"""
Nexus OS GUI Engine

Uses macOS Accessibility (AX) APIs via PyObjC to read and control the UI.
Requires accessibility permissions granted to the terminal/Python environment.
"""

import sys
import logging
from typing import Dict, Any, List

# A global dictionary to map string IDs back to raw AXUIElementRefs
_ax_element_cache = {}

try:
    from ApplicationServices import (
        AXUIElementCreateSystemWide,
        AXUIElementCopyAttributeValue,
        AXUIElementPerformAction,
        AXUIElementSetAttributeValue,
        kAXFocusedApplicationAttribute,
        kAXFocusedWindowAttribute,
        kAXChildrenAttribute,
        kAXRoleAttribute,
        kAXTitleAttribute,
        kAXValueAttribute,
        kAXIdentifierAttribute,
        kAXPressAction
    )
    import Quartz
except ImportError:
    logging.warning("PyObjC frameworks not found. GUI Engine running in Mock Mode.")
    Quartz = None

def _get_ax_attribute(element, param):
    if not Quartz: return None
    err, val = AXUIElementCopyAttributeValue(element, param, None)
    if err == 0:
        return val
    return None

def _parse_element(element, depth=0, max_depth=5) -> Dict[str, Any]:
    if depth > max_depth or not Quartz:
        return {}
    
    role = _get_ax_attribute(element, kAXRoleAttribute)
    title = _get_ax_attribute(element, kAXTitleAttribute)
    identifier = _get_ax_attribute(element, kAXIdentifierAttribute)
    
    # Store in memory cache to allow clicking later
    el_id = f"el_{id(element)}"
    _ax_element_cache[el_id] = element

    node = {
        "id": el_id,
        "role": role if isinstance(role, str) else "Unknown",
        "title": title if isinstance(title, str) else "",
        "identifier": identifier if isinstance(identifier, str) else ""
    }

    children = _get_ax_attribute(element, kAXChildrenAttribute)
    if children and isinstance(children, (list, tuple)):
        # Limit branching to avoid massive payloads
        node["children"] = [_parse_element(c, depth + 1, max_depth) for c in children[:15]]
        
    return node

def get_active_window() -> Any:
    """Capture the AXUIElement of the current focused window and the app name."""
    if not Quartz:
        return None, "Mock App"
    system_wide = AXUIElementCreateSystemWide()
    err, focused_app = AXUIElementCopyAttributeValue(system_wide, kAXFocusedApplicationAttribute, None)
    if err != 0 or not focused_app: return None, "Unknown App"
    
    # Try to get app title (often works, depends on OS)
    app_title = _get_ax_attribute(focused_app, kAXTitleAttribute)
    if not isinstance(app_title, str):
        app_title = "Unknown App"

    err, focused_window = AXUIElementCopyAttributeValue(focused_app, kAXFocusedWindowAttribute, None)
    if err != 0 or not focused_window: 
        return None, app_title
    return focused_window, app_title

def dump_ax_tree() -> Dict[str, Any]:
    """Recursively traverse the window's children to create a JSON map of elements."""
    _ax_element_cache.clear()
    window, app_name = get_active_window()
    
    if not window:
        return {"error": "PyObjC not installed or no active window found.", "app_name": app_name, "elements": 0, "tree": {}}
        
    tree = _parse_element(window)
    elements_found = len(_ax_element_cache)
    
    return {
        "status": "success",
        "app_name": app_name,
        "elements": elements_found,
        "tree": tree
    }

def perform_action(element_id: str, action_type: str, value: str = None) -> str:
    """Execute a click or set value (type text) action on a specific element."""
    if not Quartz:
        return f"Mock mode: Performed {action_type} on {element_id} with '{value}'"
        
    if action_type == "type" and value is not None:
        # We use CoreGraphics to simulate deep keyboard events.
        # A robust implementation would map out characters, but for simplicity in this bridge, 
        # we can use AppleScript as a clean proxy for global typing.
        import subprocess
        escaped_text = value.replace('"', '\\"')
        script = f'tell application "System Events" to keystroke "{escaped_text}"'
        subprocess.run(["osascript", "-e", script])
        return f"Typed '{value}' into focused application."
        
    if action_type == "click":
        element = _ax_element_cache.get(element_id)
        if not element:
            return f"Error: Element {element_id} not found in cache. Did you read_gui_state first?"
            
        err = AXUIElementPerformAction(element, kAXPressAction)
        if err == 0:
            return f"Successfully clicked {element_id}"
        else:
            return f"Failed to click {element_id}. Error code: {err}"
            
    return f"Unsupported action: {action_type}"
