# execution-agent-dispatch

Compatibility wrapper for the dispatch/supervision half of **`worker-orchestrator`**.

## Status

This README is kept only as a compatibility aid.
The maintained source of truth is now:

- `skills/worker-orchestrator/SKILL.md`

## What this wrapper still means

Use `execution-agent-dispatch` only when you specifically want the **dispatch / handoff / reporting-discipline** half of the orchestration workflow:

- turn a worker plan into a clear task packet
- standardize worker reply format
- enforce milestone / blocker / completion reporting
- keep main-to-Tao forwarding discipline explicit

## What it is not

This wrapper is **not**:
- a runtime transport fix
- evidence that worker↔worker or agent↔agent communication is stable
- a substitute for upstream OpenClaw / ACP runtime support

## Preferred modern usage

If the task involves both:
- deciding the worker split
- and dispatching / supervising workers

then use **`worker-orchestrator`** directly.

## Practical takeaway

Current safe operating model remains:
- main dispatches workers
- workers execute and report back to main
- main integrates and reports to Tao
