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
    /// Guarded shell execution.
    pub fn shell_execute(command: &str) -> Result<String, String> {
        // Implement a strict allowlist for shell commands
        let allowed_commands = ["ls", "echo", "pwd", "date", "cat", "ps", "top", "df", "mkdir"];
        let base_cmd = command.split_whitespace().next().unwrap_or("");

        if !allowed_commands.contains(&base_cmd) {
            return Err(format!("Command '{}' blocked by Security Policy (Power Lane Authorization Required).", base_cmd));
        }

        let output = if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", command]).output()
        } else {
            Command::new("sh").arg("-c").arg(command).output()
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
}
