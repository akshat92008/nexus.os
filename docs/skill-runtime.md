# Nexus Skill Runtime

Nexus OS now executes external skills through a manifest-driven runtime instead of direct shell wrappers.

## Why this matters

- Skills are discoverable from disk.
- Invocation is deterministic and typed.
- Results can be cached for repeated reads.
- Each skill has its own timeout and metadata.
- The runtime is reusable from tools, workflows, and API routes.

## File layout

Each skill lives in `apps/api/src/external_skills/` and should include:

- An executable script, for example `my_skill.js`
- A manifest, for example `my_skill.skill.json`

## Manifest shape

```json
{
  "id": "my_skill",
  "name": "My Skill",
  "description": "What this skill does",
  "entry": "my_skill.js",
  "runtime": "node",
  "inputMode": "argv-json",
  "outputMode": "json",
  "requiresApproval": false,
  "cacheTtlMs": 30000,
  "timeoutMs": 10000,
  "tags": ["category"],
  "undo": { "strategy": "none" }
}
```

## Current integration points

- `apps/api/src/tools/skillRuntime.ts`
- `apps/api/src/tools/skillAdapter.ts`
- `apps/api/src/tools/toolRegistry.ts` via `skill_execute`
- `GET /api/skills`
- `POST /api/skills/:skillId/execute`

## Design principle

This is inspired by the efficiency of OpenClaw's skill-centric execution style, but narrowed to Nexus's enterprise-safe architecture:

- DAGs remain in Nexus.
- Rollbacks remain in Nexus.
- HITL approval remains in Nexus.
- Skills are execution atoms, not the product architecture.
