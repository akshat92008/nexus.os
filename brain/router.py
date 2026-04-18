"""
Nexus OS Router — Intent classification and agent selection.

Analyzes user input and routes to the correct specialized agent persona.
Uses keyword heuristics first, with LLM classification as fallback.
"""

from agents import AGENT_REGISTRY
from brain.planner import call_openrouter, extract_json

# ============================================================
# KEYWORD HEURISTICS — Fast, zero-cost classification
# ============================================================
DEV_KEYWORDS = {
    "git", "commit", "push", "pull", "merge", "branch", "diff", "clone", "repo",
    "docker", "container", "build", "deploy", "test", "debug", "fix", "bug",
    "code", "function", "class", "import", "pip", "npm", "pnpm", "yarn",
    "python", "javascript", "typescript", "react", "fastapi", "flask",
    "scaffold", "refactor", "lint", "format", "compile", "run",
    "create project", "new project", "api", "server", "database",
    "error", "traceback", "exception", "log", "crash",
}

SYS_KEYWORDS = {
    "open", "close", "launch", "quit", "kill", "finder", "safari", "chrome",
    "settings", "preferences", "volume", "brightness", "dark mode", "wifi",
    "bluetooth", "battery", "screenshot", "screen", "display",
    "folder", "file", "move", "copy", "delete", "rename", "organize",
    "cleanup", "trash", "desktop", "downloads", "documents",
    "process", "memory", "cpu", "disk", "space", "storage",
}

LIFE_KEYWORDS = {
    "email", "mail", "message", "whatsapp", "slack", "telegram", "sms",
    "calendar", "schedule", "meeting", "reminder", "notification",
    "todo", "task", "note", "contact", "call", "inbox",
}


class AgentRouter:
    """
    Classifies user intent and selects the appropriate agent persona.
    """

    def route(self, user_input: str) -> dict:
        """
        Analyze user input and return the selected agent.

        Returns:
            {"agent_id": str, "agent_name": str, "prompt": str, "icon": str}
        """
        input_lower = user_input.lower()

        # Score each domain by keyword matches
        scores = {
            "dev":  sum(1 for kw in DEV_KEYWORDS if kw in input_lower),
            "sys":  sum(1 for kw in SYS_KEYWORDS if kw in input_lower),
            "life": sum(1 for kw in LIFE_KEYWORDS if kw in input_lower),
        }

        # Select highest scoring agent (default to dev for ambiguous cases)
        best = max(scores, key=scores.get)

        # If no keywords matched at all, default to dev (most capable)
        if scores[best] == 0:
            best = "dev"

        agent = AGENT_REGISTRY[best]
        return agent

    def route_with_context(self, user_input: str, history_context: str = "") -> dict:
        """
        Same as route(), but can optionally use history context
        for more informed routing decisions.
        """
        # For now, keyword heuristics are sufficient.
        # LLM-based classification can be added here in the future.
        return self.route(user_input)
