import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ARCHIVE_COUNT = 20;
const MAX_MEMORY_FILES = 500;

const PLACEHOLDER_VALUES = new Set([
  "", "none", "n/a", "na", "idle",
  "[one sentence: what are we trying to accomplish]",
  "[exactly what should happen next]",
]);

// Matches a single CJK character (no `g` flag — used per-char in estimateTokens)
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;

// Patterns that indicate error/garbage assistant responses — kept at module scope
// so the array is not re-created on every extractStateFromMessages call.
const POISON_PATTERNS = [
  /not logged in/i,
  /please run \/login/i,
  /unknown skill/i,
  /session expired/i,
  /auth.*failed/i,
  /error.*timeout/i,
];
const isPoisoned = (text) => POISON_PATTERNS.some(p => p.test(text));

/**
 * Estimate token count with CJK awareness.
 * CJK characters ≈ 1.5 tokens each; Latin/other chars ≈ 1 token per ~4 chars.
 * Uses a single-pass for...of loop so surrogate pairs are iterated by code point.
 */
function estimateTokens(text) {
  if (!text) return 0;
  let cjkCount = 0;
  let nonCjkLen = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjkCount++;
    else nonCjkLen++;
  }
  return Math.ceil(cjkCount * 1.5) + Math.ceil(nonCjkLen / 4);
}

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

function archiveState(workspaceDir, md, config = {}) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const archiveDir = path.join(workspaceDir, "memory", "session_archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, `${stamp}.md`), md, "utf8");

  // Enforce archive count limit
  const maxCount = config.maxArchiveCount || MAX_ARCHIVE_COUNT;
  const files = fs.readdirSync(archiveDir).sort();
  if (files.length > maxCount) {
    const toDelete = files.slice(0, files.length - maxCount);
    for (const f of toDelete) {
      try { fs.unlinkSync(path.join(archiveDir, f)); } catch {}
    }
  }

  // Clean up memory directory
  cleanupMemoryDir(workspaceDir);
}

function cleanupMemoryDir(workspaceDir) {
  const memoryDir = path.join(workspaceDir, "memory");
  try {
    const entries = fs.readdirSync(memoryDir);

    // Clean up legacy STATE_ARCHIVE_*.md files from memory/ root
    const legacyArchives = entries.filter(f => /^STATE_ARCHIVE_.*\.md$/.test(f));
    for (const f of legacyArchives) {
      try { fs.unlinkSync(path.join(memoryDir, f)); } catch {}
    }

    // Check total file count (top level only)
    const remaining = fs.readdirSync(memoryDir);
    const fileEntries = remaining.filter(f => {
      try { return fs.statSync(path.join(memoryDir, f)).isFile(); } catch { return false; }
    });

    if (fileEntries.length > MAX_MEMORY_FILES) {
      const PROTECTED = new Set(["CURRENT_STATE.md", "MEMORY.md", "INDEX.md"]);
      const deletable = fileEntries
        .filter(f => !PROTECTED.has(f) && f.endsWith(".md"))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(memoryDir, f)).mtimeMs }))
        .sort((a, b) => a.mtime - b.mtime);

      const toRemove = deletable.slice(0, fileEntries.length - 450);
      for (const { name } of toRemove) {
        try { fs.unlinkSync(path.join(memoryDir, name)); } catch {}
      }
    }
  } catch {}
}

/**
 * Append a session summary to the daily session log.
 * File: memory/sessions/YYYY-MM-DD.md (one per day, append-only)
 */
