require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 7000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'KiaanAdmin2026!';
const JWT_SECRET = process.env.JWT_SECRET || 'kiaan_super_secret_license_signing_key_987654321';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CLIENT APPLICATION ENDPOINTS ───

/**
 * POST /api/license/activate
 * Called by BioTrack Pro backend when customer activates a live domain
 */
app.post('/api/license/activate', (req, res) => {
    try {
        const { product, key, domain, customerEmail, licenseType } = req.body;
        const cleanDomain = (domain || '').replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase().trim();
        const searchKey = (key || '').trim();

        if (!searchKey || !cleanDomain) {
            return res.status(400).json({
                success: false,
                error: 'Both License Key (or Order ID) and Domain are required.'
            });
        }

        let license = db.findLicense(searchKey, product);

        // ── Option 1: Automatic Auto-Bind on First Activation ──
        if (!license) {
            if (searchKey.length >= 3) {
                license = db.createLicense({
                    product: product || 'biotrack-pro',
                    orderId: searchKey.startsWith('#') ? searchKey : `#${searchKey}`,
                    key: searchKey.startsWith('KT-') ? searchKey : null,
                    customerName: customerEmail ? customerEmail.split('@')[0] : 'Codester Verified Buyer',
                    customerEmail: customerEmail || '',
                    licenseType: licenseType || 'REGULAR',
                    channel: 'Codester (Auto-Bind)'
                });
                console.log(`⚡ Auto-registered new sale from client domain: ${cleanDomain} with reference ${searchKey}`);
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Invalid License Key or Order ID format.'
                });
            }
        }

        if (license.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                error: 'This license has been suspended or revoked. Please contact support.'
            });
        }

        // Domain binding check
        if (license.bound_domain && license.bound_domain !== cleanDomain) {
            return res.status(409).json({
                success: false,
                error: `This license is already bound to domain: ${license.bound_domain}. Please deactivate it first to transfer domains.`
            });
        }

        // Generate signed activation token
        const token = jwt.sign(
            {
                id: license.id,
                product: license.product,
                domain: cleanDomain,
                licenseType: license.license_type || licenseType || 'REGULAR'
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        const updated = db.bindDomain(license.id, cleanDomain);

        return res.json({
            success: true,
            message: 'Domain activation successful!',
            orderId: updated.order_id,
            licenseType: updated.license_type,
            token
        });
    } catch (err) {
        console.error('Activation API error:', err);
        return res.status(500).json({ success: false, error: 'Internal license server error.' });
    }
});

/**
 * POST /api/license/verify
 * Periodic heartbeat check from client application
 */
app.post('/api/license/verify', (req, res) => {
    try {
        const { product, key, domain } = req.body;
        const cleanDomain = (domain || '').replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase().trim();
        const license = db.findLicense(key, product);

        if (!license || license.status !== 'ACTIVE') {
            return res.status(403).json({ success: false, valid: false, message: 'License inactive or invalid.' });
        }

        if (license.bound_domain && license.bound_domain !== cleanDomain) {
            return res.status(409).json({ success: false, valid: false, message: 'Domain mismatch.' });
        }

        db.touchVerification(license.id);
        return res.json({
            success: true,
            valid: true,
            licenseType: license.license_type,
            lastVerifiedAt: new Date().toISOString()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Verification failed.' });
    }
});

/**
 * POST /api/license/deactivate
 * Releases the bound domain (for customer migrating servers)
 */
app.post('/api/license/deactivate', (req, res) => {
    try {
        const { product, key, domain } = req.body;
        const license = db.findLicense(key, product);
        if (license) {
            db.resetDomain(license.id);
        }
        return res.json({ success: true, message: 'Domain successfully released.' });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Deactivation failed.' });
    }
});

// ─── ADMIN DASHBOARD ENDPOINTS ───

// Auth Middleware for Admin
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header missing.' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') {
            return next();
        }
        return res.status(403).json({ success: false, error: 'Unauthorized role.' });
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }
};

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, error: 'Incorrect Admin Password.' });
});

app.get('/api/admin/licenses', adminAuth, (req, res) => {
    const licenses = db.getAllLicenses();
    return res.json({ success: true, licenses });
});

app.post('/api/admin/licenses', adminAuth, (req, res) => {
    const { product, key, orderId, customerName, customerEmail, licenseType, channel } = req.body;

    const trimmedProduct = (product || '').trim();
    const trimmedKey = (key || '').trim();
    const trimmedOrder = (orderId || '').trim();
    const trimmedName = (customerName || '').trim();

    if (!trimmedProduct || trimmedProduct.toLowerCase() === 'custom') {
        return res.status(400).json({ success: false, error: 'Valid product name is required.' });
    }

    if (!trimmedKey && !trimmedOrder) {
        return res.status(400).json({ success: false, error: 'Please enter either a Codester Order ID (e.g. #104529) or a License Key.' });
    }

    const newLicense = db.createLicense({
        product: trimmedProduct,
        key: trimmedKey,
        orderId: trimmedOrder,
        customerName: trimmedName || 'Codester Buyer',
        customerEmail: (customerEmail || '').trim(),
        licenseType: licenseType || 'REGULAR',
        channel: channel || 'Codester'
    });
    return res.json({ success: true, license: newLicense });
});

app.post('/api/admin/licenses/:id/reset-domain', adminAuth, (req, res) => {
    const updated = db.resetDomain(req.params.id);
    return res.json({ success: true, license: updated });
});

app.post('/api/admin/licenses/:id/toggle-status', adminAuth, (req, res) => {
    const updated = db.toggleStatus(req.params.id);
    return res.json({ success: true, license: updated });
});

app.delete('/api/admin/licenses/:id', adminAuth, (req, res) => {
    db.deleteLicense(req.params.id);
    return res.json({ success: true, message: 'License deleted.' });
});

app.get('/api/admin/system-stats', adminAuth, (req, res) => {
    const licenses = db.getAllLicenses();
    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = uptimeSec > 3600
        ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
        : `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`;

    return res.json({
        success: true,
        stats: {
            total: licenses.length,
            bound: licenses.filter(l => l.bound_domain).length,
            codester: licenses.filter(l => l.channel && l.channel.toLowerCase().includes('codester')).length,
            codecanyon: licenses.filter(l => l.channel && l.channel.toLowerCase().includes('codecanyon')).length,
            direct: licenses.filter(l => l.channel === 'Direct').length,
            extended: licenses.filter(l => l.license_type === 'EXTENDED').length,
            regular: licenses.filter(l => l.license_type !== 'EXTENDED').length,
            active: licenses.filter(l => l.status === 'ACTIVE').length
        },
        system: {
            nodeVersion: process.version,
            uptime: uptimeStr,
            port: PORT,
            autoBind: 'Active (Option 1 First-Activation)',
            memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
    });
});

// Serve frontend UI
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Kiaan Central License Server running on port ${PORT}`);
    console.log(`📡 Admin Dashboard: http://localhost:${PORT}`);
});
