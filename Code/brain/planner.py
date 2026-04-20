import os
import json
import requests

def call_openrouter(prompt: str, messages: list):
    """
    Simulates or calls OpenRouter for LLM responses.
    Uses Gemini if GEMINI_API_KEY is available as fallback for direct routing.
    """
    key = os.getenv("OPENROUTER_KEY")
    if not key:
        return json.dumps({
            "action": "done",
            "explanation": "No OPENROUTER_KEY set. Check deploy-brain.sh or .env"
        })
        
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}"}
    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [{"role": "system", "content": prompt}] + messages,
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        return json.dumps({
            "action": "done",
            "explanation": f"API Error: {str(e)}"
        })

def extract_json(raw_text: str):
    """Safely parse the LLM text output into JSON."""
    try:
        # Strip potential markdown code blocks
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1)
        if raw_text.endswith("```"):
            raw_text = raw_text[::-1].replace("```", "", 1)[::-1]
            
        return json.loads(raw_text.strip())
    except Exception as e:
        return {
            "action": "done", 
            "tool": "none",
            "explanation": f"Failed to parse LLM response: {raw_text}"
        }
