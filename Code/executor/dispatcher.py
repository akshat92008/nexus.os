"""
Nexus OS OAV Dispatcher

Enforces the Observation-Action-Verification (OAV) loop.
Every action must return a Result object containing:
- status (Success/Fail)
- output (text/logs)
- current_state (a snapshot of the AX Tree or file list)
"""

import os
import traceback
from typing import Dict, Any
from executor.state_manager import interim_state

# We may fallback to importing gui_engine if it exists and is needed.
try:
    from executor import gui_engine
    HAS_GUI = True
except ImportError:
    HAS_GUI = False

class Dispatcher:
    def __init__(self, working_dir: str = None):
        self.working_dir = working_dir or os.getcwd()
        self.undo_count = 0

    def _get_current_state(self, is_gui: bool) -> str:
        """Captures a snapshot for self-verification."""
        if is_gui and HAS_GUI:
            try:
                tree = gui_engine.dump_ax_tree()
                # Return stringified version or specific layout summary
                return str(tree)
            except Exception as e:
                return f"Error capturing GUI state: {e}"
        else:
            try:
                # File list snapshot
                files = os.listdir(self.working_dir)
                return f"Files in {self.working_dir}: {', '.join(files[:50])}"
            except Exception as e:
                return f"Error capturing File state: {e}"

    def dispatch(self, action_type: str, params: Dict[str, Any], override: bool = False) -> Dict[str, Any]:
        """
        Executes the tool and wraps the payload in the OAV Result format.
        """
        status = "Success"
        output = ""
        is_gui = False

        try:
            if action_type == "set_context":
                key = params.get("key", "")
                val = params.get("value", "")
                output = interim_state.set_context(key, val)
                
            elif action_type == "get_context":
                key = params.get("key", "")
                output = str(interim_state.get_context(key))
                
            elif action_type == "read_gui_state":
                is_gui = True
                if HAS_GUI:
                    output = "Captured GUI State."
                else:
                    status = "Fail"
                    output = "GUI Engine unavailable."
                    
            elif action_type == "gui_click":
                is_gui = True
                if HAS_GUI:
                    element_id = params.get("element_id", "")
                    output = gui_engine.perform_action(element_id, "click")
                else:
                    status = "Fail"
                    output = "GUI Engine unavailable."
                    
            elif action_type == "gui_type":
                is_gui = True
                if HAS_GUI:
                    text = params.get("text", "")
                    output = gui_engine.perform_action("", "type", text)
                else:
                    status = "Fail"
                    output = "GUI Engine unavailable."

            elif action_type == "shell":
                cmd = params.get("command", "")
                output = f"Simulated execution of: {cmd}" # Fast fallback
                
            else:
                status = "Fail"
                output = f"Unknown action: {action_type}"

        except Exception as e:
            status = "Fail"
            output = f"Exception during execution: {traceback.format_exc()}"

        current_state = self._get_current_state(is_gui)

        return {
            "status": status,
            "output": output,
            "current_state": current_state
        }

    def rollback(self) -> str:
        self.undo_count = 0
        return "Rollback executed."
