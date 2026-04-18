"""
Nexus OS Git Manager — High-reliability Git operations.

All functions return plain strings for the agentic loop to consume.
"""

import subprocess


def _run_git(args: str, cwd: str = ".") -> str:
    """Run a git command and return stdout or stderr."""
    result = subprocess.run(
        f"git {args}", shell=True, capture_output=True, text=True,
        timeout=15, cwd=cwd
    )
    output = result.stdout.strip() if result.stdout else result.stderr.strip()
    return output if output else "(no output)"


def git_status(cwd: str = ".") -> str:
    """Get the current git status of the repository."""
    return _run_git("status --short", cwd)


def git_diff(cwd: str = ".", staged: bool = False) -> str:
    """Get the diff of the current changes."""
    flag = "--staged" if staged else ""
    diff = _run_git(f"diff {flag}", cwd)
    # Truncate massive diffs
    if len(diff) > 6000:
        diff = diff[:6000] + "\n\n... [DIFF TRUNCATED — showing first 6000 chars]"
    return diff


def git_commit(message: str, cwd: str = ".") -> str:
    """Stage all changes and commit with the given message."""
    _run_git("add -A", cwd)
    return _run_git(f'commit -m "{message}"', cwd)


def git_log(count: int = 5, cwd: str = ".") -> str:
    """Get the last N commit logs in one-line format."""
    return _run_git(f"log --oneline -n {count}", cwd)
