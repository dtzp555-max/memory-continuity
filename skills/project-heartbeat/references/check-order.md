# Heartbeat timeout check order

When the 10-minute timer expires:

1. Check worker/session traces
   - session history
   - recent/active subagents
   - visible logs / evidence points

2. Check task state
   - CURRENT_STATE.md
   - planned / dispatching / in_progress / blocked / reviewing / done

3. Check known blocker buckets
   - launch
   - model
   - auth
   - tool
   - path/repo
   - scope
   - policy/review
   - external

4. Produce a user-visible update
   - who
   - status
   - output
   - next

Prefer precise failure language over passive waiting language.
