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
from brain.agents import AGENT_REGISTRY

# ============================================================
# APP + STATE
# ============================================================
app = FastAPI(title="Nexus OS Brain", version="4.0")
memory = SessionMemory(max_entries=20)
router = AgentRouter()

# Legacy prompt for backward compat
LEGACY_PROMPT = """
You are the core intelligence of Nexus OS, a self-correcting orchestrator.
Use the ReAct (Reason + Act) pattern loop: Plan -> Act -> Observe -> Verify -> Correct -> Done.

You MUST respond ONLY in valid JSON. You have two response profiles depending on your state:
If generating a new plan, return:
{
  "mission": "Describe the overall mission",
  "plan": [{"step": 1, "desc": "Step description", "tool": "tool", "params": {}}],
  "current_step": 0,
  "status": "planning"
}

If verifying an observation, respond with the next action or correction:
{
  "action": "tool_name",
  "params": {"param_key": "param_value"},
  "explanation": "Reasoning for the next act or correction."
}

Available tools include:
- set_context (params: {"key": "string", "value": "string"}) - Store interim data.
- get_context (params: {"key": "string"}) - Retrieve interim data.
- digital_janitor (params: {"target_dir": "path"})
- resource_reaper
- workflow_launcher (params: {"mode": "deep_work"})
- project_onboard (params: {"path": "path"})
- shell_execute (params: {"command": "cmd"})
- read_gui_state
- click_gui_element (params: {"element_id": "label"})
- type_into_gui (params: {"text": "text value"})
- read_file (params: {"path": "path"})
- write_file (params: {"path": "path", "content": "text"})

CRITICAL: Never assume a command worked. Check the `current_state` observation and emit Correction Actions if needed.
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
            from executor.memory import local_memory
            cognitive_history = local_memory.query_memory(user_input, limit=5)
        except Exception as memory_err:
            cognitive_history = f"(Memory module offline: {memory_err})"

        MEMORY_PROMPT = f"""
        -- SOVEREIGN MEMORY CONTEXT --
        {cognitive_history}
        Use this information to provide highly personalized and historically accurate responses.
        """

        # Add GUI Tools to the system prompt
        GUI_TOOLS_REGISTRY = """
        -- NATIVE GUI TOOLS --
        You have direct control over the native OS GUI.
        - read_gui_state: "Returns a JSON map of the current active window's UI elements. Use this to find buttons or fields."
        - gui_click: "Clicks a specific element based on the ID provided by read_gui_state." (Params: {"element_id": "value"})
        - gui_type: "Types a specific string into a text field in the active window." (Params: {"text": "value"})

        -- MCP PLATFORM TOOLS (Dynamic) --
        You are connected to an MCP Bridge. If the target requires external data (GitHub, Figma, etc.), use the corresponding MCP tool.
        - mcp_github_fetch (Params: {"repo": "string", "path": "string"})
        - mcp_figma_extract (Params: {"document_id": "string"})

        -- AGENT HANDOFF PROTOCOL --
        If a task requires another persona's specialty (e.g. SysAgent needs DevAgent to fix a script), use the "transfer" action.
        Format: {"action": "transfer", "transfer_to": "TargetAgent", "state": {"key": "value"}, "requirement": "Prompt for target agent"}

        -- AGENTIC PERFORMANCE LOOP --
        When interacting with the GUI or MCP tools, follow this exact reasoning flow:
        User Intent -> Tool Selection -> Execute -> Read State (Observe) -> Verify -> Correct/DONE.
        """

        enriched_prompt = f"{agent_prompt}\n{GUI_TOOLS_REGISTRY}\n\nSESSION HISTORY:\n{memory.get_context()}\n{MEMORY_PROMPT}"

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
