"""
Nexus OS Safety Layer — Command Blacklist & Guardrails.

Intercepts and blocks destructive commands unless the CEO
provides an explicit Force Override.
"""

import re
from typing import Tuple

# ============================================================
# BLACKLIST PATTERNS — Regex patterns for dangerous commands
# ============================================================
BLACKLIST_PATTERNS = [
    # Filesystem destruction
    (r"rm\s+(-[rfRF]+\s+)?/(?!\w)", "Recursive deletion of root filesystem"),
    (r"rm\s+(-[rfRF]+\s+)?~\s*$", "Recursive deletion of home directory"),
    (r"rm\s+(-[rfRF]+\s+)?\*\s*$", "Wildcard deletion in current directory"),

    # Disk-level destruction
    (r"mkfs\b", "Filesystem format command"),
    (r"dd\s+if=", "Direct disk write (dd)"),
    (r">\s*/dev/sd[a-z]", "Direct device overwrite"),

    # System shutdown/reboot
    (r"\bshutdown\b", "System shutdown command"),
    (r"\breboot\b", "System reboot command"),
    (r"\bhalt\b", "System halt command"),
    (r"\bpoweroff\b", "System poweroff command"),

    # Fork bomb
    (r":\(\)\s*\{", "Fork bomb detected"),

    # macOS specific dangers
    (r"diskutil\s+erase", "Disk erase command"),
    (r"sudo\s+rm\s+-rf\s+/", "Sudo root deletion"),

    # Credential theft
    (r"curl.*\|\s*sh", "Remote code execution via curl pipe"),
    (r"wget.*\|\s*sh", "Remote code execution via wget pipe"),

    # Python system-level
    (r"os\.system\s*\(\s*['\"]rm", "Python os.system deletion"),
    (r"shutil\.rmtree\s*\(\s*['\"/]", "Python shutil.rmtree on root"),
]

# Compile patterns for performance
_COMPILED = [(re.compile(pattern, re.IGNORECASE), reason) for pattern, reason in BLACKLIST_PATTERNS]


def check(command: str, force: bool = False) -> Tuple[bool, str]:
    """
    Check if a command is safe to execute.

    Args:
        command: The shell command or tool parameter string to check.
        force: If True, bypasses the blacklist (CEO override).

    Returns:
        (allowed: bool, reason: str)
        - (True, "OK") if the command is allowed.
        - (False, "reason") if the command is blocked.
    """
    if force:
        return True, "CEO Force Override active"

    if not command or not command.strip():
        return True, "OK"

    for pattern, reason in _COMPILED:
        if pattern.search(command):
            return False, f"⛔ BLOCKED: {reason} — Command: '{command[:80]}'"

    return True, "OK"


def check_path(path: str, force: bool = False) -> Tuple[bool, str]:
    """
    Check if a file path is safe to write to.

    Args:
        path: The file path to validate.
        force: If True, bypasses the check.

    Returns:
        (allowed: bool, reason: str)
    """
    if force:
        return True, "CEO Force Override active"

    if not path:
        return False, "⛔ BLOCKED: Empty file path"

    # Block writes to critical system paths
    dangerous_prefixes = [
        "/System/", "/Library/", "/usr/", "/bin/",
        "/sbin/", "/etc/", "/var/", "/private/",
    ]

    for prefix in dangerous_prefixes:
        if path.startswith(prefix):
            return False, f"⛔ BLOCKED: Write to protected system path: {prefix}"

    return True, "OK"
