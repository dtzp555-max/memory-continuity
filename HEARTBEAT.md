# HEARTBEAT.md

# Task progress / silence guardrails
# - When Tao assigns a task that takes > a few minutes, acknowledge quickly with Plan + ETA.
# - Then send updates at *milestones* (not time-based spam).
# - If ETA slips or a tool/process is still running unusually long, proactively message Tao with: status + blocker + next step.
#
# Project-heartbeat runtime rule
# - If `memory/project-heartbeat-state.json` exists and contains an active project with state `armed`, treat it as a live anti-silence timer.
# - Compare now vs `lastUserVisibleUpdateAt`.
# - If elapsed time >= `timeoutMin`, switch mentally to `checking` and inspect:
#   1) worker/session traces
#   2) CURRENT_STATE.md
#   3) known blockers (launch/model/auth/tool/path/scope/policy/external)
# - Then send a real user-visible status update (who / status / output / next).
# - After sending the update, treat the timer as reset from now.
# - If the project state is `done`, `paused`, `failed`, or `cancelled`, do not send heartbeat progress nudges.
#
# Periodic check (lightweight): look for any "in-flight" work mentioned in today's memory notes or running background processes;
# if found and Tao hasn't been updated recently, send a short milestone/status update.

