# Phase 2 Hook Validation Notes

## Goal
Validate whether a **standard lifecycle plugin** can support the first practical
memory-continuity MVP without consuming the exclusive `contextEngine` slot.

## Current evidence from local docs / SDK

### Confirmed hook/event names seen in local OpenClaw install
From local docs and SDK/runtime sources, the following names are present:

#### Typed plugin lifecycle hooks (`api.on`)
- `before_prompt_build`
- `before_agent_start`
- `agent_end`
- `before_compaction`
- `after_compaction`
- `subagent_ended`

#### Event hooks (`api.registerHook`)
- `command:new`
- `command:reset`
- `session:compact:before`
- `session:compact:after`
- `agent:bootstrap`

## Important finding: prompt injection is available to standard plugins
Local runtime code shows:
- `promptInjectionHookNameSet = new Set(["before_prompt_build", "before_agent_start"])`

This matters because it means a standard plugin may be able to inject startup
continuity hints **without** using the exclusive ContextEngine slot.

## Preferred v1 hook mapping

### 1. Startup recovery hint
**Primary candidate:** `before_prompt_build`

Why:
- explicitly documented as preferred over legacy `before_agent_start`
- supports prompt mutation fields such as:
  - `prependContext`
  - `prependSystemContext`
  - `appendSystemContext`
  - `systemPrompt`
- happens after session load, which is more practical for dynamic continuity state

**Fallback candidate:** `before_agent_start`

Why:
- present in runtime and treated as a prompt injection hook
- useful if `before_prompt_build` proves insufficient in some environments

### 2. `/new` boundary checkpoint
**Primary candidate:** `command:new`

Goal:
- save/archive working-state checkpoint before user-triggered reset of conversational continuity

### 3. End-of-run safety checkpoint
**Primary candidate:** `agent_end`

Goal:
- opportunistically preserve checkpoint state even if the agent was imperfectly disciplined mid-turn

### 4. Compaction protection
**Candidates to test:**
- `before_compaction`
- `session:compact:before`

This is the most important unresolved path.

## Biggest unresolved technical risk
The lifecycle-plugin route still has one major unsolved problem:

> How should the plugin expose a startup continuity hint robustly enough to
> satisfy “baseline recovery without read”, without relying on ContextEngine-only
> `systemPromptAddition`?

Local evidence suggests `before_prompt_build` may be enough, but this must be
validated by a real plugin test.

## Required Phase 2 experiments

### Experiment A — startup prompt injection
Build a minimal plugin that:
- reads `memory/CURRENT_STATE.md`
- derives a compact snapshot
- injects it through `before_prompt_build`
- verifies the snapshot is actually visible to the agent in a fresh run

### Experiment B — `/new` checkpoint timing
Build a minimal plugin that:
- handles `command:new`
- archives or checkpoints `CURRENT_STATE.md`
- verifies the write occurs before continuity is reset

### Experiment C — compaction boundary guarantee
Build a minimal plugin that:
- hooks `before_compaction` and/or `session:compact:before`
- writes a deterministic marker/checkpoint
- verifies compaction waits for hook completion

**This experiment is mandatory.**
If the hook does not reliably block until the write completes, the compaction
safety design must be revised.

### Experiment D — end-of-run safety path
Build a minimal plugin that:
- hooks `agent_end`
- performs a trivial state write
- confirms the event fires reliably enough to be useful as a safety net

## Prototype status
A local prototype skeleton exists at:
- `plugin/lifecycle-prototype.ts`

That file is only a Phase 2 probe. It is **not** the final implementation.

## Current conclusion
Based on local documentation and runtime inspection:
- a **standard lifecycle plugin** looks viable as the primary v1 architecture
- it likely supports startup prompt injection, `/new` handling, run-end checkpointing, and compaction-path interception
- the two most important items still requiring live proof are:
  1. prompt injection quality in `before_prompt_build`
  2. synchronous compaction safety in `before_compaction` / `session:compact:before`
