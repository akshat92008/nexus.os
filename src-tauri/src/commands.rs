use crate::ai_service::{AIService, ChatMessage};
use crate::execution_engine::ExecutionEngine;
use crate::gui_engine::GuiEngine;
use crate::memory::MemoryManager;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn execute_mission(
    message: String,
    session_id: String,
    history: Vec<ChatMessage>,
    ai: State<'_, AIService>,
    memory: State<'_, MemoryManager>,
) -> Result<Value, String> {
    // 1. SAVE to long-term memory
    let _ = memory.save_interaction("user", &message);

    // 2. RETRIEVE semantic context (Optional for this phase)
    // let context = memory.search_memory(vec![...], 3);

    // 3. Ask the Brain to think
    let brain_res = ai.think(&message, &session_id, history).await?;

    // 4. Return the intent and tool
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
