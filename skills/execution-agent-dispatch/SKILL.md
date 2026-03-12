---
name: execution-agent-dispatch
description: Standardize how main dispatches work to execution agents and how execution agents report back. Use when main has already decided which execution agent(s) should do the work and needs a clear handoff packet, result format, blocker/escalation rules, and milestone discipline so workers do not drift or go silent.
---

# Execution agent dispatch

Use this skill after execution architecture is decided.

## Status / scope boundary

This skill is a **workflow / protocol skill**.
It standardizes dispatch packets, worker replies, escalation points, and main-to-Tao forwarding discipline.

It is **not** a runtime transport fix.
It does **not** create stable bidirectional communication between OpenClaw agents, subagents, or ACP sessions.
It does **not** guarantee parent-first completion routing, persistent child↔parent conversation, or reliable agent-to-agent backchannels.

Current project status:
- treat this skill as useful only for **process discipline**
- do **not** treat it as a solution to ACP / subagent communication instability
- if stable agent-to-agent communication is needed, wait for OpenClaw / ACP runtime support to mature first

## Goal

Turn vague delegation into a clear handoff.
Every dispatched task should make it obvious:
- what to do
- what not to do
- what counts as done
- when to escalate back to main

## Dispatch packet

When main assigns work to an execution agent, include these sections:

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

Execution agents should respond compactly with:
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

Execution-agent updates are not complete until main forwards the state change upward.

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
