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

def get_active_window_structure() -> Dict[str, Any]:
    """Captures the hierarchical tree of the currently focused application window."""
    if not Quartz:
        return {"error": "PyObjC not installed. Mock Window Structure returned.", "children": []}

    _ax_element_cache.clear()
    
    system_wide = AXUIElementCreateSystemWide()
    
    # Get Focused Application
    err, focused_app = AXUIElementCopyAttributeValue(system_wide, kAXFocusedApplicationAttribute, None)
    if err != 0 or not focused_app:
        return {"error": "Could not find focused application."}

    # Get Focused Window
    err, focused_window = AXUIElementCopyAttributeValue(focused_app, kAXFocusedWindowAttribute, None)
    if err != 0 or not focused_window:
        return {"error": "Could not find focused window in application."}

    # Parse Tree
    tree = _parse_element(focused_window)
    return {"status": "success", "tree": tree}

def click_element(element_id: str) -> str:
    """Sends a native click event to a specific UI element."""
    if not Quartz:
        return f"Mock mode: Clicked {element_id}"

    element = _ax_element_cache.get(element_id)
    if not element:
        return f"Error: Element {element_id} not found in cache. Did you read_gui_state first?"

    err = AXUIElementPerformAction(element, kAXPressAction)
    if err == 0:
        return f"Successfully clicked {element_id}"
    else:
        return f"Failed to click {element_id}. Error code: {err}"

def type_text(text: str) -> str:
    """Inject text into the currently focused text field using CGEvent."""
    if not Quartz:
        return f"Mock mode: Typed '{text}'"
        
    # We use CoreGraphics to simulate deep keyboard events.
    # A robust implementation would map out characters to CGEventCreateKeyboardEvent,
    # but for simplicity in this bridge, we can use AppleScript as a clean proxy for global typing.
    import subprocess
    escaped_text = text.replace('"', '\\"')
    script = f'tell application "System Events" to keystroke "{escaped_text}"'
    subprocess.run(["osascript", "-e", script])
    return f"Typed '{text}' into focused application."
