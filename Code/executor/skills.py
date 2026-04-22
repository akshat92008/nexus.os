import os
import shutil
import subprocess
import json
import logging

def digital_janitor(params):
    """Organizes files in a directory by their type into subfolders."""
    target_dir = os.path.expanduser(params.get("target_dir", "~/Desktop"))
    if not os.path.isdir(target_dir):
        return f"❌ Target is not a directory: {target_dir}"

    categories = {
        "Images": [".jpg", ".jpeg", ".png", ".gif", ".svg", ".heic"],
        "Documents": [".pdf", ".docx", ".txt", ".xlsx", ".pptx", ".md", ".csv"],
        "Installers": [".dmg", ".pkg", ".zip", ".tar.gz"],
        "Code": [".py", ".js", ".ts", ".html", ".css", ".json", ".rs", ".go", ".c"]
    }

    moved_count = 0
    try:
        for item in os.listdir(target_dir):
            item_path = os.path.join(target_dir, item)
            if os.path.isfile(item_path):
                ext = os.path.splitext(item).lower()[1]
                if not ext: continue
                ext = "." + ext
                
                target_folder = None
                for category, extensions in categories.items():
                    if ext in extensions:
                        target_folder = category
                        break
                
                if target_folder:
                    dest_dir = os.path.join(target_dir, target_folder)
                    os.makedirs(dest_dir, exist_ok=True)
                    shutil.move(item_path, os.path.join(dest_dir, item))
                    moved_count += 1
        
        return f"✅ Digital Janitor complete. Organized {moved_count} files into {target_dir}."
    except Exception as e:
        return f"❌ Digital Janitor error: {str(e)}"

def resource_reaper(params=None):
    """Identifies top RAM and CPU hogging processes using 'ps'."""
    try:
        # ps command to get top processes by CPU and Memory
        cmd = "ps -eo pid,pcpu,pmem,comm | sort -k3 -nr | head -n 6"
        output = subprocess.check_output(cmd, shell=True).decode()
        
        lines = output.strip().split('\n')
        report = "💀 RESOURCE REAPER — Top System Hogs:\n\n"
        report += "{:<8} {:<10} {:<10} {}\n".format("PID", "CPU (%)", "MEM (%)", "PROCESS")
        report += "-" * 50 + "\n"
        
        for line in lines[1:]: # Skip header
            parts = line.split()
            if len(parts) >= 4:
                pid, cpu, mem, comm = parts[0], parts[1], parts[2], " ".join(parts[3:])
                report += "{:<8} {:<10} {:<10} {}\n".format(pid, cpu, mem, os.path.basename(comm))
        
        return report
    except Exception as e:
        return f"❌ Resource Reaper error: {str(e)}"

def workflow_launcher(params):
    """Launches apps for specific preset modes."""
    mode = params.get("mode", "deep_work")
    presets = {
        "deep_work": ["Visual Studio Code", "Spotify", "Notes"],
        "creative": ["Adobe Photoshop", "Figma", "Spotify"],
        "meeting": ["Zoom", "Calendar", "Notes"],
        "relax": ["Spotify", "Safari", "TV"]
    }
    
    apps = presets.get(mode, [])
    if not apps:
        return f"❌ Unknown mode: {mode}"
        
    launched = []
    for app in apps:
        try:
            subprocess.Popen(["open", "-a", app], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            launched.append(app)
        except:
            pass
            
    return f"🚀 {mode.replace('_', ' ').title()} mode active: {', '.join(launched)} launched."

def project_onboard(params):
    """Analyzes directory structure and detects tech stack."""
    path = os.path.expanduser(params.get("path", "."))
    if not os.path.exists(path):
        return f"❌ Path does not exist: {path}"
        
    try:
        files = os.listdir(path)
        structure = []
        tech_stack = []
        
        # Tech stack detection
        stack_map = {
            "package.json": "Node.js/JavaScript",
            "Cargo.toml": "Rust",
            "requirements.txt": "Python",
            "go.mod": "Go",
            "composer.json": "PHP",
            "Dockerfile": "Docker",
            "main.py": "Python",
            "index.html": "Frontend Web"
        }
        
        for f in files:
            if f in stack_map:
                tech_stack.append(stack_map[f])
        
        # Build structure preview
        for item in files[:15]:
            indicator = "📁" if os.path.isdir(os.path.join(path, item)) else "📄"
            structure.append(f"{indicator} {item}")
            
        report = f"📂 Project Onboarder: {os.path.abspath(path)}\n"
        if tech_stack:
            report += f"✨ Tech Stack Detected: {', '.join(list(set(tech_stack)))}\n"
        report += "-" * 40 + "\n"
        report += "\n".join(structure)
        if len(files) > 15:
            report += f"\n... and {len(files) - 15} more items."
            
        return report
    except Exception as e:
        return f"❌ Project Onboarder error: {str(e)}"
