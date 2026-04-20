import re
from brain.agents import AGENT_REGISTRY

class AgentRouter:
    """Master Orchestrator that intercepts user intent and maps it to the correct persona."""
    
    def route(self, user_input: str) -> dict:
        ui_lower = user_input.lower()
        
        # DevAgent heuristics
        if re.search(r"code|bug|refactor|terminal|git|build|npm|python|test|script|module", ui_lower):
            return AGENT_REGISTRY["dev_agent"]
            
        # SysAgent heuristics
        elif re.search(r"find|file|system|app|screen|ax tree|window|macos|safari|click|type", ui_lower):
            return AGENT_REGISTRY["sys_agent"]
            
        # Default / Fallback: LifeAgent 
        else:
            return AGENT_REGISTRY["life_agent"]
