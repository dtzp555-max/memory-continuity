---
name: memory-continuity
description: Preserve short-term working continuity for OpenClaw agents when recent in-flight work gets lost after gateway interruption/restart, model fallback or unavailability, /new or fresh sessions, context compaction, or silent execution-agent reporting gaps. Use when you need memory/CURRENT_STATE.md, dual reporting discipline, continuity doctor checks, or repair of continuity drift across agent workspaces.
---

# Memory Continuity

Use this skill to prevent agents from forgetting what is currently in flight when continuity breaks in practical ways: gateway interruption/restart, model fallback/unavailability, `/new` or fresh sessions, context compaction, or worker results not being surfaced upward in time.

Use `memory/CURRENT_STATE.md` as a small overwrite-oriented workbench, not as a journal.

## Core rules

- Ensure every agent workspace has `memory/CURRENT_STATE.md`
- Keep `CURRENT_STATE.md` small
  - main: target 25-40 lines, hard cap 50
  - other agents: target 15-25 lines, hard cap 30
- Required sections:
  - `In Flight`
  - `Blocked / Waiting`
  - `Recently Finished`
  - `Next`
  - `Reset Summary`
- Update only on state changes, not on a timer
- Remove stale items instead of endlessly appending

## Dual reporting protocol

### Worker → main
Execution agents must report to main at:
- accepted
- blocked
- milestone
- done
- model/environment abnormal

Preferred reply format:
- `status`
- `summary`
- `evidence`
- `risk`
- `next`

### main → Tao
Main must report to Tao at:
- task accepted / formally started
- worker dispatched
- blocked
- milestone reached
- task/phase completed

Preferred Tao update format:
- who
- status
- output
- next

Ordering rule:
- When a worker reports milestone/completion/blocker, first update `CURRENT_STATE.md`, then update Tao, then continue with review/commit/next dispatch.
- If no evidence point exists yet (sessionKey / commit / branch / PR / log), do not claim work has already started.

## When to use the doctor
Run `scripts/continuity_doctor.py` when:
- OpenClaw was upgraded
- gateway restarted and continuity feels suspicious
- an agent seems to have lost short-term context
- you need to confirm `CURRENT_STATE.md` coverage across workspaces

## How to use the doctor
From the main workspace:

```bash
python3 skills/memory-continuity/scripts/continuity_doctor.py \\
  --main-workspace /Users/taodeng/.openclaw/workspace/main \
  --agents-root /Users/taodeng/.openclaw/workspaces
```

The doctor checks:
- main `memory/CURRENT_STATE.md` exists
- all agent workspaces have `memory/CURRENT_STATE.md`
- required sections exist
- line-count caps are respected
- `AGENTS.md` still contains continuity + dual reporting rules

## Repair strategy
If drift is found:
1. Restore/create missing `memory/CURRENT_STATE.md`
2. Restore continuity guidance in `AGENTS.md`
3. Re-run doctor
4. Only then investigate deeper behavioral failures

## References
- For template and limits: read `references/template.md`
- For doctor semantics and PASS/WARN/FAIL meanings: read `references/doctor-spec.md`
