# memory-continuity

**Current release:** `v4.0.0`

OpenClaw **lifecycle plugin** for short-term working continuity. Preserves structured in-flight work state across `/new`, reset, gateway restarts, model fallback, and context compaction.

## Why this plugin?

There are feature-rich memory plugins out there (vector search, semantic dedup, smart extraction). We took a different path:

- **Zero dependency** — no embedding API, no vector DB, no external services
- **Plain files** — data is markdown, human-readable, editable, greppable
- **Hook-driven** — doesn't rely on model behavior, works with any model
- **Backup = copy** — `cp` / `scp` / `rsync` is your entire backup strategy
- **Migrate in seconds** — copy files to new host, done. No re-indexing, no model binding
- **Upgrade-proof** — doesn't occupy the `contextEngine` slot, doesn't depend on OpenClaw internals
- **Native-consistent** — aligns with OpenClaw's `memory/` file conventions

If what you need is "don't lose work across sessions" rather than "semantic search over 100k memories", this plugin is for you.

## What problem does this solve?

OpenClaw already preserves transcripts, compaction summaries, memory files, and session memory search. But those don't always answer the most operational question:

> What were we doing right now, where did we stop, and what should happen next?

That is the problem this plugin solves.

**One-line summary:**
- long-term memory = what you know
- memory continuity = what you are doing right now

## How it works

The plugin uses OpenClaw lifecycle hooks to **automatically** save and restore working state — no model cooperation needed.

| Hook | What it does |
|---|---|
| `before_agent_start` | Reads `memory/CURRENT_STATE.md` and injects it into the agent's system context |
| `before_compaction` | Injects state before compaction so it survives context compression |
| `before_reset` | Archives current state to `session_archive/` before `/new` |
| `agent_end` | Auto-extracts working state from conversation if no explicit state exists |
| `session_end` | Ensures `CURRENT_STATE.md` exists for future sessions |

Because state injection happens at the hook level (before the model sees anything), it works with **any model** — GPT-4o, MiniMax, Claude, etc.

## Quick Start

### Marketplace Install (recommended)

```bash
openclaw plugins install https://github.com/dtzp555-max/memory-continuity
```

### Works with lossless-claw

This plugin does **not** use the `contextEngine` slot. It runs via lifecycle hooks only, so it coexists perfectly with lossless-claw or any other context engine:

- **lossless-claw** = lossless context compression (contextEngine slot)
- **memory-continuity** = working-state recovery (hooks only)

Install both for the best experience.

### Programmatic API

Other plugins can call MC's recall function programmatically:

```javascript
// In another plugin's register() function:
const recall = api.getService("mc:recall");
if (recall) {
  const result = await recall.handler(
    { topic: "deployment issues", maxItems: 3 },
    ctx
  );
  // result.results = [{ date, type, score, summary }, ...]
}
```

### Install

```bash
# Clone the plugin
git clone https://github.com/dtzp555-max/memory-continuity.git

# Run the installer
cd memory-continuity
bash scripts/post-install.sh
```

The installer will:
1. Copy the plugin to `~/.openclaw/extensions/memory-continuity/`
2. Add the plugin entry to `~/.openclaw/openclaw.json`
3. Add `memory-continuity` to `plugins.allow` (trust list)
4. Add install record to `plugins.installs` (provenance tracking)
5. Restart the gateway

No npm install, no API keys, no external database.

### Verify

```bash
# Quick 3-layer install check (files → tool → workspace state)
bash scripts/verify.sh

# Show a sample high-importance state entry
bash scripts/verify.sh --sample

# Check against a custom workspace
bash scripts/verify.sh --workspace ~/.openclaw/workspace/myproject
```

```bash
# Alternatively, confirm the gateway loaded the plugin
openclaw gateway restart 2>&1 | grep memory-continuity
# Should show: [memory-continuity] Plugin registered successfully
```

### Test

1. Tell your agent something memorable (e.g., "I'll tell you a secret: Ethan is super kid")
2. Send `/new` to reset the session
3. Ask "what was the secret?" or "我们刚才聊到哪了"
4. The agent should immediately surface the recovered state

## Interactive Commands (`/mc`)

v3.0.0 adds a companion plugin that registers `/mc` as a native slash command. Works in Telegram, Discord, and anywhere OpenClaw commands are supported.

```
/mc state              View main agent's working state
/mc state --all        Overview of all agents
/mc state tech_geek    View a specific agent's state
/mc history            List archived sessions
/mc restore 3          Restore archive #3
/mc search auth        Search "auth" across all memory
/mc settings           View plugin settings
/mc settings maxArchiveCount 30   Update a setting
/mc compact            Compress oversized state file
/mc export all         Export all agents' memory to file
/mc --help             Command reference
```

The `/mc` plugin reads memory files directly — no HTTP endpoints, no model invocation. Responses are instant.

### Install the command plugin

The `/mc` command plugin is separate from the lifecycle plugin. To install:

```bash
# Clone (if you haven't already)
cd ~/.openclaw/projects
git clone https://github.com/dtzp555-max/memory-continuity.git

# The mc-plugin is bundled in the mc-plugin/ directory
cp -r memory-continuity/mc-plugin ~/.openclaw/projects/mc-plugin
mkdir -p ~/.openclaw/extensions/mc
cp ~/.openclaw/projects/mc-plugin/* ~/.openclaw/extensions/mc/
```

Then add to `openclaw.json`:
```json
{
  "plugins": {
    "allow": ["memory-continuity", "mc"],
    "entries": {
      "mc": { "enabled": true }
    },
    "installs": {
      "mc": {
        "source": "path",
        "sourcePath": "~/.openclaw/projects/mc-plugin",
        "installPath": "~/.openclaw/extensions/mc"
      }
    }
  }
}
```

