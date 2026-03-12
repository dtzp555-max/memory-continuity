# Memory Continuity Lifecycle Plugin Design

## Status
Design draft only. No plugin implementation yet.

## Current architectural choice
Memory continuity should **not** use the `ContextEngine` slot as its primary v1 architecture.

Reason:
- `contextEngine` is an **exclusive slot** in OpenClaw
- users should not be forced to choose between memory continuity and context engines such as `lossless-claw`
- context compression is a broad baseline need; working-state recovery is an additional capability

Therefore the main path is:
- **skill + ordinary lifecycle plugin** as the primary architecture
- **ContextEngine integration** kept as a future option, not the default implementation target

## Why a plugin version exists
The current `memory-continuity` skill is useful, but it depends too much on agent cooperation:
- the agent must notice recovery conditions
- the agent must keep `memory/CURRENT_STATE.md` updated
- the agent often benefits from `read`

A lifecycle plugin gives a runtime-aligned way to improve reliability without modifying OpenClaw core and without consuming the exclusive ContextEngine slot.

## Product strategy
Keep three forms with clear roles:

### A. Skill version
Role:
- zero-dependency fallback
- behavior contract
- template discipline
- compatibility with environments that do not install plugins

### B. Lifecycle plugin version (primary runtime path)
Role:
- runtime-assisted recovery
- automatic checkpointing at key lifecycle points
- better startup and `/new` continuity
- coexistence with `lossless-claw` and other context engines

### C. ContextEngine version (future option)
Role:
- more powerful prompt-time snapshot injection via `assemble` / `systemPromptAddition`
- only worth pursuing later if slot tradeoffs are acceptable or composite engine support exists

These forms should complement each other, not compete.

## Source of truth
Primary durable checkpoint file:
- `memory/CURRENT_STATE.md`

The plugin should treat this file as the editable, human-readable source of truth for working state.

The plugin may derive a lighter runtime snapshot from it, but should not replace it with an opaque database-first design.

## Non-goals
The plugin version should **not**:
- replace `MEMORY.md`
- replace daily notes in `memory/YYYY-MM-DD.md`
- replace native OpenClaw compaction summaries
- replace native `memoryFlush`
- replace session transcript memory search
- persist a full transcript mirror
- inject large recovery payloads into every turn
- attempt real-time bidirectional state synchronization in v1

## Core runtime idea
Use standard lifecycle hooks to ensure that short-term working state remains available across:
- `/new`
- reset/restart
- compaction
- session end / restart-like boundaries
- limited subagent handoff scenarios when supported by available hooks

The plugin should prefer deterministic, structured recovery over free-form recollection.

## Desired user-visible property
Even if an agent lacks `read`, the session should still recover a compact continuity hint whenever there is meaningful active work to recover.

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
The plugin should derive a much smaller summary than the raw checkpoint file.

Target content:
- Objective
- Current Step
- Last Confirmed Result or Key Decision(s)
- Next Action
- Blockers
- Unsurfaced Results
- Freshness / Updated At

### Draft example
```text
CONTINUITY SNAPSHOT
Objective: Verify memory continuity for Telegram subagents.
Current Step: Tools fixed; validating plugin-backed recovery design.
Key Decision: Use lifecycle plugin as primary path; ContextEngine stays optional.
Next Action: Finalize hook mapping and update the skill docs.
Blockers: None.
Unsurfaced Results: None.
Updated: 2026-03-12T22:00:00+10:00
```

### Size target
- preferred: ~150-300 tokens
- avoid large raw checkpoint injection on every turn
- skip injection entirely when there is no meaningful active state

### V1 rule for “meaningful active work”
Treat work as active when:
- `Objective` is non-empty
- and `Objective` is not placeholder text such as `None`, `idle`, `n/a`, or an empty template marker

This rule can be refined later, but v1 should use a simple deterministic threshold.

## Primary lifecycle hook mapping

### 1. Startup hook (`before_agent_start` / closest available startup hook)
Purpose:
- establish whether recovery state exists
- load a compact continuity summary for startup recovery behavior
- ensure recovery can happen even when the agent does not explicitly call `read`

Should do:
- check for `memory/CURRENT_STATE.md`
- perform lightweight validation
- derive a compact startup continuity hint when active work exists
- make recovery state available through the startup/lifecycle hook path supported by OpenClaw

Should avoid:
- rewriting the checkpoint unnecessarily
- injecting large raw file content
- treating placeholder/idle state as active recovery material

Notes:
- exact injection mechanism depends on the standard plugin hook surface available in OpenClaw
- this design intentionally does **not** assume access to ContextEngine-only `systemPromptAddition`

---

### 2. `/new` hook (`command:new` or equivalent)
Purpose:
- create a reliable checkpoint right before the user deliberately resets conversational continuity

Should do:
- save a final overwrite-style checkpoint before reset
- optionally archive the outgoing checkpoint if that remains part of the skill design
- ensure the next session can recover active work from a deterministic file state

Should avoid:
- expensive archival behavior for trivial idle sessions
- losing unsurfaced results at reset boundaries

---

