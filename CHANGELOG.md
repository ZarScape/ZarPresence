# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] - 2026-05-03
### Added
- **Active Memory Reclaiming**: Dashboard window is now fully destroyed on close/hide, dropping WebView2 RAM usage to lowest when in the background.
- **Adaptive Background Polling**: Reduced background CPU usage by decreasing status polling frequency when the dashboard is hidden.
- **Production Asset Fix**: Corrected resource path resolution so platform configurations load correctly in built/installed versions.

### Fixed
- Fixed recursive `CloseRequested` handler that was preventing WebView2 processes from being destroyed.
- Optimized `Alt+Z` global shortcut to use the window destruction/recreation pattern for maximum RAM efficiency.
- Replaced `hide()` with `close()` in the frontend title bar to ensure immediate memory release.

## [1.0.3] - 2026-05-02
### Added
- Added Spotify support with detailed track, playlist, and profile tracking.
- Transitioned to a fully Dynamic Configuration-driven architecture (`platforms/` directory).
- Each platform now has its own dedicated JSON configuration file for better scalability.
- Implemented robust multi-tab tracking in the browser extension.
- Added background polling to keep Discord RPC live even when tabs are not focused.
- RPC now correctly clears immediately when the source platform tab is closed.
- Automatic fallback to "Playing" background tabs when the active tab is not a platform.

### Fixed
- Fixed issue where RPC would get "stuck" after closing a platform tab.
- Resolved TypeScript errors in extension content scripts.

## [1.0.2] - 2026-04-30
### Added
- **Dynamic Update System**: High-performance update checking via updates.json.
- **Repository Optimization**: Removed unused assets and template files.

## [1.0.1] - 2026-04-30
### Added
- **Auto-Updater**: Application now checks for updates and installs them automatically.
- **Single Instance Mode**: Prevents multiple copies of ZarPresence from running.
- **Improved Metadata**: Dynamic version tracking across all components.

## [1.0.0] - 2026-04-30
### Added
- **Initial Release** of ZarPresence.
- Support for **YouTube** and **YouTube Shorts**.
- Support for **Crunchyroll**.
- **Privacy Mode**: Suppress video titles and thumbnails on Discord Profile.
- **Auto-Startup**: Option to launch ZarPresence with Windows.
- **Modern Dashboard**: A complete React-based UI for managing presence settings.
- **WebSocket Bridge**: Real-time communication between browser extension and desktop client.
