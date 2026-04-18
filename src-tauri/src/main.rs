#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod ai_service;
mod execution_engine;
mod gui_engine;
mod memory;
mod commands;

use ai_service::AIService;
use memory::MemoryManager;
use commands::{execute_mission, run_tool, get_memory_status};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize Memory Module
            let handle = app.handle();
            app.manage(MemoryManager::new(handle));
            
            // Register AI Service
            app.manage(AIService::new());

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            execute_mission,
            run_tool,
            get_memory_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
