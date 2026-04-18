# Nexus OS — v3.0 'Sovereign' Private Beta

Nexus OS is the first fully autonomous, GUI-aware agentic environment for macOS. It transforms your computer from a tool you use into a partner that works for you.

## 🛰️ v3.0 Agentic Architecture
- **The Nerve (Native Rust)**: High-performance macOS integration via Tauri v2, managing the **AX Tree Eye** for GUI awareness and **Sovereign Memory** (SQLite-vec) for semantic recall.
- **The Brain (Cloud Kernel)**: Distributed reasoning via Groq, OpenAI, and Gemini, managing complex DAG-based mission planning.
- **The Trust Layer (Saga)**: Native 'Undo' capability. Every destructive operation is logged and reversible via the Saga Rollback pattern.
- **The Cyber-Shell**: A premium React dashboard featuring a command-centric HUD, live Mission Logs, and the CEO Authorization gate.

## 🧪 Private Beta Status
Nexus OS is currently in **Private Beta**. Access is restricted to authorized partners and early-access CEOs via the Waitlist.

### Getting Started (Native Developer Build)
1. **Prepare Assets**:
   ```bash
   bash scripts/prepare_build.sh
   ```
2. **Launch Dev Environment**:
   ```bash
   pnpm tauri dev
   ```
3. **Generate Production Bundle**:
   ```bash
   pnpm tauri build
   ```

## 🛡️ Security & Privacy
Nexus OS prioritizes **Sovereign Privacy**. Your interaction history, file metadata, and gui state are stored in a local **Sovereign Memory** (SQLite-vec) on your machine. All power-lane actions require explicit **CEO Authorization**.

---
*Nexus OS — Build for the Sovereign Era.*