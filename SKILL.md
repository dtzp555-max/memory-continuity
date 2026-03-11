---
name: memory-continuity
description: >
  Short-term working continuity for OpenClaw agents. Preserves in-flight state
  across gateway restarts, /new, model fallback, and context compaction.
  Use this skill whenever an agent needs to survive session breaks without
  losing what it was doing. Triggers on: session start, /new, context recovery,
  "where were we", "continue", resuming work, or any situation where recent
  working state may have been lost. This is NOT a long-term memory system —
  it is a crash-recovery workbench.
---

# memory-continuity

Lightweight continuity layer that keeps a single overwrite-oriented state file
(`memory/CURRENT_STATE.md`) so any agent can pick up exactly where it left off
after a restart, `/new`, gateway crash, model fallback, or context compaction.

## Why this exists

Long-term memory (vector DB, markdown journals) stores *what you know*.
This skill stores *what you are doing right now*. They solve different problems.

When a gateway crashes mid-task, no amount of long-term memory recall can tell
the next session: "you were halfway through step 3, the user approved option B,
and the blocker was X." That is what CURRENT_STATE.md does.

## File layout

```
$WORKSPACE/
├── memory/
│   ├── CURRENT_STATE.md      # THE workbench (overwritten, never appended)
│   └── session_archive/      # compressed snapshots from past sessions
│       ├── 2026-03-12_14-30.md
│       └── ...
```

---

## MANDATORY PROTOCOL

### 1. On every session start

```
IF memory/CURRENT_STATE.md exists:
  READ it
  Tell user: "Last session we were working on [Objective]. We reached [Current Step]. Want to continue?"
  WAIT for user confirmation before proceeding
ELSE:
  Create memory/CURRENT_STATE.md with empty template (see below)
```

### 2. When to update CURRENT_STATE.md (the discipline rules)

Update the file by **overwriting** it (not appending) at these moments:

| Trigger | Why |
|---|---|
| User confirms a decision | Decisions are the hardest thing to reconstruct |
| A task step completes | Marks progress so next session knows where to start |
| An error or blocker appears | Prevents the next session from hitting the same wall |
| Before any tool call that might take long | If gateway dies during the call, state is already saved |
| User says "let's stop here" or similar | Explicit save point |
| Every ~10 turns of substantive conversation | Periodic checkpoint against silent context loss |

**The update must be quick.** Write only what changed. The entire file should
stay under 40 lines. If you find yourself writing more, you are journaling,
not checkpointing. Stop and compress.

### 3. On `/new` or session end

Before the session closes:

1. Do a final overwrite of `memory/CURRENT_STATE.md` with latest state
2. Copy a timestamped snapshot to `memory/session_archive/YYYY-MM-DD_HH-MM.md`
3. The snapshot is a frozen record; CURRENT_STATE.md is the live workbench

If gateway crashes before you can do this, that is OK — the last mid-session
checkpoint in CURRENT_STATE.md is your recovery point. It will not be perfect,
but it will be vastly better than starting from zero.

### 4. Result surfacing rule

If you are a sub-agent or execution agent:
- Before exiting, write your key results into CURRENT_STATE.md under `## Unsurfaced Results`
- The main agent MUST check this section on startup and relay findings to the user

This prevents the #1 silent failure: sub-agent did the work, but nobody saw it.

---

## CURRENT_STATE.md Template

```markdown
# Current State
> Last updated: [ISO timestamp]

## Objective
[One sentence: what are we trying to accomplish]

## Current Step
[What step are we on, what was the last thing completed]

## Key Decisions
- [Decision 1: what was decided and why, max 3 items]

## Next Action
[Exactly what should happen next]

## Blockers
[What is preventing progress, or "None"]

## Unsurfaced Results
[Results from sub-agents or tools not yet shown to user, or "None"]
```

**Rules for this template:**
- Every field is mandatory. Write "None" rather than omitting a section.
- `Objective` and `Next Action` are the two most critical fields. If you can
  only save two things before a crash, save these.
- `Key Decisions` caps at 3 items. Older decisions belong in long-term memory,
  not here.
- The entire file should be readable in 15 seconds. If it takes longer, trim it.

---

## Continuity Doctor (optional)

Run `scripts/continuity_doctor.py` to check workspace health:

```bash
python3 scripts/continuity_doctor.py --workspace /path/to/workspace
```

It checks:
- Does `memory/CURRENT_STATE.md` exist?
- Is it stale (not updated in the last session)?
- Does `Objective` match any active tasks file?
- Are there `Unsurfaced Results` that were never addressed?
- Are there session archives without a corresponding state update?

The doctor **reports only** — it does not auto-repair. You decide what to fix.

---

## What this skill is NOT

- Not a long-term memory system (use OpenClaw's native markdown memory or LanceDB for that)
- Not a conversation log or journal (CURRENT_STATE.md is overwritten, not appended)
- Not a task manager (use OpenSpec or tasks.md for project planning)
- Not dependent on any external database (works with plain files only)

## Compatibility

- Works with any OpenClaw agent (main or sub-agent)
- No external dependencies (no npm install, no API keys, no database)
- Backup: `git add memory/` or `cp -r memory/ /backup/` — that is the entire disaster recovery plan
- Can coexist with memory-lancedb-pro, hippocampus, or any other memory skill
