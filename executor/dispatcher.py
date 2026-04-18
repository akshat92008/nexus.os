"""
Nexus OS Dispatcher v2.0 — Deterministic Execution with Safety & Rollback.

Features:
- Structured tool routing (no raw shell fallback for unregistered tools)
- Safety layer integration (command blacklist)
- Saga pattern with UndoLog for rollback capability
"""

import subprocess
import os
import shutil
from collections import deque
from typing import Optional

from executor.actions import git_manager, file_manager, app_launcher, skill_packs
from executor import safety

WORKING_DIR = os.getcwd()

# ============================================================
# TOOL REGISTRY — Maps tool IDs to handler functions
# ============================================================
TOOL_REGISTRY = {
    # Git operations
    "git_status":  git_manager.git_status,
    "git_diff":    git_manager.git_diff,
    "git_commit":  git_manager.git_commit,
    "git_log":     git_manager.git_log,

    # File operations
    "read_file":     file_manager.read_file,
    "write_file":    file_manager.write_file,
    "list_dir":      file_manager.list_dir,
    "find_files":    file_manager.find_files,
    "create_folder": file_manager.create_folder,

    # App / System operations
    "open_app":       app_launcher.open_app,
    "close_app":      app_launcher.close_app,
    "system_setting": app_launcher.system_setting,

    # Super-Skill-Packs: Developer
    "project_onboard":   skill_packs.dev_onboard,
    "auto_document":     skill_packs.dev_auto_doc,

    # Super-Skill-Packs: Founder
    "digital_janitor":   skill_packs.founder_janitor,
    "workflow_launcher": skill_packs.founder_launcher,

    # Super-Skill-Packs: System
    "system_control":    skill_packs.sys_settings,
    "resource_reaper":   skill_packs.sys_reaper,
}

# Tools that are READ-ONLY and don't need undo logging
READ_ONLY_TOOLS = {
    "git_status", "git_diff", "git_log",
    "read_file", "list_dir", "find_files",
    "project_onboard", "auto_document", "resource_reaper",
}


class UndoEntry:
    """A single entry in the undo log."""
    def __init__(self, action: str, path: str, previous_content: Optional[str] = None, was_new: bool = False):
        self.action = action        # "write_file", "create_folder", "shell"
        self.path = path            # The affected file/folder path
        self.previous_content = previous_content  # Content before modification (None if new)
        self.was_new = was_new      # True if the file/folder didn't exist before


