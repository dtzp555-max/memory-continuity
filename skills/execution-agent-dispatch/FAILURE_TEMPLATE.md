# Delegation Failure Template

Use this when a delegated task did not truly start, stalled, or was misreported.

## Minimal internal record
- Task:
- Intended worker(s):
- State when failure recognized:
- Failure type: `launch failure` | `stalled` | `model` | `auth` | `tool` | `path/repo` | `scope` | `policy/review` | `external`
- Evidence present:
- Evidence missing:
- User-visible impact:
- Correct next state:
- Prevention rule:

## Minimal Tao update
- who:
- status:
- output:
- next:

## Example: launch failure
- who: `data_worker`
- status: blocked — launch failure
- output: dispatch was attempted, but no worker session evidence / milestone / artifact appeared within the launch window
- next: mark this worker blocked, stop claiming progress, and either retry explicitly or revise the plan

## Example: main misreporting failure
- who: main
- status: failed — reporting/process failure
- output: main reported progress without execution evidence from the delegated worker
- next: correct state to `dispatching` or `blocked`, notify Tao, and tighten the evidence gate before future dispatches
