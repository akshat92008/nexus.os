"""
Nexus OS Interim State Engine

Provides an in-memory key-value store that persists for the duration of a mission.
This eliminates the "Toggle Tax" by allowing the AI to temporarily stash context
(like an invoice amount from an email) and retrieve it later for another app.
"""

from typing import Dict, Any

class StateManager:
    def __init__(self):
        self._store: Dict[str, Any] = {}

    def set_context(self, key: str, value: Any) -> str:
        """Stores a piece of data temporarily."""
        self._store[key] = value
        return f"Successfully stored context for key: '{key}'"

    def get_context(self, key: str) -> Any:
        """Retrieves data for the next tool call."""
        if key in self._store:
            return self._store[key]
        return f"Error: Key '{key}' not found in Interim State."

    def clear(self) -> str:
        """Clears the interim state at the end of a mission."""
        self._store.clear()
        return "Interim state cleared."

# Global singleton
interim_state = StateManager()
