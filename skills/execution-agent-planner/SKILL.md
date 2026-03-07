---
name: execution-agent-planner
description: Plan execution-agent architecture after project analysis. Use when main is acting as PM/architect and needs to decide whether to keep work with one execution agent or create multiple specialized execution agents, define each agent's role and boundaries, and distribute tasks across them without over-splitting small or tightly coupled work.
---

# Execution agent planner

Use this skill after the project/problem has been understood well enough to split work.

## Goal

Decide:
1. whether multiple execution agents are needed
2. how many are justified
3. what each agent owns
4. what should stay with main as PM/reviewer

## Default stance

- Prefer **one execution agent** when work is small, linear, or tightly coupled.
- Create **multiple execution agents** when the split will reduce confusion or increase throughput.
- Do not create agents just because the architecture allows it.

## Split triggers

Create multiple execution agents when several of these are true:
- work can proceed in parallel
- responsibilities are clearly different
- code/docs/ops/test contexts would otherwise contaminate each other
- different deliverables need separate review or validation
- the project spans multiple repos, layers, or operational tracks
- a single execution agent would become a long-running catch-all bucket

## Avoid splitting when

- the task is tiny
- the task is strongly sequential
- requirements are still fuzzy
- one agent would spend most of its time blocked on another
- the split adds more coordination cost than execution value

## Output format

When using this skill, produce a short plan with:

### 1) Recommended execution architecture
- single execution agent
- or multiple execution agents

### 2) Agent list
For each proposed execution agent, define:
- name
- role
- scope
- non-goals / boundaries
- expected output

### 3) Task allocation
- what each execution agent should do first
- what can run in parallel
- what depends on another agent finishing first

### 4) Main's PM responsibilities
State what main will keep:
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

## Delegation rule

Unless the task is truly tiny and can be completed in one short pass, main should avoid doing implementation directly and should assign execution work first.

## Progress discipline

After planning the execution architecture:
- tell Tao what split you chose and why
- give the first milestone and ETA
- report blockers when the split turns out wrong or incomplete
