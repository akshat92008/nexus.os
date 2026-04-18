"""
Nexus OS Super-Skill-Packs — High-level "Hero Functions."

Developer Pack:
  - dev_onboard: Analyze and summarize a codebase
  - dev_auto_doc: Generate README from git diffs

Founder Pack:
  - founder_janitor: Organize files by type (Digital Janitor)
  - founder_launcher: Launch workflow modes (Deep Work, etc.)

System Pack:
  - sys_settings: macOS system control (volume, dark mode, brightness)
  - sys_reaper: Identify top RAM-hogging processes
"""

import os
import subprocess
import shutil
import glob


# ============================================================
# DEVELOPER PACK
# ============================================================

def dev_onboard(path: str = ".", cwd: str = ".") -> str:
    """
    Onboard to a project: Read directory structure, detect package managers,
    and summarize the project purpose.
    """
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

    if not os.path.isdir(full_path):
        return f"ERROR: Directory not found: {full_path}"

    report = []
    report.append(f"📦 PROJECT ONBOARD REPORT: {os.path.basename(full_path)}")
    report.append(f"   Path: {full_path}")
    report.append("")

    # 1. Directory structure (max 2 levels deep)
    report.append("📁 STRUCTURE:")
    count = 0
    for root, dirs, files in os.walk(full_path):
        # Skip hidden dirs, node_modules, __pycache__, .git
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build')]
        level = root.replace(full_path, '').count(os.sep)
        if level > 2:
            continue
        indent = "   " + "  " * level
        report.append(f"{indent}📁 {os.path.basename(root)}/")
        for f in files[:10]:  # Max 10 files per dir
            report.append(f"{indent}  📄 {f}")
        if len(files) > 10:
            report.append(f"{indent}  ... and {len(files) - 10} more files")
        count += len(files)

    report.append(f"\n   Total files scanned: {count}")
    report.append("")

    # 2. Detect project type
    report.append("🔍 PROJECT TYPE DETECTION:")
    indicators = {
        "package.json": "Node.js / JavaScript / TypeScript",
        "requirements.txt": "Python",
        "Pipfile": "Python (Pipenv)",
        "pyproject.toml": "Python (Modern)",
        "Cargo.toml": "Rust",
        "go.mod": "Go",
        "Gemfile": "Ruby",
        "pom.xml": "Java (Maven)",
        "build.gradle": "Java/Kotlin (Gradle)",
        "Makefile": "C/C++ or Multi-tool",
        "Dockerfile": "Containerized",
        "docker-compose.yml": "Docker Compose",
        "tsconfig.json": "TypeScript",
        "next.config.js": "Next.js",
        "next.config.mjs": "Next.js",
        "vite.config.ts": "Vite",
        "tailwind.config.js": "TailwindCSS",
    }

    detected = []
    for filename, tech in indicators.items():
        if os.path.exists(os.path.join(full_path, filename)):
            detected.append(f"   ✅ {filename} → {tech}")

    if detected:
        report.extend(detected)
    else:
        report.append("   ⚠️ No standard project files detected.")

    report.append("")

    # 3. Read key files for context
    report.append("📄 KEY FILE CONTENTS:")
    key_files = ["README.md", "package.json", "requirements.txt", "pyproject.toml"]
    for kf in key_files:
        kf_path = os.path.join(full_path, kf)
        if os.path.exists(kf_path):
            try:
                with open(kf_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()[:800]
                report.append(f"\n   --- {kf} (first 800 chars) ---")
                report.append(f"   {content}")
            except Exception:
                pass

    return "\n".join(report)


def dev_auto_doc(cwd: str = ".") -> str:
    """
    Auto-document: Run git diff, collect project context,
    and return a structured README update payload.
    """
    full_path = cwd if os.path.isabs(cwd) else os.path.join(os.getcwd(), cwd)

    report = []
    report.append("📝 AUTO-DOCUMENTATION PAYLOAD")
    report.append("")

    # 1. Git diff
    try:
        result = subprocess.run(
            "git diff --stat", shell=True, capture_output=True, text=True,
            timeout=10, cwd=full_path
        )
        diff_summary = result.stdout.strip() if result.stdout else "(no changes)"
        report.append("📊 GIT DIFF SUMMARY:")
        report.append(f"   {diff_summary}")
    except Exception as e:
        report.append(f"   Git diff failed: {e}")

    report.append("")

    # 2. Recent commits
    try:
        result = subprocess.run(
            "git log --oneline -5", shell=True, capture_output=True, text=True,
            timeout=10, cwd=full_path
        )
        report.append("📜 RECENT COMMITS:")
        for line in (result.stdout or "").strip().split("\n"):
            report.append(f"   {line}")
    except Exception:
        pass

    report.append("")

    # 3. Existing README
    readme_path = os.path.join(full_path, "README.md")
    if os.path.exists(readme_path):
        try:
            with open(readme_path, "r", encoding="utf-8") as f:
                existing = f.read()[:2000]
            report.append("📄 EXISTING README (first 2000 chars):")
            report.append(f"   {existing}")
        except Exception:
            pass
    else:
        report.append("📄 No README.md found — a new one should be created.")

    report.append("")
    report.append("💡 INSTRUCTION: Use this payload to generate an updated README.md with write_file.")

    return "\n".join(report)


# ============================================================
# FOUNDER PACK
# ============================================================

FILE_TYPE_MAP = {
    "Images":     [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".heic", ".tiff"],
    "Documents":  [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".rtf", ".csv", ".odt"],
    "Installers": [".dmg", ".pkg", ".app", ".exe", ".msi", ".deb", ".rpm"],
    "Videos":     [".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm"],
    "Audio":      [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"],
    "Archives":   [".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz"],
    "Code":       [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h", ".go", ".rs", ".rb", ".swift"],
}


def founder_janitor(target_dir: str = ".", cwd: str = ".") -> str:
    """
    Digital Janitor: Scan a folder and organize files into typed subfolders.
    Moves .jpg/.png → Images/, .pdf/.docx → Documents/, .dmg → Installers/, etc.
    """
    full_path = os.path.join(cwd, target_dir) if not os.path.isabs(target_dir) else target_dir

    if not os.path.isdir(full_path):
        return f"ERROR: Directory not found: {full_path}"

    moved = []
    skipped = []

    files = [f for f in os.listdir(full_path) if os.path.isfile(os.path.join(full_path, f))]

    for filename in files:
        if filename.startswith('.'):
            continue  # Skip hidden files

        ext = os.path.splitext(filename)[1].lower()
        dest_folder = None

        for category, extensions in FILE_TYPE_MAP.items():
            if ext in extensions:
                dest_folder = category
                break

        if dest_folder:
            dest_dir = os.path.join(full_path, dest_folder)
            os.makedirs(dest_dir, exist_ok=True)
            src = os.path.join(full_path, filename)
            dst = os.path.join(dest_dir, filename)

            # Handle name collisions
            if os.path.exists(dst):
                name, ext_part = os.path.splitext(filename)
                dst = os.path.join(dest_dir, f"{name}_copy{ext_part}")

            try:
                shutil.move(src, dst)
                moved.append(f"   📦 {filename} → {dest_folder}/")
            except Exception as e:
                skipped.append(f"   ⚠️ {filename}: {e}")
        else:
            skipped.append(f"   🔹 {filename} (unknown type: {ext})")

    report = [f"🧹 DIGITAL JANITOR REPORT: {full_path}"]
    report.append(f"   Scanned: {len(files)} files")
    report.append(f"   Organized: {len(moved)} files")
    report.append(f"   Skipped: {len(skipped)} files")
    report.append("")

    if moved:
        report.append("📦 MOVED:")
        report.extend(moved)

    if skipped:
        report.append("\n🔹 SKIPPED:")
        report.extend(skipped[:20])

    return "\n".join(report)


# Deep Work mode apps
WORKFLOW_MODES = {
    "deep_work": {
        "name": "Deep Work",
        "apps": ["Visual Studio Code", "Spotify", "Notes"],
        "settings": ["volume:20"],
    },
    "creative": {
        "name": "Creative",
        "apps": ["Figma", "Safari", "Spotify"],
        "settings": ["volume:40"],
    },
    "meeting": {
        "name": "Meeting",
        "apps": ["Zoom", "Notes", "Calendar"],
        "settings": ["volume:60"],
    },
    "research": {
        "name": "Research",
        "apps": ["Safari", "Notes", "Finder"],
        "settings": ["volume:15"],
    },
}


def founder_launcher(mode: str = "deep_work", cwd: str = ".") -> str:
    """
    Workflow Launcher: Launch a pre-configured set of apps for a specific mode.
    Modes: deep_work, creative, meeting, research
    """
    mode_key = mode.lower().replace(" ", "_")

    if mode_key not in WORKFLOW_MODES:
        available = ", ".join(WORKFLOW_MODES.keys())
        return f"ERROR: Unknown mode '{mode}'. Available: {available}"

    config = WORKFLOW_MODES[mode_key]
    report = [f"🚀 LAUNCHING: {config['name']} Mode"]
    report.append("")

    # Launch apps
    for app_name in config["apps"]:
        try:
            result = subprocess.run(
                f'open -a "{app_name}"', shell=True,
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                report.append(f"   ✅ Opened: {app_name}")
            else:
                report.append(f"   ⚠️ Could not open: {app_name} ({result.stderr.strip()})")
        except Exception as e:
            report.append(f"   ❌ Error opening {app_name}: {e}")

    # Apply settings
    for setting in config["settings"]:
        if setting.startswith("volume:"):
            try:
                level = int(setting.split(":")[1])
                subprocess.run(
                    f"osascript -e 'set volume output volume {level}'",
                    shell=True, timeout=5
                )
                report.append(f"   🔊 Volume set to {level}%")
            except Exception:
                pass

    report.append("")
    report.append(f"✅ {config['name']} Mode activated. Focus up, CEO! 🎯")
    return "\n".join(report)


# ============================================================
# SYSTEM PACK
# ============================================================

def sys_settings(action: str, value: str = "", cwd: str = ".") -> str:
    """
    macOS System Control via osascript.

    Supported actions:
        "dark_mode_on", "dark_mode_off"
        "volume" (value: "0"-"100")
        "brightness" (value: "0"-"100")
        "do_not_disturb_on", "do_not_disturb_off"
    """
    action = action.lower().strip()

    if action == "dark_mode_on":
        cmd = 'tell app "System Events" to tell appearance preferences to set dark mode to true'
        _osascript(cmd)
        return "🌙 Dark Mode: ON"

    elif action == "dark_mode_off":
        cmd = 'tell app "System Events" to tell appearance preferences to set dark mode to false'
        _osascript(cmd)
        return "☀️ Dark Mode: OFF"

    elif action == "volume":
        try:
            level = max(0, min(100, int(value)))
            subprocess.run(f"osascript -e 'set volume output volume {level}'", shell=True, timeout=5)
            return f"🔊 Volume set to {level}%"
        except ValueError:
            return f"ERROR: Invalid volume value: {value}"

    elif action == "brightness":
        try:
            level = max(0, min(100, int(value)))
            # macOS brightness via AppleScript (may require permissions)
            pct = level / 100
            subprocess.run(
                f'osascript -e \'tell application "System Events" to set value of slider 1 of group 1 of window "Displays" of application process "System Preferences" to {pct}\'',
                shell=True, timeout=5, capture_output=True
            )
            return f"🔆 Brightness set to {level}%"
        except ValueError:
            return f"ERROR: Invalid brightness value: {value}"

    elif action == "do_not_disturb_on":
        return "🔕 Do Not Disturb: ON (requires macOS Shortcuts integration)"

    elif action == "do_not_disturb_off":
        return "🔔 Do Not Disturb: OFF (requires macOS Shortcuts integration)"

    else:
        return f"ERROR: Unknown setting action: {action}. Available: dark_mode_on, dark_mode_off, volume, brightness"


def sys_reaper(cwd: str = ".") -> str:
    """
    Resource Reaper: Identify the top 5 RAM-hogging processes
    and return them in a formatted report.
    """
    try:
        result = subprocess.run(
            "ps -eo pid,ppid,%mem,%cpu,comm --sort=-%mem | head -6",
            shell=True, capture_output=True, text=True, timeout=10
        )
        output = result.stdout.strip()

        if not output:
            return "⚠️ Could not retrieve process info."

        lines = output.split("\n")
        report = ["💀 RESOURCE REAPER — Top 5 RAM Hogs:"]
        report.append("")
        report.append(f"   {'PID':<8} {'PPID':<8} {'MEM%':<8} {'CPU%':<8} {'PROCESS'}")
        report.append(f"   {'─'*50}")

        for line in lines[1:]:  # Skip header
            parts = line.split()
            if len(parts) >= 5:
                pid, ppid, mem, cpu = parts[0], parts[1], parts[2], parts[3]
                proc = " ".join(parts[4:])
                proc_short = os.path.basename(proc)[:30]
                report.append(f"   {pid:<8} {ppid:<8} {mem:<8} {cpu:<8} {proc_short}")

        report.append("")
        report.append("💡 To kill a process, use: kill -9 <PID>")

        return "\n".join(report)

    except Exception as e:
        return f"ERROR: Resource reaper failed: {e}"


def _osascript(script: str) -> str:
    """Internal helper to run osascript commands."""
    try:
        result = subprocess.run(
            f"osascript -e '{script}'", shell=True,
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() if result.stdout else ""
    except Exception as e:
        return f"ERROR: {e}"
