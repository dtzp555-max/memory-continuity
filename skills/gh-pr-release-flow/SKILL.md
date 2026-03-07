---
name: gh-pr-release-flow
description: Handle GitHub repos that may block direct pushes to main and require pull-request-first delivery plus post-merge release work. Use when changing a GitHub repo and you need to: (1) detect whether direct pushes are blocked, (2) switch to branch + PR flow, (3) decide whether release work must wait until after merge, (4) create PRs, tags, and releases in the correct order, or (5) avoid repeating the 'push rejected, PR required' mistake.
---

# GitHub PR + release flow

Default assumption: if repo rules are unknown, prefer **branch + PR** over direct push to `main`.

## Core workflow

1. Check current state before publishing changes:
   - local branch
   - unpushed commits
   - latest release/tag/version if release is involved
2. Try to understand repo constraints early:
   - if prior attempts showed `main` is PR-only, do not try direct push again
   - if unsure, assume PR-only
3. For normal code/docs changes:
   - commit locally
   - create a branch
   - push branch
   - open PR
4. For release work:
   - do **not** publish a release for changes that are still only in an open PR
   - merge first, then bump version/tag/release from the merged state unless the repo has an explicit prerelease workflow

## Common traps

- `approvals = 0` does **not** mean direct pushes to `main` are allowed.
- Branch protection may still require PRs even when review count is zero.
- Package version, git tag, and GitHub release can drift; inspect all three before changing release state.
- "Latest release" may describe old `main` if newer work is only in a PR branch.

## Publishing decision rules

### If push to main is rejected
Treat that as a stable repo rule unless proven otherwise.

Do this:
1. keep local commit(s)
2. create a descriptive branch
3. push branch
4. create PR
5. continue discussion/review there

### If user asks to "update the release"
First determine whether the intended changes are already merged.

- If **not merged**: explain that release should wait until merge, unless user explicitly wants a draft/prerelease.
- If **merged**: inspect `package.json` version, tags, and GitHub releases; then decide patch/minor bump.

### If change is docs-only or packaging-only
Still follow repo rules. Do not assume docs can bypass PR requirements.

## Recommended command pattern

### Inspect
- `git branch --show-current`
- `git status --short`
- `git tag --sort=-creatordate | head`
- `gh release list --limit 10`
- `gh pr view <n>` / `gh pr list`

### PR-first publish
- `git checkout -b <branch>`
- `git push -u origin <branch>`
- `gh pr create ...`

### Post-merge release
1. switch to updated `main`
2. verify merged commits are present
3. bump version if needed
4. create tag
5. create GitHub release with concise notes

## PR body template

Use a compact structure:
- Summary
- Why
- Notes / follow-ups

## Release note template

Use a compact structure:
- Highlights
- Why this matters
- Upgrade / notes (only if needed)

## When to be explicit with the user

Always say so when:
- a repo rule blocks direct push
- release should wait for merge
- version/tag/release are out of sync
- you are switching from direct-push assumption to PR flow

Keep the explanation short and operational, not theoretical.
