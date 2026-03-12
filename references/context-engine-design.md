# Memory Continuity ContextEngine Design

## Status
Design draft only. No plugin implementation yet.

## Why a ContextEngine version exists
The current `memory-continuity` skill is useful, but it depends too much on agent cooperation:
- the agent must notice recovery conditions
- the agent must keep `memory/CURRENT_STATE.md` updated
- the agent often benefits from `read`

OpenClaw now exposes a formal `ContextEngine` extension point. That gives memory continuity a runtime-aligned path forward without modifying OpenClaw core.

## Product strategy
Keep two product forms:

### A. Skill version
Role:
- zero-dependency fallback
- behavior contract
- template discipline
- compatibility with environments that do not install plugins

### B. ContextEngine plugin version
Role:
- runtime-backed recovery
- continuity snapshot injection without depending on `read`
- stronger compaction and subagent continuity

These two forms should complement each other, not compete.

## Source of truth
Primary durable checkpoint file:
- `memory/CURRENT_STATE.md`

The plugin should treat this file as the editable, human-readable source of truth for working state.

The plugin may derive an internal lightweight snapshot from it, but should not replace it with an opaque database-first design.

## Non-goals
The plugin version should **not**:
- replace `MEMORY.md`
- replace daily notes in `memory/YYYY-MM-DD.md`
- replace native OpenClaw compaction summaries
- replace native `memoryFlush`
- persist a full transcript mirror
- inject large recovery payloads into every turn

## Core runtime idea
Use the ContextEngine lifecycle to ensure that short-term working state remains available across:
- `/new`
- reset/restart
- compaction
- subagent boundaries

The plugin should prefer deterministic, structured recovery over free-form recollection.

## Desired user-visible property
Even if an agent lacks `read`, the session should still have a compact continuity hint when there is active work worth recovering.

## Checkpoint schema
The checkpoint file should retain a stable, minimal structure:

```md
# Current State
> Last updated: 2026-03-12T21:00:00+10:00

## Objective
...

## Current Step
...

## Key Decisions
- ...

## Next Action
...

## Blockers
None

## Unsurfaced Results
None
```

Potential future additions if truly needed:
- `Confidence`
- `Freshness`
- `Recent Finished`

But the default should stay compact.

## Runtime snapshot shape
The plugin should inject a much smaller summary than the raw file.

Target content:
- Objective
- Current Step
- Last Confirmed Result or Key Decision(s)
- Next Action
- Blockers
- Freshness / Updated At

### Draft example
```text
CONTINUITY SNAPSHOT
Objective: Verify memory continuity for Telegram subagents.
Current Step: Tools fixed; validating runtime-backed recovery design.
Key Decision: Use skill as fallback, ContextEngine as long-term path.
Next Action: Finalize plugin scope and hook responsibilities.
Blockers: None.
Updated: 2026-03-12T22:00:00+10:00
```

### Size target
- preferred: ~150-300 tokens
- avoid large raw file injection on every turn
- skip injection entirely when there is no meaningful active state

## ContextEngine lifecycle mapping

### 1. `bootstrap`
Purpose:
- initialize plugin-managed continuity state for a session
- verify whether a checkpoint file exists
- record whether recovery state is available

Should do:
- check for `memory/CURRENT_STATE.md`
- perform lightweight validation
- avoid heavy prompt injection here

Should not do:
- inject large content directly
- rewrite the checkpoint file unnecessarily

Reasoning:
`bootstrap` should establish availability, not spend tokens.

---

### 2. `assemble`
Purpose:
- the main recovery injection point

Should do:
- load/derive a very small continuity snapshot
- return it via `systemPromptAddition`
- inject only when the checkpoint indicates meaningful active work
- favor stable, structured wording

Should avoid:
- injecting the full checkpoint file by default
- injecting stale or placeholder content
- adding snapshot text when objective/current step are empty or obviously idle

This is the key mechanism that enables baseline continuity **without requiring `read`**.

---

