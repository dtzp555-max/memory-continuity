/**
 * MC Plugin — registers /mc as a native slash command in OpenClaw gateway.
 * Provides interactive commands for the Memory Continuity plugin.
 */

import fs from "node:fs";
import path from "node:path";

// ── Helpers ─────────────────────────────────────────────────────────────

function mono(text) { return "```\n" + text + "\n```"; }

const BASE = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "/tmp", ".openclaw");
const MAIN_WS = path.join(BASE, "workspace", "main", "memory");
const EXTRA_WS = path.join(BASE, "workspaces");

/** Discover all agent workspaces that have memory directories */
function discoverAgents() {
  const agents = [];

  // Main workspace
  if (fs.existsSync(path.join(MAIN_WS, "CURRENT_STATE.md"))) {
    agents.push({ name: "main", memDir: MAIN_WS });
  }

  // Sub-agent workspaces
  try {
    for (const d of fs.readdirSync(EXTRA_WS)) {
      const memDir = path.join(EXTRA_WS, d, "memory");
      if (fs.existsSync(path.join(memDir, "CURRENT_STATE.md"))) {
        agents.push({ name: d, memDir });
      }
    }
  } catch {}

  return agents;
}

function resolveMemDir(agentName) {
  if (!agentName || agentName === "main") return MAIN_WS;
  const p = path.join(EXTRA_WS, agentName, "memory");
  return fs.existsSync(p) ? p : null;
}

function readFile(fp) {
  try { return fs.readFileSync(fp, "utf8"); } catch { return null; }
}

function extractSection(md, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "m");
  return (md.match(re)?.[1] ?? "").trim();
}

function relTime(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return dateStr || "unknown"; }
}

function truncate(s, max = 120) {
  if (!s) return "(empty)";
  const line = s.split("\n")[0];
  return line.length > max ? line.slice(0, max) + "…" : line;
}

// ── Subcommand handlers ─────────────────────────────────────────────────

function cmdState(args) {
  const agent = args || "main";
  const memDir = resolveMemDir(agent);
  if (!memDir) return `Agent "${agent}" not found.`;

  const md = readFile(path.join(memDir, "CURRENT_STATE.md"));
  if (!md) return `No state file for "${agent}".`;

  const updated = md.match(/^> Last updated:\s*(.+)$/m)?.[1]?.trim();

  let out = `State: ${agent}\n`;
  out += `Updated: ${relTime(updated)}\n`;
  out += "─────────────────────────────\n";
  for (const section of ["Objective", "Current Step", "Key Decisions", "Next Action", "Blockers"]) {
    const val = extractSection(md, section);
    // Compact multi-line values
    const compact = val.split("\n").slice(0, 3).join("\n");
    out += `${section}:\n  ${compact || "(empty)"}\n\n`;
  }
  return out.trimEnd();
}

function cmdStateAll() {
  const agents = discoverAgents();
  if (!agents.length) return "No agents with memory found.";

  let out = `Memory States (${agents.length} agents)\n`;
  out += "─────────────────────────────\n";

  for (const { name, memDir } of agents) {
    const md = readFile(path.join(memDir, "CURRENT_STATE.md"));
    if (!md) { out += `${name.padEnd(20)} (no state)\n`; continue; }

    const updated = md.match(/^> Last updated:\s*(.+)$/m)?.[1]?.trim();
    const objective = extractSection(md, "Objective");

    out += `${name.padEnd(20)} ${relTime(updated).padEnd(10)} ${truncate(objective, 50)}\n`;
  }
  return out.trimEnd();
}

