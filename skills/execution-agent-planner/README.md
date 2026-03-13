# execution-agent-planner

Compatibility wrapper for the planning half of **`worker-orchestrator`**.

## Status

This README is kept only as a compatibility aid.
The maintained source of truth is now:

- `skills/worker-orchestrator/SKILL.md`

## What this wrapper still means

Use `execution-agent-planner` only when you specifically want the **planning / splitting** half of the orchestration workflow:

- decide whether work should stay with one worker or split into several
- define worker roles and boundaries
- avoid over-splitting or under-splitting
- decide what stays with main as PM / reviewer

## What it is not

This wrapper is **not**:
- a communication-layer fix
- evidence that OpenClaw / ACP inter-agent communication is stable
- a transport or routing solution

## Preferred modern usage

If the task involves both:
- planning the worker architecture
- and dispatching / supervising workers

then use **`worker-orchestrator`** directly.

## Practical takeaway

Current safe operating model remains:
- main plans
- workers execute
- workers report back to main
- main integrates and reports to Tao
