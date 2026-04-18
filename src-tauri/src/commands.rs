use crate::ai_service::{AIService, ChatMessage};
use crate::execution_engine::ExecutionEngine;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn execute_mission(
    message: String,
    session_id: String,
    history: Vec<ChatMessage>,
    ai: State<'_, AIService>,
) -> Result<Value, String> {
    // 1. Ask the Brain to think
    let brain_res = ai.think(&message, &session_id, history).await?;

    // 2. Return the intent and tool to the UI for confirmation or auto-exec
    Ok(json!({
        "intent": brain_res.intent,
        "tool": brain_res.tool,
        "params": brain_res.params,
        "explanation": brain_res.explanation
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
            // Safety check logic can be added here too
            ExecutionEngine::shell_execute(cmd)
        },
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
        "create_folder" => {
            let path = params["path"].as_str().ok_or("Missing path parameter")?;
            std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
            Ok(format!("Folder created: {}", path))
        },
        "list_dir" => {
            let path = params["path"].as_str().unwrap_or(".");
            let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;
            let names: Vec<String> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect();
            Ok(names.join("\n"))
        },
        _ => Err(format!("Tool not implemented: {}", tool)),
    }
}
