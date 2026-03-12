# Long-term Memory (curated)

## 1) Working model / roles
- Tao prefers to send tasks to **main**; main acts as **PM/architect** and delegates implementation (often to Codex).
- Dedicated agents and intended responsibilities:
  - **tech_geek** (Telegram group “技术宅”, workspace `tech_home_group`): tech/home-lab/ops discussions + GitHub (gh CLI / PR / CI / issues) follow-up.
  - **travel_assistant**: travel planning and travel-related research/tasks.
  - **finance_assistant** (“理财小帮手”): personal finance tasks.

## 2) Dev workflow / merge policy
- **Small changes** (docs/copy/layout/typos/i18n cleanup): Xiao Qiang can merge after self-review/verification, then notify Tao with PR link + summary.
- **Big feature changes**: require Tao review/approval before merge.

## 3) Sub-agents: architecture + token efficiency
- Sub-agents reuse the parent/main agent **bot** for messaging, but each sub-agent has an **independent workspace + SOUL (persona) + MEMORY (memory)**.
- Goal: prevent context/memory mixing, improve focus/efficiency, and save tokens by keeping contexts smaller.
- Current preferred multi-agent architecture for complex development:
  - **main** acts as **PM/architect/reviewer**: requirements, task breakdown, prioritization, risk calls, progress updates, and final summaries to Tao.
  - Execution agents should be **role-specialized** and do the implementation work.
  - **codex_worker** is the dedicated Codex execution agent for coding tasks.
  - Default delegation rule: unless a task is truly tiny and can be finished in one short pass, **main should not default to personally coding/editing files**; implementation work should be delegated to **codex_worker** first.
  - Good candidates for main to do directly: tiny edits, very small linear fixes, or short actions that are not worth execution-agent handoff.
  - For complex projects, create more specialized agents as needed (e.g. frontend/backend/test/ops/docs/data) instead of overloading one agent.
  - Create multiple execution agents when work is meaningfully parallel, responsibilities are different, contexts are likely to contaminate each other, or independent validation/release tracks are needed.
  - Avoid over-splitting for tiny, highly coupled, or poorly defined tasks.
  - This is the **current default pattern**, but Tao may change the rules as needs evolve.

## 4) ACP/Codex delegation constraints
- Telegram channel plugin currently does **not** support `subagent_spawning` hooks → cannot bind persistent subagent sessions with `thread=true`; use `sessions_spawn(mode="run")` as workaround.
- Current durable conclusion on `execution-agent-dispatch`: it is a **process/protocol skill**, not a fix for OpenClaw/ACP runtime communication. We previously tested parent↔child / agent↔agent flows and did **not** get stable bidirectional communication. Default behavior is still closer to spawn + announce than reliable free-form agent-to-agent conversation. Keep the skill frozen as a workflow aid only; wait for OpenClaw ACP/runtime support to become stable before resuming development aimed at true inter-agent communication.

## 5) OCM (OpenClaw Manager) repo policies
- OCM repo path: `~/.openclaw/ocm`.
- Internal-only docs (Project Brief / Architecture / Decisions) must **not** be uploaded to GitHub; keep them under `~/.openclaw/ocm-internal/docs/`.

## 6) Ops / security notes
- Ensure `~/.openclaw/openclaw.json` is not world-readable; prefer permission mode **600**.
- **Gateway control rule (critical hard ban):** on Tao’s machine, do **not** run `openclaw gateway stop` under any circumstance during normal assistance/recovery/reload work.
- **Related hard ban:** do **not** run any gateway command that may internally perform stop→start semantics unless Tao explicitly asks for that exact action and accepts the risk. Treat `openclaw gateway restart` as unsafe-by-default as well, because in practice it may still tear down the active service/control path.
- Stopping or restart-style control can cut off the agent’s own control path, and the service may then require Tao to manually run `openclaw gateway install` to restore it.
- Required sequence before any gateway intervention: (1) run `openclaw gateway status`; (2) report findings to Tao; (3) prefer non-disruptive diagnosis first; (4) only touch gateway lifecycle if Tao explicitly approves the exact command.

## 7) Model policy (current preference)
- Historical temporary preference once was: all subagents **primary** = `openai-codex/gpt-5.2`, **fallback** = `github-copilot/claude-opus-4.6`.
- Current important exception / newer rule: **execution agents** (esp. `codex_worker`, and by default other workers unless Tao says otherwise) must target **primary** = `openai-codex/gpt-5.4`.
  - **No silent fallback:** if the system falls back to any other model (or if `openai-codex/gpt-5.4` becomes unknown/unavailable), main must **immediately notify Tao**.
  - **No auto-fallback for execution agents:** if 5.4 is unavailable, workers should not continue on another model; main should report and wait for Tao’s model decision.
  - If an execution agent is not responding, main must consider **model unavailability/fallback** as a first-class suspected cause and **tell Tao**.
- Additional long-lived execution agents initialized locally for repeat use: **docs_worker**, **qa_worker**, **ops_worker**.
- Execution-agent system needs a standardized dispatch/handoff layer: task input template, result format, blocker/escalation rules, and a **main-to-Tao forwarding rule**.
- **Hard reporting/forwarding protocol (must-follow):**
  - Worker events that require immediate Tao-visible updates (no “I’ll summarize later”): **accepted**, **milestone result**, **blocked/failed**, **completion**, **agent switch decision**, **transition to review/commit/release**.
  - **Ordering constraint:** when a worker reports milestone/completion, main’s *first* action is to update Tao; only then proceed to review/commit/next dispatch.
  - **Failure definition:** if a worker has already reported completion and main has not forwarded it to Tao, that is a **main process failure**, not “task still in progress”.
  - Default 4-line update template: **who / status / output / next**.

## 8) Watchdog / automation policy
- Tao preference: avoid watchdog-style auto-restart automation.
- The previous watchdog automation was **removed**:
  - OpenClaw cron job `Gateway monitor + auto-restart (main)` removed (jobId `139258d6-f675-4f88-b2a7-cbe0b93a0db6`).
  - Mac launchd watchdog `ai.openclaw.watchdog` removed.
  - Pi-side crontab watchdog removed.

## 9) Webex keep-alive (local script)
- Tao requested a controllable Webex desktop “keep active” option.
- Script installed on Mac: `~/.openclaw/scripts/webex-keepalive.sh` (commands: `start|stop|status`).
- Notes: uses AppleScript/System Events; may require macOS Accessibility permission for Terminal/iTerm. Logs: `~/.openclaw/logs/webex-keepalive.log`, pid: `~/.openclaw/run/webex-keepalive.pid`.

## 10) Local memory library organization
- Local memory dir: `/Users/taodeng/.openclaw/workspace/main/memory/`.
- Added `memory/INDEX.md` to classify daily notes vs topic notes vs automation state JSON (do not rename/move state JSON without updating jobs).
- Plan: create a separate GitHub KB repo (option A) for shareable/curated knowledge; keep private/sensitive items local and only publish redacted content.
