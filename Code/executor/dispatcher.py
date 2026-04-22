"""
Nexus OS Central Executor

Enforces the new structured Action Schema.
Processes atomic tasks sequentially, injecting outputs into the next task.
"""

import os
import traceback
from typing import Dict, Any, List
from executor.state_manager import interim_state
from executor.schema import ActionSchema

try:
    from executor import gui_engine
    HAS_GUI = True
except ImportError:
    HAS_GUI = False

try:
    from executor.actions import TOOL_MAP
    HAS_ACTIONS = True
except ImportError:
    HAS_ACTIONS = False

class CentralExecutor:
    def __init__(self, working_dir: str = None):
        self.working_dir = working_dir or os.getcwd()
        self.undo_count = 0 # Track local actions for UI rollback

    def dispatch(self, tool: str, params: Dict[str, Any], force: bool = False) -> Dict[str, Any]:
        """Bridge for legacy ui.py calls. Maps to the new execute_task pattern."""
        task = {"type": tool, "params": params}
        result = self.execute_task(task)
        
        # UI expects specific format for safety blocks
        return {
            "status": result.status,
            "output": result.output,
            "current_state": result.current_state,
            "blocked": False # Safety logic handled in newer tools directly
        }

    def _get_current_state(self, is_gui: bool) -> str:
        """Captures a snapshot for self-verification."""
        if is_gui and HAS_GUI:
            try:
                tree = gui_engine.dump_ax_tree()
                return str(tree)
            except Exception as e:
                return f"Error capturing GUI state: {e}"
        else:
            try:
                files = os.listdir(self.working_dir)
                return f"Files in {self.working_dir}: {', '.join(files[:50])}"
            except Exception as e:
                return f"Error capturing File state: {e}"

    def execute_task(self, task: Dict[str, Any], previous_output: str = "") -> ActionSchema:
        """Executes a single atomic task wrapped in the strict Action Schema."""
        action_type = task.get("type", task.get("tool", "none"))
        params = task.get("params", {})
        
        action = ActionSchema(action_type, params)
        action.status = "executing"
        
        # Feed previous output into the next task
        if previous_output and "previous_output" not in action.params:
             action.params["previous_output"] = previous_output
             
        status_val = "Success"
        output_val = ""
        is_gui = False

        try:
            # 1. Check Omni-Tools
            if HAS_ACTIONS and action_type in TOOL_MAP:
                output_val = TOOL_MAP[action_type](action.params)
            
            # 2. Legacy handlers fallback
            elif action_type == "set_context":
                key = action.params.get("key", "")
                val = action.params.get("value", "")
                output_val = interim_state.set_context(key, val)
                
            elif action_type == "get_context":
                key = action.params.get("key", "")
                output_val = str(interim_state.get_context(key))
                
            elif action_type in ["read_gui_state", "gui_click", "gui_type"]:
                is_gui = True
                if HAS_GUI:
                    if action_type == "read_gui_state":
                        output_val = "Captured GUI State."
                    elif action_type == "gui_click":
                        output_val = gui_engine.perform_action(action.params.get("element_id", ""), "click")
                    elif action_type == "gui_type":
                        output_val = gui_engine.perform_action("", "type", action.params.get("text", ""))
                else:
                    status_val = "Fail"
                    output_val = "GUI Engine unavailable."

            elif action_type == "shell":
                output_val = TOOL_MAP["shell"](action.params)
                
            else:
                status_val = "Fail"
                output_val = f"Unknown action: {action_type}"

        except Exception as e:
            status_val = "Fail"
            output_val = f"Exception during execution: {traceback.format_exc()}"

        action.status = "completed" if status_val == "Success" else "failed"
        action.output = output_val

        return action

    def rollback(self) -> str:
        return "Rollback implemented in persistence layer."
