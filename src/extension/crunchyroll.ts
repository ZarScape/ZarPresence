import config from '../config/platforms/crunchyroll.json';

// Crunchyroll Content Script for ZarPresence
let lastUrl = location.href;
let updateInterval: number | null = null;
let browsingStartTime = Math.floor(Date.now() / 1000);

const templates = config.display_templates;

function parseDurationToSeconds(duration: string): number {
    // Duration format: PT23M33.718000000000075S
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseFloat(match[3] || "0");
    return (hours * 3600) + (minutes * 60) + seconds;
}

function scrapeCrunchyrollData() {
    const path = window.location.pathname;
    const isSeriesPage = path.startsWith("/series/");
    const isWatchPage = path.startsWith("/watch/");

    const baseData = {
        platform_id: "crunchyroll",
        is_paused: false,
        is_browsing: false,
        large_image_key: "crunchyroll-icon",
        large_text: "Crunchyroll"
    };

    if (isSeriesPage) {
        let seriesName = "Loading...";
        let imageUrl = "crunchyroll-icon";

        // Parse ld+json
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent || "{}");
                if (data["@type"] === "TVSeries") {
                    seriesName = data.name || seriesName;
                    imageUrl = data.image || imageUrl;
                    break;
                }
            } catch (e) {
                // ignore JSON parse errors
            }
        }

        return {
            ...baseData,
            details: templates.series || "Viewing Series",
            state: seriesName,
            is_browsing: true,
            timestamp_start: browsingStartTime,
            large_image_key: imageUrl,
            large_text: seriesName,
            small_image_key: ((templates as any).icons?.series) || "crunchyroll-icon",
            small_text: ((templates as any).icons?.series_text) || "Viewing Series"
        };
    }

    if (isWatchPage) {
        let seriesName = "Loading Series Name...";
        let episodeName = "...";
        let imageUrl = "crunchyroll-icon";
        let seasonText = "";
        let durationSeconds = 0;

        // Parse ld+json
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent || "{}");
                if (data["@type"] === "TVEpisode") {
                    episodeName = data.name || episodeName;
                    imageUrl = data.thumbnailUrl || data.image || imageUrl;
                    if (data.partOfSeries && data.partOfSeries.name) {
                        seriesName = data.partOfSeries.name;
                    }
                    if (data.partOfSeason && data.partOfSeason.name) {
                        seasonText = data.partOfSeason.name;
                    }
                } else if (data["@type"] === "VideoObject") {
                    episodeName = data.name || episodeName;
                    if (data.duration) {
                        durationSeconds = parseDurationToSeconds(data.duration);
                    }
                    if (data.thumbnailUrl && data.thumbnailUrl.length > 0) {
                        imageUrl = data.thumbnailUrl[0];
                    }
                }
            } catch (e) {
                // ignore JSON parse errors
            }
        }

        const videoElement = document.querySelector('video');
        let timestamp_start: number | undefined = undefined;
        let timestamp_end: number | undefined = undefined;
        let isPaused = false;

        if (videoElement) {
            isPaused = videoElement.paused;
            const currentTime = videoElement.currentTime || 0;
            // Handle NaN and Infinity which are common in HLS streams
            let duration = videoElement.duration;
            if (isNaN(duration) || duration === Infinity || duration === 0) {
                duration = durationSeconds;
            }

            const now = Math.floor(Date.now() / 1000);

            if (isPaused) {
                timestamp_start = browsingStartTime;
            } else {
                // Always set start time so we at least get "Elapsed" time if duration is broken
                timestamp_start = now - Math.floor(currentTime);
                
                // Only set end time if we have a valid duration
                if (duration && !isNaN(duration) && duration > 0 && duration !== Infinity) {
                    timestamp_end = now + Math.floor(duration - currentTime);
                }
            }
        }

        // Clean up episode name (often Crunchyroll puts the season name inside the episode name in TVEpisode block)
        // If series name is in episode name, we try to strip it, but it's risky. 
        // Let's just use what we have.

        return {
            ...baseData,
            details: seriesName,
            state: episodeName,
            is_paused: isPaused,
            timestamp_start,
            timestamp_end,
            large_image_key: imageUrl,
            large_text: seasonText || episodeName,
            small_image_key: ((templates as any).icons?.playing) || "play",
            small_text: ((templates as any).icons?.playing_text) || "Watching"
        };
    }

    // Home / Exploring
    return {
        ...baseData,
        details: templates.home || "Browsing Anime",
        state: "",
        is_browsing: true,
        timestamp_start: browsingStartTime,
        small_image_key: ((templates as any).icons?.browsing) || "crunchyroll-icon",
        small_text: ((templates as any).icons?.browsing_text) || "Browsing Anime"
    };
}

function sendData() {
    const data = scrapeCrunchyrollData();
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
            // Reset browsing time if navigating to a new watch page?
            // Actually, keep it as total browsing time.
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
