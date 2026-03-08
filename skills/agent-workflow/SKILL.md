---
name: agent-workflow
description: Run a minimal JIRA-like workflow for OpenClaw agents so tasks do not silently disappear between main and execution agents. Use when main is planning, dispatching, supervising, reviewing, or reporting delegated work and needs simple task states, evidence gates, timeout rules, launch-failure detection, and worker→main / main→user reporting discipline.
---

# Agent Workflow

Use this skill to keep delegated work visible and mechanically supervised.

This skill exists because tasks can appear to be "in progress" when they are not:
- `sessions_spawn accepted` but the worker never really launches
- workers go silent without a first response
- ETA slips without a milestone
- main reports progress upward without enough evidence
- blocked work looks like waiting instead of failure

Keep the workflow small.

## Task states
Use these states only:
- `planned`
- `dispatching`
- `in_progress`
- `blocked`
- `reviewing`
- `done`

Important:
- `dispatching` is not a cosmetic alias for `in_progress`.
- Use `dispatching` only while delegation is being launched and there is still no execution evidence.
- If execution evidence never appears, do not quietly leave the task in `dispatching`; convert it to `blocked` with reason `launch failure`.

## State meaning
- `planned`: task exists and has been defined
- `dispatching`: main has initiated delegation, but does not yet have enough evidence that the worker truly launched
- `in_progress`: worker/session has visible execution evidence
- `blocked`: task cannot safely proceed right now (including launch failure, stalled worker, model failure, auth/tool issues)
- `reviewing`: deliverable exists and main is validating it
- `done`: main has accepted the result and updated the user

## Evidence rule
Do not upgrade a task state without an evidence point.

Good evidence points include:
- non-empty worker session history
- worker accepted / milestone reply
- commit
- branch
- PR
- release
- runtime log

Important:
- `sessions_spawn accepted` alone is not enough to claim real progress.

## Timeout rules
- If a worker has no first visible response/evidence within 10 minutes after dispatch, mark the task `blocked` with reason `launch failure`.
- If a worker has an ETA and passes that ETA without a milestone, mark the task `blocked` with reason `stalled`.
- Silence is not neutral; unexplained silence is a process failure signal.

## Worker → main protocol
Execution agents report to main, not directly to the user.

Workers must report at:
- accepted
- blocked
- milestone
- done
- model/environment abnormal

Preferred worker reply format:
- `status`
- `summary`
- `evidence`
- `risk`
- `next`

## Main → user protocol
Main must update the user at:
- task formally started
- worker truly in progress (not merely spawn-accepted)
- blocked
- milestone reached
- task/phase completed

Preferred user update format:
- who
- status
- output
- next

## Ordering rule
When a worker reports milestone/completion/blocker:
1. update task state / CURRENT_STATE if relevant
2. update the user
3. continue with review, commit, or next dispatch

If there is no evidence point yet, do not claim the work has already started; say it is about to start.

## Completion-consumption rule
If a worker completion/milestone/blocker has already been emitted by runtime or is visible in session history, main must treat that as a consumed-state obligation immediately.

Main must not remain in a "still waiting" posture after worker completion is already visible.

Required steps:
1. read/confirm the worker result
2. update task state / CURRENT_STATE
3. send the user a normal main-authored update (`who / status / output / next`)

Important:
- runtime auto-announce does not replace main's supervisory duty
- user seeing the worker result before main summarizes it is a main-process failure, not an acceptable steady state

## Blocked reasons
Prefer a short blocked reason label:
- `launch failure`
- `stalled`
- `model`
- `auth`
- `tool`
- `path/repo`
- `scope`
- `policy/review`
- `external`

## References
- For minimal state-machine examples: read `references/state-machine.md`
- For reporting templates: read `references/reporting.md`
