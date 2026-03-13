---
name: execution-agent-dispatch
description: Compatibility wrapper for worker dispatch discipline. Prefer `worker-orchestrator` for the maintained PM/orchestration workflow; use this wrapper when you only need the handoff/reply/reporting section.
---

# Execution agent dispatch

This skill is now a **compatibility wrapper**.

The maintained source of truth is:
- `skills/worker-orchestrator/SKILL.md`

## Current role

Use this wrapper only when the task is specifically about:
- turning an already-decided worker plan into a dispatch packet
- standardizing worker reply format
- enforcing milestone / blocker / completion reporting discipline

If you need the full workflow, use **`worker-orchestrator`** instead.

## Important boundary

This wrapper is still only a **workflow / protocol aid**.
It is **not** a runtime transport fix.
It does **not** create stable bidirectional communication between OpenClaw agents, subagents, or ACP sessions.

## What to read / apply from `worker-orchestrator`

Apply these sections from the unified skill:
- **Part B — Dispatch and supervision**
- especially:
  - Dispatch packet
  - Worker response format
  - Escalate immediately when
  - Silence rule
  - Main-to-Tao forwarding rule
  - Completion rule

## Practical note

Current safe operating model remains:
- main dispatches workers
- workers execute and report back to main
- main integrates and reports to Tao

Do **not** interpret this wrapper as a communication-layer solution.
