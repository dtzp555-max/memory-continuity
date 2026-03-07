# execution-agent-dispatch

A lightweight skill for turning PM decisions into clear worker handoffs.

## Why this exists

It is not enough to have execution agents.
They also need a consistent way to receive work and report results.

Without that, the system drifts into familiar failure modes:
- vague delegation
- role boundary drift
- workers doing too much or too little
- silent blocking
- messy result reporting

This skill exists to standardize the handoff layer between **main** and execution agents.

## What it standardizes

- the task packet main sends to a worker
- the result format a worker returns
- when a worker must escalate instead of staying silent
- milestone / ETA discipline for delegated work

## Core idea

A good worker handoff should answer:
1. What exactly should be done?
2. What is out of bounds?
3. What does success look like?
4. When should the worker report back?
5. What should trigger escalation?

## Recommended task packet

- Task
- Scope
- Deliverable
- Constraints
- Milestone 1 + ETA

## Recommended result packet

- `status:` ok | blocked | failed
- `changed:` ...
- `notes:` ...
- `next:` ...

## Notes

This is a dispatch / coordination skill, not an implementation skill.
It works best after `execution-agent-planner` has already decided which workers should exist and what they should own.
