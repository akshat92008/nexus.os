"""
Nexus OS Agent Registry — Maps agent IDs to their personas.
"""

from agents.dev_agent import DEV_AGENT
from agents.sys_agent import SYS_AGENT
from agents.life_agent import LIFE_AGENT

AGENT_REGISTRY = {
    "dev":  DEV_AGENT,
    "sys":  SYS_AGENT,
    "life": LIFE_AGENT,
}

__all__ = ["AGENT_REGISTRY", "DEV_AGENT", "SYS_AGENT", "LIFE_AGENT"]
