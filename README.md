# memory-continuity

**Current release:** `v2.3.0`

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
openclaw gateway restart 2>&1 | grep memory-continuity
# Should show: [memory-continuity] Plugin registered successfully
```

### Test

1. Tell your agent something memorable (e.g., "I'll tell you a secret: Ethan is super kid")
2. Send `/new` to reset the session
3. Ask "what was the secret?" or "我们刚才聊到哪了"
4. The agent should immediately surface the recovered state

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

## OpenClaw 升级后恢复

OpenClaw 升级（`npm update -g openclaw`）**不会覆盖** `~/.openclaw/openclaw.json` 用户配置。但如果插件行为异常，按以下步骤排查和恢复：

### 快速诊断

```bash
# 检查插件是否加载
openclaw gateway restart 2>&1 | grep memory-continuity
# 应输出: [memory-continuity] Plugin registered successfully

# 检查配置是否完整
cat ~/.openclaw/openclaw.json | grep -A2 memory-continuity
```

### 常见故障与恢复

| 症状 | 原因 | 恢复方法 |
|------|------|---------|
| 启动日志无 `Plugin registered` | 插件文件缺失或配置丢失 | 重跑 `bash scripts/post-install.sh` |
| `plugins.allow is empty` 警告 | `openclaw.json` 中 `plugins.allow` 被清空 | 添加 `"plugins.allow": ["memory-continuity"]` |
| `loaded without provenance` 警告 | `plugins.installs` 记录丢失 | 添加 `"plugins.installs": {"memory-continuity": {"source": "path"}}` |
| 新版本改了钩子 API | OpenClaw breaking change | 查看 [CHANGELOG](CHANGELOG.md)，更新 `index.js` |
| 状态不恢复但无报错 | Session 缓存了旧的 skillsSnapshot | `/new` 开新 session，或重跑 `post-install.sh`（会清缓存） |

### 一键恢复

出现任何问题，重跑安装脚本即可（幂等，可重复执行）：

```bash
cd ~/.openclaw/projects/memory-continuity   # 或你 clone 的位置
git pull                                     # 拉取最新版本
bash scripts/post-install.sh                 # 重新安装 + 重启 gateway
```

### 升级前备份（推荐）

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
    └── continuity_doctor.py       # Health check
```

## Design principles

1. **Files are the source of truth** — plain markdown, no database
2. **Hooks over prompts** — don't rely on model behavior
3. **Zero external dependencies** — no API keys, no vector DB
4. **Portable and backupable** — `cp` is your backup tool
5. **Complements native OpenClaw memory** — does not replace it

## License

MIT
