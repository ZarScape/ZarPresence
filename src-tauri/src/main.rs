// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod discord;
mod ws;
mod install;

use std::sync::{Arc, Mutex};
use discord::DiscordState;
use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem, SystemTrayMenuItem};

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
#[cfg(target_os = "windows")]
use window_vibrancy::apply_blur;

#[tauri::command]
fn change_theme(window: tauri::Window, is_dark: bool) {
    #[cfg(target_os = "windows")]
    {
        if is_dark {
            apply_blur(&window, Some((18, 18, 18, 125))).expect("Failed to apply dark blur");
        } else {
            apply_blur(&window, Some((255, 255, 255, 125))).expect("Failed to apply light blur");
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::NSVisualEffectMaterial;
        if is_dark {
            window_vibrancy::apply_vibrancy(&window, NSVisualEffectMaterial::Dark, None, None).expect("Failed to apply dark vibrancy");
        } else {
            window_vibrancy::apply_vibrancy(&window, NSVisualEffectMaterial::Light, None, None).expect("Failed to apply light vibrancy");
        }
    }
}

#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}

#[tauri::command]
fn reconnect_rpc(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let discord_state = app_handle.state::<Arc<Mutex<DiscordState>>>();
    let mut state = discord_state.lock().unwrap();
    
    state.disconnect();
    match state.connect("1497547763028856945") {
        Ok(_) => {
            let _ = app_handle.emit_all("discord-status", true);
            Ok(true)
        },
        Err(e) => {
            let _ = app_handle.emit_all("discord-status", false);
            Err(format!("Failed to reconnect: {}", e))
        }
    }
}

#[tauri::command]
fn set_privacy_mode(app_handle: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let discord_state = app_handle.state::<Arc<Mutex<DiscordState>>>();
    let mut state = discord_state.lock().unwrap();
    state.privacy_mode = enabled;
    Ok(())
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "ZarPresence"])
            .output();
        
        if let Ok(out) = output {
            return out.status.success();
        }
    }
    false
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if enabled {
            let exe_path = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            
            let status = Command::new("reg")
                .args(&["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "ZarPresence", "/t", "REG_SZ", "/d", &exe_path, "/f"])
                .status()
                .map_err(|e| e.to_string())?;
            
            if !status.success() {
                return Err("Failed to add registry key".to_string());
            }
        } else {
            let _ = Command::new("reg")
                .args(&["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "ZarPresence", "/f"])
                .status();
        }
    }
    Ok(())
}

#[tauri::command]
async fn check_for_updates() -> Result<Option<String>, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let client = reqwest::Client::builder()
        .user_agent("ZarPresence")
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch your custom updates.json
    let res = client
        .get("https://raw.githubusercontent.com/ZarScape/ZarPresence/master/updates.json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let updates: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let latest_version = updates["version"].as_str().unwrap_or("");

    if latest_version != current_version && !latest_version.is_empty() {
        Ok(Some(latest_version.to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn install_update(version: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    // Get the download URL from the JSON
    let res = client
        .get("https://raw.githubusercontent.com/ZarScape/ZarPresence/master/updates.json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let updates: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let url = updates["platforms"]["windows-x86_64"]["url"].as_str()
        .ok_or("Could not find download URL in updates.json")?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let temp_dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let file_path = temp_dir.path().join("ZarPresence_Update.exe");
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    // Execute the installer silently
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new(file_path)
            .arg("/S") // NSIS Silent flag
            .spawn()
            .map_err(|e| e.to_string())?;
        
        // Exit the current app so the installer can replace the files
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Updates are only supported on Windows currently.".to_string());
    }
}

fn main() {
    let discord_state = Arc::new(Mutex::new(DiscordState::new()));
    let ws_discord_state = discord_state.clone();

    // Start WebSocket server in background
    tauri::async_runtime::spawn(async move {
        ws::start_server(ws_discord_state).await;
    });

    let quit = CustomMenuItem::new("quit".to_string(), "Quit ZarPresence");
    let show = CustomMenuItem::new("show".to_string(), "Show Dashboard");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(discord_state.clone())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| {
            let handle_show = || {
                if let Some(window) = app.get_window("main") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                } else {
                    // Rebuild window from scratch to save RAM when hidden
                    let window = tauri::WindowBuilder::new(
                        app,
                        "main",
                        tauri::WindowUrl::App("index.html".into())
                    )
                    .title("ZarPresence")
                    .inner_size(1000.0, 700.0)
                    .min_inner_size(800.0, 500.0)
                    .decorations(false)
                    .transparent(true)
                    .build()
                    .unwrap();

                    // Initial check for Discord
                    let discord_state = app.state::<Arc<Mutex<DiscordState>>>();
                    let mut state = discord_state.lock().unwrap();
                    if let Err(_) = state.connect("1497547763028856945") {
                        window.emit("discord-not-found", ()).unwrap();
                        window.emit("discord-status", false).unwrap();
                    } else {
                        window.emit("discord-status", true).unwrap();
                    }
                }
            };

            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    match id.as_str() {
                        "quit" => {
                            std::process::exit(0);
                        }
                        "show" => {
                            handle_show();
                        }
                        _ => {}
                    }
                }
                SystemTrayEvent::LeftClick { .. } => handle_show(),
                _ => {}
            }
        })        .setup(|app| {
            // Periodically check Discord status and emit to frontend
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    let is_connected = {
                        let discord_state = app_handle.state::<Arc<Mutex<DiscordState>>>();
                        let state = discord_state.lock().unwrap();
                        state.client.is_some()
                    };
                    
                    let _ = app_handle.emit_all("discord-status", is_connected);
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            });

            // Initial check if Discord is running
            if let Some(window) = app.get_window("main") {
                let discord_state = app.state::<Arc<Mutex<DiscordState>>>();
                let mut state = discord_state.lock().unwrap();
                if let Err(_) = state.connect("1497547763028856945") {
                    window.emit("discord-not-found", ()).unwrap();
                    window.emit("discord-status", false).unwrap();
                } else {
                    window.emit("discord-status", true).unwrap();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            install::force_install_extension,
            change_theme,
            quit_app,
            reconnect_rpc,
            set_privacy_mode,
            is_autostart_enabled,
            set_autostart,
            check_for_updates,
            install_update
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                // Prevent app from exiting when the main window is destroyed
                api.prevent_exit();
            }
            _ => {}
        });
}
