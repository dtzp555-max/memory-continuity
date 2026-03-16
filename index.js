import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_VALUES = new Set([
  "", "none", "n/a", "na", "idle",
  "[one sentence: what are we trying to accomplish]",
  "[exactly what should happen next]",
]);

const STATE_TEMPLATE = `# Current State
> Last updated: ${new Date().toISOString()}

## Objective
None

## Current Step
None

## Key Decisions
- None

## Next Action
None

## Blockers
None

## Unsurfaced Results
None
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStatePath(workspaceDir) {
  if (!workspaceDir) return null;
  return path.join(workspaceDir, "memory", "CURRENT_STATE.md");
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return null; }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function extractSection(md, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "m");
  return (md.match(re)?.[1] ?? "").trim();
}

function isMeaningful(value) {
  return !PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function buildSnapshot(md) {
  const objective = extractSection(md, "Objective");
  if (!isMeaningful(objective)) return null;

  const fields = {
    "Objective": objective,
    "Current Step": extractSection(md, "Current Step") || "unknown",
    "Key Decisions": extractSection(md, "Key Decisions") || "None",
    "Next Action": extractSection(md, "Next Action") || "unknown",
    "Blockers": extractSection(md, "Blockers") || "None",
    "Unsurfaced Results": extractSection(md, "Unsurfaced Results") || "None",
  };
  const updated = md.match(/^> Last updated:\s*(.+)$/m)?.[1]?.trim() ?? "unknown";

  return [
    "=== CONTINUITY RECOVERY ===",
    ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
    `Last Updated: ${updated}`,
    "=== END RECOVERY ===",
  ].join("\n");
}

function archiveState(workspaceDir, md) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const archiveDir = path.join(workspaceDir, "memory", "session_archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, `${stamp}.md`), md, "utf8");
}

function extractStateFromMessages(messages) {
  if (!messages || messages.length === 0) return null;

  // Walk messages backwards to find the last meaningful exchange
  const userMessages = [];
  const assistantMessages = [];

  for (const msg of messages) {
    const role = msg?.role;
    const content = typeof msg?.content === "string"
      ? msg.content
      : Array.isArray(msg?.content)
        ? msg.content.filter(b => b?.type === "text").map(b => b.text).join("\n")
        : null;
    if (!content) continue;
    // Strip channel metadata (Telegram, Discord, etc.) from user messages
    const cleaned = role === "user"
      ? content
          .replace(/^Conversation info \(untrusted metadata\):[\s\S]*?\n\n/m, "")
          .replace(/^Sender \(untrusted metadata\):[\s\S]*?\n\n/m, "")
          .trim()
      : content;
    if (role === "user" && cleaned) userMessages.push(cleaned);
    if (role === "assistant") assistantMessages.push(content);
  }

  if (userMessages.length === 0 && assistantMessages.length === 0) return null;

  // Build a simple state from the conversation tail
  const lastUser = userMessages[userMessages.length - 1] || "";
  const lastAssistant = assistantMessages[assistantMessages.length - 1] || "";

  // Truncate to keep it compact
  const truncate = (s, max = 200) => s.length > max ? s.slice(0, max) + "..." : s;

  return `# Current State
> Last updated: ${new Date().toISOString()}

## Objective
${truncate(lastUser, 300)}

## Current Step
Conversation ended after ${messages.length} messages

## Key Decisions
- Auto-extracted from conversation

## Next Action
Continue from where we left off

## Blockers
None

## Unsurfaced Results
${truncate(lastAssistant, 500)}
`;
}

// ---------------------------------------------------------------------------
// Plugin Definition
// ---------------------------------------------------------------------------

const plugin = {
  id: "memory-continuity",
  name: "Memory Continuity",

  register(api) {
    const log = api.logger || console;
    const getConfig = () => api.pluginConfig || {};

    // ------------------------------------------------------------------
    // HOOK 1: before_agent_start — inject recovered state into context
    // ------------------------------------------------------------------
    api.on("before_agent_start", async (_event, _ctx) => {
      const ws = _ctx?.workspaceDir;
      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      const md = readFile(statePath);
      if (!md) return;

      const snapshot = buildSnapshot(md);
      if (!snapshot) return;

      log.info?.("[memory-continuity] Injecting recovered state into context");

      return {
        prependSystemContext:
          snapshot + "\n\n" +
          "IMPORTANT: The above is recovered working state from a previous session. " +
          "If the user appears to be resuming work, surface this state immediately " +
          "before any generic greeting. This is a continuity requirement, not optional.",
      };
    }, { priority: 10 });

    // ------------------------------------------------------------------
    // HOOK 2: before_compaction — inject state so it survives compaction
    // ------------------------------------------------------------------
    api.on("before_compaction", async (_event, _ctx) => {
      const ws = _ctx?.workspaceDir;
      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      const md = readFile(statePath);
      if (!md) return;

      const snapshot = buildSnapshot(md);
      if (!snapshot) return;

      log.info?.("[memory-continuity] Injecting state before compaction");

      return {
        prependSystemContext: snapshot,
      };
    }, { priority: 10 });

    // ------------------------------------------------------------------
    // HOOK 3: before_reset (/new) — archive current state
    // ------------------------------------------------------------------
    api.on("before_reset", async (_event, _ctx) => {
      const ws = _ctx?.workspaceDir;
      const config = getConfig();
      if (!ws || config.archiveOnNew === false) return;

      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      const md = readFile(statePath);
      if (!md) return;

      if (buildSnapshot(md)) {
        archiveState(ws, md);
        log.info?.("[memory-continuity] Archived state before /new");
      }
    }, { priority: 10 });

    // ------------------------------------------------------------------
    // HOOK 4: agent_end — extract and save working state
    // ------------------------------------------------------------------
    api.on("agent_end", async (event, _ctx) => {
      const ws = _ctx?.workspaceDir;
      const config = getConfig();
      if (!ws || config.autoExtract === false) return;

      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      // Always extract from the latest conversation — the whole point is to
      // capture what happened *this* session so the next session can recover.
      const newState = extractStateFromMessages(event?.messages);
      if (!newState) {
        log.info?.("[memory-continuity] No extractable state from conversation");
        return;
      }

      // Archive previous state if it exists
      const existing = readFile(statePath);
      if (existing) {
        const archivePath = statePath.replace(/CURRENT_STATE\.md$/, `STATE_ARCHIVE_${Date.now()}.md`);
        writeFile(archivePath, existing);
      }

      writeFile(statePath, newState);
      log.info?.("[memory-continuity] Updated state from conversation");
    }, { priority: 90 }); // low priority, run after other hooks

    // ------------------------------------------------------------------
    // HOOK 5: session_end — ensure state file exists
    // ------------------------------------------------------------------
    api.on("session_end", async (_event, _ctx) => {
      const ws = _ctx?.workspaceDir;
      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      if (!readFile(statePath)) {
        writeFile(statePath, STATE_TEMPLATE);
        log.info?.("[memory-continuity] Created initial CURRENT_STATE.md");
      }
    }, { priority: 90 });

    log.info?.("[memory-continuity] Plugin registered successfully");
  },
};

export default plugin;
