# ZarPresence

<p align="center">
  <img src="src/extension/assets/logo-transparent.png" width="128" height="128" alt="ZarPresence Logo" />
</p>

**Modern Discord Rich Presence, redefined.**  
ZarPresence is a high-performance, configuration-driven presence tracker that streams your activity from the browser directly to Discord with zero latency.

---

### 🚀 Key Features

- **Dynamic Platform Discovery**: Powered by a modular JSON configuration system. Adding new platforms requires almost zero code changes.
- **Full Spotify Integration**: Track your music, playlists, and user profiles with beautiful, real-time status updates.
- **Robust Multi-Tab Tracking**: Intelligent background polling keeps your Discord status "live" even when you're browsing in other tabs.
- **Smart Privacy Mode**: A single master toggle to hide sensitive content (titles, artists, thumbnails) across all platforms instantly.
- **Premium Dashboard**: A stunning, high-performance UI built with React and TailwindCSS, featuring glassmorphism and dynamic dark/light modes.
- **Native Performance**: Built with Rust and Tauri for a lightweight footprint and lightning-fast execution.

### 🎮 Currently Supported

- **YouTube**: Full video tracking + integrated **YouTube Shorts** support.
- **Spotify**: Detailed track, playlist, and profile presence.
- **Crunchyroll**: Anime streaming with episode and series metadata.
- *(More platforms coming soon)*

---

### 🛠️ Installation

#### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS)
- [Rust](https://rustup.rs/) (For Tauri backend)

#### Development Setup
```bash
# Install dependencies
npm install

# Build the browser extension
npm run build:extension

# Launch the desktop dashboard in dev mode
npm run tauri dev
```

#### Production Build
```bash
# Build the production binaries and installers
npm run tauri build
```

---

### 🧩 Browser Extension
To use ZarPresence, you must load the companion extension:
1. Open Chrome/Edge/Brave and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist-extension` folder.

---

### 📄 License
ZarPresence is licensed under the **GPL-3.0 License**.

---
<p align="center">
  Built with ❤️ by <b><a href="https://github.com/ZarScape">ZarScape</a></b>
</p>
