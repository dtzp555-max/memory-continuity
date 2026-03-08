# Project heartbeat state machine

## States
- idle
- armed
- checking
- closed

## Normal flow
1. main sends a project-progress update -> `armed`
2. 10-minute silence timer runs
3. meaningful update arrives before timeout -> reset timer, remain `armed`
4. timeout fires -> `checking`
5. main inspects workers/project state and sends user-visible update
6. if still active -> back to `armed`
7. if done/paused/failed/cancelled -> `closed`

## Failure patterns
- no worker trace after supposed dispatch -> `blocked (launch failure)`
- ETA missed with no milestone -> `blocked (stalled)`
- model/auth/tool/path issues -> `blocked` with explicit reason
