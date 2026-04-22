class SessionMemory:
    """Manages short-term conversation context buffers to prevent context limits."""
    
    def __init__(self, max_entries=20):
        self.history = []
        self.max_entries = max_entries
        
    def add(self, user_input: str, action: str, agent: str):
        """Adds a completed interaction to the memory stack."""
        self.history.append({"u": user_input, "a": f"[{agent}]: {action}"})
        if len(self.history) > self.max_entries:
            self.history.pop(0)
            
    def get_context(self) -> str:
        """Returns stringified session history for LLM consumption."""
        if not self.history:
            return "No previous actions in this session."
        return "\n".join([f"User: {h['u']} -> Task executed: {h['a']}" for h in self.history])