function cmdHistory(args) {
  const agent = args || "main";
  const memDir = resolveMemDir(agent);
  if (!memDir) return `Agent "${agent}" not found.`;

  const archiveDir = path.join(memDir, "session_archive");
  let files;
  try { files = fs.readdirSync(archiveDir).filter(f => f.endsWith(".md")).sort().reverse(); }
  catch { return `No archive for "${agent}".`; }

  if (!files.length) return `No archived sessions for "${agent}".`;

  let out = `Session Archive: ${agent} (${files.length} entries)\n`;
  out += "─────────────────────────────\n";
  out += `${"#".padStart(3)} ${"Timestamp".padEnd(20)} Objective\n`;
  out += "─".repeat(60) + "\n";

  for (let i = 0; i < Math.min(files.length, 20); i++) {
    const f = files[i];
    const ts = f.replace(".md", "").replace(/_/g, " ");
    const md = readFile(path.join(archiveDir, f));
    const obj = md ? truncate(extractSection(md, "Objective"), 35) : "?";
    out += `${String(i + 1).padStart(3)} ${ts.padEnd(20)} ${obj}\n`;
  }

  if (files.length > 20) out += `\n  ... and ${files.length - 20} more`;
  return out.trimEnd();
}

function cmdRestore(args) {
  const parts = (args || "").trim().split(/\s+/);
  const idx = parseInt(parts[0]);
  const agent = parts[1] || "main";

  if (isNaN(idx) || idx < 1) return "Usage: /mc restore <N> [agent]\nN = archive number from /mc history";

  const memDir = resolveMemDir(agent);
  if (!memDir) return `Agent "${agent}" not found.`;

  const archiveDir = path.join(memDir, "session_archive");
  let files;
  try { files = fs.readdirSync(archiveDir).filter(f => f.endsWith(".md")).sort().reverse(); }
  catch { return `No archive for "${agent}".`; }

  if (idx > files.length) return `Only ${files.length} archives available.`;

  const target = files[idx - 1];
  const content = readFile(path.join(archiveDir, target));
  if (!content) return `Failed to read archive ${target}.`;

  // Backup current state first
  const statePath = path.join(memDir, "CURRENT_STATE.md");
  const current = readFile(statePath);
  if (current) {
    const bak = path.join(memDir, "CURRENT_STATE.md.bak");
    fs.writeFileSync(bak, current, "utf8");
  }

  fs.writeFileSync(statePath, content, "utf8");
  return `✓ Restored archive #${idx} (${target.replace(".md", "")})\n  Previous state backed up to CURRENT_STATE.md.bak`;
}