class Dispatcher:
    """
    Routes structured tool calls from the Brain to local action modules.
    Integrates safety checks and maintains an undo log for rollback.
    """

    def __init__(self, working_dir: str = None):
        self.working_dir = working_dir or WORKING_DIR
        self.undo_log: deque[UndoEntry] = deque(maxlen=50)

    def dispatch(self, tool: str, params: dict = None, force: bool = False) -> dict:
        """
        Execute a tool call with safety checks and undo logging.

        Args:
            tool:   The tool identifier (e.g., "git_status", "read_file")
            params: Tool-specific parameters dict
            force:  CEO override — bypasses safety checks

        Returns:
            {"success": bool, "output": str, "tool": str, "blocked": bool}
        """
        params = params or {}

        # Inject working directory if not specified
        if "cwd" not in params:
            params["cwd"] = self.working_dir

        # ========================================
        # SAFETY CHECK
        # ========================================

        # For shell-like tools, check the command string
        if tool == "shell" or tool not in TOOL_REGISTRY:
            command = params.get("command", tool if tool not in TOOL_REGISTRY else "")
            allowed, reason = safety.check(command, force=force)
            if not allowed:
                return {"success": False, "output": reason, "tool": tool, "blocked": True}

        # For write operations, check the path
        if tool in ("write_file", "create_folder"):
            path = params.get("path", "")
            full_path = os.path.join(params.get("cwd", self.working_dir), path) if not os.path.isabs(path) else path
            allowed, reason = safety.check_path(full_path, force=force)
            if not allowed:
                return {"success": False, "output": reason, "tool": tool, "blocked": True}

        # ========================================
        # UNDO LOG (pre-action snapshot)
        # ========================================
        if tool not in READ_ONLY_TOOLS:
            self._snapshot_before(tool, params)

        # ========================================
        # ROUTE TO REGISTERED TOOL
        # ========================================
        if tool in TOOL_REGISTRY:
            try:
                result = TOOL_REGISTRY[tool](**params)
                return {"success": True, "output": result, "tool": tool, "blocked": False}
            except Exception as e:
                return {"success": False, "output": f"Tool Error ({tool}): {e}", "tool": tool, "blocked": False}

        # ========================================
        # GUARDED SHELL FALLBACK
        # ========================================
        if tool == "shell":
            command = params.get("command", "")
            return self._safe_shell(command, params.get("cwd", self.working_dir))

        # ========================================
        # UNREGISTERED TOOL — Reject (no silent shell)
        # ========================================
        return {
            "success": False,
            "output": f"Unknown tool '{tool}'. Available: {', '.join(TOOL_REGISTRY.keys())}, shell",
            "tool": tool,
            "blocked": False,
        }

    def _safe_shell(self, command: str, cwd: str) -> dict:
        """Execute a safety-checked shell command."""
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=30, cwd=cwd
            )
            output = result.stdout if result.stdout else result.stderr
            if not output:
                output = "(no output)"
            if len(output) > 4000:
                output = output[:4000] + "\n... [TRUNCATED]"
            return {"success": True, "output": output, "tool": "shell", "blocked": False}
        except subprocess.TimeoutExpired:
            return {"success": False, "output": "Command timed out (30s limit).", "tool": "shell", "blocked": False}
        except Exception as e:
            return {"success": False, "output": f"Shell Error: {e}", "tool": "shell", "blocked": False}

    def _snapshot_before(self, tool: str, params: dict):
        """Take a pre-action snapshot for the undo log."""
        try:
            if tool == "write_file":
                path = params.get("path", "")
                cwd = params.get("cwd", self.working_dir)
                full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

                if os.path.exists(full_path):
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        prev = f.read()
                    self.undo_log.append(UndoEntry("write_file", full_path, previous_content=prev, was_new=False))
                else:
                    self.undo_log.append(UndoEntry("write_file", full_path, was_new=True))

            elif tool == "create_folder":
                path = params.get("path", "")
                cwd = params.get("cwd", self.working_dir)
                full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path
                was_new = not os.path.exists(full_path)
                self.undo_log.append(UndoEntry("create_folder", full_path, was_new=was_new))

            elif tool == "shell":
                # Shell commands are logged but not easily reversible
                command = params.get("command", "")
                self.undo_log.append(UndoEntry("shell", command))

        except Exception:
            pass  # Snapshot failure should never block execution

    def rollback(self) -> str:
        """
        Revert the last logged action.

        Returns:
            A human-readable description of what was rolled back.
        """
        if not self.undo_log:
            return "Nothing to rollback — undo log is empty."

        entry = self.undo_log.pop()

        try:
            if entry.action == "write_file":
                if entry.was_new:
                    # File was newly created — delete it
                    if os.path.exists(entry.path):
                        os.remove(entry.path)
                        return f"⏪ ROLLBACK: Deleted newly created file: {entry.path}"
                    return f"⏪ ROLLBACK: File already gone: {entry.path}"
                else:
                    # File was modified — restore previous content
                    with open(entry.path, "w", encoding="utf-8") as f:
                        f.write(entry.previous_content)
                    return f"⏪ ROLLBACK: Restored previous content of: {entry.path}"

            elif entry.action == "create_folder":
                if entry.was_new and os.path.exists(entry.path):
                    shutil.rmtree(entry.path)
                    return f"⏪ ROLLBACK: Removed newly created folder: {entry.path}"
                return f"⏪ ROLLBACK: Folder was not new, skipping: {entry.path}"

            elif entry.action == "shell":
                return f"⏪ ROLLBACK: Shell commands cannot be auto-reverted. Last command was: {entry.path[:100]}"

        except Exception as e:
            return f"⏪ ROLLBACK FAILED: {e}"

        return "⏪ ROLLBACK: No action taken."

    @property
    def undo_count(self) -> int:
        return len(self.undo_log)
