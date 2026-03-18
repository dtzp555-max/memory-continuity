#!/usr/bin/env bash
# post-install.sh — Install memory-continuity as an OpenClaw lifecycle plugin
#
# This script:
#   1. Copies the plugin to ~/.openclaw/extensions/memory-continuity/
#   2. Adds the plugin entry to openclaw.json (if not present)
#   3. Detects OpenClaw agents and installs SKILL.md to selected workspaces
#
# Usage:
#   bash scripts/post-install.sh
#
# Safe to run multiple times (idempotent).

set -euo pipefail

OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
EXTENSIONS_DIR="$OPENCLAW_DIR/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/memory-continuity"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

# Resolve the repo root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== memory-continuity plugin installer ==="
echo ""

# Step 1: Copy plugin files to extensions directory
echo "[1/3] Installing plugin to $PLUGIN_DIR ..."
mkdir -p "$EXTENSIONS_DIR"

# Remove old installation if exists
if [[ -d "$PLUGIN_DIR" || -L "$PLUGIN_DIR" ]]; then
  rm -rf "$PLUGIN_DIR"
  echo "  Removed previous installation"
fi

# Copy essential plugin files (not the entire repo)
mkdir -p "$PLUGIN_DIR"
for f in index.js openclaw.plugin.json package.json SKILL.md; do
  if [[ -f "$REPO_DIR/$f" ]]; then
    cp "$REPO_DIR/$f" "$PLUGIN_DIR/"
  fi
done
echo "  Copied plugin files"

# Step 2: Add plugin entry to openclaw.json
echo "[2/3] Configuring openclaw.json ..."
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "  WARNING: $CONFIG_FILE not found. Skipping config update."
  echo "  You'll need to manually add the plugin entry."
else
  python3 -c "
import json
path = '$CONFIG_FILE'
with open(path) as f:
    data = json.load(f)
if 'plugins' not in data:
    data['plugins'] = {}
allow_list = data['plugins'].get('allow', [])
if 'memory-continuity' not in allow_list:
    allow_list.append('memory-continuity')
    data['plugins']['allow'] = allow_list
if 'entries' not in data['plugins']:
    data['plugins']['entries'] = {}
data['plugins']['entries']['memory-continuity'] = {
    'enabled': True,
    'hooks': {
        'allowPromptInjection': True
    },
    'config': {
        'maxStateLines': 50,
        'archiveOnNew': True,
        'autoExtract': True
    }
}
if 'installs' not in data['plugins']:
    data['plugins']['installs'] = {}
data['plugins']['installs']['memory-continuity'] = {
    'source': 'path',
    'installPath': '~/.openclaw/extensions/memory-continuity',
    'sourcePath': '$REPO_DIR'
}
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('  Added plugin entry, trust config, and install record')
" 2>/dev/null || echo "  WARNING: Could not update config automatically. Add manually."
fi

# ---------------------------------------------------------------------------
# Step 3: Detect agents and install SKILL.md to selected workspaces
# ---------------------------------------------------------------------------
echo "[3/3] Detecting OpenClaw agents ..."

GRAY='\033[0;90m'
RST='\033[0m'

# detect_agents outputs lines of: INDEX|ID|DISPLAY_NAME|WORKSPACE_PATH
# Uses python3 to parse openclaw.json; falls back gracefully if unavailable.
detect_agents() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    return 1
  fi

  python3 - "$CONFIG_FILE" "$OPENCLAW_DIR" <<'PYEOF'
import json, sys, os

config_file = sys.argv[1]
openclaw_dir = sys.argv[2]

with open(config_file) as f:
    data = json.load(f)

default_ws = data.get('agents', {}).get('defaults', {}).get('workspace', os.path.join(openclaw_dir, 'workspace', 'main'))

agents = data.get('agents', {}).get('list', [])
seen = set()
idx = 1

for agent in agents:
    agent_id = agent.get('id', '')
    if not agent_id or agent_id in seen:
        continue
    seen.add(agent_id)

    name = agent.get('name', agent_id)
    workspace = agent.get('workspace', default_ws if agent_id == 'main' else None)

    # Skip agents without a resolvable workspace
    if not workspace:
        workspace = os.path.join(openclaw_dir, 'workspaces', agent_id)

    # Expand ~ in path
    workspace = os.path.expanduser(workspace)

    print('{}|{}|{}|{}'.format(idx, agent_id, name, workspace))
    idx += 1

PYEOF
}

# Collect ALL detected agents (including non-alive) into arrays
ALL_AGENT_IDS=()
ALL_AGENT_NAMES=()
ALL_AGENT_WORKSPACES=()

if command -v python3 &>/dev/null && [[ -f "$CONFIG_FILE" ]]; then
  while IFS='|' read -r idx agent_id agent_name workspace; do
    ALL_AGENT_IDS+=("$agent_id")
    ALL_AGENT_NAMES+=("$agent_name")
    ALL_AGENT_WORKSPACES+=("$workspace")
  done < <(detect_agents 2>/dev/null || true)
fi

# Filter to alive agents (workspace directory exists)
AGENT_IDS=()
AGENT_NAMES=()
AGENT_WORKSPACES=()
SKIPPED=0

