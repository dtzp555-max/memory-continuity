---
name: gh-pr-release-flow
description: Iron rules for GitHub repository maintenance — covers the full lifecycle of commit, push, PR, review, merge, version bump, tag, release, and release notes. Use this skill whenever touching any GitHub repo we own. All agents MUST follow these rules on every execution.
---

# GitHub 仓库维护铁律

**适用于所有我们维护的 GitHub 仓库。所有 agent 必须在每次 GitHub 操作时遵守。**

---

## 第一章：开始前必做（Pre-flight Check）

每次对 repo 做任何写操作之前，**必须先执行检查**：

```bash
# 1. 当前位置
git branch --show-current
git status --short

# 2. 远端状态
git fetch origin
git log --oneline HEAD..origin/main  # 有没有落后

# 3. 版本三件套对齐检查
cat package.json | grep '"version"'   # 代码版本（如有）
git tag --sort=-creatordate | head -5  # 最近 tag
gh release list --limit 5              # GitHub release
```

**规则：如果三件套不对齐，先修复对齐，再做新工作。**

---

## 第二章：分支策略

### 默认假设
- 如果不确定 repo 是否允许直推 main，**一律走 branch + PR**
- `approvals = 0` 不代表可以直推；branch protection 可能仍然要求 PR

### 分支命名
```
feat/<简短描述>     # 新功能
fix/<简短描述>      # 修复
docs/<简短描述>     # 文档
chore/<简短描述>    # 杂项（依赖、CI、配置）
release/v<版本号>   # 发版准备（仅在需要多步发版时使用）
```

### 分支生命周期
- 分支从最新 `main` 创建
- 合并后**立刻删除**远程分支
- 不允许长期存在的 feature 分支（超过 3 天未合并要说明原因）

---

## 第三章：Commit 规范

### 格式
```
<type>: <简短描述>

<可选正文：为什么做这个改动>
```

### type 枚举
- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档
- `refactor` — 重构（不改行为）
- `chore` — 构建、依赖、配置
- `test` — 测试
- `perf` — 性能优化

### 铁律
- **一个 commit 只做一件事**
- **不混入不相关的改动**（哪怕"顺手"修了个 typo，也单独一个 commit）
- **commit message 写 why，不写 what**（diff 已经说了 what）

---

## 第四章：Push 规则

### 直推 main 的条件（全部满足才允许）
1. repo 没有 branch protection
2. 改动是 trivial（typo、注释、formatting）
3. 之前从未被 main 拒绝过 push

### 被拒绝后
**永远不要重试直推。** 改走 PR 流程：
1. 保留本地 commit
2. 创建分支
3. push 分支
4. 开 PR

### Push 前最后检查
```bash
git diff origin/main --stat  # 确认改了什么
git log origin/main..HEAD --oneline  # 确认有哪些 commit
```

---

## 第五章：Pull Request

### 创建 PR 的铁律
1. **PR 标题 < 70 字符**，格式：`<type>: <描述>`
2. **PR body 必须包含**：
   - `## Summary` — 1-3 句话
   - `## Why` — 为什么做这个改动
   - `## Changes` — 关键改动列表
   - `## Notes` — 仅在有 breaking change / migration / 注意事项时写
3. **一个 PR 只做一件事**（single responsibility）
4. **PR 不能包含未 commit 的文件**
5. **不要在 PR 里混入版本号变更**（版本号在 merge 后单独处理，除非 repo 规定 PR 带版本号）

### PR body 模板
```markdown
## Summary
<1-3 bullet points>

## Why
<动机和背景>

## Changes
- <改动 1>
- <改动 2>

## Notes
<仅在必要时填写>
```

### PR Review 规则
- **小改动**（docs / typo / layout / i18n）：小强自审后可以直接 merge，然后通知 Tao
- **功能改动**：必须 Tao review/approve
- **安全相关改动**：必须 Tao review/approve
- **Review 后有修改**：必须重新标记为 ready for review

---

## 第六章：Merge

### Merge 策略
- 默认使用 **squash merge**（除非 commit 历史有独立意义）
- merge 后**立刻删除远端分支**

### Merge 前检查
```bash
gh pr checks <PR_NUMBER>  # CI 通过
gh pr view <PR_NUMBER>    # 确认 review 状态
```

### Merge 后
```bash
git checkout main
git pull origin main
# 确认 merge 的内容在 main 上
git log --oneline -5
```

---

## 第七章：版本号（Semantic Versioning）

### 铁律
- `patch` (x.y.Z) = bugfix only，不改行为
- `minor` (x.Y.0) = 新功能，向后兼容
- `major` (X.0.0) = breaking change
- **版本号只在 main 上 bump，不在 PR 分支里 bump**

