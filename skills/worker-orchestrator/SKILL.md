---
name: worker-orchestrator
description: PM-style orchestration for execution workers. Use when main needs to decide whether to keep work with one worker or split across several, define worker roles/boundaries, dispatch clear task packets, enforce reply discipline, and report progress back to Tao.
---

# Worker orchestrator

Use this skill when main is acting as **PM / architect / orchestrator** for execution work.

It combines two responsibilities that belong to the same workflow:
1. **planning** the worker architecture
2. **dispatching / supervising** the resulting workers

## Status / scope boundary

This is a **PM + orchestration skill**.
It helps main:
- decide whether multiple workers are needed
- define worker scope and ownership
- dispatch clear handoff packets
- standardize worker replies
- keep Tao updated at the right moments

It is **not** a runtime transport fix.
It does **not** make OpenClaw / ACP inter-agent communication magically stable.
It does **not** guarantee reliable free-form worker↔worker or agent↔agent conversation.

Current safe interpretation:
- use it to support the model that now appears practical:
  - **main → worker → main → Tao**
- do **not** use it as evidence that worker↔worker direct communication is reliable
- do **not** use it as a substitute for upstream runtime support

## When to use

Use this skill when:
- Tao gives main a task that may need delegation
- main needs to decide whether to use one worker or many
- main wants cleaner worker boundaries
- main wants a standard dispatch packet and reply format
- main wants milestone / blocker / completion reporting discipline

## Goal

Turn a vague implementation request into a controlled execution workflow:
1. decide the worker split
2. define responsibilities and boundaries
3. dispatch clean task packets
4. supervise milestones / blockers / completion
5. report upward to Tao in the correct order

---

# Part A — Planning the worker architecture

## Default stance

- Prefer **one worker** when work is small, linear, or tightly coupled.
- Create **multiple workers** when the split reduces confusion or increases throughput.
- Do not create workers just because the architecture allows it.

## Split triggers

Create multiple workers when several of these are true:
- work can proceed in parallel
- responsibilities are clearly different
- code/docs/ops/test contexts would otherwise contaminate each other
- different deliverables need separate review or validation
- the project spans multiple repos, layers, or operational tracks
- a single worker would become a long-running catch-all bucket

## Avoid splitting when

- the task is tiny
- the task is strongly sequential
- requirements are still fuzzy
- one worker would spend most of its time blocked on another
- the split adds more coordination cost than execution value

## Planning output

When using this planning section, produce a short plan with:

### 1) Recommended execution architecture
- single worker
- or multiple workers

### 2) Worker list
For each proposed worker, define:
- name
- role
- scope
- non-goals / boundaries
- expected output

### 3) Task allocation
- what each worker should do first
- what can run in parallel
- what depends on another worker finishing first

### 4) Main's PM responsibilities
State what main keeps:
- requirement clarification
- prioritization
- risk calls
- review / acceptance
- status updates to Tao

## Naming guidance

Prefer role-based names over vague names.
Examples:
- `codex_worker`
- `frontend_worker`
- `backend_worker`
- `qa_worker`
- `docs_worker`
- `ops_worker`

Avoid names that do not imply responsibility.

---

# Part B — Dispatch and supervision

## Dispatch packet

When main assigns work to a worker, include these sections:

### 1) Task
One short statement of the goal.

### 2) Scope
Specify:
- repo / path / files if known
- what area is in bounds
- what is explicitly out of bounds

### 3) Deliverable
Define the expected output:
- code change
- docs update
- validation report
- PR / commit / test result
- recommendation only

### 4) Constraints
List non-negotiables, such as:
- do not change unrelated files
- do not switch models automatically
- do not message users directly
- ask before destructive actions

### 5) Milestone 1 + ETA
Tell the worker what first checkpoint matters and when main expects the first update.

## Worker response format

Workers should respond compactly with:
- `status:` accepted | milestone | blocked | failed | done
- `summary:` short summary
- `evidence:` files changed/created, commands run, session/log proof, or `none`
- `risk:` key caveat or `none`
- `next:` next action or handoff need

Important:
- A reply without `evidence` is not enough for main to claim the task is truly `in_progress`.
- `accepted` means the worker has seen the handoff; it does not automatically mean meaningful execution has started.

## Escalate immediately when

A worker should report back to main instead of silently stalling when:
- permissions are missing
- the model/tooling is unavailable
- repo rules block the intended action
- requirements are contradictory or underspecified
- the task is crossing role boundaries
- the ETA has clearly slipped
- the requested change is riskier or broader than the original handoff suggested

## Silence rule

Workers should not chatter, but should also not disappear.

Default rule:
- acknowledge briefly
- do the work
- report at milestone
- report immediately on blockers

## Main-to-Tao forwarding rule

Worker updates are not complete until main forwards the state change upward.

When a worker reports any of these:
- task accepted
- milestone reached
- blocked
- failed
- completed

main must update Tao **before** continuing with review, commit, release, or re-delegation work.

If a worker has already reported completion and main has not forwarded that state, treat it as a **main process failure**, not as "still in progress".

## Completion rule

A task is not complete just because files changed.
Completion should include:
- the requested deliverable exists
- basic verification happened when relevant
- blockers or caveats are disclosed
- main has enough information to review and report upward

## Main's responsibility

Main must not delegate sloppily.
Before dispatching, main should decide:
- why this worker is the right worker
- what the boundary is
- what review criteria will be used
- whether the task is small enough that delegation is unnecessary

## Good default tone

- short
- operational
- explicit
- non-dramatic

Prefer a clean task packet over a long motivational speech.

---

## Current practical model

Based on current validation, this skill should be used around this practical orchestration model:
- **temporary subagents** can act as execution workers and return results to main
- **ACP Codex workers** can act as execution workers and return results to main
- **Claude ACP** should be treated as needing clean-sample validation when provider state is healthy
- **worker↔worker direct communication** is still not something to assume

In short:
- safe default = **main orchestrates; workers execute; main integrates**
- unsafe assumption = workers will reliably self-coordinate without main in the loop
