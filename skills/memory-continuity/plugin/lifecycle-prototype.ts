import fs from "node:fs";
import path from "node:path";

const PLACEHOLDER_VALUES = new Set([
  "",
  "none",
  "n/a",
  "na",
  "idle",
  "[one sentence: what are we trying to accomplish]",
  "[exactly what should happen next]",
]);

function resolveStatePath(runtime: { workspaceDir?: string }) {
  const workspaceDir = runtime?.workspaceDir;
  if (!workspaceDir) return null;
  return path.join(workspaceDir, "memory", "CURRENT_STATE.md");
}

function readStateFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function extractSection(markdown: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "m");
  const m = markdown.match(re);
  return (m?.[1] ?? "").trim();
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function isMeaningful(value: string) {
  return !PLACEHOLDER_VALUES.has(normalizeValue(value));
}

function buildSnapshot(markdown: string) {
  const objective = extractSection(markdown, "Objective");
  const currentStep = extractSection(markdown, "Current Step");
  const keyDecisions = extractSection(markdown, "Key Decisions");
  const nextAction = extractSection(markdown, "Next Action");
  const blockers = extractSection(markdown, "Blockers");
  const unsurfacedResults = extractSection(markdown, "Unsurfaced Results");
  const updated = markdown.match(/^> Last updated:\s*(.+)$/m)?.[1]?.trim() ?? "unknown";

  if (!isMeaningful(objective)) return null;

  return [
    "CONTINUITY SNAPSHOT",
    `Objective: ${objective}`,
    `Current Step: ${currentStep || "unknown"}`,
    `Key Decisions: ${keyDecisions || "None"}`,
    `Next Action: ${nextAction || "unknown"}`,
    `Blockers: ${blockers || "None"}`,
    `Unsurfaced Results: ${unsurfacedResults || "None"}`,
    `Updated: ${updated}`,
  ].join("\n");
}

function ensureStateFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(
    filePath,
    `# Current State\n> Last updated: ${new Date().toISOString()}\n\n## Objective\nNone\n\n## Current Step\nNone\n\n## Key Decisions\n- None\n\n## Next Action\nNone\n\n## Blockers\nNone\n\n## Unsurfaced Results\nNone\n`,
    "utf8",
  );
}

function formatArchiveStamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function appendArchive(workspaceDir: string, markdown: string) {
  const stamp = formatArchiveStamp();
  const archiveDir = path.join(workspaceDir, "memory", "session_archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, `${stamp}.md`), markdown, "utf8");
}

export default function register(api: any) {
  // Startup recovery hint: this is the most important Phase 2 check.
  api.on(
    "before_prompt_build",
    async (_event: any, ctx: any) => {
      const statePath = resolveStatePath(api.runtime ?? {});
      if (!statePath) return;
      const markdown = readStateFile(statePath);
      if (!markdown) return;
      const snapshot = buildSnapshot(markdown);
      if (!snapshot) return;
      return {
        prependSystemContext:
          `${snapshot}\n\n` +
          "If the user is clearly resuming/recovering prior work, surface the recovered state before generic greeting.",
      };
    },
    { priority: 20 },
  );

  // /new boundary: best-effort archive/checkpoint.
  api.registerHook(
    "command:new",
    async () => {
      const workspaceDir = api.runtime?.workspaceDir;
      const statePath = resolveStatePath(api.runtime ?? {});
      if (!workspaceDir || !statePath) return;
      ensureStateFile(statePath);
      const markdown = readStateFile(statePath);
      if (!markdown) return;
      appendArchive(workspaceDir, markdown);
    },
    {
      name: "memory-continuity.command-new",
      description: "Archive CURRENT_STATE.md before /new resets conversational continuity.",
    },
  );

  // End-of-run checkpoint stub: proves the lifecycle hook wiring exists.
  api.on("agent_end", async () => {
    const statePath = resolveStatePath(api.runtime ?? {});
    if (!statePath) return;
    ensureStateFile(statePath);
  });

  // Compaction hook probe: v1 must confirm this path is actually synchronous enough.
  api.on("before_compaction", async () => {
    const statePath = resolveStatePath(api.runtime ?? {});
    if (!statePath) return;
    ensureStateFile(statePath);
    const existing = readStateFile(statePath) ?? "";
    const marker = `\n<!-- COMPACTION_PROBE ${new Date().toISOString()} -->\n`;
    if (!existing.includes("<!-- COMPACTION_PROBE ")) {
      fs.writeFileSync(statePath, existing.trimEnd() + marker, "utf8");
    } else {
      fs.writeFileSync(
        statePath,
        existing.replace(/<!-- COMPACTION_PROBE .*?-->/, marker.trim()),
        "utf8",
      );
    }
    console.log(`[memory-continuity] before_compaction probe wrote marker to ${statePath}`);
  });
}
