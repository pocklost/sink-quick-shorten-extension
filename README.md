# Sink Short-Link Extension

Chrome Extension／A fast short-link tool for **[Sink](https://github.com/ccbikai/sink)**.  
⚠️ You must deploy the Sink backend yourself before using this extension.

---

## ✨ Features
- Create short links instantly  
- Custom slugs and expiration times  
- One-click shortening via right-click menu  
- Built-in link list (view, edit, delete)  
- Analytics (views, visitors, referrers — requires backend support)  

---

## 📦 Requirements
- A deployed Sink instance  
- **Site token** (your Sink dashboard login password)  
- Recommended: deploy on [Cloudflare](https://www.cloudflare.com/) (free tier works)

---

## 🖥 Installation

### Manual Install (Developer Mode)
1. Download this repository (`Code → Download ZIP`) and unzip.  
2. Open your browser extensions page:  
   - Chrome: `chrome://extensions/`  
   - Edge: `edge://extensions/`  
3. Enable **Developer mode** (top right).  
4. Click **Load unpacked** and select the unzipped folder.  

---

## 🚀 Deployment & Guides
- Source & docs: [github.com/ccbikai/sink](https://github.com/ccbikai/sink)  
- Step-by-step (Cloudflare): [fossengineer.com guide](https://fossengineer.com/sink-url-shortener-setup/)  
- Video tutorial: [YouTube](https://youtu.be/MkU23U2VE9E)

---

## 🔧 Usage
1. Open the extension menu → **Settings** tab.  
2. Enter your Sink host and site token.  
3. Switch to the **Create** tab, paste the target URL.  
   - (Optional) set slug/expiration  
   - Click **Create & Copy** → short link copied to clipboard  
4. Or right-click any page → **Shorten with Sink** to generate instantly.

---

## 🔒 Permissions
- **Active tab URL** → auto-fills target URL  
- **Context menus** → quick shortening  
- **Clipboard** → auto-copies new short link  

---

## 🛡 Privacy
This extension **collects no personal data**.  
All links are stored and managed entirely by **your self-hosted Sink service**.