### 3. `afterTurn`
Purpose:
- opportunistic maintenance of checkpoint state after a completed turn

Should do:
- update checkpoint when meaningful state changes are detected
- optionally use a configurable cadence (for example every N substantive turns)
- keep writes overwrite-oriented rather than append-heavy

Should avoid:
- writing on every trivial turn
- producing noisy I/O for idle chat
- becoming the only write path

Practical stance:
- `afterTurn` is a maintenance path, not the only safety net
- correctness should not rely entirely on semantic heuristics

---

### 4. `compact`
Purpose:
- hard safety checkpoint before compaction loses older detailed history

Should do:
- force a final continuity checkpoint before compaction
- preserve current objective / step / blockers / unsurfaced results
- ensure recovery remains possible after compaction

This is the strongest required protection point.

If any lifecycle hook must be treated as mandatory continuity insurance, this is the one.

---

### 5. `prepareSubagentSpawn`
Purpose:
- seed child continuity with the minimum parent working-state context

First implementation should stay simple:
- prepare a lightweight child seed from parent objective + current step
- avoid over-copying parent state
- prefer a minimal handoff

Initial scope suggestion:
- include only what the child needs to start coherently
- do not attempt full bidirectional synchronization in v1

---

### 6. `onSubagentEnded`
Purpose:
- reclaim continuity-relevant child outputs when the child lifecycle ends

First implementation should stay simple:
- inspect whether child state contains meaningful `Unsurfaced Results`
- optionally merge a compact result summary back into parent continuity state

Caution:
- parent/child sync can become complex quickly
- v1 should prefer conservative merge behavior over ambitious automation

## Interaction with native OpenClaw systems

### With `memoryFlush`
Native `memoryFlush` helps the model store durable memory before compaction.

Memory continuity should not replace that.
Instead:
- `memoryFlush` handles durable notes / memory files
- continuity handles structured working-state checkpointing

### With native compaction continuity
OpenClaw’s compaction keeps summary information in session history.

Memory continuity should complement that by providing:
- a fixed schema
- a stable recovery surface
- explicit next-step / blocker / unsurfaced-result fields

### With tools like `read`
`read` remains valuable for enhanced recovery and debugging.

But baseline continuity should not require `read` once the plugin injects a small snapshot during `assemble`.

## Open design questions
1. How should stale checkpoints be detected and labeled?
2. Should the plugin compute confidence/freshness automatically?
3. What is the best trigger for "active work exists"?
4. How much of `CURRENT_STATE.md` should be normalized vs preserved verbatim?
5. Should plugin writes go directly to `memory/CURRENT_STATE.md`, or stage then atomically replace?
6. How should main/subagent continuity boundaries behave when multiple workers are active?

## Recommended implementation phases

### Phase 1 — Design + discipline hardening
- refine skill documentation
- stabilize checkpoint template
- clarify scope vs non-goals
- improve validation / doctor behavior

### Phase 2 — Minimal plugin MVP
- register context engine
- implement `bootstrap`
- implement `assemble` with `systemPromptAddition`
- implement `compact` forced checkpoint
- leave subagent lifecycle hooks minimal or no-op initially

### Phase 3 — Reliability improvements
- add controlled `afterTurn` checkpointing
- add freshness/confidence labeling
- improve stale-state handling
- tune injection length

### Phase 4 — Subagent continuity
- implement minimal `prepareSubagentSpawn`
- implement conservative `onSubagentEnded`
- validate parent/child merge behavior in real workflows

## Success criteria
The plugin version is successful when:
- reset/new sessions recover active work without depending on `read`
- compaction no longer destroys actionable in-flight state
- subagent continuity improves without excessive prompt bloat
- the snapshot remains small enough to be practical on every assembled turn
- behavior aligns with OpenClaw’s official plugin/context-engine model

## Short summary
The ContextEngine plugin version should become the **runtime-backed continuity layer**, while the existing skill remains the **human-readable protocol and fallback behavior contract**.
