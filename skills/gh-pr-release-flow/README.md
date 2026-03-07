# gh-pr-release-flow

A lightweight GitHub workflow skill for repos that:
- reject direct pushes to `main`
- require pull requests even when approvals are set to 0
- need releases to happen **after merge**, not while work is still only in an open PR

## Why this exists

We kept running into the same avoidable problems:
- pushing to `main` and getting rejected by repo rules
- assuming `approvals = 0` meant direct push was allowed
- discussing release updates before the relevant changes were merged
- re-discovering the same GitHub flow every time

This skill turns that repeated pain into a default workflow.

## What it helps with

- detect when a repo is effectively PR-only
- switch quickly from local commits to branch + PR flow
- decide whether release work should wait until after merge
- keep `package.json` version, git tag, and GitHub release from drifting apart
- avoid repeating the same repo-rule mistakes

## Default policy

If repo rules are unclear, prefer:
1. local commit
2. branch
3. push branch
4. PR
5. merge
6. release

In other words: **PR first, release after merge**.

## Suggested use cases

- docs updates that still must go through PR
- feature work in protected repos
- patch releases after merge
- repos with branch protection / PR-only rules

## Notes

This is intentionally a narrow workflow skill, not a general GitHub encyclopedia.
It exists to encode one practical habit: stop bouncing off protected `main`, and stop releasing changes that have not landed yet.
