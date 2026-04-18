"""
Nexus OS File Manager — Structured file I/O operations.

All functions return plain strings for the agentic loop to consume.
"""

import os
import glob as globmod


def read_file(path: str, cwd: str = ".") -> str:
    """Read a local file and return its contents."""
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        if len(content) > 8000:
            content = content[:8000] + "\n\n... [TRUNCATED — showing first 8000 chars]"
        return content
    except FileNotFoundError:
        return f"ERROR: File not found: {full_path}"
    except Exception as e:
        return f"ERROR: Could not read file: {e}"


def write_file(path: str, content: str, cwd: str = ".") -> str:
    """Write content to a local file. Creates parent dirs as needed."""
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

    try:
        parent = os.path.dirname(full_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"SUCCESS: Wrote {len(content)} chars to {path}"
    except Exception as e:
        return f"ERROR: Could not write file: {e}"


def create_folder(path: str, cwd: str = ".") -> str:
    """Create a directory. Creates parent dirs as needed."""
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

    try:
        os.makedirs(full_path, exist_ok=True)
        return f"SUCCESS: Created folder: {path}"
    except Exception as e:
        return f"ERROR: Could not create folder: {e}"


def list_dir(path: str = ".", cwd: str = ".") -> str:
    """List contents of a directory."""
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path

    try:
        entries = sorted(os.listdir(full_path))
        dirs = [f"📁 {e}/" for e in entries if os.path.isdir(os.path.join(full_path, e))]
        files = [f"📄 {e}" for e in entries if os.path.isfile(os.path.join(full_path, e))]
        return "\n".join(dirs + files) if (dirs or files) else "(empty directory)"
    except FileNotFoundError:
        return f"ERROR: Directory not found: {full_path}"
    except Exception as e:
        return f"ERROR: {e}"


def find_files(pattern: str, path: str = ".", cwd: str = ".") -> str:
    """Find files matching a glob pattern recursively."""
    full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path
    search = os.path.join(full_path, "**", pattern)

    try:
        matches = globmod.glob(search, recursive=True)
        if not matches:
            return f"No files matching '{pattern}' found in {path}"
        # Truncate results
        if len(matches) > 50:
            matches = matches[:50]
            matches.append(f"... and more (showing first 50)")
        return "\n".join(matches)
    except Exception as e:
        return f"ERROR: {e}"
