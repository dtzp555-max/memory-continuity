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

  // Extract and index #tags from the topic
  updateTagIndex(workspaceDir, topic, dateStr);
}

/**
 * Extract the last N meaningful user/assistant exchange pairs from messages.
 * Returns a formatted string for injection into compaction context.
 */
function extractTailMessages(messages, count = 3) {
  if (!messages || messages.length === 0) return null;

  // Walk backwards, collect up to `count` user+assistant pairs
  const pairs = [];
  let i = messages.length - 1;

  while (i >= 0 && pairs.length < count) {
    // Find assistant message
    while (i >= 0 && messages[i]?.role !== "assistant") i--;
    if (i < 0) break;
    const assistantMsg = messages[i];
    i--;

    // Find preceding user message
    while (i >= 0 && messages[i]?.role !== "user") i--;
    if (i < 0) break;
    const userMsg = messages[i];
    i--;

    const getText = (msg) => {
      if (typeof msg?.content === "string") return msg.content;
      if (Array.isArray(msg?.content)) {
        return msg.content.filter(b => b?.type === "text").map(b => b.text).join("\n");
      }
      return "";
    };

    const userText = getText(userMsg).trim();
    const assistantText = getText(assistantMsg).trim();

    // Skip trivial exchanges
    if (userText.length < 10 && assistantText.length < 20) continue;

    // Token-aware truncation per message
    const maxPerMsg = 150;
    const truncMsg = (s) => {
      if (estimateTokens(s) <= maxPerMsg) return s;
      let lo = 0, hi = s.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (estimateTokens(s.slice(0, mid)) <= maxPerMsg) lo = mid;
        else hi = mid - 1;
      }
      // Avoid splitting surrogate pairs
      while (lo > 0 && lo < s.length && s.charCodeAt(lo) >= 0xDC00 && s.charCodeAt(lo) <= 0xDFFF) lo--;
      return s.slice(0, lo) + "...";
    };

    pairs.unshift({ user: truncMsg(userText), assistant: truncMsg(assistantText) });
  }

  if (pairs.length === 0) return null;

  const lines = ["=== RECENT EXCHANGE (protected) ==="];
  for (const p of pairs) {
    lines.push(`User: ${p.user}`);
    lines.push(`Assistant: ${p.assistant}`);
    lines.push("---");
  }
  lines.push("=== END RECENT EXCHANGE ===");
  return lines.join("\n");
}

/**
 * Generate a daily summary from the previous day's session log.
 * Only runs when today differs from the last summary date.
 * Output: memory/summaries/daily/YYYY-MM-DD.md
 */
