import uuid
from typing import Dict, Any, Literal

class ActionSchema:
    def __init__(self, action_type: str, params: Dict[str, Any]):
        self.action_id = str(uuid.uuid4())
        self.type: str = action_type
        self.params: Dict[str, Any] = params
        self.status: Literal["pending", "executing", "completed", "failed"] = "pending"
        self.output: str = ""
        
    def to_dict(self):
        return {
            "action_id": self.action_id,
            "type": self.type,
            "params": self.params,
            "status": self.status,
            "output": self.output
        }
