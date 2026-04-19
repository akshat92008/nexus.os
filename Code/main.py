"""
Nexus OS Brain — Thin FastAPI Shell.

This is the Cloud Run entry point. All logic lives in the brain/ and agents/ packages.
This file wires together the router, planner, memory, and agent registry.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from brain.planner import call_openrouter, extract_json
from brain.memory import SessionMemory
from brain.router import AgentRouter
from agents import AGENT_REGISTRY

# ============================================================
# APP + STATE
# ============================================================
app = FastAPI(title="Nexus OS Brain", version="4.0")
memory = SessionMemory(max_entries=20)
router = AgentRouter()

# Legacy prompt for backward compat
LEGACY_PROMPT = """
You are the core intelligence of Nexus OS. You translate user intent into macOS shell commands.
Respond ONLY in JSON format:
{"intent": "power" or "utility", "command": "command", "explanation": "explanation"}
"""


# ============================================================
# REQUEST MODELS
# ============================================================
class UserRequest(BaseModel):
    input: str
    history: list = []

class AgentMessage(BaseModel):
    role: str
    content: str

class AgentRequest(BaseModel):
    messages: List[AgentMessage]


# ============================================================
# ENDPOINTS
# ============================================================
@app.get("/")
async def health_check():
    return {
        "status": "online",
        "version": "4.0",
        "mode": "modular-agentic",
        "agents": list(AGENT_REGISTRY.keys()),
    }


@app.post("/think")
async def think(request: UserRequest):
    """Legacy single-shot endpoint for backward compatibility."""
    try:
        context = "\n".join([f"User: {h['u']}\nAI: {h['a']}" for h in request.history])
        messages = [
            {"role": "user", "content": f"History:\n{context}\n\nClient Intent: {request.input}"}
        ]
        raw_text = call_openrouter(LEGACY_PROMPT, messages)
        return extract_json(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent")
async def agent(request: AgentRequest):
    """
    Agentic endpoint with automatic agent routing.

    1. Extracts the user's original intent from the first message.
    2. Routes to the correct Agent Persona (DevAgent, SysAgent, LifeAgent).
    3. Calls the LLM with the agent's specialized prompt.
    4. Returns the next structured action.
    """
    try:
        # Extract the original user input (first user message in thread)
        user_input = ""
        for msg in request.messages:
            if msg.role == "user":
                user_input = msg.content
                break

        # Route to the correct agent
        agent_info = router.route(user_input)
        agent_prompt = agent_info["prompt"]

        # Inject memory context into the prompt
        try:
            from executor.memory_store import local_memory
            cognitive_history = local_memory.retrieve_relevant_context(user_input)
        except Exception as memory_err:
            cognitive_history = f"(Memory module offline: {memory_err})"

        # Add GUI Tools to the system prompt
        GUI_TOOLS_REGISTRY = """
        -- NATIVE GUI TOOLS --
        You have direct control over the native OS GUI. Use these if 'shell' is inefficient:
        - read_gui_state: Returns the structural map of the active window.
        - gui_click: Clicks a specific element. Params: {"element_id": "value"}
        - gui_type: Types text into the active field. Params: {"text": "value"}
        """

        enriched_prompt = f"{agent_prompt}\n{GUI_TOOLS_REGISTRY}\n\nSESSION HISTORY:\n{memory.get_context()}\n\nCOGNITIVE MEMORY:\n{cognitive_history}"

        # Build the OpenRouter message thread
        messages = []
        for msg in request.messages:
            if msg.role == "tool_result":
                messages.append({"role": "user", "content": msg.content})
            else:
                messages.append({"role": msg.role, "content": msg.content})

        raw_text = call_openrouter(enriched_prompt, messages)
        result = extract_json(raw_text)

        # Ensure required fields
        if "action" not in result:
            result["action"] = "done"
        if "tool" not in result:
            result["tool"] = "shell" if result.get("action") == "shell" else "none"
        if "params" not in result:
            result["params"] = {}

        # Tag the response with the selected agent
        result["agent_id"] = agent_info["agent_id"]
        result["agent_name"] = agent_info["agent_name"]
        result["agent_icon"] = agent_info["icon"]

        # Update memory if this is a "done" action
        if result["action"] == "done":
            memory.add(user_input, result.get("explanation", ""), agent_info["agent_id"])

        return result

    except Exception as e:
        print(f"Brain Error (agent): {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
