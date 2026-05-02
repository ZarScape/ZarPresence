export interface PlatformConfig {
  id: string;
  name: string;
  discord_app_id: string;
  match_url: string;
  large_image_key: string;
  small_image_key: string;
  enabled: boolean;
  color?: string;
  description?: string;
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