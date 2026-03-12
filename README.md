# memory-continuity

OpenClaw skill for **short-term working continuity** — so an agent can recover
structured in-flight work state after `/new`, reset, gateway interruption,
model fallback, or compaction.

## What problem does this solve?

OpenClaw already preserves a lot:
- transcripts
- compaction summaries
- memory files
- session memory search

But those do not always answer the most operational question:

> What were we doing right now, where did we stop, and what should happen next?

That is the problem this skill solves.

**One-line summary:**
- long-term memory = what you know
- memory continuity = what you are doing right now

## Current architecture stance

This repository now treats the skill as:
- a **behavior contract**
- a **fallback implementation**
- a **human-readable protocol** for structured working-state checkpoints

The planned primary runtime path is a **standard lifecycle plugin** that can
improve startup, `/new`, and compaction continuity **without consuming
OpenClaw’s exclusive `contextEngine` slot**.

A ContextEngine implementation remains a **future option**, not the default
v1 direction.

## Quick Start

### Install

```bash
cd ~/.openclaw/workspace/skills/
git clone https://github.com/dtzp555-max/memory-continuity.git
```

No npm install, no API keys, no external database.

### Test the current skill version

1. Start a multi-step task with your agent
2. Make a few concrete decisions
3. Check whether `memory/CURRENT_STATE.md` exists and reflects the work state
4. Trigger `/new`
5. Ask a recovery question like:
   - “刚才我们说到哪了”
   - “continue”
   - “what were we doing”

A good recovery should surface the current objective / step / next action,
not generic small talk.

### Run the doctor

```bash
python3 scripts/continuity_doctor.py --workspace ~/.openclaw/workspace
```

## How the current skill version works

The skill defines a discipline around one file:
- `memory/CURRENT_STATE.md`

That file is the short-term workbench for active work. It is:
- overwritten, not appended
- intentionally short
- structured for fast recovery

### The checkpoint shape

```markdown
# Current State
> Last updated: 2026-03-12T14:30:00Z

## Objective
Build the user authentication module

## Current Step
Completed JWT token generation, starting refresh endpoint

## Key Decisions
- Using RS256 for token signing (user approved)
- Token expiry: 15 minutes access, 7 days refresh

## Next Action
Implement POST /auth/refresh endpoint

## Blockers
None

## Unsurfaced Results
None
```

## Recovery rules

In recovery scenarios, the skill expects the agent to prioritize:
- Objective
- Current Step
- Next Action
- Blockers
- Unsurfaced Results

A generic greeting should **not** outrank recovery state when the checkpoint
contains active work.

## Relationship to native OpenClaw features

### Native OpenClaw already handles
- transcript persistence
- compaction
- pre-compaction `memoryFlush`
- session memory search
- system prompt/bootstrap assembly

### memory-continuity adds
- a **structured working-state checkpoint**
- explicit short-term recovery fields
- a deterministic place to look for active work state
- explicit handling for `Unsurfaced Results`

### Important boundary
Session memory search is useful for:
- “what did we discuss before?”
- “what decision was mentioned in a prior session?”

Memory continuity is for:
- “what are we doing right now?”
- “where did we stop?”
- “what should happen next?”

## Repository layout

```text
memory-continuity/
├── SKILL.md
├── README.md
├── LICENSE
├── references/
│   ├── template.md
│   └── doctor-spec.md
└── scripts/
    └── continuity_doctor.py
```

At runtime, the skill works primarily with:

```text
$WORKSPACE/
└── memory/
    ├── CURRENT_STATE.md
    └── session_archive/
```

## Design principles

1. **Files are the source of truth**
2. **Structured checkpoint beats free-form recollection**
3. **Recovery must prefer truth over confident guessing**
4. **This complements native OpenClaw memory; it does not replace it**
5. **Read access is helpful, but should not be the only long-term path**
6. **The primary plugin direction should coexist with other ecosystem plugins such as `lossless-claw`**

## Current roadmap

### Phase 1
Strengthen the current skill version:
- tighten recovery behavior
- tighten checkpoint discipline
- improve doctor and docs

### Phase 2
Build a **standard lifecycle plugin** as the primary runtime path:
- startup recovery behavior
- `/new` checkpointing
- compaction-boundary checkpointing
- end-of-run safety writes

### Future option
Evaluate a ContextEngine variant later only if the slot tradeoff is justified.

## License

MIT
