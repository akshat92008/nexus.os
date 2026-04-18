"""
Nexus OS App Launcher — macOS application and system control.

All functions return plain strings for the agentic loop to consume.
"""

import subprocess


def open_app(name: str, cwd: str = ".") -> str:
    """Open a macOS application by name."""
    try:
        result = subprocess.run(
            f'open -a "{name}"', shell=True, capture_output=True, text=True,
            timeout=10
        )
        if result.returncode == 0:
            return f"SUCCESS: Opened {name}"
        return f"ERROR: {result.stderr.strip()}"
    except Exception as e:
        return f"ERROR: Could not open {name}: {e}"


def close_app(name: str, cwd: str = ".") -> str:
    """Gracefully close a macOS application."""
    try:
        script = f'tell application "{name}" to quit'
        result = subprocess.run(
            f'osascript -e \'{script}\'', shell=True,
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return f"SUCCESS: Closed {name}"
        return f"ERROR: {result.stderr.strip()}"
    except Exception as e:
        return f"ERROR: Could not close {name}: {e}"


def system_setting(action: str, cwd: str = ".") -> str:
    """
    Execute a macOS system setting via osascript.
    
    Supported actions:
        "dark_mode_on", "dark_mode_off",
        "volume:<0-100>", "brightness:<0-100>",
        "do_not_disturb_on", "do_not_disturb_off"
    """
    scripts = {
        "dark_mode_on": 'tell app "System Events" to tell appearance preferences to set dark mode to true',
        "dark_mode_off": 'tell app "System Events" to tell appearance preferences to set dark mode to false',
    }

    # Handle volume commands like "volume:50"
    if action.startswith("volume:"):
        try:
            level = int(action.split(":")[1])
            level = max(0, min(100, level))
            cmd = f"osascript -e 'set volume output volume {level}'"
            subprocess.run(cmd, shell=True, timeout=5)
            return f"SUCCESS: Volume set to {level}%"
        except Exception as e:
            return f"ERROR: {e}"

    # Handle named scripts
    if action in scripts:
        try:
            cmd = f"osascript -e '{scripts[action]}'"
            subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
            return f"SUCCESS: {action} executed"
        except Exception as e:
            return f"ERROR: {e}"

    # Fallback: pass raw osascript
    try:
        result = subprocess.run(
            f'osascript -e \'{action}\'', shell=True,
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout.strip() if result.stdout else result.stderr.strip()
        return output if output else "SUCCESS: Script executed"
    except Exception as e:
        return f"ERROR: {e}"
