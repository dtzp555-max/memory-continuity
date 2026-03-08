# Execution-Agent Dispatch Checklist

Use this checklist before main claims delegated work is underway.

## A. Before dispatch
- [ ] The task is worth delegating (not a tiny one-shot edit main should just do directly)
- [ ] The correct worker is chosen
- [ ] Scope is explicit
- [ ] Out-of-scope boundaries are explicit
- [ ] Deliverable is explicit
- [ ] Constraints are explicit
- [ ] Milestone 1 and ETA are explicit
- [ ] Escalation conditions are explicit

## B. Immediately after dispatch
- [ ] Record task state as `dispatching`
- [ ] Do **not** call it `in_progress` yet
- [ ] Do **not** tell Tao that execution is underway unless evidence already exists

## C. Evidence gate for `in_progress`
At least one of these must exist before main upgrades the task to `in_progress`:
- [ ] Worker session has a visible non-empty reply
- [ ] Worker reported `accepted` with real execution context
- [ ] Worker reported a milestone
- [ ] A branch / commit / PR exists
- [ ] A file / artifact / runtime log exists

If none of the above exists, the task is still `dispatching`.

## D. Launch-failure rule
- [ ] If no first evidence appears within 10 minutes, mark the task `blocked`
- [ ] Use blocked reason: `launch failure`
- [ ] Tell Tao plainly that the worker never produced execution evidence

## E. Allowed Tao-visible updates
Main should proactively update Tao only when one of these is true:
- [ ] Worker truly started (with evidence)
- [ ] Milestone reached
- [ ] Blocked / failed
- [ ] Completed
- [ ] Main is switching workers / phases in a way Tao should know

If none is true, do not send a long "in progress" page.

## F. Worker reply minimums
A worker reply should include:
- [ ] `status`
- [ ] `summary`
- [ ] `evidence`
- [ ] `risk`
- [ ] `next`

A worker reply without `evidence` is not enough to justify `in_progress`.

## G. Completion gate
Before main says the task is done:
- [ ] Deliverable exists
- [ ] Basic verification happened when relevant
- [ ] Caveats/blockers are disclosed
- [ ] Tao has been updated
