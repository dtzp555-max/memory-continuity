#!/usr/bin/env bash
# post-install.sh — Flush stale skill snapshots after installing memory-continuity
#
# OpenClaw caches a "skillsSnapshot" per session. If this skill was installed
# while the gateway was stopped (or after a gateway restart), the file watcher
# won't detect the new SKILL.md and existing sessions will never refresh.
#
# This script clears stale snapshots so every session rebuilds on next turn.
#
# Usage:
#   bash scripts/post-install.sh [--agent-id <id>]
#
# Options:
#   --agent-id <id>   Agent ID (default: main)
#
# Safe to run multiple times (idempotent).

set -euo pipefail

AGENT_ID="main"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
SESSIONS_FILE="$OPENCLAW_DIR/agents/$AGENT_ID/sessions/sessions.json"

if [[ ! -f "$SESSIONS_FILE" ]]; then
  echo "No sessions file found at $SESSIONS_FILE — nothing to do."
  exit 0
fi

# Count and clear stale skillsSnapshot entries
BEFORE=$(python3 -c "
import json, sys
with open('$SESSIONS_FILE') as f:
    data = json.load(f)
count = sum(1 for v in data.values() if isinstance(v, dict) and 'skillsSnapshot' in v)
print(count)
" 2>/dev/null || echo "0")

if [[ "$BEFORE" == "0" ]]; then
  echo "No stale skill snapshots found — all sessions will discover skills normally."
  exit 0
fi

python3 -c "
import json
path = '$SESSIONS_FILE'
with open(path) as f:
    data = json.load(f)
for key in data:
    if isinstance(data[key], dict) and 'skillsSnapshot' in data[key]:
        del data[key]['skillsSnapshot']
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
"

echo "Cleared skillsSnapshot from $BEFORE session(s) in $SESSIONS_FILE"
echo "All sessions will rebuild their skill list on next turn."

# Restart gateway if running, so file watcher picks up the new SKILL.md
if command -v openclaw &>/dev/null; then
  if openclaw gateway status 2>&1 | grep -q "running"; then
    echo "Restarting gateway to activate file watcher..."
    openclaw gateway restart 2>/dev/null && echo "Gateway restarted." || echo "Gateway restart failed — try manually: openclaw gateway restart"
  fi
fi
