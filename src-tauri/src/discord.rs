use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::time::{Duration, Instant};
use crate::config::Config;

pub struct DiscordState {
    pub client: Option<DiscordIpcClient>,
    pub current_app_id: Option<String>,
    pub last_error_time: Option<Instant>,
    pub privacy_mode: bool,
    pub config: Config,
}

impl DiscordState {
    pub fn new(config: Config) -> Self {
        Self {
            client: None,
            current_app_id: None,
            last_error_time: None,
            privacy_mode: false,
            config,
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
            return Ok(());
        }

        if let Some(last_error) = self.last_error_time {
            if last_error.elapsed() < Duration::from_secs(10) {
                return Err("Waiting for connection cooldown...".into());
            }
        }

        if let Some(mut client) = self.client.take() {
            let _ = client.close();
        }

        let mut client = DiscordIpcClient::new(app_id);
        match client.connect() {
            Ok(_) => {
                self.client = Some(client);
                self.current_app_id = Some(app_id.to_string());
                self.last_error_time = None;
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
        // 1. Find platform and clone needed info to satisfy borrow checker
        let platform_info = self.config.categories.iter()
            .flat_map(|c| &c.platforms)
            .find(|p| p.id == payload.platform_id)
            .cloned();

        if let Some(p) = platform_info {
            // 2. Connect (Mutable borrow of self happens here)
            if let Err(_) = self.connect(&p.discord_app_id) {
                return;
            }

            // 3. Update activity
            if let Some(client) = &mut self.client {
                let activity_type = match p.activity_type.as_str() {
                    "Listening" => activity::ActivityType::Listening,
                    "Playing" => activity::ActivityType::Playing,
                    "Watching" => activity::ActivityType::Watching,
                    "Competing" => activity::ActivityType::Competing,
                    _ => activity::ActivityType::Watching,
                };

                let mut activity = activity::Activity::new()
                    .activity_type(activity_type);

                let is_shorts = payload.is_shorts.unwrap_or(false);
                let feature = if is_shorts {
                    p.features.iter().find(|f| f.id == "youtube_shorts").cloned()
                } else {
                    None
                };

                // Handle Privacy Mode or normal details
                let is_spotify = payload.platform_id == "spotify";

                if self.privacy_mode {
                    let details = if is_spotify {
                        "Listening to Music"
                    } else {
                        feature.as_ref().map(|f| &f.name).unwrap_or(&p.name)
                    };
                    activity = activity.details(details);
                    if !is_spotify {
                        activity = activity.state("Privacy Active");
                    }
                } else {
                    activity = activity.details(&payload.details);
                    if !payload.state.is_empty() {
                        activity = activity.state(&payload.state);
                    }
                }

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
                    let icon = if is_spotify { "spotify-icon" } else if is_shorts { "youtube-shorts-icon" } else { &p.large_image_key };
                    let name = if is_spotify { "Spotify" } else { feature.as_ref().map(|f| &f.name).unwrap_or(&p.name) };
                    assets = assets.large_image(icon).large_text(name);
                } else {
                    // 1. Try browser thumbnail override first
                    // 2. Then try platform/feature default icon
                    let l_image = payload.large_image_key.as_deref().unwrap_or_else(|| {
                        if is_shorts { "youtube-shorts-icon" } else { &p.large_image_key }
                    });
                    
                    let l_text = feature.as_ref().map(|f| f.name.as_str()).unwrap_or(p.name.as_str());
                    let l_text_final = payload.large_text.as_deref().unwrap_or(l_text);
                    
                    assets = assets.large_image(l_image).large_text(l_text_final);

                    if !payload.is_browsing.unwrap_or(false) {
                        let s_image = payload.small_image_key.as_deref().unwrap_or(&p.small_image_key);
                        let s_text = payload.small_text.as_deref().unwrap_or(
                            if payload.is_paused { "Paused" } else { "Playing" }
                        );
                        assets = assets.small_image(s_image).small_text(s_text);
                    }
                }
                
                activity = activity.assets(assets);

                if let Err(e) = client.set_activity(activity) {
                    eprintln!("Failed to set Discord activity: {}", e);
                }
            }
        }
    }
}
