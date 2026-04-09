#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Optional: You can spawn commands or check sidecar status here
            let window = app.get_window("main").unwrap();
            
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            println!("🚀 Nexus OS — Core Desktop Layer initialized.");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
