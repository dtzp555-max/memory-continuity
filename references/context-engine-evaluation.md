# ContextEngine Variant Evaluation

## Status
Decision document. Phase 5 evaluation as outlined in plugin-design.md.

## Executive Summary

**Decision: Do not build a ContextEngine variant.**

Memory Continuity already achieves its core recovery goals through lifecycle hooks and `before_prompt_build`. The contextEngine slot is exclusive, and occupying it would break coexistence with lossless-claw and future context engines -- destroying MC's strongest ecosystem advantage. The marginal gains from `assemble()` and `systemPromptAddition` do not justify the slot cost, especially since `prependSystemContext` via `before_prompt_build` already provides prompt-time injection.

---

## What contextEngine provides vs current hooks approach

### ContextEngine slot capabilities (theoretical)
| Capability | Description |
|---|---|
| `assemble()` | Full control over context assembly -- decides what goes into the prompt, in what order, with what priority |
| `systemPromptAddition` | Guaranteed system prompt injection with engine-level priority |
| Context window management | Direct control over token budgets, message pruning, and compression strategy |
| Turn-level interception | Can modify or rewrite every message before it reaches the model |

### What MC currently uses (hooks-only)
| Capability | Implementation |
|---|---|
| `before_prompt_build` | Injects continuity snapshot via `prependSystemContext` -- works today, confirmed in phase 2 validation |
| `command:new` | Archives checkpoint before `/new` reset |
| `agent_end` | Safety checkpoint at session end |
| `before_compaction` | Protection checkpoint before compaction |
| `subagent_ended` | Child-to-parent result recovery |
| Session logging, summaries, relevance injection | All implemented via hooks without needing the engine slot |

### Gap analysis: what would a ContextEngine variant actually gain?

1. **`assemble()` -- full context control**: MC does not need this. MC's job is to inject a 150-300 token snapshot at startup and protect state at boundaries. It does not need to control the entire context assembly pipeline. That is a context compression concern (lossless-claw's domain).

2. **`systemPromptAddition`**: MC already achieves equivalent functionality via `prependSystemContext` in the `before_prompt_build` hook. Phase 2 validation confirmed this works. The injection is not ContextEngine-exclusive.

3. **Token budget management**: MC's snapshot is deliberately small (~150-300 tokens). It does not need fine-grained token budget control. Oversized state files are handled by the `maxStateLines` config and `mc compact` command.

4. **Turn-level interception**: MC does not need to modify arbitrary turns. Its concern is boundary events (startup, /new, compaction, session end), all of which are already covered by lifecycle hooks.

**Conclusion**: The practical capabilities MC needs are already available through the hooks API. The additional capabilities from the contextEngine slot solve problems MC does not have.

---

## Slot conflict analysis

### The core constraint
OpenClaw's `contextEngine` is an **exclusive slot** -- only one plugin can occupy it at a time.

### Impact on lossless-claw coexistence
MC's `openclaw.plugin.json` explicitly declares:
- `"slot": "hooks-only"`
- `"slotNote": "Does NOT occupy the contextEngine slot. Safe to run alongside any context engine."`
- `"complements": [{ "id": "lossless-claw", ... }]`

If MC became a contextEngine:
- Users would be forced to choose between MC and lossless-claw
- Context compression is a broader, more fundamental need than working-state recovery
- Most users who want MC also want context compression -- making them mutually exclusive would reduce adoption of both

### Composite/multi-engine support
Research found **no evidence** of composite engine, engine chaining, or multi-engine support in OpenClaw:
- No `contextEngine` array support in plugin schema
- No engine composition layer in runtime code
- No roadmap references to multi-engine support in available documentation
- The design documents themselves note this as a precondition: "only pursue if... composite-engine support exists"

**That precondition has not been met.**

### Ecosystem risk
MC's hooks-only design is a competitive advantage:
- It is the only memory plugin that explicitly complements rather than competes with context engines
- Converting to a contextEngine would make MC just another exclusive-slot plugin competing for the same position
- The interop declaration in `openclaw.plugin.json` is a trust signal to users that MC respects their plugin choices

