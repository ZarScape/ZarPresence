import config from '../config/platforms/spotify.json';

// Spotify Content Script for ZarPresence
let lastUrl = location.href;
let updateInterval: number | null = null;
let browsingStartTime = Math.floor(Date.now() / 1000);

const templates = config.display_templates;

function fillTemplate(template: string, data: Record<string, string>) {
    return template.replace(/{(\w+)}/g, (_, key) => data[key] || "");
}

function scrapeSpotifyData() {
    const path = window.location.pathname;
    const isPlaylistPage = path.startsWith("/playlist/");
    const isProfilePage = path.startsWith("/user/");
    const isSearchPage = path.startsWith("/search");
    const isHomePage = path === "/" || path === "/home" || path === "/section/0JQ5DAqbVfvxeqQEaa9vY6";

    const baseData = {
        platform_id: "spotify",
        is_paused: false,
        is_browsing: false,
        large_image_key: "spotify-icon",
        large_text: "Spotify"
    };

    const icons = (templates as any).icons || {};

    // 1. Check if music is playing
    const titleEl = document.querySelector('[data-testid="now-playing-widget"] [data-testid="context-item-link"]') ||
                    document.querySelector('[data-testid="now-playing-widget"] a[href^="/track/"]');
    const artistEl = document.querySelector('[data-testid="now-playing-widget"] [data-testid="context-item-info-artist"]');
    const albumArtEl = document.querySelector('[data-testid="now-playing-widget"] img');
    const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
    
    const positionEl = document.querySelector('[data-testid="playback-position"]');
    const durationEl = document.querySelector('[data-testid="playback-duration"]');

    if (titleEl && artistEl) {
        const title = titleEl.textContent?.trim() || "Unknown Song";
        const artist = artistEl.textContent?.trim() || "Unknown Artist";
        const albumArt = (albumArtEl as HTMLImageElement)?.src || "spotify-icon";
        
        const ariaLabel = playPauseBtn?.getAttribute('aria-label') || "";
        const isPaused = ariaLabel.toLowerCase().includes("play");

        const now = Math.floor(Date.now() / 1000);
        let timestamp_start: number | undefined = undefined;
        let timestamp_end: number | undefined = undefined;

        if (!isPaused && positionEl && durationEl) {
            const parseTime = (timeStr: string) => {
                const parts = timeStr.split(':').map(p => parseInt(p, 10));
                if (parts.length === 2) return (parts[0] * 60) + parts[1];
                if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                return 0;
            };

            const posSec = parseTime(positionEl.textContent || "0:00");
            const durSec = parseTime(durationEl.textContent || "0:00");

            if (durSec > 0) {
                timestamp_start = now - posSec;
                timestamp_end = now + (durSec - posSec);
            }
        }

        return {
            ...baseData,
            details: artist,
            state: fillTemplate(templates.playing_state || "", { artist }),
            is_paused: isPaused,
            timestamp_start,
            timestamp_end,
            large_image_key: albumArt,
            large_text: title,
            small_image_key: icons.playing || "play-icon",
            small_text: icons.playing_text || "Playing"
        };
    }

    // 2. Handle specific pages if not playing
    if (isPlaylistPage) {
        const titleEl = document.querySelector('[data-testid="playlist-page"] h1') || 
                        document.querySelector('h1[dir="auto"]') || 
                        document.querySelector('h1');
        const imgEl = document.querySelector('[data-testid="playlist-page"] img') || 
                      document.querySelector('[data-testid="entity-image"] img') ||
                      document.querySelector('img[src^="https://mosaic.scdn.co/"]') ||
                      document.querySelector('img[src^="https://i.scdn.co/image/"]');
        
        const playlistName = titleEl?.textContent?.trim() || "Playlist";
        const imageUrl = (imgEl as HTMLImageElement)?.src || "spotify-icon";

        return {
            ...baseData,
            details: fillTemplate(templates.playlist || "Viewing Playlist", { name: playlistName }),
            state: "",
            is_browsing: true,
            timestamp_start: browsingStartTime,
            large_image_key: imageUrl,
            large_text: playlistName,
            small_image_key: icons.playlist || "playlist-icon",
            small_text: icons.playlist_text || "Exploring"
        };
    }

    if (isProfilePage) {
        const titleEl = document.querySelector('[data-testid="profile-page"] h1') || 
                        document.querySelector('h1');
        const imgEl = document.querySelector('[data-testid="profile-page"] img') || 
                      document.querySelector('img[alt="Profile picture"]') ||
                      document.querySelector('img[src^="https://i.scdn.co/image/"]');
        
        const userName = titleEl?.textContent?.trim() || "User";
        const imageUrl = (imgEl as HTMLImageElement)?.src || "spotify-icon";

        return {
            ...baseData,
            details: fillTemplate(templates.profile || "Viewing Profile", { name: userName }),
            state: "",
            is_browsing: true,
            timestamp_start: browsingStartTime,
            large_image_key: imageUrl,
            large_text: userName,
            small_image_key: icons.profile || "profile-icon",
            small_text: icons.profile_text || "User Profile"
        };
    }

    if (isSearchPage) {
        const searchInput = document.querySelector('input[data-testid="search-input"]') as HTMLInputElement;
        const query = searchInput?.value || "";

        return {
            ...baseData,
            details: templates.search || "Searching",
            state: query ? fillTemplate(templates.search_state || "", { query }) : "",
            is_browsing: true,
            timestamp_start: browsingStartTime,
            small_image_key: icons.search || "search-icon",
            small_text: icons.search_text || "Searching"
        };
    }

    if (isHomePage) {
        return {
            ...baseData,
            details: templates.home || "Browsing Home",
            state: templates.home_state || "",
            is_browsing: true,
            timestamp_start: browsingStartTime
        };
    }

    // Fallback
    return {
        ...baseData,
        details: "Browsing Spotify",
        state: "",
        is_browsing: true,
        timestamp_start: browsingStartTime
    };
}

function sendData() {
    const data = scrapeSpotifyData();
    if (data) {
        chrome.runtime.sendMessage(data).catch(() => {});
    }
}

// Start observing
function startObserving() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = window.setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
        }
        sendData();
    }, 2000);
}

startObserving();

chrome.runtime.onMessage.addListener((message: any) => {
    if (message.type === "REQUEST_UPDATE") {
        sendData();
    }
});
