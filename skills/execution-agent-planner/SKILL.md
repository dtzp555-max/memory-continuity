---
name: execution-agent-planner
description: Compatibility wrapper for worker planning. Prefer `worker-orchestrator` for the maintained PM/orchestration workflow; use this wrapper when you only need the planning/splitting section.
---

# Execution agent planner

This skill is now a **compatibility wrapper**.

The maintained source of truth is:
- `skills/worker-orchestrator/SKILL.md`

## Current role

Use this wrapper only when the task is specifically about:
- deciding whether to use one worker or multiple workers
- defining worker roles / boundaries
- splitting work before dispatch begins

If you need the full workflow, use **`worker-orchestrator`** instead.

## Important boundary

This wrapper is still only a **planning / architecture aid**.
It is **not** evidence that OpenClaw / ACP inter-agent communication is stable.
It does **not** provide transport, routing, or reliable bidirectional communication.

## What to read / apply from `worker-orchestrator`

Apply these sections from the unified skill:
- **Part A — Planning the worker architecture**
- especially:
  - Default stance
  - Split triggers
  - Avoid splitting when
  - Planning output
  - Naming guidance

## Practical note

Current safe operating model remains:
- main decides the split
- workers execute
- workers report back to main
- main reports to Tao

Do **not** interpret this wrapper as a communication-layer solution.