### 版本号修改流程
1. merge PR 到 main
2. checkout main，pull latest
3. 修改 `package.json`（或其他版本文件）中的版本号
4. commit：`chore: bump version to vX.Y.Z`
5. 创建 tag：`git tag vX.Y.Z`
6. push：`git push origin main --tags`

### 版本号判断规则
| 改动类型 | 版本 |
|---|---|
| typo / docs-only | 不 bump（或 patch） |
| bugfix | patch |
| 新功能 / 新配置项 / 新 env var | minor |
| 删除功能 / 改接口 / 改默认行为 | major |

---

## 第八章：Release + Release Notes

### 何时创建 Release
以下情况**必须**创建 GitHub Release：
- 安全修复
- 新配置项 / 新环境变量
- 行为变更
- 安装 / 使用方式变更
- 用户可感知的新功能或重要修复

### Release 创建流程
```bash
# 1. 确认 tag 已存在且在 main 上
git tag -l 'vX.Y.Z'
git log --oneline vX.Y.Z -1

# 2. 创建 release
gh release create vX.Y.Z --title "vX.Y.Z — <标题>" --notes "$(cat <<'EOF'
## Highlights
- <核心改动 1>
- <核心改动 2>

## Why this matters
<一句话说清楚对用户的影响>

## Upgrade notes
<仅在有 breaking change / 迁移步骤时写>
EOF
)"
```

### Release Notes 铁律
1. **面向用户写，不面向开发者**
2. **写影响，不写实现细节**
3. **如果有 breaking change，必须写迁移步骤**
4. **不要把 git log 当 release notes**

### Release Notes 模板
```markdown
## Highlights
- <改动 1：用户视角的描述>
- <改动 2>

## Why this matters
<对用户意味着什么>

## Upgrade notes
<仅在必要时>
- <迁移步骤 1>
- <迁移步骤 2>
```

---

## 第九章：完整交付检查清单

每次交付（push / merge / release）后，对照检查：

| 项目 | 检查 |
|---|---|
| Code | 代码已 push 到 main |
| Version | package.json 版本号已更新（如需要） |
| Tag | git tag 已创建且 push |
| Release | GitHub Release 已创建（如需要） |
| Notes | Release Notes 已写好 |
| Docs | README / 配置文档已更新（如行为变化） |
| Notify | 已通知 Tao 交付结果 |

**缩写记忆：CVTRNDN — Code, Version, Tag, Release, Notes, Docs, Notify**

简单 bugfix 可能只需要 Code + Version + Tag + Notify。
重要功能全部都要。

---

## 第十章：禁止事项

1. **禁止直接在 main 上 force push**
2. **禁止 rewrite 已 push 的 history**（`rebase -i` / `commit --amend` 已推送的 commit）
3. **禁止跳过版本号**（v1.5 → v1.7 只因为 v1.6 做了一半放弃了）
4. **禁止 release 未 merge 的内容**（PR 还没合就发 release）
5. **禁止静默 merge**（合了不通知 Tao）
6. **禁止在一个 PR 里混多个不相关改动**
7. **禁止 commit message 写 "fix" / "update" / "change" 这种无信息量的词**
8. **禁止删除 release**（除非 Tao 明确同意）
9. **禁止在 tag 上做修改后不重新打 tag**

---

## 第十一章：异常处理

### 版本号 / tag / release 不对齐
1. 找出当前真实状态（三件套分别是什么）
2. 报告给 Tao
3. 等 Tao 确认修复方案后执行

### PR merge 冲突
1. 不要用 GitHub 的自动 resolve
2. 本地 checkout，手动 resolve
3. 确认冲突解决正确后 push

### CI 失败
1. 先看日志，定位原因
2. 修复后重新 push
3. 不要 skip CI

### 意外推送了错误内容
1. **不要 force push**
2. 创建一个 revert commit
3. 通知 Tao

---

## 附录：快速参考命令

```bash
# 完整交付流程（PR-first repo）
git checkout -b feat/my-feature
# ... 编辑 + commit ...
git push -u origin feat/my-feature
gh pr create --title "feat: ..." --body "..."
# ... review + merge ...
git checkout main && git pull
# bump version in package.json
git add package.json && git commit -m "chore: bump version to vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
gh release create vX.Y.Z --title "vX.Y.Z — ..." --notes "..."

# 快速检查三件套对齐
echo "pkg: $(node -p 'require("./package.json").version' 2>/dev/null || echo N/A)"
echo "tag: $(git tag --sort=-creatordate | head -1)"
echo "rel: $(gh release view --json tagName -q .tagName 2>/dev/null || echo none)"
```
