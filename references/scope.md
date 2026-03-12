# Memory Continuity Scope

## One-line definition
Memory continuity is a **structured working-state checkpoint** for recovering in-flight work after `/new`, reset, compaction, model fallback, gateway interruption, or subagent handoff.

## Core goal
Preserve just enough short-term state that an agent can answer:
- What are we trying to do?
- What step were we on?
- What was decided?
- What should happen next?
- What is blocked?
- What result exists but has not yet been surfaced?

This is a recovery layer for **active work**, not a general memory system.

## Source of truth
The canonical working-state record is a Markdown checkpoint file:
- `memory/CURRENT_STATE.md` in the current skill version

Longer-term direction:
- keep the checkpoint file as source of truth
- add runtime-assisted continuity delivery derived from that file
- keep the file readable/editable by humans and agents

## Responsibilities
Memory continuity **is responsible for**:
1. Maintaining a compact, overwrite-oriented checkpoint for current work
2. Recovering in-flight work across session breaks
3. Preserving active task state through compaction and subagent handoff
4. Providing a deterministic place to look for next-step recovery
5. Surfacing unsent / unsurfaced results that would otherwise be lost
6. Giving agents a standard structure for short-term state updates

## Non-goals
Memory continuity is **not responsible for**:
1. Long-term personal memory curation
2. Replacing `MEMORY.md` or daily notes
3. Replacing OpenClaw compaction summaries
4. Replacing OpenClaw `memoryFlush`
5. Replacing session transcript memory search
6. Acting as a project-management database
7. Acting as a full conversation transcript
8. Storing every detail of recent chat history
9. Guaranteeing perfect semantic recall of arbitrary facts from all prior turns

## Relationship to native OpenClaw systems
### Native OpenClaw handles
- bootstrap/system prompt assembly
- compaction lifecycle
- memory flush before compaction
- transcript persistence
- tools, sessions, and runtime orchestration
- context engine selection and plugin lifecycle
- session transcript recall via session-aware memory search

### Memory continuity adds
- a **structured checkpoint** for working state
- a predictable recovery format independent of transcript shape
- explicit fields for `Objective`, `Current Step`, `Next Action`, `Blockers`, and `Unsurfaced Results`
- stronger short-term recovery for in-flight work than generic compaction summaries alone

### Boundary with session memory search
Session memory search can help answer questions like:
- what did we discuss before?
- what decision was mentioned in a prior session?

Memory continuity is for a different question:
- what are we doing **right now**, where did we stop, and what should happen next?

In short:
- session memory search is good at **recalling prior conversation material**
- memory continuity is good at **recovering active working state**

## Product forms
### 1. Skill version (current / fallback version)
Purpose:
- zero-dependency compatibility layer
- human-readable protocol for agents
- works today without plugin installation

What it should do:
- define update discipline
- define recovery behavior
- define template shape
- define failure/uncertainty handling

What it cannot guarantee:
- recovery without agent cooperation
- recovery without correct tool/config support
- automatic runtime injection on every turn

### 2. Lifecycle plugin version (target architecture)
Purpose:
- runtime-assisted continuity guarantees without taking the exclusive ContextEngine slot
- reduced dependence on `read`
- better startup, `/new`, and compaction continuity
- coexistence with context engines such as `lossless-claw`

What it should do:
- use ordinary lifecycle hooks to checkpoint and recover working state
- improve startup recovery behavior
- checkpoint before destructive context transitions when hooks permit it
- support minimal parent/child continuity handoff without requiring full bidirectional sync

### 3. ContextEngine version (future option, not v1)
Purpose:
- more powerful prompt-time continuity injection when the ecosystem tradeoff is worth it

Why it is not the current primary path:
- `contextEngine` is an exclusive plugin slot
- users should not be forced to choose between memory continuity and widely useful context engines such as `lossless-claw`

## Design principles
1. **Files remain source of truth**
2. **Structured checkpoint beats free-form summary**
3. **Recovery state must stay short**
4. **Read access is an enhancement, not the only path**
5. **Continuity complements native OpenClaw memory; it does not replace it**
6. **Working-state recovery must prefer truth over confident guessing**
7. **User-visible recovery should prioritize current task state over generic greetings when continuity is clearly requested**
8. **Ecosystem compatibility matters: continuity should not unnecessarily block other high-value plugins**

## Minimal recovery fields
Any continuity implementation should preserve, at minimum:
- Objective
- Current Step
- Key Decisions / Key Facts
- Next Action
- Blockers
- Unsurfaced Results
- Updated At / Freshness

## Success criteria
A good continuity implementation should let an agent recover:
- the current objective
- the latest confirmed step
- the next concrete action
- the main blocker, if any
- one or more unsurfaced results

Even after:
- `/new`
- session reset
- compaction
- subagent handoff
- gateway interruption

## Failure criteria
The continuity layer is considered insufficient if, after a reset-like event, the agent:
- forgets the active objective
- loses a confirmed decision
- cannot identify the next action
- hides completed but unsurfaced results
- hallucinates prior work instead of expressing uncertainty
- when `CURRENT_STATE.md` exists and contains active work, opens with generic greeting/chit-chat instead of first surfacing the recovered state in a recovery scenario

## Current roadmap stance
- **Short term:** strengthen the existing skill + file discipline version
- **Medium term:** implement a standard lifecycle plugin version aligned with OpenClaw’s official hook model
- **Long term:** keep multiple compatible forms
  - skill = fallback + behavior contract
  - lifecycle plugin = primary runtime-assisted reliability layer
  - context-engine variant = optional future path when slot tradeoffs are acceptable
