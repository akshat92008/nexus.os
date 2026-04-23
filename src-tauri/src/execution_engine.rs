use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::{System, ProcessExt, SystemExt};
use serde_json::Value;

pub struct ExecutionEngine;

impl ExecutionEngine {
    /// THE DIGITAL JANITOR
    /// Organizes files in a directory by their type.
    pub fn digital_janitor(target_dir: &str) -> Result<String, String> {
        let path = Path::new(target_dir);
        if !path.is_dir() {
            return Err(format!("Target is not a directory: {}", target_dir));
        }

        let mut moved_count = 0;
        let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_path = entry.path();
            if file_path.is_file() {
                if let Some(ext) = file_path.extension().and_then(|s| s.to_str()) {
                    let folder_name = match ext.to_lowercase().as_str() {
                        "jpg" | "jpeg" | "png" | "gif" | "svg" => Some("Images"),
                        "pdf" | "docx" | "txt" | "xlsx" | "pptx" => Some("Documents"),
                        "dmg" | "pkg" | "zip" => Some("Installers"),
                        "py" | "js" | "ts" | "html" | "css" | "json" | "rs" => Some("Code"),
                        _ => None,
                    };

                    if let Some(folder) = folder_name {
                        let dest_dir = path.join(folder);
                        fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
                        
                        let file_name = file_path.file_name().unwrap();
                        let dest_path = dest_dir.join(file_name);
                        
                        fs::rename(&file_path, &dest_path).map_err(|e| e.to_string())?;
                        moved_count += 1;
                    }
                }
            }
        }

