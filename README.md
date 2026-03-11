# memory-continuity

OpenClaw skill for **short-term working continuity** — so your agent can pick up
exactly where it left off after a gateway crash, `/new`, model fallback, or
context compaction.

## What problem does this solve?

When your gateway dies mid-conversation, or you hit `/new` to start fresh, or
the model falls back to a different provider — your agent loses its working
context. Long-term memory can tell it *what it knows*, but not *what it was
doing*. This skill fills that gap.

**One-line summary:** Long-term memory = what you know. This skill = what you
are doing right now.

## Quick Start

### Install

```bash
# Go to your OpenClaw workspace skills directory
cd ~/.openclaw/workspace/skills/

# Clone
git clone https://github.com/dtzp555-max/memory-continuity.git

# That's it. No npm install, no API keys, no database.
```

### Test it

1. Start a conversation with your agent about a multi-step task
2. Chat for a few turns, make some decisions
3. Check: does `memory/CURRENT_STATE.md` exist in your workspace? Does it
   reflect what you were doing?
4. Type `/new` to start a fresh session
5. The agent should read `CURRENT_STATE.md` and ask:
   *"Last session we were working on X. Want to continue?"*

If step 5 works, the skill is doing its job.

### Run the doctor

```bash
python3 scripts/continuity_doctor.py --workspace ~/.openclaw/workspace
```

Sample output:
```
Continuity Doctor — scanning: /Users/you/.openclaw/workspace
============================================================

[OK]        memory/CURRENT_STATE.md exists
[OK]        CURRENT_STATE.md is fresh (0.3h old)
[OK]        Template compliance: all sections present
[WARNING]   Unsurfaced Results section is not empty — review needed
[INFO]      Found 3 session archive(s), latest: 2026-03-12_14-30.md

Overall status: WARNING
```

## How it works

The skill installs a behavioral protocol via `SKILL.md`. When loaded, the agent
follows these rules:

1. **Session start:** Read `memory/CURRENT_STATE.md`, brief the user, wait for
   confirmation
2. **During work:** Overwrite the state file at key moments (decisions,
   completed steps, errors, before long tool calls, every ~10 turns)
3. **Session end / `/new`:** Final state save + archive a timestamped snapshot

The state file uses a fixed template:

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

The entire file is designed to be read in 15 seconds. It is overwritten (not
appended) on every update, keeping it permanently short.

## Architecture position

This skill occupies a specific niche. Here is how it relates to other tools:

| Layer | Tool | What it stores |
|---|---|---|
| Working state | **memory-continuity** (this skill) | What you are doing *right now* |
| Stable facts | OpenClaw native markdown memory | Preferences, decisions, knowledge |
| Retrieval | memory-lancedb-pro / similar | Searchable long-term history |

These layers are complementary. This skill has **zero dependency** on any
database or external memory plugin. It works with plain markdown files that
live in your workspace and can be backed up with `git` or `cp`.

## File structure

```
memory-continuity/
├── SKILL.md                    # Core skill (loaded by OpenClaw)
├── README.md                   # This file
├── LICENSE                     # MIT
├── references/
│   ├── template.md             # CURRENT_STATE.md blank template
│   └── doctor-spec.md          # Doctor check specifications
└── scripts/
    └── continuity_doctor.py    # Diagnostic tool (reports only, no auto-repair)
```

At runtime, the skill creates these files in your workspace:

```
$WORKSPACE/
└── memory/
    ├── CURRENT_STATE.md         # Live workbench (overwritten each update)
    └── session_archive/         # Timestamped snapshots from past sessions
        ├── 2026-03-12_14-30.md
        └── ...
```

## Design principles

1. **Zero dependencies.** No database, no API, no npm packages. Just files.
2. **Backup = copy.** The entire state is in `memory/`. Back it up however you
   back up your workspace.
3. **Overwrite, don't append.** CURRENT_STATE.md is a workbench, not a journal.
   It stays short because it is replaced on every update.
4. **Diagnose, don't auto-repair.** The doctor script flags problems for you to
   fix. Automated repair of state files is too risky at this stage.
5. **Complement, don't compete.** This skill does not replace long-term memory.
   It solves a different problem (crash recovery vs knowledge retrieval).

## Current status

**v0.2 — Draft / early version**

What works:
- SKILL.md protocol with discipline rules
- CURRENT_STATE.md template
- Continuity doctor diagnostic script
- Session archive on `/new`

Planned:
- Plugin version with `command:new` and `before_agent_start` hooks
  (for guaranteed save/restore without relying on agent self-discipline)
- More real-world validation across different gateway configurations
- Sub-agent continuity handover protocol

## License

MIT
