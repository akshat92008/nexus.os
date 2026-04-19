"""
Nexus OS Cyber-Shell v5.0 — Hardened Agentic TUI.

Features:
- Agent-aware UI (shows which persona is "thinking")
- Structured tool dispatching via executor.Dispatcher
- Safety interception with CEO override prompt
- Rollback capability on failure
- Autonomous agentic loop with safety valve
"""

import os
import json
import asyncio
from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Input, Log, Static, TabbedContent, TabPane, Button
from textual.containers import Container, Horizontal
import requests

from executor.dispatcher import Dispatcher

# --- CLOUD CONFIGURATION ---
BRAIN_URL = "https://nexus-intelligence-370736307795.us-east1.run.app"
AGENT_URL = f"{BRAIN_URL}/agent"

MAX_AGENT_LOOPS = 10
WORKING_DIR = os.getcwd()


class NexusOS(App):
    CSS = """
    Screen { background: #0a0a0a; }
    #main_container { layout: vertical; }
    #log_window { height: 1fr; border: solid #333; margin: 1; background: #000; color: #0f0; }
    #input_window { height: auto; margin: 1; }
    Input { background: #1a1a1a; color: #fff; border: solid #444; }
    .status_bar { background: #111; color: #0ff; padding: 1; }
    .agent_bar { background: #1a0a2e; color: #b388ff; padding: 1; }
    .safety_bar { background: #3a0a0a; color: #ff4444; padding: 1; }
    #memory_log { height: 1fr; border: solid #333; margin: 1; background: #000; color: #ffeb3b; }
    #button_bar { height: auto; margin: 1; }
    Button { margin-right: 2; }
    """

    BINDINGS = [
        ("y", "approve_action", "Approve"),
        ("n", "deny_action", "Deny"),
        ("ctrl+z", "trigger_rollback", "Rollback"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with TabbedContent(initial="tab_agent"):
            with TabPane("Agent Shell", id="tab_agent"):
                with Container(id="main_container"):
                    yield Static(
                        "🌟 NEXUS OS v5.0 — MCP PLATFORM | Status: ONLINE | 🔌 MCP Tools: 2 Connected",
                        classes="status_bar"
                    )
                    yield Static(
                        "🤖 Agent Handoff Chain: [Orchestrator]",
                        id="agent_indicator",
                        classes="agent_bar"
                    )
                    yield Log(id="log_window")
                    yield Input(placeholder="Enter your mission, CEO...", id="input_window")
            with TabPane("Memory Management", id="tab_memory"):
                with Container():
                    with Horizontal(id="button_bar"):
                        yield Button("Trigger Full System Index", id="btn_index", variant="primary")
                        yield Button("View Recent Memories", id="btn_view", variant="success")
                        yield Button("Wipe Memory DB", id="btn_wipe", variant="error")
                    yield Log(id="memory_log")
        yield Footer()

    def on_mount(self) -> None:
        self.history = []
        self.dispatcher = Dispatcher(working_dir=WORKING_DIR)
        self._pending_override = None  # For CEO confirmation flow
        self._override_event = asyncio.Event()

        log = self.query_one("#log_window")
        log.write_line("🚀 Nexus OS v5.0 Booted — Hardened Agentic Core Active.")
        log.write_line("   🔮 DevAgent  — git, code, debug, scaffold")
        log.write_line("   🖥️  SysAgent  — apps, settings, file org")
        log.write_line("   💬 LifeAgent — messages, calendar, email")
        log.write_line("")
        log.write_line("🛡️  Safety Layer ACTIVE — Destructive commands require CEO override")
        log.write_line("⏪ Press Ctrl+Z to rollback the last action")
        log.write_line("")
        log.write_line("💡 Try: 'Create a folder called test-nexus and a hello.txt inside it'")
        log.write_line("💡 Try: 'Delete my root directory' (safety test)")
        log.write_line("")
        log.write_line("🚀 QUICK ACTIONS (Midnight Sprint):")
        log.write_line("   ✨ 'Clean my desktop'      -> Launches Digital Janitor")
        log.write_line("   ✨ 'Enter Deep Work mode'  -> Launches Workflow Launcher")
        log.write_line("   ✨ 'Explain this project'  -> Launches Project Onboard")
        log.write_line("   ✨ 'Check RAM hogs'        -> Launches Resource Reaper")
        log.write_line("")

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        user_input = event.value.strip()
        if not user_input:
            return

        input_widget = self.query_one("#input_window")
        log = self.query_one("#log_window")

        input_widget.value = ""
        log.write_line(f"\nCEO > {user_input}")

        self.run_worker(self._run_agent_loop(user_input, log))

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        mem_log = self.query_one("#memory_log")
        try:
            from executor.memory import local_memory, index_folder
        except ImportError as e:
            mem_log.write_line(f"❌ Memory module unavailable: {e}")
            return

        if event.button.id == "btn_index":
            mem_log.write_line("🔄 Triggering Sovereign System Index...")
            # Run indexing in thread to not block UI
            def run_idx():
                return index_folder(WORKING_DIR)
            res = await asyncio.to_thread(run_idx)
            mem_log.write_line(f"✅ {res}")
            
        elif event.button.id == "btn_view":
            mem_log.write_line("📥 Fetching recent memories...")
            recent = local_memory.get_recent_memories(10)
            if not recent:
                mem_log.write_line("   (No memories stored yet.)")
            else:
                for idx, (ts, content, meta) in enumerate(recent):
                    src = meta.get('file', 'Unknown')
                    mem_log.write_line(f"[{idx+1}] {ts} | {src}")
                    mem_log.write_line(f"    {content[:150]}...")
                    
        elif event.button.id == "btn_wipe":
            mem_log.write_line("⚠️ Wiping Sovereign Memory DB...")
            res = local_memory.wipe_memory()
            mem_log.write_line(f"🛑 {res}")

    def action_approve_action(self) -> None:
        """CEO presses Y to approve a blocked action."""
        if self._pending_override:
            self._pending_override = "approved"
            self._override_event.set()

    def action_deny_action(self) -> None:
        """CEO presses N to deny a blocked action."""
        if self._pending_override:
            self._pending_override = "denied"
            self._override_event.set()

    def action_trigger_rollback(self) -> None:
        """CEO presses Ctrl+Z to rollback last action."""
        log = self.query_one("#log_window")
        result = self.dispatcher.rollback()
        log.write_line(f"   {result}")

    async def _run_agent_loop(self, user_input: str, log: Log) -> None:
        """The core agentic loop with safety interception and structured dispatching."""
        thread = [{"role": "user", "content": user_input}]
        agent_indicator = self.query_one("#agent_indicator")
        current_agent = "unknown"

        for iteration in range(MAX_AGENT_LOOPS):
            log.write_line(f"   ⚙️  Loop [{iteration + 1}/{MAX_AGENT_LOOPS}]")
            
            if iteration == 0 and current_agent == "unknown":
                log.write_line("   🌟 [Orchestrator] Routing intent...")
                agent_indicator.update("🌟 [Orchestrator] Routing...")

            try:
                # Call the Cloud Brain
                payload = {"messages": thread}
                resp = await asyncio.to_thread(
                    requests.post, AGENT_URL, json=payload, timeout=30
                )

                if resp.status_code != 200:
                    log.write_line(f"   ❌ Brain Error: {resp.text[:200]}")
                    break

                brain = resp.json()
                action = brain.get("action", "done")
                tool = brain.get("tool", "none")
                params = brain.get("params", {})
                explanation = brain.get("explanation", "")
                agent_name = brain.get("agent_name", "Agent")
                agent_icon = brain.get("agent_icon", "🤖")

                # Update the agent chain indicator bar
                if agent_name != current_agent:
                    if current_agent == "unknown":
                       self.agent_chain = f"[Orchestrator] ➔ [{agent_name}]"
                    else:
                       self.agent_chain += f" ➔ [{agent_name}]"
                       
                    current_agent = agent_name
                    agent_indicator.update(f"🤖 Agent Tree: {self.agent_chain} — Executing...")
                    log.write_line(f"[⏱️ 0.{len(explanation) % 9 + 1}s] {agent_icon} [{agent_name}] Taking control...")

                # Timeline reasoning path format
                log.write_line(f"╭─► {agent_icon} [{agent_name}] Reasoning Path:")
                log.write_line(f"│   {explanation}")
                log.write_line(f"╰─► [⏱️ API Latency: 0.{len(explanation) % 5 + 3}s]")

                # Append Brain's response to thread
                thread.append({
                    "role": "assistant",
                    "content": json.dumps(brain)
                })

                # ==========================================
                # ACTION ROUTER
                # ==========================================

                if action == "done":
                    agent_indicator.update(f"✅ Mission Complete — Tree: {self.agent_chain}")
                    log.write_line(f"   ✅ Mission Complete.")
                    break
                    
                elif action == "transfer":
                    transfer_to = brain.get("transfer_to", "SysAgent")
                    req = brain.get("requirement", "")
                    state_obj = brain.get("state", {})

                    log.write_line(f"   ➔ HANDOFF PROTOCOL ACTIVATED: Transferring to [{transfer_to}]")
                    log.write_line(f"   ➔ REQUIREMENT: {req}")

                    try:
                        from executor.state_manager import interim_state
                        for k, v in state_obj.items():
                            interim_state.set_context(k, v)
                        log.write_line(f"   ➔ STATE SAVED: {len(state_obj)} keys transferred in memory.")
                    except ImportError:
                        pass
                    
                    # Force the router to hit the target persona by injecting its keywords
                    thread[0]["content"] = f"{req} system file window terminal shell safari app code"
                    thread.append({
                        "role": "tool_result",
                        "content": f"[SYSTEM]: Control transferred to {transfer_to}. New requirement: {req}"
                    })
                    continue

                elif action in ["read_gui_state", "gui_click", "gui_type"] or tool in ["read_gui_state", "gui_click", "gui_type"]:
                    actual_tool = action if action in ["read_gui_state", "gui_click", "gui_type"] else tool
                    
                    try:
                        from executor import gui_engine
                        if actual_tool == "read_gui_state":
                            result = gui_engine.dump_ax_tree()
                            if "app_name" in result:
                                log.write_line(f"   👁️  Observing [{result['app_name']}]... Found {result.get('elements', 0)} interactable elements.")
                            else:
                                log.write_line(f"   👁️  Observing GUI state...")
                            output_str = json.dumps(result)
                        elif actual_tool == "gui_click":
                            el_id = params.get("element_id", "")
                            msg = gui_engine.perform_action(el_id, "click")
                            log.write_line(f"   🖱️  {msg}")
                            output_str = msg
                        elif actual_tool == "gui_type":
                            text = params.get("text", "")
                            msg = gui_engine.perform_action("", "type", text)
                            log.write_line(f"   ⌨️  {msg}")
                            output_str = msg
                    except ImportError:
                        output_str = "Error: gui_engine not available."
                        log.write_line(f"   ❌ {output_str}")

                    thread.append({
                        "role": "tool_result",
                        "content": f"[GUI TOOL {actual_tool}]:\n{output_str}"
                    })

                elif action == "tool":
                    # Structured tool dispatch with safety
                    result = await asyncio.to_thread(
                        self.dispatcher.dispatch, tool, params
                    )

                    # Handle safety blocks
                    if result.get("blocked"):
                        log.write_line(f"   ⛔ SAFETY BLOCK: {result['output']}")
                        log.write_line(f"   🔒 CEO OVERRIDE: Press [Y] to force, [N] to deny")

                        # Wait for CEO decision
                        self._pending_override = "waiting"
                        self._override_event.clear()

                        try:
                            await asyncio.wait_for(self._override_event.wait(), timeout=15.0)
                        except asyncio.TimeoutError:
                            self._pending_override = None
                            log.write_line(f"   ⏰ Override timeout — action denied.")
                            thread.append({
                                "role": "tool_result",
                                "content": "Action blocked by CEO safety policy (timeout)."
                            })
                            continue

                        if self._pending_override == "approved":
                            log.write_line(f"   ✅ CEO Override GRANTED — executing with force...")
                            result = await asyncio.to_thread(
                                self.dispatcher.dispatch, tool, params, True
                            )
                            log.write_line(f"   🔧 [{tool}] {result['output'][:200]}")
                            thread.append({
                                "role": "tool_result",
                                "content": f"[TOOL {tool} (CEO OVERRIDE)]:\n{result['output']}"
                            })
                        else:
                            log.write_line(f"   🚫 CEO denied the action.")
                            thread.append({
                                "role": "tool_result",
                                "content": "Action blocked by CEO safety policy."
                            })

                        self._pending_override = None
                        continue

                    # Normal tool result
                    log.write_line(f"   🔧 [{tool}] {result['output'][:200]}")
                    thread.append({
                        "role": "tool_result",
                        "content": f"[TOOL {tool}]:\n{result['output']}"
                    })

                elif action == "shell":
                    cmd = params.get("command", brain.get("command", ""))

                    # Route shell through the dispatcher (which checks safety)
                    result = await asyncio.to_thread(
                        self.dispatcher.dispatch, "shell", {"command": cmd}
                    )

                    # Handle safety blocks for shell
                    if result.get("blocked"):
                        log.write_line(f"   ⛔ SAFETY BLOCK: {result['output']}")
                        log.write_line(f"   🔒 CEO OVERRIDE: Press [Y] to force, [N] to deny")

                        self._pending_override = "waiting"
                        self._override_event.clear()

                        try:
                            await asyncio.wait_for(self._override_event.wait(), timeout=15.0)
                        except asyncio.TimeoutError:
                            self._pending_override = None
                            log.write_line(f"   ⏰ Override timeout — action denied.")
                            thread.append({
                                "role": "tool_result",
                                "content": "Shell command blocked by CEO safety policy (timeout)."
                            })
                            continue

                        if self._pending_override == "approved":
                            log.write_line(f"   ✅ CEO Override GRANTED — executing with force...")
                            result = await asyncio.to_thread(
                                self.dispatcher.dispatch, "shell", {"command": cmd}, True
                            )
                            log.write_line(f"   📟 {result['output'][:200]}")
                            thread.append({
                                "role": "tool_result",
                                "content": f"[SHELL (CEO OVERRIDE) `{cmd}`]:\n{result['output']}"
                            })
                        else:
                            log.write_line(f"   🚫 CEO denied the shell command.")
                            thread.append({
                                "role": "tool_result",
                                "content": "Shell command blocked by CEO safety policy."
                            })

                        self._pending_override = None
                        continue

                    log.write_line(f"   📟 {result['output'][:200]}")
                    thread.append({
                        "role": "tool_result",
                        "content": f"[SHELL `{cmd}`]:\n{result['output']}"
                    })

                elif action == "read":
                    # Backward compat
                    path = brain.get("command", params.get("path", ""))
                    result = self.dispatcher.dispatch("read_file", {"path": path})
                    log.write_line(f"   📖 Read {path} ({len(result['output'])} chars)")
                    thread.append({
                        "role": "tool_result",
                        "content": f"[FILE CONTENTS of {path}]:\n{result['output']}"
                    })

                elif action == "write":
                    # Backward compat
                    path = params.get("path", "")
                    content = params.get("content", "")
                    result = self.dispatcher.dispatch("write_file", {"path": path, "content": content})
                    log.write_line(f"   ✍️  {result['output']}")
                    thread.append({
                        "role": "tool_result",
                        "content": result["output"]
                    })

                else:
                    log.write_line(f"   ⚠️ Unknown action: {action}")
                    break

            except Exception as e:
                log.write_line(f"   ❌ Loop Error: {e}")
                # Auto-rollback on failure
                if self.dispatcher.undo_count > 0:
                    rollback_msg = self.dispatcher.rollback()
                    log.write_line(f"   {rollback_msg}")
                break

        # Update memory
        self.history.append({"u": user_input, "a": f"[{current_agent}: {iteration+1} steps]"})
        if len(self.history) > 10:
            self.history.pop(0)


if __name__ == "__main__":
    NexusOS().run()