function cmdClear(args) {
  const agent = args || "main";
  const memDir = resolveMemDir(agent);
  if (!memDir) return `Agent "${agent}" not found.`;

  const statePath = path.join(memDir, "CURRENT_STATE.md");
  const current = readFile(statePath);

  if (current) {
    // Archive before clearing
    const archiveDir = path.join(memDir, "session_archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    fs.writeFileSync(path.join(archiveDir, `${stamp}.md`), current, "utf8");
  }

  const template = `# Current State
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
  fs.writeFileSync(statePath, template, "utf8");
  return `✓ State cleared for "${agent}"\n  Previous state archived.`;
}

function cmdSearch(args) {
  if (!args) return "Usage: /mc search <keyword> [agent]\nSearches current state + archives.";

  const parts = args.trim().split(/\s+/);
  // Last part might be an agent name
  let keyword, agent;
  const agents = discoverAgents();
  const agentNames = new Set(agents.map(a => a.name));

  if (parts.length > 1 && agentNames.has(parts[parts.length - 1])) {
    agent = parts.pop();
    keyword = parts.join(" ");
  } else {
    keyword = parts.join(" ");
    agent = null; // search all
  }

  const re = new RegExp(keyword, "gi");
  const results = [];

  const searchAgents = agent ? [{ name: agent, memDir: resolveMemDir(agent) }] : agents;

  for (const { name, memDir } of searchAgents) {
    if (!memDir) continue;

    // Search current state
    const state = readFile(path.join(memDir, "CURRENT_STATE.md"));
    if (state && re.test(state)) {
      const lines = state.split("\n").filter(l => re.test(l));
      results.push({ agent: name, source: "CURRENT_STATE", matches: lines.slice(0, 3) });
    }

    // Search archives
    const archiveDir = path.join(memDir, "session_archive");
    try {
      const files = fs.readdirSync(archiveDir).filter(f => f.endsWith(".md")).sort().reverse();
      for (const f of files.slice(0, 30)) {
        const content = readFile(path.join(archiveDir, f));
        if (content && re.test(content)) {
          const lines = content.split("\n").filter(l => re.test(l));
          results.push({ agent: name, source: f.replace(".md", ""), matches: lines.slice(0, 2) });
        }
      }
    } catch {}
  }

  if (!results.length) return `No matches for "${keyword}".`;

  let out = `Search: "${keyword}" (${results.length} hits)\n`;
  out += "─────────────────────────────\n";
  for (const r of results.slice(0, 15)) {
    out += `[${r.agent}] ${r.source}\n`;
    for (const line of r.matches) {
      out += `  ${truncate(line.trim(), 80)}\n`;
    }
    out += "\n";
  }
  if (results.length > 15) out += `  ... and ${results.length - 15} more hits`;
  return out.trimEnd();
}

function cmdSettings(args) {
  // Read memory-continuity config from openclaw.json
  const configPath = path.join(BASE, "openclaw.json");
  const raw = readFile(configPath);
  if (!raw) return "Cannot read openclaw.json";

  let config;
  try { config = JSON.parse(raw); } catch { return "Cannot parse openclaw.json"; }

  const mcConfig = config?.plugins?.entries?.["memory-continuity"]?.config
    || config?.entries?.["memory-continuity"]?.config
    || {};

  if (!args) {
    const defaults = {
      maxStateLines: { value: mcConfig.maxStateLines ?? 50, desc: "Max lines before compress warning" },
      archiveOnNew: { value: mcConfig.archiveOnNew ?? true, desc: "Archive state on /new" },
      autoExtract: { value: mcConfig.autoExtract ?? true, desc: "Auto-extract state at agent_end" },
      maxArchiveCount: { value: mcConfig.maxArchiveCount ?? 20, desc: "Max archive files kept" },
    };

    let out = "MC Settings\n─────────────────────────────\n";
    for (const [k, v] of Object.entries(defaults)) {
      out += `${k.padEnd(18)} ${String(v.value).padStart(6)}   ${v.desc}\n`;
    }

    // Show stats
    const agents = discoverAgents();
    out += "\nStats:\n";
    out += `  Agents with memory: ${agents.length}\n`;
    let totalArchives = 0;
    for (const { memDir } of agents) {
      try {
        totalArchives += fs.readdirSync(path.join(memDir, "session_archive")).filter(f => f.endsWith(".md")).length;
      } catch {}
    }
    out += `  Total archives:     ${totalArchives}\n`;
    return out.trimEnd();
  }

  // Parse "key value" for settings update
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || parts[0] === "--help" || parts[0] === "-h") {
    return "Usage: /mc settings <key> <value>\nKeys: maxStateLines, archiveOnNew, autoExtract, maxArchiveCount";
  }

  const [key, val] = parts;
  const validKeys = ["maxStateLines", "archiveOnNew", "autoExtract", "maxArchiveCount"];
  if (!validKeys.includes(key)) return `Unknown key: ${key}\nValid: ${validKeys.join(", ")}`;

  let parsed;
  if (val === "true") parsed = true;
  else if (val === "false") parsed = false;
  else if (!isNaN(Number(val))) parsed = Number(val);
  else return `Cannot parse value: ${val}`;

  // Update openclaw.json
  try {
    // Ensure path exists
    if (!config.entries) config.entries = {};
    if (!config.entries["memory-continuity"]) config.entries["memory-continuity"] = { enabled: true };
    if (!config.entries["memory-continuity"].config) config.entries["memory-continuity"].config = {};
    config.entries["memory-continuity"].config[key] = parsed;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    return `✓ ${key} = ${parsed}\n  Restart gateway to apply.`;
  } catch (e) {
    return `✗ Failed to write config: ${e.message}`;
  }
}

function cmdCompact(args) {
  const agent = args || "main";
  const memDir = resolveMemDir(agent);
  if (!memDir) return `Agent "${agent}" not found.`;

  const statePath = path.join(memDir, "CURRENT_STATE.md");
  const md = readFile(statePath);
  if (!md) return `No state for "${agent}".`;

  const lines = md.split("\n");
  const originalLen = lines.length;

  // Keep headers and first meaningful line of each section
  const compacted = [];
  let inSection = false;
  let sectionLines = 0;

  for (const line of lines) {
    if (line.startsWith("# ") || line.startsWith("> Last updated")) {
      compacted.push(line);
      inSection = false;
    } else if (line.startsWith("## ")) {
      compacted.push(line);
      inSection = true;
      sectionLines = 0;
    } else if (inSection) {
      sectionLines++;
      if (sectionLines <= 3 || line.startsWith("- ")) {
        compacted.push(line);
      }
    } else {
      compacted.push(line);
    }
  }

  // Update timestamp
  const result = compacted.join("\n")
    .replace(/^> Last updated:.*$/m, `> Last updated: ${new Date().toISOString()}`);

  fs.writeFileSync(statePath, result, "utf8");
  return `✓ Compacted "${agent}" state: ${originalLen} → ${compacted.length} lines`;
}

function cmdExport(args) {
  const agent = args || "all";
  const agents = agent === "all" ? discoverAgents() : [{ name: agent, memDir: resolveMemDir(agent) }];

  if (agents.length === 0 || !agents[0]?.memDir) return `Agent "${agent}" not found.`;

  const exportDir = path.join(BASE, "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const exportFile = path.join(exportDir, `mc-export-${stamp}.md`);

  let content = `# Memory Continuity Export\n> Exported: ${now.toISOString()}\n\n`;

  for (const { name, memDir } of agents) {
    if (!memDir) continue;
    content += `---\n# Agent: ${name}\n\n`;

    // Current state
    const state = readFile(path.join(memDir, "CURRENT_STATE.md"));
    if (state) {
      content += `## Current State\n\n${state}\n\n`;
    }

    // Archives
    const archiveDir = path.join(memDir, "session_archive");
    try {
      const files = fs.readdirSync(archiveDir).filter(f => f.endsWith(".md")).sort().reverse();
      if (files.length) {
        content += `## Archives (${files.length})\n\n`;
        for (const f of files) {
          const ac = readFile(path.join(archiveDir, f));
          if (ac) content += `### ${f.replace(".md", "")}\n\n${ac}\n\n`;
        }
      }
    } catch {}
  }

  fs.writeFileSync(exportFile, content, "utf8");
  const sizeMB = (Buffer.byteLength(content) / 1024).toFixed(1);
  return `✓ Exported to:\n  ${exportFile}\n  ${agents.length} agent(s), ${sizeMB} KB`;
}

function cmdHelp() {
  return `MC Commands (Memory Continuity)
─────────────────────────────
/mc state [agent]       View current state (default: main)
/mc state --all         Overview of all agents
/mc history [agent]     List archived sessions
/mc restore <N> [agent] Restore archive #N
/mc clear [agent]       Clear state (archives first)
/mc search <keyword>    Search across all memory
/mc settings            View MC settings
/mc settings <k> <v>    Update a setting
/mc compact [agent]     Compress state file
/mc export [agent|all]  Export memory to file`;
}

// ── Plugin entry point ──────────────────────────────────────────────────

export default function (api) {
  console.log("[mc] MC plugin loading, registering /mc command...");
  api.registerCommand({
    name: "mc",
    description: "Memory Continuity commands — state, history, search, settings, etc.",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const raw = (ctx.args || "").trim();
      const spaceIdx = raw.indexOf(" ");
      const subcmd = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
      const subargs = spaceIdx === -1 ? "" : raw.slice(spaceIdx + 1).trim();

      try {
        let text;
        switch (subcmd) {
          case "state":
            text = subargs === "--all" ? cmdStateAll() : cmdState(subargs || null);
            break;
          case "history":   text = cmdHistory(subargs || null); break;
          case "restore":   text = cmdRestore(subargs); break;
          case "clear":     text = cmdClear(subargs || null); break;
          case "search":    text = cmdSearch(subargs); break;
          case "settings":  text = cmdSettings(subargs || null); break;
          case "compact":   text = cmdCompact(subargs || null); break;
          case "export":    text = cmdExport(subargs || null); break;
          case "help": case "--help": case "-h": case "":
            text = cmdHelp(); break;
          default:
            text = `Unknown subcommand: ${subcmd}\n\n${cmdHelp()}`;
        }
        return { text: mono(text) };
      } catch (err) {
        return { text: `MC error: ${err.message}` };
      }
    },
  });
}