---

## Risk/Benefit Matrix

### Building a ContextEngine variant

| Factor | Assessment |
|---|---|
| **Benefit: Better prompt injection** | Low -- `prependSystemContext` already works |
| **Benefit: Full context control** | Irrelevant -- MC does not need context assembly control |
| **Benefit: Token budget awareness** | Minimal -- MC's snapshots are already small by design |
| **Risk: Breaks lossless-claw coexistence** | **Critical** -- destroys MC's key ecosystem advantage |
| **Risk: Reduced adoption** | **High** -- users forced into either/or choice |
| **Risk: Maintenance burden** | Medium -- two codepaths (hooks version + engine version) to maintain |
| **Risk: Feature creep** | High -- engine slot invites scope expansion into context compression territory |
| **Risk: No composite engine fallback** | **Critical** -- if composite support never ships, the variant is permanently exclusive |

### Keeping hooks-only

| Factor | Assessment |
|---|---|
| **Benefit: Coexists with all context engines** | **Critical** -- unique market position |
| **Benefit: Simpler architecture** | High -- one codepath, clear scope boundaries |
| **Benefit: Lower maintenance** | High -- no engine API surface to track |
| **Benefit: Aligned with design principles** | High -- scope.md principle #8: "Ecosystem compatibility matters" |
| **Risk: Missing prompt-time power** | Low -- `before_prompt_build` covers the actual need |
| **Risk: Weaker injection guarantee** | Low -- not observed as a real problem in practice |

---

## Recommendation

**Do not build a ContextEngine variant. Invest in hook-based improvements instead.**

### Rationale
1. The two preconditions from plugin-design.md Phase 5 are both unmet:
   - "slot tradeoffs are acceptable" -- they are not; lossless-claw coexistence is too valuable
   - "composite-engine support exists" -- it does not
2. MC's actual prompt injection needs are satisfied by `before_prompt_build` + `prependSystemContext`
3. The contextEngine API solves context assembly and compression problems that are outside MC's scope
4. Converting would destroy MC's strongest differentiator: being the only memory plugin that complements rather than competes with context engines

### What to do instead: hook improvements

#### Priority 1 -- Strengthen existing injection
- Validate `prependSystemContext` reliability across OpenClaw versions and model backends
- Add fallback to `before_agent_start` if `before_prompt_build` proves unreliable in edge cases
- Improve snapshot quality (better summarization, freshness labeling)

#### Priority 2 -- Better compaction protection
- Confirm `before_compaction` is truly synchronous (the probe exists but needs production validation)
- Add tail-message protection quality metrics
- Consider `after_compaction` hook for post-compaction state verification

#### Priority 3 -- Smarter relevance injection
- The `relevanceInjection` feature already injects historical context at startup
- Improve relevance scoring without needing engine-level token budget control
- Keep injection budget self-contained (MC manages its own token ceiling)

#### Priority 4 -- Monitor OpenClaw evolution
- Watch for composite-engine or engine-delegation support in future OpenClaw releases
- If OpenClaw adds a way for hooks to register "guaranteed system prompt sections" at engine priority without taking the slot, adopt that immediately
- Re-evaluate this decision if the exclusive-slot constraint changes

---

## Conditions for revisiting this decision

Re-evaluate if ANY of these become true:
1. OpenClaw adds composite/multi-engine support (multiple contextEngines can coexist)
2. OpenClaw adds a "system prompt section" API at engine priority, available to non-engine plugins
3. `before_prompt_build` + `prependSystemContext` proves unreliable in a way that cannot be fixed via hooks
4. A significant user cohort explicitly requests engine-level context control from MC and does not use lossless-claw

Until then, the hooks-only architecture remains correct.

---

## Document history
- 2026-03-31: Initial evaluation. Decision: do not build.
