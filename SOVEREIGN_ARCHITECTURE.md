# Nexus OS Sovereign Architecture Blueprint

## Executive Summary
This document details the transition of Nexus OS from a standard "Tool-calling Agent" to a "State-Aware Autonomous OS", introducing the Sovereign and Depth upgrades. This architecture prioritizes low latency, high reliability, and absolute user sovereignty (zero data leakage).

The upgrade is comprised of four primary pillars:
1.  **Sovereign Gateway (LUI Transition)**
2.  **GUI Depth (The State-Machine)**
3.  **Cognitive Depth (Temporal Knowledge Graph)**
4.  **Execution Depth (The Self-Healing Loop)**

---

## Pillar 1: The Sovereign Gateway (LUI Transition)

**Objective**: Move beyond a traditional chat window by implementing a transparent Command Pilot overlay and a fast Semantic Router that does not rely on LLM calls.

### 1.1 The Command Pilot Overlay
The GUI must be an omnipresent, transparent overlay that intercepts specific global hotkeys but allows regular cursor/mouse events to pass through unhindered when not actively engaged.

**Implementation (Tauri Configuration):**
*   **Event Passthrough:** By configuring the Tauri window with `transparent: true` and dynamically toggling `set_ignore_cursor_events(true/false)`, the overlay will float above other windows. When the user summons the agent (e.g., via `Cmd+Space`), cursor events are intercepted. Once dismissed, events pass through to the underlying OS.

### 1.2 Semantic Router
Instead of using a cloud LLM to decide which persona or tool to invoke, we use local vector embeddings.

**Logic Flow:**
1.  User enters an intent via the Command Pilot.
2.  The intent string is immediately embedded locally (using `all-MiniLM-L6-v2` or similar model loaded in memory/Tauri).
3.  The embedding is queried against `knowledge_vec` in SQLite (via `sqlite-vec`), comparing it to pre-computed embeddings of our Agent Personas / Tools.
4.  The system routes the request to the highest-scoring persona.

**Code Signatures:**
```rust
// src-tauri/src/router.rs

/// Computes local embedding for the user intent and queries sqlite-vec for the closest persona match.
pub fn semantic_route(intent: &str) -> Result<String, String>;
```

```typescript
// apps/api/src/intentRouter.ts
export class IntentRouter {
  /**
   * Calls the Tauri backend to route the intent based on local vector similarity.
   */
  async routeIntent(intent: string): Promise<string>;
}
```

**The "Sovereign" Advantage:**
By executing routing locally via `sqlite-vec` rather than calling out to a cloud LLM, latency drops from seconds to milliseconds. The OS acts instantaneously without exposing basic user queries to external servers.

---

## Pillar 2: GUI Depth (The State-Machine)

**Objective**: Ensure reliable GUI interactions by verifying state changes and utilizing robust fuzzy matching, transitioning away from "click and hope" methodologies.

### 2.1 The Verification Loop
Every interaction must ensure the desired outcome occurred.

**Logic Flow:**
1.  Agent identifies an element and issues a `gui_click(element_id)`.
2.  Immediately after the click, the engine captures a localized snippet of the AX Tree.
3.  The engine verifies the state change (e.g., the target button no longer exists, a new window appeared, or a specific label appeared).
4.  If the state hasn't changed within a timeout, throw an `ActionFailed` error to trigger the RAOV correction loop.

### 2.2 Hybrid Fuzzy Matching
To ensure robustness against minor UI changes, element targeting relies on both label and structural proximity.

**Logic Flow:**
1.  Parse the requested label and search the active AX Tree.
2.  Compute the Levenshtein distance between the requested label and actual AX element labels.
3.  For close matches, evaluate the hierarchical path (e.g., is it inside the "Settings" window or the "Main" window?).
4.  Return the element with the highest combined score (Text Similarity + Path Validity).

**Code Signatures:**
```rust
// src-tauri/src/gui_engine.rs

/// Finds an element using Levenshtein distance on title/role and structural validation via AX tree path.
pub fn find_element_fuzzy(label: &str, expected_path_hints: Option<Vec<&str>>) -> Result<AXNode, String>;

/// Verifies that a specific element state has changed after an action.
pub fn verify_gui_state(pre_action_tree: &AXNode, action: &GUIAction) -> Result<bool, String>;
```