Restart the gateway and `/mc --help` should work.

## Configuration

The plugin works with zero configuration. Optional settings in `openclaw.json`:

```json
{
  "plugins": {
    "allow": ["memory-continuity"],
    "entries": {
      "memory-continuity": {
        "enabled": true,
        "hooks": {
          "allowPromptInjection": true
        },
        "config": {
          "maxStateLines": 50,
          "archiveOnNew": true,
          "autoExtract": true
        }
      }
    }
  }
}
```

| Option | Default | Description |
|---|---|---|
| `maxStateLines` | `50` | Max lines for CURRENT_STATE.md |
| `archiveOnNew` | `true` | Archive state to `session_archive/` before `/new` |
| `autoExtract` | `true` | Auto-extract state from conversation at session end |
| `maxArchiveCount` | `20` | Maximum archive files to keep (oldest auto-deleted) |

## The checkpoint file

The plugin maintains one file: `$WORKSPACE/memory/CURRENT_STATE.md`

```markdown
# Current State
> Last updated: 2026-03-15T14:00:00Z

## Objective
Build the user authentication module

## Current Step
Completed JWT token generation, starting refresh endpoint

## Key Decisions
- Using RS256 for token signing (user approved)

## Next Action
Implement POST /auth/refresh endpoint

## Blockers
None

## Unsurfaced Results
None
```

This file is:
- **Overwritten**, not appended (it's a checkpoint, not a journal)
- **Human-readable** plain markdown
- **Portable** — just copy the file to backup or migrate
- **Model-agnostic** — injected via hooks, not dependent on model behavior

## Backup & Migration

```bash
# Backup
cp $WORKSPACE/memory/CURRENT_STATE.md /backup/

# Migrate to another machine
scp -r ~/.openclaw/extensions/memory-continuity/ newhost:~/.openclaw/extensions/
scp $WORKSPACE/memory/CURRENT_STATE.md newhost:$WORKSPACE/memory/
```

No database, no vector embeddings, no API keys to transfer.

## Recovery after OpenClaw upgrade

OpenClaw upgrades (`npm update -g openclaw`) **do not overwrite** the user config at `~/.openclaw/openclaw.json`. However, if the plugin stops working after an upgrade, follow these steps:

### Quick diagnosis

```bash
# Check if the plugin is loaded
openclaw gateway restart 2>&1 | grep memory-continuity
# Expected: [memory-continuity] Plugin registered successfully

# Verify config is intact
cat ~/.openclaw/openclaw.json | grep -A2 memory-continuity
```

### Common issues and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| No `Plugin registered` in startup log | Plugin files missing or config lost | Re-run `bash scripts/post-install.sh` |
| `plugins.allow is empty` warning | `plugins.allow` was cleared in config | Add `"plugins.allow": ["memory-continuity"]` |
| `loaded without provenance` warning | `plugins.installs` record missing | Add `"plugins.installs": {"memory-continuity": {"source": "path"}}` |
| New version changed hook API | OpenClaw breaking change | Check [CHANGELOG](CHANGELOG.md), update `index.js` |
| State not recovering, no errors | Session cached stale skillsSnapshot | `/new` to start fresh session, or re-run `post-install.sh` (clears cache) |

### One-command recovery

The install script is idempotent — safe to re-run at any time:

```bash
cd ~/.openclaw/projects/memory-continuity   # or wherever you cloned it
git pull                                     # pull latest version
bash scripts/post-install.sh                 # reinstall + restart gateway
```

### Pre-upgrade backup (recommended)

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak
```

## Architecture: Plugin vs Skill

Previous versions (v0.x) shipped as a **skill** — a markdown file that asked the model to read/write `CURRENT_STATE.md`. This was unreliable because models could ignore the instructions.

v2.0 is a **lifecycle plugin** that uses OpenClaw hooks. The key difference:

| | Skill (v0.x) | Plugin (v2.0) |
|---|---|---|
| State injection | Model must read the file | Hook injects automatically |
| State saving | Model must write the file | Hook saves automatically |
| Model dependency | Requires model cooperation | Model-agnostic |
| Reliability | Varies by model | Consistent |

The skill (`SKILL.md`) is retained as documentation and fallback protocol.

## Repository layout

```text
memory-continuity/
├── openclaw.plugin.json           # Plugin manifest
├── index.js                       # Plugin entry point (hooks)
├── SKILL.md                       # Behavior contract / protocol docs
├── README.md
├── LICENSE
├── plugin/
│   └── lifecycle-prototype.ts     # Original prototype (reference)
├── references/
│   ├── template.md
│   ├── doctor-spec.md
│   └── phase2-hook-validation.md
└── scripts/
    ├── post-install.sh            # Automated installer
    ├── verify.sh                  # 3-layer install verifier
    └── continuity_doctor.py       # Health check
```

## Design principles

1. **Files are the source of truth** — plain markdown, no database
2. **Hooks over prompts** — don't rely on model behavior
3. **Zero external dependencies** — no API keys, no vector DB
4. **Portable and backupable** — `cp` is your backup tool
5. **Complements native OpenClaw memory** — does not replace it

## Support

If you find this plugin useful, please consider giving it a ⭐ on GitHub — it helps others discover the project!

[![GitHub stars](https://img.shields.io/github/stars/dtzp555-max/memory-continuity?style=social)](https://github.com/dtzp555-max/memory-continuity)

## License

MIT
