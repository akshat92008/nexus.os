import json
import re
import requests
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

# --- MULTI-CLOUD CONFIGURATION ---
OPENROUTER_KEY = os.getenv("OPENROUTER_KEY", "sk-or-v1-YOUR_KEY_HERE")
MODEL_ID = "anthropic/claude-3-haiku"

app = FastAPI()

# ============================================================
# AGENTIC SYSTEM PROMPT — The "Soul" of Nexus OS
# ============================================================
SYSTEM_PROMPT = """
You are the Nexus Agent, a world-class autonomous software engineer operating inside Nexus OS.
You work in an agentic loop: ANALYZE → READ → PLAN → EXECUTE → VERIFY.

You have four tools. Respond ONLY in JSON with one of these actions:

1. READ a file:
   {"intent": "power", "action": "read", "command": "path/to/file", "explanation": "why"}

2. WRITE a file (use | to separate path from content):
   {"intent": "power", "action": "write", "command": "path/to/file | file content here", "explanation": "why"}

3. SHELL command (any bash/zsh):
   {"intent": "power", "action": "shell", "command": "ls -la", "explanation": "why"}

4. DONE (task complete, no more actions needed):
   {"intent": "done", "action": "done", "command": "", "explanation": "summary of what was accomplished"}

AGENTIC RULES:
- You receive results of your previous actions in the conversation. Use them to decide your NEXT action.
- When asked to fix a bug: READ the file first, then WRITE the fix, then SHELL to verify.
- When asked about git: SHELL `git diff` or `git status` first, then analyze, then SHELL `git commit`.
- When asked to create a project: SHELL `mkdir -p`, then WRITE each file with real production code.
- When asked to debug: READ log files, identify the error, READ the source file, then WRITE the fix.
- Always VERIFY your work with a final SHELL or READ before marking DONE.
- NEVER skip the analysis step. Always read before writing.
- Limit yourself to at most 8 actions per task. If you cannot finish, mark DONE with a summary of progress.
- Respond with ONLY the JSON object. No markdown, no explanation outside JSON.
"""

# ============================================================
# LEGACY PROMPT — For backward-compatible /think endpoint
# ============================================================
LEGACY_PROMPT = """
You are the core intelligence of Nexus OS. You translate user intent into macOS shell commands.
You have access to 'Session Memory' to remember previous tasks.

Respond ONLY in JSON format:
{"intent": "power" or "utility", "command": "command", "explanation": "explanation"}

SKILLSET GUIDELINES:
1. POWER LANE: Dev tasks (git, docker, system config). Always mark as 'power'.
2. UTILITY LANE: 
   - File Org: Use 'find' and 'mv' to organize folders.
   - App Launch: Use 'open -a "AppName"'.
   - System: Use 'osascript -e "..."' for macOS settings (Dark mode, Volume, etc).
3. MEMORY: Use the provided history to resolve pronouns (e.g., if the user says "delete it", check history to see what 'it' is).

Do not write conversational text. ONLY JSON.
"""


# ============================================================
# REQUEST MODELS
# ============================================================
class UserRequest(BaseModel):
    input: str
    history: list = []

class AgentMessage(BaseModel):
    role: str  # "user", "assistant", "system", "tool_result"
    content: str

class AgentRequest(BaseModel):
    messages: List[AgentMessage]


# ============================================================
# SHARED: OpenRouter API Call
# ============================================================
def call_openrouter(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """Call OpenRouter and return the raw text response."""
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "HTTP-Referer": "https://nexus-os.ai",
            "X-Title": "Nexus OS Agent",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL_ID,
            "messages": full_messages,
            "temperature": 0.1,  # Low temp for precise tool use
        },
        timeout=30,
    )

    res_json = response.json()
    if "choices" not in res_json:
        raise Exception(f"OpenRouter Error: {res_json}")

    return res_json["choices"][0]["message"]["content"]


def extract_json(raw_text: str) -> dict:
    """Extract a JSON object from potentially noisy LLM output."""
    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # Fallback: return raw text as an explanation
    return {
        "intent": "done",
        "action": "done",
        "command": "",
        "explanation": raw_text.strip()[:500]
    }


# ============================================================
# ENDPOINTS
# ============================================================
@app.get("/")
async def health_check():
    return {"status": "online", "model": MODEL_ID, "mode": "agentic"}


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
        print(f"Brain Error (think): {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent")
async def agent(request: AgentRequest):
    """
    Agentic endpoint. Accepts a full conversation thread and returns
    the next action the agent wants to take.
    """
    try:
        # Convert our AgentMessage models to OpenRouter format
        messages = []
        for msg in request.messages:
            if msg.role == "tool_result":
                # Tool results are sent as user messages with a prefix
                messages.append({"role": "user", "content": msg.content})
            else:
                messages.append({"role": msg.role, "content": msg.content})

        raw_text = call_openrouter(SYSTEM_PROMPT, messages)
        result = extract_json(raw_text)

        # Ensure the result has the required 'action' field
        if "action" not in result:
            result["action"] = "done"

        return result

    except Exception as e:
        print(f"Brain Error (agent): {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
