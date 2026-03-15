# Changelog

## v2.0.0 — 2026-03-15

### Summary
Major architecture upgrade: from prompt-based skill to **lifecycle plugin**.
State injection and extraction now happen automatically via OpenClaw hooks,
making recovery model-agnostic and reliable across all providers.

### Added
- `index.js` — plugin entry point with 5 lifecycle hooks
- `openclaw.plugin.json` — plugin manifest with configSchema
- Automated installer (`scripts/post-install.sh`) that handles copy + config + restart

### Changed
- Architecture: skill (prompt-based) → plugin (hook-based)
- `before_agent_start` hook injects `CURRENT_STATE.md` into system context automatically
- `agent_end` hook auto-extracts working state from conversation
- `before_compaction` hook preserves state through context compression
- `before_reset` hook archives state before `/new`
- `session_end` hook ensures state file exists
- README fully rewritten for plugin architecture
- post-install.sh rewritten for plugin installation flow

### Removed
- Dependency on model cooperation for state read/write
- Reliance on `skillsSnapshot` cache clearing

### Validated
- Tested with MiniMax M2.5 and GPT-5.4 on OpenClaw 2026.3.12
- `/new` recovery: agent correctly surfaces recovered state
- Multi-turn state: conversation context (secrets, scheduled events) persists across resets

---

## v0.3.0-probe — 2026-03-13

### Summary
Transition from skill-only to dual-form package (skill + lifecycle plugin probe).

### Added
- `plugin/lifecycle-prototype.ts`
- `references/phase2-hook-validation.md`

### Changed
- Repository direction clarified: primary path is lifecycle plugin
- ContextEngine documented as future option, not v1 default

### Validated
- Startup continuity injection on resident subagents
- Hook wiring confirmed without `read` tool dependency

### Known limitation
- Skill-based approach unreliable: models can ignore recovery instructions
- This limitation is resolved in v2.0.0 by moving to hooks
