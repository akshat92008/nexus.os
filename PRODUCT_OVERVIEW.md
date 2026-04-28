# Nexus OS v5.0 — The AI Operating Layer

Nexus OS is a **Native Agentic Operating System** designed to bridge high-level AI intelligence with low-level macOS control. It transforms the computer into an autonomous collaborator by providing AI models with a native "Nervous System."

## 🏗️ Architecture

Nexus OS uses a hybrid, high-performance architecture:

- **The Intelligence Hub (Cloud Brain)**: A FastAPI-based reasoning layer with **Resilient Multi-Model Fallback**. It automatically pivots from OpenRouter to Groq or Gemini if an API error occurs, ensuring 100% mission reliability.
- **The Native Nerve (Execution Layer)**: A high-performance **Tauri v2 + Rust** application. It executes actions locally using native APIs, replacing raw shell commands with deterministic, safety-checked Rust functions.
- **The Cyber-Shell (Frontend)**: A professional **React + Tailwind** dashboard that visualizes the agent's thought loop (Thinking 🧠 → Executing ⚙️ → Success ✅) and manages permissions.

## 🚀 Core "Hero Skills"

The system comes pre-loaded with specialized skill-packs for Developers and Founders:

*   **📦 Digital Janitor**: Autonomous file organization. Cleans messy directories and sorts files into logical categories (Images, Docs, Code, etc.) based on type.
*   **💀 Resource Reaper**: Real-time process monitoring. Identifies RAM/CPU hogs and offers to optimize system performance instantly.
*   **📂 Project Onboarder**: Instant codebase mapping. Analyzes new repositories, detects the tech stack, and explains the project structure.
*   **⚡ Workflow Launcher**: Preset productivity modes. One-command set up for "Deep Work" (VS Code, Spotify, DND) or "Meeting" modes.

## 🛡️ Structural Hardening & Safety

Nexus OS is built with a "Safety-First" philosophy:

- **Command Blacklist**: 15+ regex guardrails block destructive operations (e.g., recursive root deletion or remote shell-pipe attacks).
- **CEO Mandate**: High-level "Power Lane" operations (like folder deletions or system changes) require explicit user approval (Y/N) via a professional authorization modal.
- **Saga Rollback Engine**: A persistent **UndoLog** allows for state snapshotting. If an agent mission fails or is cancelled, modified files and folders can be reverted to their previous state.

---
*Nexus OS — Empowering the next generation of autonomous computing.*
