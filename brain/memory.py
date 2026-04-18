"""
Nexus OS Memory — Session history and persistent state management.

Maintains a sliding window of conversation history for contextual
awareness across the agentic loop.
"""

from typing import List, Dict
from collections import deque


class SessionMemory:
    """
    Manages a sliding window of user/agent interactions.
    Provides formatted history for injection into agent prompts.
    """

    def __init__(self, max_entries: int = 20):
        self.max_entries = max_entries
        self._history: deque = deque(maxlen=max_entries)

    def add(self, user_input: str, agent_summary: str, agent_id: str = "unknown"):
        """Record a completed interaction."""
        self._history.append({
            "user": user_input,
            "agent": agent_id,
            "summary": agent_summary,
        })

    def get_context(self) -> str:
        """Format history as a context string for prompt injection."""
        if not self._history:
            return "(No previous interactions)"

        lines = []
        for i, entry in enumerate(self._history):
            lines.append(
                f"[{i+1}] User: {entry['user']}\n"
                f"    Agent({entry['agent']}): {entry['summary']}"
            )
        return "\n".join(lines)

    def get_raw(self) -> List[Dict]:
        """Return raw history as a list of dicts."""
        return list(self._history)

    def clear(self):
        """Clear all history."""
        self._history.clear()

    @property
    def size(self) -> int:
        return len(self._history)
