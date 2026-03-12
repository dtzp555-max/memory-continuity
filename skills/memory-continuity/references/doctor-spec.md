# Continuity Doctor — Specification

## Purpose

The continuity doctor is a diagnostic tool that checks whether the
memory-continuity protocol is being followed correctly in a workspace.
It reports problems but does **not** auto-fix them.

## Design philosophy

- **Diagnose, don't repair.** Automated repair of state files is dangerous
  because incorrect fixes can overwrite valid state.
- **Fast and offline.** No API calls, no database queries. Reads files only.
- **Exit codes matter.** 0 = healthy, 1 = warnings found, 2 = critical issues.
- **Working-state focus.** The doctor validates active-work recovery hygiene,
  not long-term memory quality.

## Checks performed

### 1. Existence check
- Does `memory/CURRENT_STATE.md` exist?
- Severity: CRITICAL if missing (no deterministic recovery point)

### 2. Staleness check
- When was `CURRENT_STATE.md` last modified?
- If older than the most recent relevant session activity, it is stale.
- Severity: WARNING

### 3. Template compliance
- Does the file contain all mandatory sections?
  (`Objective`, `Current Step`, `Key Decisions`, `Next Action`, `Blockers`, `Unsurfaced Results`)
- Are any sections still showing placeholder text?
- Severity: WARNING for missing sections, INFO/WARNING for unresolved placeholders depending on severity

### 4. Active-work usability
- Does `Objective` appear meaningful, or is it empty / placeholder / idle?
- If active work exists, does `Next Action` look usable?
- Severity: WARNING when a checkpoint exists but does not provide a usable recovery surface

### 5. Unsurfaced results
- Is the `Unsurfaced Results` section non-empty?
- If yes, someone likely still needs to review or forward those results.
- Severity: WARNING

### 6. Archive consistency
- Are there files in `memory/session_archive/`?
- Does the newest archive differ significantly from `CURRENT_STATE.md`?
  (This may be expected after task switches, but is worth flagging.)
- Severity: INFO

### 7. Recovery-priority hygiene (best-effort)
- If workspace/session evidence suggests a recovery scenario recently occurred,
  did the agent still prefer generic greeting over recovered work state?
- Severity: WARNING when detectable
- Note: this may depend on transcript/session inspection and can remain best-effort

### 8. Optional alignment checks
- If a `tasks.md`, `openspec/`, or similar planning artifact exists, does the
  `Objective` roughly align with active work?
- Severity: INFO

## Important boundaries
The doctor is **not** trying to replace:
- OpenClaw compaction summaries
- native `memoryFlush`
- session transcript memory search

It only answers:
- is the working-state checkpoint present?
- is it fresh?
- is it structurally usable for recovery?

## Output format

```text
[CRITICAL] memory/CURRENT_STATE.md does not exist
[WARNING]  CURRENT_STATE.md is stale (last modified 2h ago, session ran 30m ago)
[WARNING]  Unsurfaced Results section is not empty — review needed
[WARNING]  Recovery state exists but Next Action is placeholder text
[INFO]     Archive objective differs from current objective (task switch?)
[OK]       Template compliance: all sections present
```

## Future extensions (not yet implemented)

- Multi-workspace scan (check all sub-agent workspaces)
- JSON output mode for programmatic consumption
- Integration with scheduled health checks
- More transcript-aware recovery-priority detection
- Validation support for future lifecycle-plugin checkpoints
