# Minimal state machine

## States
- planned
- dispatching
- in_progress
- blocked
- reviewing
- done

## Typical flow
1. `planned`
2. `dispatching`
3. `in_progress`
4. `reviewing`
5. `done`

## Failure shortcuts
- `dispatching` + no worker trace within 10 minutes -> `blocked (launch failure)`
- `in_progress` + ETA exceeded with no milestone -> `blocked (stalled)`

## Notes
- Keep the state machine small.
- Avoid adding extra states unless repeated real-world failures demand them.
- State changes should be backed by evidence, not optimism.