### 3. Session end / run-end hook (`agent_end` or closest available end hook)
Purpose:
- checkpoint work at natural lifecycle boundaries

Should do:
- persist the latest working-state checkpoint when a meaningful state change occurred
- preserve unsurfaced results
- act as a safety net when the agent followed the protocol imperfectly during the turn

Should avoid:
- noisy writes on obviously trivial/no-op turns
- assuming this hook alone is enough for correctness

---

### 4. Compaction hooks (`session:compact:before` / equivalent)
Purpose:
- hard safety checkpoint before compaction removes detailed older context

Should do:
- force a final continuity checkpoint before compaction
- preserve current objective / step / blockers / unsurfaced results
- ensure recovery remains possible after compaction

Critical requirement:
- checkpoint writing in the compaction path must complete **synchronously** before compaction proceeds
- if the hook cannot provide that guarantee, this risk must be documented explicitly

This is the strongest required protection point.

---

### 5. Post-turn maintenance hook (when available)
Purpose:
- opportunistic checkpoint maintenance after substantive turns

Should do:
- update checkpoint when meaningful state changes are detected
- optionally use a configurable cadence (for example every N substantive turns)
- keep writes overwrite-oriented rather than append-heavy

V1 definition of **substantive turn**:
A turn counts as substantive when it includes at least one of:
- a tool result that materially changes work state
- a user confirmation of a decision or direction
- an agent statement that a concrete step was completed
- a newly discovered blocker or newly surfaced result

Non-substantive examples:
- greetings
- acknowledgements
- short clarifications without state change
- filler chatter

Should avoid:
- writing on every trivial turn
- producing noisy I/O for idle chat
- becoming the only write path

Practical stance:
- post-turn maintenance is useful, but not sufficient alone
- correctness should not rely entirely on semantic heuristics

## Subagent continuity stance for v1
V1 should stay conservative.

### Allowed in v1
- parent → child: minimal seed/handoff when a suitable hook/path exists
- child → parent: limited recovery of `Unsurfaced Results`

### Explicitly out of scope in v1
- continuous bidirectional synchronization
- real-time merge of parent and child working state
- multi-worker consensus state

This keeps the first implementation tractable and reduces process risk.

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

### With session transcript memory search
Session memory search can help retrieve prior conversational material.

Memory continuity is different:
- memory search helps answer “what did we discuss?”
- continuity helps answer “what were we doing, and what should happen next?”

### With tools like `read`
`read` remains valuable for enhanced recovery and debugging.

But baseline continuity should not depend on `read` once the lifecycle plugin can expose recovery state through startup/runtime hooks.

### With ContextEngine plugins such as `lossless-claw`
This is the main architectural reason the lifecycle-plugin path is preferred.

Because `contextEngine` is an exclusive slot, making memory continuity a ContextEngine by default would force users to choose between:
- context compression / context assembly plugins
- working-state continuity

V1 should avoid creating that conflict.

## Open design questions
1. Which exact standard hook surface is best for startup recovery injection on current OpenClaw releases?
2. How should stale checkpoints be detected and labeled?
3. Should the plugin compute confidence/freshness automatically?
4. How should the plugin expose a startup continuity hint without relying on ContextEngine-only `systemPromptAddition`?
5. Should plugin writes go directly to `memory/CURRENT_STATE.md`, or stage then atomically replace?
6. How should compaction-hook guarantees be validated in practice?
7. What is the safest minimal parent/child handoff path under current OpenClaw hook support?
8. Under what future conditions would a ContextEngine variant become worth the slot tradeoff?

## Recommended implementation phases

### Phase 1 — Design + discipline hardening
- refine skill documentation
- stabilize checkpoint template
- clarify scope vs non-goals
- improve validation / doctor behavior

### Phase 2 — Minimal lifecycle plugin MVP
- register a standard plugin
- implement startup recovery hook behavior
- implement `/new` checkpoint behavior
- implement end-of-run checkpoint behavior
- implement compaction-path checkpoint behavior if the hook guarantees are sufficient

### Phase 3 — Reliability improvements
- add controlled post-turn checkpointing
- add freshness/confidence labeling
- improve stale-state handling
- tune snapshot length and injection behavior

### Phase 4 — Conservative subagent support
- add minimal parent → child seed behavior when safe
- add conservative child → parent unsurfaced-result recovery
- validate handoff behavior in real workflows

### Phase 5 — Future option evaluation
- reassess whether a ContextEngine variant is worth building
- only pursue if slot tradeoffs are acceptable or composite-engine support exists

## Success criteria
The plugin version is successful when:
- reset/new sessions recover active work without depending on `read`
- compaction no longer destroys actionable in-flight state
- the agent does not lose unsurfaced results at reset-like boundaries
- the runtime path coexists with `lossless-claw` and similar context engines
- startup recovery improves without excessive prompt bloat
- behavior aligns with OpenClaw’s official plugin and hook model

## Short summary
The primary long-term implementation should be a **standard lifecycle plugin** that improves continuity without consuming the exclusive ContextEngine slot, while the existing skill remains the **human-readable protocol and fallback behavior contract**. A ContextEngine variant remains a future option, not the default architecture.
