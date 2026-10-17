# Kiaan Central License Server (Multi-Product DRM)

This is the standalone **Central License Management Server** designed to handle domain activations, heartbeats, and Codester/CodeCanyon sales for all your software products (BioTrack Pro, Clinic Management, POS, etc.).

---

## 🌟 Key Capabilities
* **Codester Order ID Support:** Add Codester Order numbers (e.g., `#104529`) or auto-generated keys.
* **Domain Binding:** Binds each license to exactly 1 production live domain (`clientdomain.com`).
* **Domain Transfer / Reset:** 1-Click "Reset Domain" button in admin dashboard to allow buyers to move servers.
* **Non-Blocking Architecture:** Compatible with the client app's 14-day offline grace period.
* **Zero Database Setup:** Uses robust persistent JSON storage out of the box (no MongoDB or MySQL setup required).

---

## 🚀 Quick Setup & Deployment

### 1. Install Dependencies
```bash
cd Central-License-Server
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=7000
ADMIN_PASSWORD=YourSecureAdminPassword123!
JWT_SECRET=your_super_secret_signing_key_here
```

### 3. Start the Server
```bash
npm start
```
The server will start at: `http://localhost:7000`

---

## 🌐 Deploying to `license.kiaantechnology.com`

You can deploy this folder to any VPS (Ubuntu/Nginx) or cloud provider (Render, Railway, DigitalOcean):

### Nginx Reverse Proxy Config (Example)
```nginx
server {
    server_name license.kiaantechnology.com;

    location / {
        proxy_pass http://localhost:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🛡️ Admin Dashboard Usage
1. Open `https://license.kiaantechnology.com` in your browser.
2. Enter your `ADMIN_PASSWORD`.
3. When you make a sale on Codester:
   * Click **"Add Codester Sale / Generate Key"**.
   * Enter the **Codester Order ID** (e.g., `#104529`) and Buyer Name.
   * Click **Save & Issue**.
4. The buyer simply enters that Order ID during setup on their live domain!