        Ok(format!("✅ Digital Janitor complete. Organized {} files.", moved_count))
    }

    /// THE RESOURCE REAPER
    /// Identifies top RAM hogging processes.
    pub fn resource_reaper() -> Result<String, String> {
        let mut sys = System::new_all();
        sys.refresh_all();

        let mut processes: Vec<_> = sys.processes().values().collect();
        processes.sort_by(|a, b| b.memory().cmp(&a.memory()));

        let mut report = String::from("💀 RESOURCE REAPER — Top 5 RAM Hogs:\n\n");
        report.push_str(&format!("{:<8} {:<10} {:<10} {}\n", "PID", "MEM (MB)", "CPU (%)", "PROCESS"));
        report.push_str("----------------------------------------------\n");

        for proc in processes.iter().take(5) {
            let mem_mb = proc.memory() / 1024 / 1024;
            let cpu_usage = proc.cpu_usage();
            let name = proc.name();
            report.push_str(&format!("{:<8} {:<10} {:<10.2} {}\n", proc.pid(), mem_mb, cpu_usage, name));
        }

        Ok(report)
    }

    /// WORKFLOW LAUNCHER
    /// Opens apps for specific modes.
    pub fn workflow_launcher(mode: &str) -> Result<String, String> {
        match mode {
            "deep_work" => {
                let apps = vec!["Visual Studio Code", "Spotify", "Notes"];
                for app in apps {
                    let _ = Command::new("open").arg("-a").arg(app).spawn();
                }
                // Optional: osascript for volume or DND can go here
                Ok("🚀 Deep Work mode active: VS Code, Spotify, and Notes launched.".to_string())
            },
            "relax" => {
                let apps = vec!["Spotify", "Safari"];
                for app in apps {
                    let _ = Command::new("open").arg("-a").arg(app).spawn();
                }
                Ok("🌙 Relax mode active: Time to unwind.".to_string())
            },
            _ => Err(format!("Unknown mode: {}", mode)),
        }
    }

    /// PROJECT ONBOARDER
    /// Basic directory mapping.
    pub fn project_onboard(path_str: &str) -> Result<String, String> {
        let path = Path::new(path_str);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", path_str));
        }

        let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
        let mut structure = Vec::new();
        for entry in entries.take(20) {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let indicator = if entry.path().is_dir() { "📁" } else { "📄" };
            structure.push(format!("{} {}", indicator, name));
        }

        Ok(format!(
            "📂 Project Structure indexing (first 20):\n{}\n\nBase path: {}",
            structure.join("\n"),
            fs::canonicalize(path).map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| path_str.to_string())
        ))
    }

    /// SHELL EXECUTE
    /// Guarded shell execution with persistent working directory.
    pub fn shell_execute(command: &str, working_dir: &str) -> Result<String, String> {
        let destructive_keywords = ["rm -rf", "sudo", "mkfs", "dd if", "del /f /s", "format"];
        let lower_cmd = command.to_lowercase();
        for kw in &destructive_keywords {
            if lower_cmd.contains(kw) {
                return Err(format!("Destructive command '{}' requires CEO_APPROVAL via ApprovalGuard.", kw));
            }
        }

        let output = if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", command]).current_dir(working_dir).output()
        } else {
            Command::new("sh").arg("-c").arg(command).current_dir(working_dir).output()
        };

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if out.status.success() {
                    Ok(stdout)
                } else {
                    Err(format!("Error: {}\n{}", stderr, stdout))
                }
            },
            Err(e) => Err(format!("Failed to execute command: {}", e)),
        }
    }

    /// READ FILE
    pub fn read_file(path: &str) -> Result<String, String> {
        fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
    }

    /// WRITE FILE
    pub fn write_file(path: &str, content: &str) -> Result<(), String> {
        fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
    }

    /// PATCH FILE (search and replace)
    pub fn patch_file(path: &str, search: &str, replace: &str) -> Result<usize, String> {
        let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;
        let count = content.matches(search).count();
        if count == 0 {
            return Err(format!("Search string not found in file: {}", path));
        }
        let new_content = content.replace(search, replace);
        fs::write(path, new_content).map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(count)
    }

    /// LIST DIRECTORY
    pub fn list_directory(path: &str, depth: u32) -> Result<Vec<String>, String> {
        let mut results = Vec::new();
        fn walk(dir: &Path, current_depth: u32, max_depth: u32, results: &mut Vec<String>) -> Result<(), String> {
            if current_depth > max_depth { return Ok(()); }
            let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let name = entry.file_name().to_string_lossy().into_owned();
                let prefix = "  ".repeat(current_depth as usize);
                let marker = if entry.path().is_dir() { "📁" } else { "📄" };
                results.push(format!("{}{} {}", prefix, marker, name));
                if entry.path().is_dir() && current_depth < max_depth {
                    walk(&entry.path(), current_depth + 1, max_depth, results)?;
                }
            }
            Ok(())
        }
        walk(Path::new(path), 0, depth, &mut results)?;
        Ok(results)
    }

    /// GLOBAL SEARCH (regex across directory)
    pub fn global_search(pattern: &str, directory: &str) -> Result<Vec<String>, String> {
        let mut results = Vec::new();
        fn walk(dir: &Path, regex: &regex::Regex, results: &mut Vec<String>) -> Result<(), String> {
            let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let path = entry.path();
                if path.is_dir() {
                    if !path.file_name().map_or(false, |n| n.to_string_lossy().starts_with('.')) {
                        walk(&path, regex, results)?;
                    }
                } else if let Ok(content) = fs::read_to_string(&path) {
                    for (i, line) in content.lines().enumerate() {
                        if regex.is_match(line) {
                            results.push(format!("{}:{}: {}", path.display(), i + 1, line.trim()));
                        }
                    }
                }
            }
            Ok(())
        }
        let re = regex::Regex::new(pattern).map_err(|e| format!("Invalid regex: {}", e))?;
        walk(Path::new(directory), &re, &mut results)?;
        Ok(results)
    }

    /// GIT OPERATION
    pub fn git_operation(action: &str, params: &Value) -> Result<String, String> {
        match action {
            "status" => {
                let output = Command::new("git").args(["status", "--short"]).output();
                Self::process_git_output(output)
            },
            "diff" => {
                let target = params.as_str().unwrap_or("HEAD~1");
                let output = Command::new("git").args(["diff", target]).output();
                Self::process_git_output(output)
            },
            "log" => {
                let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(10);
                let output = Command::new("git").args(["log", "--oneline", "-n", &limit.to_string()]).output();
                Self::process_git_output(output)
            },
            "branch" => {
                let output = Command::new("git").args(["branch", "-a"]).output();
                Self::process_git_output(output)
            },
            _ => Err(format!("Unknown git action: {}", action))
        }
    }

    fn process_git_output(output: std::io::Result<std::process::Output>) -> Result<String, String> {
        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                if out.status.success() { Ok(stdout) } else { Err(stdout) }
            },
            Err(e) => Err(format!("Git command failed: {}", e))
        }
    }

    /// OPEN APPLICATION
    pub fn open_application(app_name: &str) -> Result<(), String> {
        if cfg!(target_os = "macos") {
            Command::new("open").args(["-a", app_name]).output()
                .map_err(|e| format!("Failed to open app: {}", e))?;
        } else if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", "start", "", app_name]).output()
                .map_err(|e| format!("Failed to open app: {}", e))?;
        } else {
            Command::new(app_name).spawn()
                .map_err(|e| format!("Failed to open app: {}", e))?;
        }
        Ok(())
    }

    /// GET CLIPBOARD
    #[cfg(target_os = "macos")]
    pub fn get_clipboard() -> Result<String, String> {
        let output = Command::new("pbpaste").output()
            .map_err(|e| format!("Failed to get clipboard: {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// SET CLIPBOARD
    #[cfg(target_os = "macos")]
    pub fn set_clipboard(content: &str) -> Result<(), String> {
        let mut child = Command::new("pbcopy").stdin(std::process::Stdio::piped())
            .spawn().map_err(|e| format!("Failed to set clipboard: {}", e))?;
        use std::io::Write;
        if let Some(stdin) = child.stdin.take() {
            let mut stdin = stdin;
            stdin.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// TAKE SCREENSHOT
    #[cfg(target_os = "macos")]
    pub fn take_screenshot(path: &str) -> Result<String, String> {
        let output = Command::new("screencapture").args(["-x", path]).output()
            .map_err(|e| format!("Failed to take screenshot: {}", e))?;
        if output.status.success() {
            Ok(format!("Screenshot saved to: {}", path))
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}