function generateDailySummary(workspaceDir, config = {}) {
  if (config.summaryEnabled === false) return;

  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Check yesterday's date
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  const summaryDir = path.join(workspaceDir, "memory", "summaries", "daily");
  const summaryFile = path.join(summaryDir, `${yStr}.md`);

  // Skip if summary already exists for yesterday
  if (fs.existsSync(summaryFile)) return;

  // Read yesterday's session log
  const sessionFile = path.join(workspaceDir, "memory", "sessions", `${yStr}.md`);
  const sessionContent = readFile(sessionFile);
  if (!sessionContent) return; // No sessions yesterday

  // Parse session entries
  const entries = sessionContent.split(/^### /gm).filter(e => e.trim());
  if (entries.length === 0) return;

  const topics = [];
  let totalUser = 0;
  let totalAssistant = 0;
  let totalTokens = 0;

  for (const entry of entries) {
    const topicMatch = entry.match(/\*\*Topic:\*\*\s*(.+)/);
    const msgMatch = entry.match(/\*\*Messages:\*\*\s*(\d+)\s*user\s*\/\s*(\d+)\s*assistant/);
    const tokenMatch = entry.match(/\*\*Est\. tokens:\*\*\s*~(\d+)/);

    if (topicMatch) topics.push(topicMatch[1].trim());
    if (msgMatch) {
      totalUser += parseInt(msgMatch[1]);
      totalAssistant += parseInt(msgMatch[2]);
    }
    if (tokenMatch) totalTokens += parseInt(tokenMatch[1]);
  }

  // Build daily summary
  const summary = [
    `# Daily Summary — ${yStr}`,
    "",
    `**Sessions:** ${entries.length}`,
    `**Messages:** ${totalUser} user / ${totalAssistant} assistant`,
    `**Est. tokens:** ~${totalTokens}`,
    "",
    "## Topics",
    ...topics.map((t, i) => `${i + 1}. ${t}`),
    "",
  ].join("\n");

  fs.mkdirSync(summaryDir, { recursive: true });
  fs.writeFileSync(summaryFile, summary, "utf8");
}

/**
 * Generate a weekly summary by rolling up daily summaries.
 * Runs on Monday, summarizing the previous week (Mon-Sun).
 * Output: memory/summaries/weekly/YYYY-Www.md (ISO week number)
 */
function generateWeeklySummary(workspaceDir, config = {}) {
  if (config.summaryEnabled === false) return;

  const now = new Date();
  // Only run on Mondays
  if (now.getDay() !== 1) return;

  const pad = (n) => String(n).padStart(2, "0");

  // Calculate previous week's Monday
  const prevMonday = new Date(now);
  prevMonday.setDate(prevMonday.getDate() - 7);

  // ISO week number
  const jan1 = new Date(prevMonday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((prevMonday - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const weekLabel = `${prevMonday.getFullYear()}-W${pad(weekNum)}`;

  const weeklyDir = path.join(workspaceDir, "memory", "summaries", "weekly");
  const weeklyFile = path.join(weeklyDir, `${weekLabel}.md`);

  // Skip if already generated
  if (fs.existsSync(weeklyFile)) return;

  // Collect daily summaries for the 7 days of previous week
  const dailyDir = path.join(workspaceDir, "memory", "summaries", "daily");
  const dailies = [];
  let weekSessions = 0;
  let weekUser = 0;
  let weekAssistant = 0;
  let weekTokens = 0;
  const allTopics = [];

  for (let d = 0; d < 7; d++) {
    const day = new Date(prevMonday);
    day.setDate(day.getDate() + d);
    const dayStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const dailyFile = path.join(dailyDir, `${dayStr}.md`);
    const content = readFile(dailyFile);
    if (!content) continue;

    dailies.push(dayStr);

    const sessMatch = content.match(/\*\*Sessions:\*\*\s*(\d+)/);
    const msgMatch = content.match(/\*\*Messages:\*\*\s*(\d+)\s*user\s*\/\s*(\d+)\s*assistant/);
    const tokenMatch = content.match(/\*\*Est\. tokens:\*\*\s*~(\d+)/);

    if (sessMatch) weekSessions += parseInt(sessMatch[1]);
    if (msgMatch) {
      weekUser += parseInt(msgMatch[1]);
      weekAssistant += parseInt(msgMatch[2]);
    }
    if (tokenMatch) weekTokens += parseInt(tokenMatch[1]);

    // Extract topics
    const topicSection = content.split("## Topics")[1];
    if (topicSection) {
      const topics = topicSection.match(/^\d+\.\s+(.+)$/gm);
      if (topics) allTopics.push(...topics.map(t => t.replace(/^\d+\.\s+/, "").trim()));
    }
  }

  if (dailies.length === 0) return;

  // Deduplicate topics (keep first occurrence)
  const seen = new Set();
  const uniqueTopics = allTopics.filter(t => {
    const key = t.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = [
    `# Weekly Summary — ${weekLabel}`,
    `> ${dailies[0]} to ${dailies[dailies.length - 1]}`,
    "",
    `**Active days:** ${dailies.length}/7`,
    `**Total sessions:** ${weekSessions}`,
    `**Total messages:** ${weekUser} user / ${weekAssistant} assistant`,
    `**Est. total tokens:** ~${weekTokens}`,
    "",
    "## Key Topics",
    ...uniqueTopics.slice(0, 20).map((t, i) => `${i + 1}. ${t}`),
    "",
  ].join("\n");

  fs.mkdirSync(weeklyDir, { recursive: true });
  fs.writeFileSync(weeklyFile, summary, "utf8");
}

/**
 * Extract #tags from a session topic and update the tag index.
 * Tags file: memory/tags.md — simple markdown index mapping tags to dates.
 */
function updateTagIndex(workspaceDir, topic, dateStr) {
  if (!topic) return;

  // Extract #tags (word chars + hyphens after #)
  const tags = topic.match(/#[\w-]+/g);
  if (!tags || tags.length === 0) return;

  const tagsFile = path.join(workspaceDir, "memory", "tags.md");
  let existing = readFile(tagsFile) || "# Tag Index\n\n";

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase();
    // Check if this tag+date combo already exists
    if (existing.includes(`${normalizedTag}`) && existing.includes(dateStr)) continue;

    // Find or create tag section
    const tagHeader = `## ${normalizedTag}`;
    if (existing.includes(tagHeader)) {
      // Append date to existing tag section
      existing = existing.replace(
        tagHeader,
        `${tagHeader}\n- ${dateStr}`
      );
    } else {
      // Add new tag section
      existing += `${tagHeader}\n- ${dateStr}\n\n`;
    }
  }

  writeFile(tagsFile, existing);
}

/**
 * Find relevant historical entries by keyword matching against the current objective.
 * Searches session logs and daily summaries, returns up to `maxItems` formatted entries.
 */
function findRelevantHistory(workspaceDir, objective, maxItems = 3) {
  if (!objective || objective.length < 10) return null;

  // Extract keywords from objective (words > 3 chars, excluding common words)
  const stopWords = new Set(["this", "that", "with", "from", "have", "been", "will", "what", "when", "where", "which", "there", "their", "about", "would", "should", "could", "into", "some", "them", "than", "then", "these", "those", "just", "also", "more", "other", "after", "before", "none"]);
  const words = objective
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toLowerCase());

  if (words.length === 0) return null;

  // Build a scoring regex from keywords
  const keywordPatterns = words.slice(0, 10).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const scored = [];

  // Search daily summaries (most recent 14)
  const dailyDir = path.join(workspaceDir, "memory", "summaries", "daily");
  try {
    const files = fs.readdirSync(dailyDir).filter(f => f.endsWith(".md")).sort().reverse();
    for (const f of files.slice(0, 14)) {
      const content = readFile(path.join(dailyDir, f));
      if (!content) continue;
      let score = 0;
      const lower = content.toLowerCase();
      for (const kw of keywordPatterns) {
        const matches = lower.match(new RegExp(kw, "gi"));
        if (matches) score += matches.length;
      }
      if (score > 0) {
        const date = f.replace(".md", "");
        // Extract topics section for context
        const topicsMatch = content.match(/## Topics\n([\s\S]*?)(?:\n##|$)/);
        const topics = topicsMatch ? topicsMatch[1].trim().split("\n").slice(0, 3).join("; ") : "";
        scored.push({ date, type: "daily", score, summary: topics || content.split("\n").slice(0, 3).join(" ") });
      }
    }
  } catch {}

  // Search session logs (most recent 7 days)
  const sessionsDir = path.join(workspaceDir, "memory", "sessions");
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".md")).sort().reverse();
    for (const f of files.slice(0, 7)) {
      const content = readFile(path.join(sessionsDir, f));
      if (!content) continue;

      // Score individual session entries
      const entries = content.split(/^### /gm).filter(e => e.trim());
      for (const entry of entries) {
        let score = 0;
        const lower = entry.toLowerCase();
        for (const kw of keywordPatterns) {
          const matches = lower.match(new RegExp(kw, "gi"));
          if (matches) score += matches.length;
        }
        if (score > 1) { // Require at least 2 keyword hits for session entries
          const topicMatch = entry.match(/\*\*Topic:\*\*\s*(.+)/);
          const time = entry.match(/^(\d{2}:\d{2})/)?.[1] || "";
          const date = f.replace(".md", "");
          scored.push({ date: `${date} ${time}`, type: "session", score, summary: topicMatch?.[1] || entry.slice(0, 80) });
        }
      }
    }
  } catch {}

  if (scored.length === 0) return null;

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxItems);

  const lines = ["=== RELATED HISTORY ==="];
  for (const item of top) {
    lines.push(`[${item.date}] ${item.summary}`);
  }
  lines.push("=== END RELATED HISTORY ===");
  return lines.join("\n");
}

/**
 * Move archives older than `decayDays` to a cold/ subdirectory.
 * Files are preserved, not deleted — they just leave the active index.
 */
function decayOldArchives(workspaceDir, config = {}) {
  const decayDays = config.archiveDecayDays ?? 30;
  if (decayDays <= 0) return; // Disabled

  const archiveDir = path.join(workspaceDir, "memory", "session_archive");
  const coldDir = path.join(archiveDir, "cold");

  let files;
  try { files = fs.readdirSync(archiveDir).filter(f => f.endsWith(".md")); }
  catch { return; }

  const cutoff = Date.now() - (decayDays * 86400000);

  let movedCount = 0;
  for (const f of files) {
    // Parse date from filename: YYYY-MM-DD_HH-MM.md
    const dateMatch = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) continue;

    const fileDate = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    ).getTime();

    if (fileDate < cutoff) {
      fs.mkdirSync(coldDir, { recursive: true });
      const src = path.join(archiveDir, f);
      const dst = path.join(coldDir, f);
      try {
        // Move: copy then delete
        fs.copyFileSync(src, dst);
        fs.unlinkSync(src);
        movedCount++;
      } catch {}
    }
  }

  return movedCount;
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
      const config = getConfig();
      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      const md = readFile(statePath);
      if (!md) return;

      const snapshot = buildSnapshot(md);
      if (!snapshot) return;

      log.info?.("[memory-continuity] Injecting recovered state into context");

      const parts = [snapshot];

      // Relevance injection: find related historical entries
      if (config.relevanceInjection !== false) {
        const objective = extractSection(md, "Objective");
        const maxItems = config.maxRelevanceItems ?? 3;
        const history = findRelevantHistory(ws, objective, maxItems);
        if (history) {
          parts.push(history);
          log.info?.("[memory-continuity] Injected relevant history context");
        }
      }

      return {
        prependSystemContext:
          parts.join("\n\n") + "\n\n" +
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
      const config = getConfig();
      const statePath = resolveStatePath(ws);
      if (!statePath) return;

      const md = readFile(statePath);
      if (!md) return;

      const snapshot = buildSnapshot(md);
      if (!snapshot) return;

      log.info?.("[memory-continuity] Injecting state before compaction");

      // Smart tail protection: also inject recent critical messages
      const tailCount = config.tailProtectCount ?? 3;
      const messages = _event?.messages;
      const tail = tailCount > 0 ? extractTailMessages(messages, tailCount) : null;

      const parts = [snapshot];
      if (tail) {
        parts.push(tail);
        log.info?.("[memory-continuity] Tail protection: injected recent exchanges");
      }

      return {
        prependSystemContext: parts.join("\n\n"),
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

      // Generate daily summary for previous day if needed
      generateDailySummary(ws, config);
      generateWeeklySummary(ws, config);
      decayOldArchives(ws, config);

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
