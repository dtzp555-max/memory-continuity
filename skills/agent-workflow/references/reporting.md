# Reporting templates

## Worker -> main
- status: accepted | blocked | milestone | done | failed
- summary: one-line result
- evidence: commit / PR / log / session trace
- risk: blocker or caveat
- next: recommended next action

## Main -> user
- who
- status
- output
- next

## Examples

### launch failure
- who: qa_worker
- status: blocked (launch failure)
- output: dispatch accepted but no worker trace/session history appeared
- next: re-dispatch or switch worker

### milestone
- who: promo_worker
- status: in_progress
- output: README links added and release draft created
- next: review and merge remaining repo updates
