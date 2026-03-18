---
name: memory-continuity
description: >
  Short-term working continuity for OpenClaw agents. Preserves structured
  in-flight work state across gateway restarts, /new, reset, model fallback,
  and context compaction. This skill is the human-readable protocol and
  fallback layer for working-state recovery; it complements native OpenClaw
  memory, compaction, and session memory search rather than replacing them.
  Use when an agent needs to survive session breaks without losing what it was
  doing.
---

# memory-continuity

Lightweight continuity layer built around a single overwrite-oriented state file
(`memory/CURRENT_STATE.md`). Its job is simple: keep a compact, structured
checkpoint of **what the agent is doing right now** so work can resume after
`/new`, reset, gateway interruption, compaction, or handoff.

## Positioning

This skill is **not** the whole long-term architecture.

It is the current:
- **behavior contract** for agents
- **fallback implementation** when no plugin is installed
- **human-readable protocol** for maintaining working-state continuity

Longer term, the primary runtime path is expected to be a **standard lifecycle
plugin** that improves save/restore reliability without consuming OpenClaw’s
exclusive `contextEngine` slot.

## Why this exists

OpenClaw already has native systems for:
- transcript persistence
- compaction summaries
- pre-compaction `memoryFlush`
- session-aware `memory_search`

Those are valuable, but they answer a different question.

They help with:
- what was discussed before?
- what knowledge or facts were written down?

This skill helps with:
- what are we doing **right now**?
- where did we stop?
- what should happen next?
- what result exists but has not yet been surfaced?

That is why `CURRENT_STATE.md` exists.

## Source of truth

The source of truth for working-state continuity is:
- `memory/CURRENT_STATE.md`

This file should stay:
- short
- structured
- overwrite-oriented
- readable by both humans and agents

It is a **checkpoint**, not a journal.

## File layout

```text
$WORKSPACE/
├── memory/
│   ├── CURRENT_STATE.md      # live workbench (overwrite, never append-log)
│   └── session_archive/      # optional frozen snapshots
│       ├── 2026-03-12_14-30.md
│       └── ...
```

---

## MANDATORY PROTOCOL

### 1. On session start or recovery-like prompts

If `memory/CURRENT_STATE.md` exists:
1. read it
2. determine whether it contains meaningful active work
3. if active work exists and the user is asking to continue / recover / resume,
   **surface the recovered state before generic greeting or chit-chat**
4. prefer truth over guessing

If no active work exists:
- normal conversation flow is fine

If the file does not exist:
- create it from the template below when work begins

### 2. Recovery priority rule

In recovery scenarios such as:
- `/new`
- reset
- “刚才我们说到哪了”
- “continue”
- “resume”
- “what were we doing”
- obvious post-interruption continuation

Do **not** open with generic greetings if `CURRENT_STATE.md` contains active
work. First surface:
- Objective
- Current Step
- Next Action
- Blockers (if any)
- Unsurfaced Results (if any)

Failure to do this is a continuity failure, not a style preference.

### 3. When to update CURRENT_STATE.md

Update the file by **overwriting** it, not appending, at these moments:

| Trigger | Why |
|---|---|
| User confirms a decision | Decisions are hard to reconstruct later |
| A concrete task step completes | Marks true progress for recovery |
| A blocker or error appears | Prevents repeated failure after reset |
| Before long-running or risky tool work | Preserves a recovery point before interruption |
| Before `/new` / reset-like boundary | Prevents deliberate context reset from dropping work state |
| Before handoff / subagent exit | Preserves outputs and unsurfaced results |
| After a substantive state change | Keeps checkpoint aligned with actual work |

### Override rule

**CURRENT_STATE.md must always be overwritten when:**
- A new task or objective starts — regardless of what is currently in the file
- The previous objective is complete or abandoned
- The user gives a new task that supersedes the previous one

Having content in CURRENT_STATE.md does NOT mean it should be preserved.
Content only matters if Objective is still active and work is genuinely in progress.

Checking before overwrite:
- Read the file
- If Objective matches the current task → update in place (overwrite)
- If Objective does NOT match → overwrite the entire file with the new state
- Never append. Never skip the update because "there's already something there".

### 4. Keep the checkpoint small

`CURRENT_STATE.md` should usually stay under about 40 lines and be readable in
15 seconds.

If it grows too long, compress it.
If it turns into a diary, you are using the wrong file.

### 5. Result surfacing rule

If you are a sub-agent or execution agent:
- write unreported outcomes into `## Unsurfaced Results`
- do not assume the main agent has already forwarded them

This prevents a common failure mode:
- work finished
- result existed
- nobody surfaced it to the user

### 6. Relationship to native OpenClaw memory

Do not use this skill to replace:
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- compaction summaries
- session memory search

Use it only for **active working state**.

A good rule of thumb:
- if the content matters because it is true long-term → put it in long-term memory
- if the content matters because it tells the next session what to do next → put it here

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

### Template rules
- Every field is mandatory. Use `None` rather than omission.
- `Objective` and `Next Action` are the two most critical fields.
- `Key Decisions` should stay short; move older material to long-term memory.
- `Unsurfaced Results` should be explicit, not implied.
- If `Objective` is empty / placeholder / idle, recovery should not pretend there is active work.

---

## Continuity Doctor (optional)

Run `scripts/continuity_doctor.py` to check workspace health:

```bash
python3 scripts/continuity_doctor.py --workspace /path/to/workspace
```

The doctor reports only. It does **not** auto-repair.

It should help answer:
- does `CURRENT_STATE.md` exist?
- is it stale?
- does it follow the template?
- are `Unsurfaced Results` still present?
- does recovery state look usable?

---

## What this skill is NOT

- Not a long-term memory system
- Not a replacement for OpenClaw compaction
- Not a replacement for `memoryFlush`
- Not a replacement for session transcript memory search
- Not a task manager or project database
- Not a conversation log or journal
- Not dependent on any external database

## Compatibility

- Works as a plain-skill fallback today
- Compatible with main agents and subagents when they can maintain the file
- Designed to evolve toward a **standard lifecycle plugin** as the primary runtime path
- Intentionally avoids depending on the exclusive `contextEngine` slot as the default architecture
