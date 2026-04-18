"""
Nexus OS Planner — The reasoning engine (Resilient Edition v4.1).

Handles communication with multiple LLM providers (OpenRouter, Groq, Gemini)
with corrected function mappings and optimized fallback models.
"""

import os
import json
import re
import requests
from typing import List, Dict

# --- Multi-Cloud Credentials ---
OPENROUTER_KEY = os.getenv("OPENROUTER_KEY", "sk-or-v1-YOUR_KEY_HERE")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# --- Model Selection ---
OR_MODEL = os.getenv("NEXUS_MODEL", "anthropic/claude-3-haiku")
GROQ_MODEL = "llama-3.1-8b-instant"  # Optimized for high rate limits
GEMINI_MODEL = "gemini-1.5-flash"


def _raw_call_openrouter(messages: List[Dict[str, str]]) -> str:
    """Internal API call to OpenRouter."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "HTTP-Referer": "https://nexus-os.ai",
        "X-Title": "Nexus OS",
        "Content-Type": "application/json",
    }
    data = {
        "model": OR_MODEL,
        "messages": messages,
        "temperature": 0.1,
    }
    resp = requests.post(url, headers=headers, json=data, timeout=20)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _raw_call_groq(messages: List[Dict[str, str]]) -> str:
    """Internal API call to Groq."""
    if not GROQ_API_KEY:
        raise ValueError("Groq API key missing")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.1,
    }
    resp = requests.post(url, headers=headers, json=data, timeout=15)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _raw_call_gemini(messages: List[Dict[str, str]]) -> str:
    """Internal API call to Gemini."""
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key missing")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    # Convert OpenAI-style messages to Gemini format
    contents = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    data = {"contents": contents}
    resp = requests.post(url, json=data, timeout=15)
    resp.raise_for_status()
    
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def call_openrouter_legacy_wrapper(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """
    Resilient wrapper that successfully attempts calls in order: OR -> Groq -> Gemini.
    """
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    errors = []
    
    # Tier 1: OpenRouter
    try:
        return _raw_call_openrouter(full_messages)
    except Exception as e:
        err_msg = f"OR: {str(e)}"
        print(f"⚠️ {err_msg}")
        errors.append(err_msg)
        
    # Tier 2: Groq
    try:
        return _raw_call_groq(full_messages)
    except Exception as e:
        err_msg = f"Groq: {str(e)}"
        print(f"⚠️ {err_msg}")
        errors.append(err_msg)

    # Tier 3: Gemini
    try:
        return _raw_call_gemini(full_messages)
    except Exception as e:
        err_msg = f"Gemini: {str(e)}"
        print(f"⚠️ {err_msg}")
        errors.append(err_msg)

    # Final Failure with Diagnostics
    error_summary = " | ".join(errors)
    raise Exception(f"Intelligence Exhausted: {error_summary}")


# PUBLIC API (Maps to legacy names used in main.py)
def call_openrouter(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    return call_openrouter_legacy_wrapper(system_prompt, messages)


def extract_json(raw_text: str) -> dict:
    """Extract a JSON object from LLM output."""
    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return {
        "intent": "done",
        "action": "done",
        "command": "",
        "explanation": raw_text.strip()[:500]
    }
