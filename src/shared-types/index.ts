export interface PlatformConfig {
  id: string;
  name: string;
  discord_app_id: string;
  match_url: string;
  large_image_key: string;
  small_image_key: string;
  enabled: boolean;
}

export interface Settings {
  platforms: PlatformConfig[];
}

export interface ActivityPayload {
  platform_id: string;
  details: string;
  state: string;
  timestamp_start?: number;
  timestamp_end?: number;
  is_paused: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  platforms: [
    {
      id: "youtube",
      name: "YouTube",
      discord_app_id: "1497547763028856945",
      match_url: "*://*.youtube.com/*",
      large_image_key: "youtube-icon",
      small_image_key: "play",
      enabled: true,
    },
    {
      id: "crunchyroll",
      name: "Crunchyroll",
      discord_app_id: "1498675988844773426",
      match_url: "*://*.crunchyroll.com/*",
      large_image_key: "crunchyroll-icon",
      small_image_key: "play",
      enabled: true,
    },
  ],
};