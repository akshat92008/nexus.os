import os
import asyncio
from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Input, Log, Static
from textual.containers import Container
import requests
import subprocess

# --- CLOUD CONFIGURATION ---
BRAIN_URL = "https://nexus-intelligence-370736307795.us-east1.run.app"
AGENT_URL = f"{BRAIN_URL}/agent"
THINK_URL = f"{BRAIN_URL}/think"

MAX_AGENT_LOOPS = 10          # Safety valve: max autonomous iterations
WORKING_DIR = os.getcwd()     # Root directory for file operations


class NexusOS(App):
    CSS = """
    Screen { background: #0a0a0a; }
    #main_container { layout: vertical; }
    #log_window { height: 1fr; border: solid #333; margin: 1; background: #000; color: #0f0; }
    #input_window { height: auto; margin: 1; }
    Input { background: #1a1a1a; color: #fff; border: solid #444; }
    .status_bar { background: #111; color: #aaa; padding: 1; }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="main_container"):
            yield Static("🌟 NEXUS OS v3.0 — AGENTIC MODE | Status: ONLINE", classes="status_bar")
            yield Log(id="log_window")
            yield Input(placeholder="Enter your mission, CEO...", id="input_window")
        yield Footer()

    def on_mount(self) -> None:
        self.history = []
        log = self.query_one("#log_window")
        log.write_line("🚀 Nexus OS v3.0 Booted — Agentic Core Active.")
        log.write_line("💡 Try: 'Create a FastAPI project called nexus-api'")
        log.write_line("💡 Try: 'Read brain.py and tell me what model we use'")
        log.write_line("💡 Try: 'Check my git status and commit everything'")
        log.write_line("")

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        user_input = event.value.strip()
        if not user_input:
            return

        input_widget = self.query_one("#input_window")
        log = self.query_one("#log_window")

        input_widget.value = ""
        log.write_line(f"\nCEO > {user_input}")

        # Run the agentic loop in a background thread to keep TUI responsive
        self.run_worker(self._run_agent_loop(user_input, log))

    async def _run_agent_loop(self, user_input: str, log: Log) -> None:
        """
        The core agentic loop. Sends the user's mission to the Cloud Brain,
        then autonomously executes read/write/shell actions and feeds
        results back until the Brain signals 'done'.
        """
        # Build the initial conversation thread
        thread = [
            {"role": "user", "content": user_input}
        ]

        for iteration in range(MAX_AGENT_LOOPS):
            log.write_line(f"   ⚙️  Agent Loop [{iteration + 1}/{MAX_AGENT_LOOPS}]")

            try:
                # Call the Cloud Brain's /agent endpoint
                payload = {"messages": thread}
                resp = await asyncio.to_thread(
                    requests.post, AGENT_URL, json=payload, timeout=30
                )

                if resp.status_code != 200:
                    log.write_line(f"   ❌ Brain Error: {resp.text[:200]}")
                    break

                brain_response = resp.json()
                action = brain_response.get("action", "done")
                command = brain_response.get("command", "")
                explanation = brain_response.get("explanation", "")

                log.write_line(f"   🧠 {explanation}")

                # Append the Brain's response to the conversation thread
                thread.append({
                    "role": "assistant",
                    "content": json.dumps(brain_response)
                })

                # ==========================================
                # ACTION ROUTER
                # ==========================================

                if action == "done":
                    log.write_line("   ✅ Mission Complete.")
                    break

                elif action == "read":
                    result = await self._action_read(command, log)
                    thread.append({
                        "role": "tool_result",
                        "content": f"[FILE CONTENTS of {command}]:\n{result}"
                    })

                elif action == "write":
                    result = await self._action_write(command, log)
                    thread.append({
                        "role": "tool_result",
                        "content": result
                    })

                elif action == "shell":
                    result = await self._action_shell(command, log)
                    thread.append({
                        "role": "tool_result",
                        "content": f"[SHELL OUTPUT of `{command}`]:\n{result}"
                    })

                else:
                    log.write_line(f"   ⚠️ Unknown action: {action}. Stopping.")
                    break

            except Exception as e:
                log.write_line(f"   ❌ Loop Error: {e}")
                break

        # Update session memory with a summary
        self.history.append({"u": user_input, "a": f"[Agent completed in {iteration + 1} steps]"})
        if len(self.history) > 10:
            self.history.pop(0)

    # ============================================================
    # ACTION HANDLERS
    # ============================================================

    async def _action_read(self, filepath: str, log: Log) -> str:
        """Read a local file and return its contents."""
        filepath = filepath.strip()
        full_path = os.path.join(WORKING_DIR, filepath) if not os.path.isabs(filepath) else filepath

        log.write_line(f"   📖 Reading: {full_path}")

        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            # Truncate massive files to avoid token limits
            if len(content) > 8000:
                content = content[:8000] + "\n\n... [TRUNCATED — file too large, showing first 8000 chars]"
            log.write_line(f"   📄 Read {len(content)} characters.")
            return content
        except FileNotFoundError:
            msg = f"ERROR: File not found: {full_path}"
            log.write_line(f"   ❌ {msg}")
            return msg
        except Exception as e:
            msg = f"ERROR: Could not read file: {e}"
            log.write_line(f"   ❌ {msg}")
            return msg

    async def _action_write(self, command: str, log: Log) -> str:
        """Write content to a local file. Command format: 'path/to/file | content'."""
        if "|" not in command:
            msg = "ERROR: Write command must use format: path/to/file | content"
            log.write_line(f"   ❌ {msg}")
            return msg

        filepath, content = command.split("|", 1)
        filepath = filepath.strip()
        content = content.strip()
        full_path = os.path.join(WORKING_DIR, filepath) if not os.path.isabs(filepath) else filepath

        log.write_line(f"   ✍️  Writing: {full_path}")

        try:
            # Create parent directories if needed
            os.makedirs(os.path.dirname(full_path), exist_ok=True) if os.path.dirname(full_path) else None
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            msg = f"SUCCESS: Wrote {len(content)} characters to {filepath}"
            log.write_line(f"   ✅ {msg}")
            return msg
        except Exception as e:
            msg = f"ERROR: Could not write file: {e}"
            log.write_line(f"   ❌ {msg}")
            return msg

    async def _action_shell(self, command: str, log: Log) -> str:
        """Execute a shell command and return its output."""
        log.write_line(f"   🔧 Executing: {command}")

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                command, shell=True, capture_output=True, text=True,
                timeout=30, cwd=WORKING_DIR
            )
            output = result.stdout if result.stdout else result.stderr
            if not output:
                output = "(no output)"

            # Truncate massive outputs
            if len(output) > 4000:
                output = output[:4000] + "\n... [TRUNCATED]"

            log.write_line(f"   📟 Output: {output[:200]}{'...' if len(output) > 200 else ''}")
            return output
        except subprocess.TimeoutExpired:
            msg = "ERROR: Command timed out after 30 seconds."
            log.write_line(f"   ❌ {msg}")
            return msg
        except Exception as e:
            msg = f"ERROR: {e}"
            log.write_line(f"   ❌ {msg}")
            return msg


# Need json import for thread serialization
import json

if __name__ == "__main__":
    NexusOS().run()
