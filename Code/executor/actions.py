import os
import subprocess
from .session import session

def global_search(params):
    """Recursive regex search across the entire codebase."""
    query = params.get("query")
    if not query: return "❌ Error: Missing query for global_search."
    # Uses grep with recursion and line numbers
    cmd = f"grep -rnE '{query}' . --exclude-dir=.git --exclude-dir=node_modules"
    return session.run_command(cmd)

def list_files_recursive(params):
    """Deep project structure discovery."""
    depth = params.get("depth", 3)
    # Returns a tree-like list
    cmd = f"find . -maxdepth {depth} -not -path '*/.*' -not -path '*/node_modules*'"
    return session.run_command(cmd)

def git_manage(params):
    """Git lifecycle management within the persistent session."""
    action = params.get("action") # 'diff', 'commit', 'branch', 'status'
    msg = params.get("message", "Nexus OS: Sovereignty Sync")
    
    if action == "diff":
        cmd = "git diff"
    elif action == "commit":
        cmd = f'git add . && git commit -m "{msg}"'
    elif action == "branch":
        name = params.get("name")
        if not name: return "❌ Error: Missing branch name."
        cmd = f"git checkout -b {name}"
    elif action == "status":
        cmd = "git status"
    else:
        return "❌ Unsupported git action."
    
    return session.run_command(cmd)

def patch_file(params):
    """Precision edit tool using persistent read/write."""
    path = params.get("path")
    search_text = params.get("search_text")
    replace_text = params.get("replace_text")
    
    if not path or not os.path.exists(path):
        return f"❌ Error: File not found at {path}"

    try:
        with open(path, 'r') as f:
            content = f.read()
        
        if search_text not in content:
            return f"❌ Error: Search text not found in {path}. Use global_search to verify content."
        
        new_content = content.replace(search_text, replace_text, 1)
        
        with open(path, 'w') as f:
            f.write(new_content)
        return f"✅ Patched {path} successfully."
    except Exception as e:
        return f"❌ Patching error: {str(e)}"

from . import skills

# Updated Elite Tool Registry
TOOL_MAP = {
    "global_search": global_search,
    "list_files": list_files_recursive,
    "git_manage": git_manage,
    "patch_file": patch_file,
    "shell": lambda p: session.run_command(p.get("command")),
    "run_test": lambda p: session.run_command(p.get("command")),
    
    # --- HERO SKILLS ---
    "digital_janitor": skills.digital_janitor,
    "resource_reaper": skills.resource_reaper,
    "workflow_launcher": skills.workflow_launcher,
    "project_onboard": skills.project_onboard
}
