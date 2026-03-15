#!/usr/bin/env bash
# post-install.sh — Install memory-continuity as an OpenClaw lifecycle plugin
#
# This script:
#   1. Copies the plugin to ~/.openclaw/extensions/memory-continuity/
#   2. Adds the plugin entry to openclaw.json (if not present)
#   3. Restarts the gateway
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
for f in index.js openclaw.plugin.json SKILL.md; do
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
  # Check if memory-continuity entry already exists
  if python3 -c "
import json, sys
with open('$CONFIG_FILE') as f:
    data = json.load(f)
entries = data.get('plugins', {}).get('entries', {})
if 'memory-continuity' in entries:
    print('exists')
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
    echo "  Plugin entry already exists in config"
  else
    # Add the plugin entry
    python3 -c "
import json
path = '$CONFIG_FILE'
with open(path) as f:
    data = json.load(f)
if 'plugins' not in data:
    data['plugins'] = {}
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
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('  Added plugin entry to config')
" 2>/dev/null || echo "  WARNING: Could not update config automatically. Add manually."
  fi
fi

# Step 3: Restart gateway
echo "[3/3] Restarting gateway ..."
if command -v openclaw &>/dev/null; then
  if openclaw gateway status 2>&1 | grep -q "running"; then
    openclaw gateway restart 2>/dev/null && echo "  Gateway restarted" || echo "  Gateway restart failed — try: openclaw gateway restart"
  else
    echo "  Gateway not running — start it with: openclaw gateway start"
  fi
else
  echo "  openclaw command not found — install OpenClaw first"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Verify with:"
echo "  openclaw gateway restart 2>&1 | grep memory-continuity"
echo ""
echo "Test with:"
echo "  1. Tell your agent something memorable"
echo "  2. Send /new"
echo "  3. Ask what you told it"
