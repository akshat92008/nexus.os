from .dev_agent import prompt as dev_prompt
from .sys_agent import prompt as sys_prompt
from .life_agent import prompt as life_prompt

AGENT_REGISTRY = {
    "dev_agent": {
        "agent_id": "dev_agent",
        "agent_name": "DevAgent",
        "icon": "🛠️",
        "prompt": dev_prompt
    },
    "sys_agent": {
        "agent_id": "sys_agent",
        "agent_name": "SysAgent",
        "icon": "🛡️",
        "prompt": sys_prompt
    },
    "life_agent": {
        "agent_id": "life_agent",
        "agent_name": "LifeAgent",
        "icon": "🧠",
        "prompt": life_prompt
    }
}
