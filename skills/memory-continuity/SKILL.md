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

## Minimal JIRA-like workflow

Keep the workflow small. Use these task states only:
- `planned`
- `dispatching`
- `in_progress`
- `blocked`
- `reviewing`
- `done`

State meaning:
- `planned`: task exists and has been defined
- `dispatching`: main has initiated delegation, but does not yet have enough evidence that the worker truly launched
- `in_progress`: worker/session has visible execution evidence
- `blocked`: task cannot safely proceed right now (including launch failure, stalled worker, model failure, auth/tool issues)
- `reviewing`: deliverable exists and main is validating it
- `done`: main has accepted the result and updated Tao

Evidence rule:
- Do not upgrade a task state without an evidence point.
- Good evidence points include: non-empty worker session history, worker accepted/milestone reply, commit, branch, PR, release, or runtime log.
- `sessions_spawn accepted` alone is not enough to claim real progress.

Timeout rules:
- If a worker has no first visible response/evidence within 10 minutes after dispatch, mark the task `blocked` with reason `launch failure`.
- If a worker has an ETA and passes that ETA without a milestone, mark the task `blocked` with reason `stalled`.
- Silence is not neutral; unexplained silence is a process failure signal.

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
- task formally started
- worker truly in progress (not merely spawn-accepted)
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
- If no evidence point exists yet (sessionKey with trace / commit / branch / PR / log), do not claim work has already started; say it is about to start.

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
