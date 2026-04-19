#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod ai_service;
mod execution_engine;
mod gui_engine;
mod memory;
mod commands;
mod mcp_client;

use ai_service::AIService;
use mcp_client::McpClient;
use memory::MemoryManager;
use commands::{execute_mission, run_tool, get_memory_status};

use tauri::{Manager, Emitter};
use notify::{Watcher, RecursiveMode, event::EventKind};
use std::path::PathBuf;

fn setup_watcher(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let mut inbox_path = PathBuf::from(home);
        inbox_path.push("NexusInbox");
        
        // Ensure folder exists
        let _ = std::fs::create_dir_all(&inbox_path);

        let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            match res {
                Ok(event) => {
                    // Trigger on create or modify
                    if let EventKind::Create(_) | EventKind::Modify(_) = event.kind {
                        // Forward to React
                        let _ = app_handle.emit("nexus-inbox-event", serde_json::json!({
                            "message": "New file detected. Should I organize this for you?",
                            "event": format!("{:?}", event.kind)
                        }));
                    }
                },
                Err(e) => println!("watch error: {:?}", e),
            }
        }).expect("Failed to initialize watcher");

        watcher.watch(&inbox_path, RecursiveMode::NonRecursive).expect("Failed to watch inbox");
        
        // Keep thread alive
        loop {
            std::thread::sleep(std::time::Duration::from_secs(3600));
        }
    });
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize Memory Module
            let handle = app.handle().clone();
            app.manage(MemoryManager::new(&handle));
            
            // Register AI Service
            app.manage(AIService::new());

            // Initialize and Run MCP Client
            let mcp = McpClient::new();
            mcp.scan_and_connect();
            app.manage(mcp);

            // Start Sovereign File Watcher
            setup_watcher(app.handle().clone());

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