function writeSessionLog(workspaceDir, messages, config = {}) {
  if (config.sessionLogging === false) return;
  if (!messages || messages.length === 0) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const sessionsDir = path.join(workspaceDir, "memory", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const logFile = path.join(sessionsDir, `${dateStr}.md`);

  // Extract first meaningful user message as topic
  let topic = "(no topic)";
  for (const msg of messages) {
    if (msg?.role !== "user") continue;
    const text = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter(b => b?.type === "text").map(b => b.text).join("\n")
        : "";
    const cleaned = text
      .replace(/^Conversation info \(untrusted metadata\):[\s\S]*?\n\n/m, "")
      .replace(/^Sender \(untrusted metadata\):[\s\S]*?\n\n/m, "")
      .trim();
    if (cleaned.length > 10) {
      topic = cleaned.split("\n")[0].slice(0, 120);
      break;
    }
  }

  // Count messages by role
  const userCount = messages.filter(m => m?.role === "user").length;
  const assistantCount = messages.filter(m => m?.role === "assistant").length;
  const contentToString = (m) => {
    if (typeof m?.content === "string") return m.content;
    if (Array.isArray(m?.content))
      return m.content.filter(b => b?.type === "text").map(b => b.text).join(" ");
    return "";
  };
  const totalTokens = estimateTokens(messages.map(contentToString).join(" "));

  // Build log entry
  const entry = [
    `### ${timeStr}`,
    `- **Topic:** ${topic}`,
    `- **Messages:** ${userCount} user / ${assistantCount} assistant`,
    `- **Est. tokens:** ~${totalTokens}`,
    "",
  ].join("\n");

  // Append-safe: use appendFileSync for both new and existing files
  const isNew = !fs.existsSync(logFile);
  const prefix = isNew ? `# Session Log — ${dateStr}\n\n` : "";
  fs.appendFileSync(logFile, prefix + entry, "utf8");
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

  // Token-aware truncation
  const truncate = (s, maxTokens = 200) => {
    if (estimateTokens(s) <= maxTokens) return s;
    // Binary search for the right cut point
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (estimateTokens(s.slice(0, mid)) <= maxTokens) lo = mid;
      else hi = mid - 1;
    }
    // Avoid splitting surrogate pairs
    while (lo > 0 && lo < s.length && s.charCodeAt(lo) >= 0xDC00 && s.charCodeAt(lo) <= 0xDFFF) lo--;
    return s.slice(0, lo) + "...";
  };

  // Filter out error/garbage responses that would poison future sessions
  if (isPoisoned(lastAssistant)) return null;
  if (isPoisoned(lastUser) && !lastAssistant) return null;

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
        archiveState(ws, md, config);
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

      const messages = event?.messages;
      if (!messages || messages.length === 0) {
        log.info?.("[memory-continuity] No messages in session, skipping");
        return;
      }

      // Count real user messages (exclude system, metadata-only, short commands)
      // Returns cleaned text strings so ignore-pattern regex can test against actual content.
      const realUserMsgs = messages.reduce((acc, m) => {
        if (m?.role !== "user") return acc;
        const text = typeof m?.content === "string" ? m.content
          : Array.isArray(m?.content) ? m.content.filter(b => b?.type === "text").map(b => b.text).join("\n")
          : "";
        const cleaned = text
          .replace(/^Conversation info \(untrusted metadata\):[\s\S]*?\n\n/m, "")
          .replace(/^Sender \(untrusted metadata\):[\s\S]*?\n\n/m, "")
          .trim();
        // Skip very short messages like "/new", "/status", single-word queries
        if (cleaned.length > 10) acc.push(cleaned);
        return acc;
      }, []);

      // Check ignore patterns — skip sessions matching cron/subagent noise
      const ignorePatterns = (config.ignorePatterns || [])
        .map(p => { try { return new RegExp(p, "i"); } catch { log.warn?.("[memory-continuity] ignorePatterns: invalid regex, skipping: " + p); return null; } })
        .filter(Boolean);

      if (ignorePatterns.length > 0 && realUserMsgs.length > 0) {
        const firstMsg = realUserMsgs[0];
        if (ignorePatterns.some(re => re.test(firstMsg))) {
          log.info?.("[memory-continuity] Session matches ignorePattern, skipping");
          return;
        }
      }

      // Write session log entry
      writeSessionLog(ws, messages, config);

      const existing = readFile(statePath);
      const newState = extractStateFromMessages(messages);
      if (!newState) {
        log.info?.("[memory-continuity] No extractable state from conversation");
        return;
      }

      // Archive previous state if it exists
      if (existing) {
        archiveState(ws, existing, config);
      }

      writeFile(statePath, newState);
      log.info?.("[memory-continuity] Updated state from conversation (" + realUserMsgs.length + " real msgs)");
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
