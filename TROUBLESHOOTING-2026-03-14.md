# memory-continuity Skill 排错报告

> 日期: 2026-03-14
> 排错人: Claude Opus 4.6 (via Claude Code)
> 环境: OpenClaw 2026.3.12 (6472949) / macOS / Node 25.8.0

---

## 问题描述

memory-continuity skill 安装后无法正常工作。具体表现：

1. `/new` 重置会话后，agent 不按照 skill 定义的恢复优先级协议行事
2. Agent 说"我不记得"，然后才提到 `CURRENT_STATE.md` 中的"残留记录"
3. `openclaw skills check` 显示 skill 状态为 `✓ ready`，但 agent 的 system prompt 中没有加载它

---

## 排错过程

### 第一阶段：确认 skill 文件完整性

- 检查 `~/.openclaw/workspace/main/skills/memory-continuity/SKILL.md` — 存在且 frontmatter 格式正确
- 检查 `openclaw.json` — 5 个 agent 的 `skills` 数组中均已包含 `"memory-continuity"`
- 检查 `openclaw skills check` — 显示 ready，source 为 `openclaw-workspace`
- **结论：安装和配置层面无问题**

### 第二阶段：验证 skill 是否进入 agent prompt

通过 `openclaw agent --agent main -m "ping" --json` 获取 `systemPromptReport`，发现：

- 加载了 20 个 skills，**memory-continuity 不在其中**
- 对比发现 `secureclaw`（同为 workspace skill）成功加载

对比两者差异：
| 项目 | secureclaw | memory-continuity |
|---|---|---|
| SKILL.md | ✓ | ✓ |
| skill.json | ✓ | ✗ |
| _meta.json | ✓ | ✗ |

尝试为 memory-continuity 补充 `skill.json` 和 `_meta.json` 后重启 gateway，**问题未解决**。

### 第三阶段：逆向分析 skill loader 源码

反编译分析 OpenClaw 的 skill 加载链路：

```
resolveSkillsPromptForRun()
  → 优先使用 skillsSnapshot（session 缓存）
  → 否则调用 buildWorkspaceSkillSnapshot()
    → resolveWorkspaceSkillPromptState()
      → filterSkillEntries()
        → shouldIncludeSkill()  // 过滤
        → skillFilter           // allowlist
```

关键发现：

1. **skill 发现机制**（`loadSkillEntries`）基于文件系统扫描 `workspace/skills/*/SKILL.md`，与 `_meta.json` 和 `skill.json` 无关
2. **skill 过滤机制**（`filterSkillEntries`）使用 agent 配置中的 `skills` 数组作为 allowlist
3. **skill snapshot 缓存**（`skillsSnapshot`）存储在 session store 中，只在以下条件刷新：
   - `isFirstTurnInSession`（首轮对话）
   - `snapshotVersion > 0` 且版本号增加

### 第四阶段：定位根因

检查 session store 中的 skills snapshot：

```json
// ~/.openclaw/agents/main/sessions/sessions.json
// session "agent:main:main"
{
  "skillsSnapshot": {
    "version": 0,
    "skills": [/* 20 个 skill，不含 memory-continuity */]
  }
}
```

**根因确认：**

- 所有 239 个 session 在 memory-continuity 安装前就已缓存了 skills snapshot
- snapshot `version: 0`，而刷新条件是 `snapshotVersion > 0`，导致永远不会自动刷新
- 后续对话复用已有 session（非 firstTurn），跳过重建
- 结果：无论怎么重启 gateway 或重装 skill，缓存的旧 snapshot 始终被使用

---

## 修复措施

### 1. 清除所有 session 的过期 skillsSnapshot（关键修复）

```python
# 遍历 sessions.json，删除所有 session 的 skillsSnapshot 字段
for key in data:
    if 'skillsSnapshot' in data[key]:
        del data[key]['skillsSnapshot']
# 共清除 239 个 session 的缓存
```

下次 agent 响应时，检测到 `!current.skillsSnapshot`，触发 `buildWorkspaceSkillSnapshot()` 重建，新 snapshot 包含 memory-continuity。

### 2. 补充 skill.json（规范性改进）

创建 `workspace/main/skills/memory-continuity/skill.json`：

```json
{
  "name": "memory-continuity",
  "version": "1.0.0",
  "description": "Short-term working continuity for OpenClaw agents...",
  "author": "dtzp555-max",
  "license": "MIT",
  "homepage": "https://github.com/dtzp555-max/memory-continuity"
}
```

### 3. 补充 _meta.json（规范性改进）

创建 `workspace/main/skills/memory-continuity/_meta.json`：

```json
{
  "ownerId": "github:dtzp555-max",
  "slug": "memory-continuity",
  "version": "1.0.0",
  "publishedAt": 1710388800000
}
```

> 注：措施 2 和 3 对 skill 加载无实际影响，但与其他 workspace skill（如 secureclaw）保持一致。

---

## 验证结果

### Skill 加载验证

```
修复前: Total: 20, memory-continuity: False
修复后: Total: 11, memory-continuity: True (620 chars)
```

加载的 11 个 skills 与 main agent 配置的 `skills` 数组完全匹配。

### 功能黑盒测试

| 步骤 | 操作 | 结果 |
|---|---|---|
| 1 | 告诉 agent 秘密信息 | agent 确认记录 |
| 2 | 检查 CURRENT_STATE.md | 秘密已写入 `## In Flight` |
| 3 | 删除 session 模拟 `/new` | 新 session 创建 |
| 4 | 在新 session 中问秘密 | agent 从 CURRENT_STATE.md 恢复，正确回答 |

---

## 经验总结

1. **OpenClaw 的 skill 加载不是实时的** — session store 中的 `skillsSnapshot` 会缓存 skill 列表，新安装的 skill 不会自动出现在已有 session 中
2. **`openclaw skills check` 显示 ready 不代表已加载** — ready 只表示文件系统发现成功，实际加载还受 session snapshot 缓存影响
3. **snapshot version = 0 是一个 edge case** — 在这个版本下，自动刷新逻辑永远不会触发（`snapshotVersion > 0` 为 false）
4. **重启 gateway 不会清除 session snapshot** — snapshot 持久化在 sessions.json 中，只有清除缓存或触发 firstTurn 才能刷新

---

## 涉及文件

| 文件 | 操作 |
|---|---|
| `~/.openclaw/agents/main/sessions/sessions.json` | 清除 239 个 session 的 skillsSnapshot |
| `~/.openclaw/workspace/main/skills/memory-continuity/skill.json` | 新建 |
| `~/.openclaw/workspace/main/skills/memory-continuity/_meta.json` | 新建 |
