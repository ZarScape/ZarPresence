use tauri::command;

#[cfg(target_os = "windows")]
#[command]
pub fn force_install_extension() -> Result<String, String> {
    use std::process::Command;
    
    let path = std::fs::canonicalize("../dist-extension")
        .map_err(|e| format!("Failed to find extension build: {}", e))?;
    let path_str = path.to_string_lossy().to_string();

    let browsers = [
        ("chrome.exe", "chrome://extensions"),
        ("msedge.exe", "edge://extensions"),
        ("brave.exe", "brave://extensions"),
        ("opera.exe", "opera://extensions"),
        ("firefox.exe", "about:debugging#/runtime/this-firefox"),
    ];

    let mut opened = Vec::new();
    
    // Check running processes via tasklist
    let output = Command::new("tasklist")
        .output()
        .map_err(|e| format!("Failed to check running processes: {}", e))?;
    let process_list = String::from_utf8_lossy(&output.stdout).to_lowercase();

    for (process, url) in browsers {
        if process_list.contains(process) {
            // Open the specific browser's extension page
            let browser_cmd = match process {
                "msedge.exe" => "msedge",
                "chrome.exe" => "chrome",
                "brave.exe" => "brave",
                "opera.exe" => "opera",
                "firefox.exe" => "firefox",
                _ => "cmd",
            };

            let _ = if browser_cmd == "cmd" {
                Command::new("cmd").args(["/C", "start", url]).spawn()
            } else {
                Command::new(browser_cmd).arg(url).spawn()
            };
            opened.push(process.replace(".exe", ""));
        }
    }

    // If no specific browser detected, just open default
    if opened.is_empty() {
        let _ = Command::new("cmd").args(["/C", "start", "chrome://extensions"]).spawn();
        opened.push("default browser".to_string());
    }

    // Also open the folder
    let _ = Command::new("explorer").arg(&path_str).spawn();

    Ok(format!(
        "Detected and opened extension pages for: {}. \n\n1. Enable 'Developer Mode' in the browser.\n2. Drag the opened folder into the browser window to install.",
        opened.join(", ")
    ))
}

#[cfg(not(target_os = "windows"))]
#[command]
pub fn force_install_extension() -> Result<String, String> {
    Err("Auto-install is currently only supported on Windows.".to_string())
}
