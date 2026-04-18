#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod ai_service;
mod execution_engine;
mod commands;

use ai_service::AIService;
use commands::{execute_mission, run_tool};

fn main() {
    tauri::Builder::default()
        .manage(AIService::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            execute_mission,
            run_tool
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
