# Development & Reporting Rules

## 1. Core Development Principles

1. **Align with OpenClaw direction**
   - Build extensions and tools that are likely to survive upstream upgrades.

2. **Clear, simple, beginner-friendly**
   - Prefer obvious behavior over cleverness.
   - Avoid workflows that only the author can understand.

3. **Keep docs and logs concise and clear**
   - README, setup, usage, and troubleshooting should stay short but usable.

4. **Search GitHub before building**
   - Check whether an existing open-source project or pattern already solves the problem.
   - Prefer reuse before starting a new repo.

5. **Explicit over implicit**
   - Critical configuration should be defined once at the top level and referenced elsewhere.
   - Avoid duplicated constants and scattered behavior switches.

6. **Test critical paths, not vanity coverage**
   - Must verify key flows such as tool invocation, model routing, health checks, and main publish/execute paths.

7. **Small PRs, single responsibility**
   - One commit/PR should do one thing.
   - Do not mix unrelated changes in one diff.

8. **Semantic versioning**
   - `patch` = bugfix only
   - `minor` = backward-compatible feature
   - `major` = breaking change

9. **Graceful failure, never silent failure**
   - If config is missing or behavior is invalid, fail loudly.
   - Do not silently fallback and pretend everything is fine.

10. **Every change must be rollback-friendly**
    - Keep the previous good state recoverable.
    - Prefer tags/releases before important deployments.

11. **Config changes count as code changes**
    - CLI args, env vars, and config file changes must be tracked and reviewed like code.

12. **External interactions need logs**
    - Log input summaries and status, but do not dump sensitive full payloads.

13. **Main is PM, not the construction crew**
    - Main handles requirements, planning, dispatch, review, and reporting.
    - Main should not personally code except for tiny linear edits.

14. **Execution work goes to workers by default**
    - Coding, QA, docs, ops, and similar execution should be delegated to the right worker.

15. **Dispatch includes environment, not just a task**
    - When creating/dispatching an agent, specify the needed model, tools, skills, context, workspace, persona, and rules.

16. **Prefer Claude Opus 4.6 for execution when available**
    - Default execution preference: `claude-local/claude-opus-4-6`
    - Secondary: `claude-local/claude-sonnet-4-6`
    - No silent fallback.

17. **Worker git authority is limited by default**
    - Workers may create local branches and commit locally.
    - Workers do not push, open PRs, merge, or rewrite shared history unless explicitly authorized.

18. **Parallel workers must isolate work**
    - Use separate branches.
    - Main owns merge order and conflict resolution.

19. **QA validates, QA does not secretly fix**
    - QA should report pass/fail/blockers based on explicit artifacts.
    - `done(FAIL)` is different from `blocked`.

20. **Rules should start light, then tighten**
    - Avoid over-bureaucratizing small tasks.
    - Use lightweight dispatch for small work and formal dispatch for risky or multi-step work.

---

## 2. Delivery Rules for Push / PR / Release

For any meaningful delivery, verify all of the following:

1. **Code**
   - Changes are actually pushed.

2. **Version**
   - Version number matches the delivery significance.

3. **Docs**
   - README / config / usage docs are updated when behavior changed.

4. **Release**
   - Important updates should get a release/tag.

5. **Release Notes**
   - Important releases should include clear notes.

### Important update triggers
Treat any of the following as an important update:
- security fixes
- new config/env vars
- behavior changes
- installation or usage changes
- user-visible new features or important fixes

Short rule:

> **Code, version, docs, release, and notes should stay aligned.**

---

## 3. Workflow / Reporting Rules

## Task states
Use only:
- `planned`
- `dispatching`
- `in_progress`
- `blocked`
- `reviewing`
- `done`
- `cancelled`

### State meanings
- `dispatching` is not `in_progress`
- no evidence -> cannot claim `in_progress`
- `blocked` can recover to `in_progress`
- `blocked` can return to `dispatching` if reassigned
- tasks can move to `cancelled` when main stops them

## Evidence rule
- No evidence, no milestone/done.
- No validation, no completion.

Good evidence includes:
- non-empty worker reply
- logs
- commit / branch / PR
- test output
- release artifact

## Worker -> Main reporting
Default required fields:
- `status`
- `summary`

Conditional:
- `evidence` (required for `milestone`, `done`, `cancelled`, `done(FAIL)`)
- `risk` (only if meaningful)
- `next` (only if meaningful)
- `artifacts` (required when handoff/review needs precision)

## Main -> Tao reporting
Main must report at these events:
- formal start
- first real execution evidence
- blocked
- milestone
- completion
- worker switch / re-dispatch
- plan change

### Ordering rule
When a worker reports a milestone/completion/blocker:
1. update task state if needed
2. update Tao
3. continue review / next dispatch

## Pre-Action Gate
Before main dispatches, re-dispatches, reviews, or switches workers, main must ask:

> **Has Tao been updated since the last state change?**

If no, update Tao first.

## Anti-Silent Rules

### 1. Step Budget
After roughly every 10 meaningful actions, main must self-audit:
- Am I still making progress?
- Does Tao know what I am doing?
- Am I entering a waiting state?
- Am I waiting for something that may never arrive?

### 2. No Silent Waiting
Before entering a waiting state, main must tell Tao:
- who/what it is waiting for
- what result it expects
- what the next step is if the wait succeeds or fails

### 3. Context Pressure Awareness
If context gets long or scattered, main should send a short checkpoint with:
- current objective
- current progress
- current blocker or next step

### 4. Deadlock Prevention
Before waiting, main must ensure the worker has the minimum resources needed to finish independently.

### 5. Limits
These rules help when main is still able to reason.
They do not solve lower-level runtime death, API/provider empty responses, or transport hangs.

---

## 4. Lightweight vs Formal Dispatch

### Lightweight dispatch
Use for small, low-risk tasks.

Required:
- `task`
- `scope`
- `deliverable`
- `done_definition`

Everything else can inherit defaults.

### Formal dispatch
Use for:
- cross-file work
- multi-step work
- high-risk work
- multi-worker work
- dependency chains
- structured handoffs

May include:
- `depends_on`
- `model`
- `tools`
- `skills`
- `context`
- `workspace`
- `persona`
- `iron_rules`
- `reporting`
- `artifacts_expected`

---

## 5. Practical Summary

If reduced to the shortest possible operating rules:

1. Guard scope.
2. No evidence, no completion.
3. Main decides; workers execute.
4. QA reports; QA does not secretly fix.
5. No silent fallback.
6. No silent waiting.
7. Update Tao on real state changes.
8. Keep code/version/docs/release/notes aligned.
9. Prefer lightweight process for small work, formal process for risky work.
10. If a rule causes friction in practice, propose a revision explicitly instead of silently ignoring it.
