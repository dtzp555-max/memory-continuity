# Changelog

## v3.0.0 — 2026-03-24

### Summary
Major release: **interactive `/mc` commands** for Telegram, Discord, and CLI. You can now inspect, search, restore, and manage agent memory directly from chat.

### Added
- **`/mc` slash command plugin** — 10 subcommands registered as a native OpenClaw gateway command
  - `/mc state [agent]` — view current working state
  - `/mc state --all` — overview of all agents' memory
  - `/mc history [agent]` — list archived sessions
  - `/mc restore <N> [agent]` — restore from archive
  - `/mc clear [agent]` — clear state (auto-archives first)
  - `/mc search <keyword>` — full-text search across all memory and archives
  - `/mc settings` — view/update plugin configuration
  - `/mc compact [agent]` — compress oversized state files
  - `/mc export [agent|all]` — export memory to markdown file
  - `/mc --help` — command reference
- **Multi-agent support** — all commands work across main + sub-agent workspaces
- **Monospace formatting** — output wrapped in code blocks for aligned display in Telegram/Discord
- **Auto-archive on clear** — clearing state automatically archives first, preventing data loss
- **Restore with backup** — restoring an archive backs up current state to `.bak`

### Changed
- Bumped version to 3.0.0
- Plugin now ships as two components: `memory-continuity` (lifecycle hooks) + `mc` (slash commands)

---

## v2.7.0 — 2026-03-22

### Changed
- Memory directory cleanup: auto-remove legacy `STATE_ARCHIVE_*.md` files
- Max memory files limit (500) with auto-cleanup of oldest files
- Archive count limit configurable via `maxArchiveCount`

---

## v2.3.0 — 2026-03-16

### Summary
First **fully stable** release. All previous versions had critical bugs causing silent failure on gateway deployments.

### Fixed
- **Workspace resolution** (`_ctx.workspaceDir`) — Hooks now read workspace path from the hook context parameter instead of `api.runtime.workspaceDir` (which was always `undefined` in gateway mode). This was the root cause of the plugin silently doing nothing on all gateway/Telegram/Discord deployments.
- **Channel metadata stripping** — User messages from Telegram/Discord are cleaned of `Conversation info (untrusted metadata)` prefixes before saving, preventing garbage in the state file.
- **Recovery death spiral** — Short conversations (< 2 real user messages) no longer overwrite existing meaningful state. Previously: tell secret → `/new` → model ignores injected context → "I don't remember" → `agent_end` overwrites secret with failure → permanent data loss.
- **State staleness** — Removed "skip if existing state is meaningful" guard that prevented state from ever updating after the first write.

### Debugging timeline
1. Hooks not firing → `api.runtime.workspaceDir` was `undefined` → fix: use `_ctx.workspaceDir`
2. State file full of Telegram metadata → fix: strip `Conversation info` / `Sender` prefixes
3. State never updating → "Existing state is meaningful, skipping" → fix: always update
4. Good state overwritten by bad → fix: require ≥ 2 real user messages to overwrite

### Tested on
- macOS: GPT-5.4 (openai-codex) ✅
- Oracle Cloud Linux: MiniMax M2.5 ✅
- Multiple OpenClaw agents via Telegram ✅

### Known limitations
- State extraction uses last user/assistant message only (not full summary)
- Models that ignore `prependSystemContext` won't surface recovered state (state file is preserved, not overwritten). Adding recovery instructions to BOOTSTRAP.md helps.

---

## v2.2.0 — 2026-03-16

### Added
- `package.json` with npm-style metadata and `openclaw.type: "plugin"` provenance
- `plugins.allow` auto-configuration in `post-install.sh`
- GitHub release with comparison table vs vector-DB plugins

### Fixed
- "plugins.allow is empty" gateway warning
- "loaded without install/load-path provenance" gateway warning

---

## v2.1.0 — 2026-03-16

### Added
- `openclaw.plugin.json` manifest with `configSchema`
- `scripts/post-install.sh` one-command installer

### Changed
- README updated with "Why this plugin?" section

---

## v2.0.0 — 2026-03-15

### Summary
Architecture upgrade: skill (prompt-based) → **plugin** (lifecycle hooks).

### Added
- `index.js` with 5 lifecycle hooks: `before_agent_start`, `before_compaction`, `before_reset`, `agent_end`, `session_end`
- Automated state injection via `prependSystemContext`
- Auto-extraction of working state from conversation

### Removed
- Dependency on model cooperation for state read/write

---

## v1.0.0 — 2026-03-14

### Summary
Initial release as a skill (SKILL.md only). Required model to voluntarily read/write `CURRENT_STATE.md`. Did not work reliably with weaker models.
