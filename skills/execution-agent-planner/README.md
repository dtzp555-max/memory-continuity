# execution-agent-planner

A lightweight skill for deciding when a project should stay with one execution agent and when it should be split into multiple specialized execution agents.

## Why this exists

Once main takes the PM / architect role, a new question appears:

- Should this project go to one execution agent?
- Or should it be split across several workers with different roles?

Without a repeatable rule, it is easy to drift into two bad extremes:
- **under-splitting**: main or one worker becomes a catch-all bucket
- **over-splitting**: too many agents, too much coordination, not enough real progress

This skill exists to keep that decision disciplined.

## What it helps decide

- whether multiple execution agents are justified
- how many workers to create
- what each worker should own
- what should remain with main as PM / reviewer
- how to split tasks without creating coordination theater

## Core rule

Start simple.

- If work is small, linear, or tightly coupled: keep one execution agent.
- If work is parallelizable, role-distinct, and context-heavy: split into multiple execution agents.

## Good reasons to split

- frontend / backend / docs / ops / QA are genuinely different tracks
- tasks can run in parallel
- one worker would otherwise mix too many contexts
- outputs need separate validation paths
- the project spans multiple repos or operational domains

## Bad reasons to split

- the project only sounds important
- requirements are still fuzzy
- tasks are tiny
- most agents would just wait on each other

## Suggested output

A good plan should answer:
1. Do we keep one execution agent or use several?
2. What is each agent called?
3. What does each agent own?
4. What does main keep as PM?
5. What is milestone 1?

## Notes

This is not an implementation skill.
It is a planning skill for execution architecture.
