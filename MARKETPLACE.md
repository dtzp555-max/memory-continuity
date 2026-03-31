# Memory Continuity — Marketplace Listing

## What it does

Memory Continuity is a **zero-dependency lifecycle plugin** that preserves your working state across session resets, compaction, and gateway restarts. It answers one question:

> What were we doing, where did we stop, and what should happen next?

## Key features

- **Automatic state checkpoint** — saves working state at session end, before /new, and before compaction
- **Session logging** — daily markdown logs of all sessions with topic, message count, and token estimates
- **Layered summaries** — daily summaries roll up into weekly summaries
- **Tag extraction** — #tag patterns auto-indexed in memory/tags.md
- **Relevance injection** — injects related history at session start based on keyword matching
- **Memory decay** — old archives move to cold storage after configurable days
- **CJK-aware** — proper token estimation for Chinese/Japanese/Korean text
- **Search & recall** — /mc search and /mc recall for cross-memory search
- **Programmatic API** — other plugins can call mc:recall service directly

## Why this plugin?

| Feature | Memory Continuity | Other memory plugins |
|---------|------------------|---------------------|
| Dependencies | Zero | SQLite, Chroma, APIs |
| Data format | Plain markdown | Proprietary DB |
| Backup strategy | cp / scp | DB export |
| Migration | Copy files | Re-index |
| contextEngine slot | Not used | Often required |
| Works with lossless-claw | Yes | Varies |

## Works with lossless-claw

MC intentionally does NOT use the contextEngine slot. It runs via lifecycle hooks only. This means you can install both:

- **lossless-claw** — lossless context compression (contextEngine slot)
- **memory-continuity** — working-state recovery (hooks only)

They serve complementary purposes and never conflict.

## Install

```
openclaw plugins install https://github.com/dtzp555-max/memory-continuity
```

## Configuration

All settings are optional with sensible defaults. See `openclaw plugins inspect memory-continuity` for the full config schema.
