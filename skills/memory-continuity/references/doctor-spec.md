# continuity doctor spec

## PASS
The checked item exists and matches the required structure.

## WARN
The item exists but is drifting:
- file too long
- required text partly missing
- structure present but not ideal

## FAIL
The item is missing or materially broken:
- missing CURRENT_STATE.md
- missing required sections
- missing continuity rules in AGENTS.md

## Minimal checks
1. `main/memory/CURRENT_STATE.md` exists
2. each agent workspace has `memory/CURRENT_STATE.md`
3. every `CURRENT_STATE.md` contains:
   - `## In Flight`
   - `## Blocked / Waiting`
   - `## Recently Finished`
   - `## Next`
   - `## Reset Summary`
4. main `AGENTS.md` contains continuity guidance, minimal JIRA-like workflow markers, and dual reporting protocol markers
5. line-count caps are respected

## Runtime/process checks to add later
These are not fully implemented yet, but are part of the intended workflow:
- detect `dispatching` tasks that never produce a worker trace
- treat no first response within 10 minutes as `blocked (launch failure)`
- treat missed milestone ETA as `blocked (stalled)`
- ensure main does not claim `in_progress` without evidence

## Suggested actions on failure
- create missing files from template
- restore missing AGENTS continuity section
- trim oversized CURRENT_STATE files
- rerun doctor after repair