for i in "${!ALL_AGENT_IDS[@]}"; do
  if [[ -d "${ALL_AGENT_WORKSPACES[$i]}" ]]; then
    AGENT_IDS+=("${ALL_AGENT_IDS[$i]}")
    AGENT_NAMES+=("${ALL_AGENT_NAMES[$i]}")
    AGENT_WORKSPACES+=("${ALL_AGENT_WORKSPACES[$i]}")
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

install_skill_to_workspace() {
  local workspace="$1"
  local skill_dest="${workspace}/skills/memory-continuity"
  mkdir -p "$skill_dest"
  cp "$REPO_DIR/SKILL.md" "$skill_dest/SKILL.md"
  echo "  Installed → ${skill_dest}/SKILL.md"
}

if [[ ${#AGENT_IDS[@]} -eq 0 && ${#ALL_AGENT_IDS[@]} -gt 0 ]]; then
  # Config has agents but none are alive
  echo ""
  echo "  Found ${#ALL_AGENT_IDS[@]} agent(s) in config but their workspace directories don't exist yet."
  echo "  You may need to initialize them first."
  echo ""
  printf "  Enter workspace path to install SKILL.md (or press Enter to skip): "
  read -r FALLBACK_WS
  if [[ -n "$FALLBACK_WS" ]]; then
    FALLBACK_WS="${FALLBACK_WS/#\~/$HOME}"
    install_skill_to_workspace "$FALLBACK_WS"
  else
    echo "  Skipped SKILL.md installation."
  fi
elif [[ ${#AGENT_IDS[@]} -eq 0 ]]; then
  # No agents at all — ask user for a workspace path
  echo "  No agents detected in openclaw.json (file missing or parse error)."
  echo ""
  printf "  Enter workspace path to install SKILL.md (or press Enter to skip): "
  read -r FALLBACK_WS
  if [[ -n "$FALLBACK_WS" ]]; then
    FALLBACK_WS="${FALLBACK_WS/#\~/$HOME}"
    install_skill_to_workspace "$FALLBACK_WS"
  else
    echo "  Skipped SKILL.md installation."
  fi
else
  # Show numbered list — alive agents first, then skipped summary
  echo ""
  echo "  Found ${#AGENT_IDS[@]} alive agent(s):"
  for i in "${!AGENT_IDS[@]}"; do
    num=$((i + 1))
    printf "    [%d] %s  (%s)\n" "$num" "${AGENT_NAMES[$i]}" "${AGENT_WORKSPACES[$i]}"
  done

  # Show skipped (non-alive) agents in gray
  if [[ $SKIPPED -gt 0 ]]; then
    echo ""
    printf "  ${GRAY}Skipped %d agent(s) with missing workspace directories:${RST}\n" "$SKIPPED"
    for i in "${!ALL_AGENT_IDS[@]}"; do
      if [[ ! -d "${ALL_AGENT_WORKSPACES[$i]}" ]]; then
        printf "    ${GRAY}  %s  (%s)${RST}\n" "${ALL_AGENT_NAMES[$i]}" "${ALL_AGENT_WORKSPACES[$i]}"
      fi
    done
  fi

  echo ""
  echo "  Install to: [A]ll alive agents (default) / [1,2,...] specific / [Q]uit"
  printf "  > (10s timeout, Enter or no input = All) "

  # Auto-select All if stdin is not a tty (pipe/CI) or on timeout
  if [[ ! -t 0 ]]; then
    SELECTION="A"
    echo "(non-interactive: auto-selecting All)"
  elif read -t 10 -r SELECTION; then
    # User provided input (possibly empty = Enter)
    : # SELECTION is set
  else
    # Timeout — default to All
    echo ""
    echo "  (timeout — defaulting to All)"
    SELECTION=""
  fi

  # Empty input (Enter or timeout) defaults to All
  if [[ -z "$SELECTION" ]]; then
    SELECTION="A"
  fi

  case "${SELECTION^^}" in
    A|ALL)
      for i in "${!AGENT_IDS[@]}"; do
        install_skill_to_workspace "${AGENT_WORKSPACES[$i]}"
      done
      ;;
    Q|QUIT)
      echo "  Skipped SKILL.md installation."
      ;;
    *)
      # Parse comma-separated numbers
      IFS=',' read -ra PICKS <<< "$SELECTION"
      INSTALLED=0
      for pick in "${PICKS[@]}"; do
        pick="${pick// /}"  # trim spaces
        if [[ "$pick" =~ ^[0-9]+$ ]]; then
          idx=$((pick - 1))
          if [[ $idx -ge 0 && $idx -lt ${#AGENT_IDS[@]} ]]; then
            install_skill_to_workspace "${AGENT_WORKSPACES[$idx]}"
            INSTALLED=$((INSTALLED + 1))
          else
            echo "  WARNING: No agent at index $pick — skipped."
          fi
        else
          echo "  WARNING: Invalid selection '$pick' — skipped."
        fi
      done
      if [[ $INSTALLED -eq 0 ]]; then
        echo "  No valid selections — SKILL.md not installed."
      fi
      ;;
  esac
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Verify with:"
echo "  bash scripts/verify.sh"
echo "  bash scripts/verify.sh --all-agents"
echo ""
echo "Test with:"
echo "  1. Tell your agent something memorable"
echo "  2. Send /new"
echo "  3. Ask what you told it"
