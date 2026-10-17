const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'licenses.json');

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    const initialData = [
        {
            id: 'lic_1',
            product: 'biotrack-pro',
            license_key: 'KT-PRO-2026-DEMO',
            order_id: '#104529',
            customer_name: 'Codester Verified Buyer',
            customer_email: 'buyer@example.com',
            license_type: 'REGULAR',
            channel: 'Codester',
            bound_domain: null,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            activated_at: null,
            last_verified_at: null
        },
        {
            id: 'lic_2',
            product: 'biotrack-pro',
            license_key: 'KT-PRO-2026-SAAS',
            order_id: '#104530',
            customer_name: 'Enterprise Client',
            customer_email: 'saas@enterprise.com',
            license_type: 'EXTENDED',
            channel: 'Codester',
            bound_domain: null,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            activated_at: null,
            last_verified_at: null
        }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

function readData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Database read error:', err.message);
        return [];
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('Database write error:', err.message);
        return false;
    }
}

const db = {
    getAllLicenses() {
        return readData();
    },

    getLicenseById(id) {
        const licenses = readData();
        return licenses.find(l => l.id === id);
    },

    findLicense(key, product) {
        const licenses = readData();
        const searchKey = (key || '').trim().toLowerCase();
        return licenses.find(l => {
            const matchKey = (l.license_key || '').toLowerCase() === searchKey;
            const matchOrder = (l.order_id || '').toLowerCase() === searchKey ||
                               (l.order_id || '').replace(/^#/, '').toLowerCase() === searchKey.replace(/^#/, '');
            
            const matchProduct = !product || (l.product || '').toLowerCase() === product.toLowerCase();
            return (matchKey || matchOrder) && matchProduct;
        });
    },

    createLicense({ product, key, orderId, customerName, customerEmail, licenseType, channel }) {
        const licenses = readData();
        const newLicense = {
            id: `lic_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            product: (product || 'biotrack-pro').toLowerCase().trim(),
            license_key: key || orderId || `KT-PRO-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            order_id: orderId || null,
            customer_name: customerName || 'Marketplace Buyer',
            customer_email: customerEmail || '',
            license_type: licenseType || 'REGULAR',
            channel: channel || 'Codester',
            bound_domain: null,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            activated_at: null,
            last_verified_at: null
        };
        licenses.unshift(newLicense);
        writeData(licenses);
        return newLicense;
    },

    bindDomain(id, domain) {
        const licenses = readData();
        const item = licenses.find(l => l.id === id);
        if (!item) return null;

        item.bound_domain = domain;
        item.activated_at = item.activated_at || new Date().toISOString();
        item.last_verified_at = new Date().toISOString();
        writeData(licenses);
        return item;
    },

    touchVerification(id) {
        const licenses = readData();
        const item = licenses.find(l => l.id === id);
        if (item) {
            item.last_verified_at = new Date().toISOString();
            writeData(licenses);
        }
        return item;
    },

    resetDomain(id) {
        const licenses = readData();
        const item = licenses.find(l => l.id === id);
        if (item) {
            item.bound_domain = null;
            writeData(licenses);
        }
        return item;
    },

    toggleStatus(id, newStatus) {
        const licenses = readData();
        const item = licenses.find(l => l.id === id);
        if (item) {
            item.status = newStatus || (item.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE');
            writeData(licenses);
        }
        return item;
    },

    deleteLicense(id) {
        const licenses = readData();
        const filtered = licenses.filter(l => l.id !== id);
        writeData(filtered);
        return true;
    }
};

module.exports = db;
