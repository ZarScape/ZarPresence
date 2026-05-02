import config from '../config/platforms/youtube.json';

// YouTube Content Script for ZarPresence
let lastUrl = location.href;
let updateInterval: number | null = null;
let browsingStartTime = Math.floor(Date.now() / 1000);

const templates = config.display_templates;

function scrapeYouTubeData() {
  const path = window.location.pathname;
  const isVideoPage = path === "/watch";
  const isShortsPage = path.startsWith("/shorts/");
  const isSearchPage = path === "/results";
  const isHomePage = path === "/" || path.startsWith("/feed/");

  // Base payload for YouTube
  const baseData = {
    platform_id: "youtube",
    is_paused: false,
    is_shorts: false,
    is_browsing: false
  };

  // Logic for Search, Home, and generic Exploring
  if (isSearchPage || isHomePage || (!isVideoPage && !isShortsPage)) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('search_query') || "";
    
    let details = templates.exploring || "Exploring YouTube";
    let state = "";

    if (isSearchPage) {
        details = templates.searching || "Searching";
        state = query ? (templates.search_state ? templates.search_state.replace('{query}', query) : `"${query}"`) : (templates.search_fallback || "YouTube");
    } else if (isHomePage) {
        details = templates.home || "YouTube Home";
        state = "";
    }

    const icons = (templates as any).icons || {};

    return {
      ...baseData,
      details,
      state,
      is_browsing: true,
      timestamp_start: browsingStartTime, // Acts as a stopwatch
      small_image_key: icons.exploring || "youtube-icon",
      small_text: icons.exploring_text || "Exploring"
    };
  }

  // Handle Video and Shorts
  if (isVideoPage || isShortsPage) {
    let title: string | null = null;
    let channel: string | null = null;
    let videoElement: HTMLVideoElement | null = null;

    // First, find the active video element.
    if (isShortsPage) {
      const videos = document.querySelectorAll('video');
      const middleY = window.innerHeight / 2;
      for (let i = 0; i < videos.length; i++) {
        const rect = videos[i].getBoundingClientRect();
        if (rect.height > 0 && rect.top <= middleY && rect.bottom >= middleY) {
          videoElement = videos[i];
          break;
        }
      }
      if (!videoElement) videoElement = document.querySelector('video'); 
    } else {
      videoElement = document.querySelector('video');
    }

    // Second, extract the title and channel specifically tied to that video!
    if (videoElement) {
      if (isShortsPage) {
        // Find the container specific to the current Short
        let activeContainer = videoElement.closest('ytd-reel-video-renderer') || videoElement.closest('.ytd-reel-video-renderer');
        
        // If we somehow can't find the parent container based on the video element, 
        // fallback to YouTube's 'is-active' attribute on the document level.
        if (!activeContainer) {
            activeContainer = document.querySelector('ytd-reel-video-renderer[is-active]') || 
                              document.querySelector('ytd-reel-video-renderer[active]');
        }

        if (activeContainer) {
          const titleEl = activeContainer.querySelector('h2.title') || 
                          activeContainer.querySelector('.reel-video-info-renderer h2') || 
                          activeContainer.querySelector('yt-reel-metapanel-metadata-renderer h2') ||
                          activeContainer.querySelector('h2.reel-player-header-renderer') ||
                          activeContainer.querySelector('h2'); // Ultimate title fallback

          // The most bulletproof way to find the channel name: 
          // YouTube channel names are ALWAYS links that start with "/@" (their handle).
          const channelEl = activeContainer.querySelector('ytd-channel-name a') ||
                            activeContainer.querySelector('#channel-name a') ||
                            activeContainer.querySelector('a[href^="/@"]') || // Handles like /@MrBeast
                            activeContainer.querySelector('a[href^="/channel/"]') || // Old channel URLs
                            activeContainer.querySelector('a[href^="/c/"]');
          
          if (titleEl) title = (titleEl as HTMLElement).textContent?.trim() || null;
          if (channelEl) channel = (channelEl as HTMLElement).textContent?.trim() || null;
        }
      } else if (isVideoPage) {
        // Standard video page
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') || 
                        document.querySelector('ytd-video-primary-info-renderer h1') ||
                        document.querySelector('#title h1');
        const channelEl = document.querySelector('ytd-channel-name yt-formatted-string a') ||
                          document.querySelector('#owner-name a') ||
                          document.querySelector('#upload-info ytd-channel-name a') ||
                          document.querySelector('.ytd-channel-name a');
        
        if (titleEl) title = (titleEl as HTMLElement).textContent?.trim() || null;
        if (channelEl) channel = (channelEl as HTMLElement).textContent?.trim() || null;
      }
    }

    // Always use document.title as the ultimate fallback for the title because it ALWAYS updates correctly in YouTube's SPA
    if (!title) {
        title = document.title.replace(" - YouTube", "").replace(/^\(\d+\)\s*/, ""); // Also strips notification counts like "(3) "
    }

    // NEVER use <link itemprop="name"> or <meta property="og:title"> on SPAs! They do not update when you scroll!
    // If the DOM scraper fails, it will fall back to "YouTube" instead of showing a stale channel name.

      if (title && videoElement) {
      // Clean up channel name
      let channelName = channel || "YouTube";
      channelName = channelName.replace(/^(by|By)\s+/, '').trim();

      const isPaused = videoElement.paused;
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      const now = Math.floor(Date.now() / 1000);
      let timestamp_start: number | undefined = undefined;
      let timestamp_end: number | undefined = undefined;

      if (isPaused) {
          // Show total YouTube usage time when paused
          timestamp_start = browsingStartTime;
      } else if (duration > 0) {
          const isLive = document.querySelector('.ytp-live') !== null;
          if (!isLive) {
              timestamp_start = now - Math.floor(currentTime);
              timestamp_end = now + Math.floor(duration - currentTime);
          } else {
              timestamp_start = now - Math.floor(currentTime);
          }
      }

      // Extract Video ID for thumbnail
      let videoId: string | null = null;
      if (isShortsPage) {
          videoId = path.split('/shorts/')[1]?.split('/')[0] || null;
      } else if (isVideoPage) {
          const urlParams = new URLSearchParams(window.location.search);
          videoId = urlParams.get('v');
      }

      const large_image_key = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : undefined;
      const icons = (templates as any).icons || {};
      const small_image_key = isShortsPage ? (icons.shorts || "youtube-shorts-icon") : (icons.playing || "play");
      const small_text = isShortsPage ? (icons.shorts_text || "YouTube Shorts") : (icons.playing_text || "Playing");

      return {
        ...baseData,
        details: title,
        state: channelName,
        timestamp_start,
        timestamp_end,
        is_paused: isPaused,
        is_shorts: isShortsPage,
        large_image_key,
        large_text: title,
        small_image_key,
        small_text
      };
    }
  }

  return null; 
}

function sendData() {
  const data = scrapeYouTubeData();
  if (data) {
    chrome.runtime.sendMessage(data).catch(() => {});
  }
}

// Start observing
function startObserving() {
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = window.setInterval(() => {
      // Always send data to keep the background Service Worker alive.
      // Deduplication is handled in the background script.
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