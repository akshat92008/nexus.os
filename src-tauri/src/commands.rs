use crate::ai_service::{AIService, ChatMessage};
use crate::execution_engine::ExecutionEngine;
use crate::gui_engine::GuiEngine;
use crate::memory::MemoryManager;
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

static GUI_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

#[tauri::command]
pub async fn execute_mission(
    message: String,
    session_id: String,
    history: Vec<ChatMessage>,
    ai: State<'_, AIService>,
    memory: State<'_, MemoryManager>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    // 1. SAVE to long-term memory
    let _ = memory.save_interaction("user", &message);

    // 2. Ask the Brain to think (Stage 1: Generates plan)
    let mut brain_res = ai.think(&message, &session_id, history).await?;

    // Emit initial plan
    let _ = app_handle.emit("mission-update", json!({
        "mission": brain_res.mission.clone(),
        "plan": brain_res.plan.clone(),
        "current_step": 0,
        "status": "planning"
    }));

    // 3. Execute plan sequentially (Stage 2: Execution)
    for step in &brain_res.plan {
        // Update state to executing
        brain_res.current_step = step.step;
        brain_res.status = "executing".to_string();
        
        // Emit executing event
        let _ = app_handle.emit("mission-update", json!({
            "mission": brain_res.mission.clone(),
            "plan": brain_res.plan.clone(),
            "current_step": brain_res.current_step,
            "status": "executing"
        }));

        // Run the tool in a blocking task to prevent locking the async runtime
        let tool = step.tool.clone();
        let params = step.params.clone();

        let is_gui_tool = tool.starts_with("gui_")
            || tool.starts_with("click_")
            || tool.starts_with("type_")
            || tool == "read_gui_state"
            || tool == "click_gui_element"
            || tool == "type_into_gui";

        let tool_result = tauri::async_runtime::spawn_blocking(move || {
            if is_gui_tool {
                // Serialize all GUI operations — prevents concurrent missions corrupting screen state
                let _guard = GUI_LOCK.lock().unwrap();
                run_tool(tool, params)
            } else {
                run_tool(tool, params)
            }
        }).await.unwrap_or_else(|e| Err(format!("Task panic: {:?}", e)));

        // Catch errors for Saga Rollback
        match tool_result {
            Ok(_) => continue,
            Err(e) => {
                // Emit rollback UI indicator
                let _ = app_handle.emit("mission-update", json!({
                    "mission": brain_res.mission.clone(),
                    "plan": brain_res.plan.clone(),
                    "current_step": brain_res.current_step,
                    "status": "rolling_back",
                    "error": e
                }));
                return Err(format!("Saga Rollback Triggered: {}", e));
            }
        }
    }
    
    // 4. Mission Accomplished
    brain_res.status = "completed".to_string();
    let _ = app_handle.emit("mission-update", json!({
        "mission": brain_res.mission.clone(),
        "plan": brain_res.plan.clone(),
        "current_step": brain_res.current_step,
        "status": "completed"
    }));

    // Return the final brain res structure
    Ok(json!({
        "mission": brain_res.mission,
        "status": "completed"
    }))
}

#[tauri::command]
pub fn run_tool(tool: String, params: Value) -> Result<String, String> {
    match tool.as_str() {
        "digital_janitor" => {
            let target = params["target_dir"].as_str().unwrap_or("~/Desktop");
            ExecutionEngine::digital_janitor(target)
        },
        "resource_reaper" => {
            ExecutionEngine::resource_reaper()
        },
        "workflow_launcher" => {
            let mode = params["mode"].as_str().unwrap_or("deep_work");
            ExecutionEngine::workflow_launcher(mode)
        },
        "project_onboard" => {
            let path = params["path"].as_str().unwrap_or(".");
            ExecutionEngine::project_onboard(path)
        },
        "shell_execute" => {
            let cmd = params["command"].as_str().ok_or("Missing command parameter")?;
            ExecutionEngine::shell_execute(cmd)
        },
        
        // --- NEW GUI TOOLS ---
        "read_gui_state" => {
            GuiEngine::get_ui_hierarchy()
        },
        "click_gui_element" => {
            let label = params["element_id"].as_str().or(params["label"].as_str()).unwrap_or("");
            GuiEngine::click_element(label)
        },
        "type_into_gui" => {
            let text = params["text"].as_str().unwrap_or("");
            GuiEngine::set_text_value(text)
        },

        // --- FILE OPS ---
        "read_file" => {
            let path = params["path"].as_str().ok_or("Missing path parameter")?;
            std::fs::read_to_string(path).map_err(|e| e.to_string())
        },
        "write_file" => {
            let path = params["path"].as_str().ok_or("Missing path parameter")?;
            let content = params["content"].as_str().ok_or("Missing content parameter")?;
            std::fs::write(path, content).map_err(|e| e.to_string())?;
            Ok(format!("File written: {}", path))
        },
        "delete_file" => {
            let path = params["path"].as_str().ok_or("Missing path parameter")?;
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
            Ok(format!("File deleted: {}", path))
        },
        "delete_folder" => {
            let path = params["path"].as_str().ok_or("Missing path parameter")?;
            std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
            Ok(format!("Folder deleted: {}", path))
        },
        _ => Err(format!("Tool not implemented: {}", tool)),
    }
}

#[tauri::command]
pub fn get_memory_status(memory: State<'_, MemoryManager>) -> Result<Value, String> {
    Ok(json!({
        "is_active": true,
        "storage": "Local SQLite-Vec",
        "location": "app_data_dir/nexus_memory.db"
    }))
}
