# Continuity Doctor — Specification

## Purpose

The continuity doctor is a diagnostic tool that checks whether the
memory-continuity protocol is being followed correctly in a workspace.
It reports problems but does **not** auto-fix them.

## Design philosophy

- **Diagnose, don't repair.** Automated repair of state files is dangerous
  because incorrect "fixes" can overwrite valid state. The doctor flags
  issues for human or agent review.
- **Fast and offline.** No API calls, no database queries. Reads files only.
- **Exit codes matter.** 0 = healthy, 1 = warnings found, 2 = critical issues.

## Checks performed

### 1. Existence check
- Does `memory/CURRENT_STATE.md` exist?
- Severity: CRITICAL if missing (no recovery possible)

### 2. Staleness check
- When was `CURRENT_STATE.md` last modified?
- If older than the most recent session transcript, it is stale.
- Severity: WARNING

### 3. Template compliance
- Does the file contain all mandatory sections?
  (Objective, Current Step, Key Decisions, Next Action, Blockers, Unsurfaced Results)
- Are any sections still showing placeholder text like `[One sentence: ...]`?
- Severity: WARNING for missing sections, INFO for placeholder text

### 4. Unsurfaced results
- Is the `Unsurfaced Results` section non-empty?
- If yes, someone needs to review those results.
- Severity: WARNING

### 5. Archive consistency
- Are there files in `memory/session_archive/` ?
- Does the newest archive have a different Objective than CURRENT_STATE.md?
  (This is expected if the user switched tasks, but worth flagging.)
- Severity: INFO

### 6. Conflict detection (optional, if tasks file exists)
- If a `tasks.md` or `openspec/` directory exists, does the Objective in
  CURRENT_STATE.md align with any active task?
- Severity: INFO (alignment is nice-to-have, not mandatory)

## Output format

```
[CRITICAL] memory/CURRENT_STATE.md does not exist
[WARNING]  CURRENT_STATE.md is stale (last modified 2h ago, session ran 30m ago)
[WARNING]  Unsurfaced Results section is not empty — review needed
[INFO]     Archive objective differs from current objective (task switch?)
[OK]       Template compliance: all sections present
```

## Future extensions (not yet implemented)

- Multi-workspace scan (check all sub-agent workspaces)
- JSON output mode for programmatic consumption
- Integration with OpenClaw cron for scheduled health checks