**The "Sovereign" Advantage:**
Standard vision agents rely on screenshot analysis, which is slow and prone to visual noise. By interacting directly with the native AX Tree and enforcing mathematical verification (hybrid matching), Nexus OS operates with deterministic precision and high speed.

---

## Pillar 3: Cognitive Depth (Knowledge Graph vs. Vectors)

**Objective**: Evolve memory from flat RAG to a Temporal Knowledge Graph capable of multi-hop reasoning.

### 3.1 Generalized Triplestore Schema
We will implement an RDF-like schema (Subject → Predicate → Object) within SQLite, enhanced with vectors for semantic search.

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS graph_nodes (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,         -- e.g., 'Project Alpha', 'Alice'
    node_type TEXT NOT NULL,     -- e.g., 'Project', 'Person', 'File'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id INTEGER PRIMARY KEY,
    source_node_id INTEGER,
    target_node_id INTEGER,
    predicate TEXT NOT NULL,     -- e.g., 'depends_on', 'modified_by'
    weight FLOAT DEFAULT 1.0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_node_id) REFERENCES graph_nodes(id),
    FOREIGN KEY(target_node_id) REFERENCES graph_nodes(id)
);

-- Semantic search over the nodes/edges
CREATE VIRTUAL TABLE IF NOT EXISTS graph_vec USING vec0(
    embedding float[384]
);
```

### 3.2 Multi-Hop Retrieval
**Logic Flow:**
1.  Query intent: "Find the file Alice modified last week for Project Alpha."
2.  Semantic Search: Find node IDs for "Alice" and "Project Alpha".
3.  SQL Graph Traversal: `SELECT object FROM graph_edges WHERE subject='Project Alpha' AND predicate='contains' AND object IN (SELECT target FROM graph_edges WHERE subject='Alice' AND predicate='modified')`.

**Code Signatures:**
```rust
// src-tauri/src/memory.rs

/// Inserts a new relationship into the Temporal Knowledge Graph.
pub fn add_triple(subject: &str, predicate: &str, object: &str, timestamp: Option<String>) -> Result<(), String>;

/// Executes a multi-hop traversal given semantic entry points.
pub fn multi_hop_query(entry_query: &str, hops: usize) -> Result<Vec<String>, String>;
```

**The "Sovereign" Advantage:**
Flat vectors are bad at relational context (e.g., tracking a chain of events). A local Temporal Knowledge Graph allows the system to build an accurate, evolving mental model of the user's files and workflows over time, completely offline.

---

## Pillar 4: Execution Depth (The Self-Healing Loop)

**Objective**: Implement the RAOV loop by evolving the existing `SagaManager` into a robust State Orchestrator capable of autonomic correction.

### 4.1 Evolving SagaManager
The `SagaManager` will now track the complete lifecycle of a goal.

**Logic Flow (RAOV Loop):**
1.  **Reason:** LLM/Planner formulates the next step.
2.  **Act:** Execute the tool (e.g., `shell_execute` or `gui_click`). State Orchestrator logs the action and its `undo_params`.
3.  **Observe:** Capture the result (e.g., STDERR output or AX Tree change).
4.  **Verify:** Evaluate the result.
    *   *Success:* Commit step, proceed to next Reason phase.
    *   *Failure (Correction):* If exit code != 0, analyze STDERR. Invoke a "Fix-it" reasoning pass to generate a corrected command.
    *   *Failure (Rollback):* If correction fails 3 times, trigger `sagaManager.rollback(goalId)`, invoking the `undo_params` sequentially backwards.

**Code Signatures:**
```typescript
// apps/api/src/services/SagaManager.ts

export class SagaManager {
  // Existing: logAction, getLastAction, clearAction

  /**
   * Evaluates observation output and triggers either progression, correction, or rollback.
   */
  async verifyObservation(goalId: string, result: ObservationResult): Promise<NextState>;

  /**
   * Executes compensation logic sequentially using logged undo_params.
   */
  async executeRollback(goalId: string): Promise<void>;
}
```

```typescript
// apps/api/src/core/orchestrator.ts

/**
 * The main RAOV loop runner.
 */
async function executeRAOVLoop(goal: Goal): Promise<void>;
```

**The "Sovereign" Advantage:**
Traditional agents crash on the first error. By implementing deterministic rollbacks and auto-correction loops, Nexus OS achieves self-healing resilience. If it makes a mistake, it can cleanly undo its actions, ensuring system integrity.
