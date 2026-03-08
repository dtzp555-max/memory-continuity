---
name: project-heartbeat
description: Keep active delegated projects from going silent by arming a 10-minute heartbeat timer after main reports progress, checking worker status when the timer expires, and pushing a fresh user-visible update until the project is done, paused, failed, or cancelled. Use when a project has active workers or outstanding milestones and the main agent needs anti-silence discipline.
---

# Project Heartbeat

Use this skill to stop active projects from disappearing into silence.

This skill exists because delegated projects can look alive while no user-visible update is happening:
- main says work is in progress, then goes quiet
- workers stall or launch-fail without being surfaced upward
- the user has to ask "how is it going?" to get a status refresh

## Purpose

Create a simple project-level heartbeat loop:
1. main gives a user-visible project update
2. a 10-minute timer is armed
3. if another meaningful update happens before timeout, reset the timer
4. if timeout is reached, check active workers / project state
5. send a fresh user-visible update
6. repeat until the project is closed

## States
Use these states only:
- `idle`
- `armed`
- `checking`
- `closed`

### Meaning
- `idle`: no active heartbeat-monitored project
- `armed`: project is active and the 10-minute silence timer is running
- `checking`: timer expired; main is actively collecting status from workers / project state
- `closed`: project is done, paused, failed, or cancelled; heartbeat stops

## Trigger to arm
Arm the heartbeat when:
- main tells the user a project has started
- main dispatches work and communicates that the project is active
- main says it will continue work and more updates are expected

Do not arm for:
- one-shot answers
- tiny tasks that are already done
- passive discussion with no active project

## Reset rule
Reset the 10-minute timer when any of these happen:
- main sends a meaningful project update to the user
- a worker milestone/blocker/completion is forwarded to the user
- the user sends a project-touching follow-up and main replies with real status

A "meaningful update" must contain actual status, not filler.

## Timeout rule
If 10 minutes pass with no meaningful update while the project is active:
1. switch to `checking`
2. inspect active workers / project state
3. determine whether the project is:
   - still progressing
   - blocked
   - launch-failed
   - stalled
   - done
4. send a user-visible update
5. return to `armed` if still active, else `closed`

## Worker check order
When timeout fires, check in this order:
1. worker session history / visible traces
2. subagent/session visibility
3. task state in `CURRENT_STATE.md`
4. known blockers (model, auth, tool, path, review, external)

If a worker was supposedly active but has no trace, prefer `blocked (launch failure)` over vague waiting language.

## User update format
Use the normal 4-line update format:
- who
- status
- output
- next

## Close conditions
Close the heartbeat when the project becomes:
- `done`
- `paused`
- `failed`
- `cancelled`

If multiple sub-tasks belong to the same project, keep the heartbeat open until the overall project is closed.

## Guardrails
- Do not spam on a fixed timer if there is nothing meaningful to say; timeout should trigger a real status check first.
- Do not keep the heartbeat alive after project closure.
- Do not claim progress without evidence.
- Silence is a process problem, not a neutral state.
- If the latest check finds no new evidence since the previous user-visible update, do not dress that up as `in_progress`; report `blocked`, `launch failure`, or `no change` plainly.
- Do not keep re-broadcasting stale `CURRENT_STATE` text as if it were fresh execution progress.

## References
- For task-state rules and evidence gates: read `../agent-workflow/references/state-machine.md`
- For reporting format: read `../agent-workflow/references/reporting.md`
- For continuity workbench use: read `../memory-continuity/references/template.md`
