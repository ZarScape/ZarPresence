// No longer using serde here
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::time::{Duration, Instant};
// Removed unused sync imports

pub struct DiscordState {
    pub client: Option<DiscordIpcClient>,
    pub current_app_id: Option<String>,
    pub last_error_time: Option<Instant>,
    pub privacy_mode: bool,
}

impl DiscordState {
    pub fn new() -> Self {
        Self {
            client: None,
            current_app_id: None,
            last_error_time: None,
            privacy_mode: false,
        }
    }

    pub fn disconnect(&mut self) {
        if let Some(mut client) = self.client.take() {
            let _ = client.close();
        }
        self.current_app_id = None;
    }

    pub fn connect(&mut self, app_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if self.current_app_id.as_deref() == Some(app_id) && self.client.is_some() {
            return Ok(()); // Already connected to this app
        }

        // Rate limit connection attempts on failure
        if let Some(last_error) = self.last_error_time {
            if last_error.elapsed() < Duration::from_secs(10) {
                return Err("Waiting for connection cooldown...".into());
            }
        }

        // Close existing
        if let Some(mut client) = self.client.take() {
            let _ = client.close();
        }

        let mut client = DiscordIpcClient::new(app_id);
        match client.connect() {
            Ok(_) => {
                self.client = Some(client);
                self.current_app_id = Some(app_id.to_string());
                self.last_error_time = None;
                println!("Connected to Discord with App ID: {}", app_id);
                Ok(())
            }
            Err(e) => {
                self.last_error_time = Some(Instant::now());
                Err(Box::new(e))
            }
        }
    }

    pub fn clear(&mut self) {
        if let Some(client) = &mut self.client {
            let _ = client.clear_activity();
        }
    }

    pub fn update(&mut self, payload: &crate::ws::ActivityPayload) {
        if let Some(client) = &mut self.client {
            println!("Updating Discord presence [{}]: {} - {} (Watching mode, Privacy: {})", 
                payload.platform_id, payload.details, payload.state, self.privacy_mode);
            
            let mut activity = activity::Activity::new()
                .activity_type(activity::ActivityType::Watching);

            if self.privacy_mode {
                let platform_name = match payload.platform_id.as_str() {
                    "crunchyroll" => "Crunchyroll",
                    "youtube" => {
                        if payload.is_shorts.unwrap_or(false) { "YouTube Shorts" } else { "YouTube" }
                    },
                    _ => "ZarPresence",
                };
                activity = activity.details(platform_name);
            } else {
                activity = activity.details(&payload.details);
                if !payload.state.is_empty() {
                    activity = activity.state(&payload.state);
                }
            }

            let is_browsing = payload.is_browsing.unwrap_or(false);

            // Timestamps
            if !self.privacy_mode {
                let mut timestamps = activity::Timestamps::new();
                let mut has_timestamps = false;
                if let Some(start) = payload.timestamp_start {
                    timestamps = timestamps.start(start);
                    has_timestamps = true;
                }
                if let Some(end) = payload.timestamp_end {
                    timestamps = timestamps.end(end);
                    has_timestamps = true;
                }
                if has_timestamps {
                    activity = activity.timestamps(timestamps);
                }
            }

            // Assets
            let mut assets = activity::Assets::new();

            if self.privacy_mode {
                let icon_key = match payload.platform_id.as_str() {
                    "crunchyroll" => "crunchyroll-icon",
                    "youtube" => {
                        if payload.is_shorts.unwrap_or(false) { "youtube-shorts-icon" } else { "youtube-icon" }
                    },
                    _ => "logo-icon",
                };
                assets = assets.large_image(icon_key);
                
                let platform_name = match payload.platform_id.as_str() {
                    "crunchyroll" => "Crunchyroll",
                    "youtube" => {
                        if payload.is_shorts.unwrap_or(false) { "YouTube Shorts" } else { "YouTube" }
                    },
                    _ => "ZarPresence",
                };
                assets = assets.large_text(platform_name);
            } else {
                if let Some(large_image) = &payload.large_image_key {
                    assets = assets.large_image(large_image);
                } else {
                    assets = assets.large_image(if payload.is_shorts.unwrap_or(false) { "youtube-shorts-icon" } else { "youtube-icon" });
                }

                if let Some(large_text) = &payload.large_text {
                    assets = assets.large_text(large_text);
                } else {
                    assets = assets.large_text(if payload.is_shorts.unwrap_or(false) { "YouTube Shorts" } else { "YouTube" });
                }
            }

            // Only show play/pause small image if NOT browsing and NOT in privacy mode
            if !is_browsing && !self.privacy_mode {
                if let Some(small_image) = &payload.small_image_key {
                    assets = assets.small_image(small_image);
                } else {
                    assets = assets.small_image(if payload.is_paused { "pause" } else { "play" });
                }

                if let Some(small_text) = &payload.small_text {
                    assets = assets.small_text(small_text);
                } else {
                    assets = assets.small_text(if payload.is_paused { "Paused" } else { "Playing" });
                }
            }
            
            activity = activity.assets(assets);

            if let Err(e) = client.set_activity(activity) {
                eprintln!("Failed to set Discord activity: {}", e);
            }
        }
    }
}
