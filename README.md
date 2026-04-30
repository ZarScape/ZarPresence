# ZarPresence 🚀
> **Modern Discord Rich Presence, redefined.**

ZarPresence is a premium, privacy-focused Discord Rich Presence (RPC) bridge that seamlessly syncs your activity from **YouTube**, **YouTube Shorts**, and **Crunchyroll** to your Discord profile.

![ZarPresence Banner](src/extension/assets/hero.png)

## ✨ Features

- **🎬 Multi-Platform Support**: Full support for YouTube (including Shorts) and Crunchyroll.
- **🛡️ Privacy Mode**: One-click metadata suppression. Hide video titles, thumbnails, and timestamps while still showing your platform status.
- **🚀 Ultra-Fast Sync**: Real-time WebSocket bridge between your browser and Discord.
- **🎨 Premium UI**: Sleek, modern dashboard with dark/light mode and glassmorphism aesthetics.
- **🖥️ System Tray Integration**: Runs quietly in the background; stays active even when the main window is closed.
- **🔄 Smart Reconnect**: Robust RPC connection management with built-in cooldowns and status monitoring.

## 🛠️ Architecture

ZarPresence is built using a modern, high-performance stack:
- **Desktop Client**: [Tauri](https://tauri.app/) + [Rust](https://www.rust-lang.org/) (Performance & Safety)
- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS](https://tailwindcss.com/)
- **Extension**: Manifest V3 Content Scripts & Background Service Workers

## 🚀 Getting Started

### 1. Requirements
- [Node.js](https://nodejs.org/) (Latest LTS)
- [Rust](https://www.rust-lang.org/tools/install) (Tauri build requirement)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/ZarScape/ZarPresence.git

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### 3. Browser Extension
1. Build the extension: `npm run build:extension`
2. Open your browser's extension page (e.g., `chrome://extensions`).
3. Enable **Developer Mode**.
4. Click **Load Unpacked** and select the `dist-extension` folder.

## ⚖️ License

Distributed under the **GPL-3.0 License**. See `LICENSE` for more information.

---

Built with ❤️ by **ZarScape**
