#!/usr/bin/env bash
# verify.sh — Verify memory-continuity installation (3-layer check)
#
# Usage:
#   bash scripts/verify.sh [--workspace PATH] [--sample] [--all-agents]
#
# Options:
#   --workspace PATH   Override default workspace (~/.openclaw/workspace/main)
#   --sample           Show a sample high-importance CURRENT_STATE.md
#   --all-agents       Run 3-layer check across all detected agent workspaces

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $*${RESET}"; }
warn() { echo -e "  ${YELLOW}⚠️  $*${RESET}"; }
fail() { echo -e "  ${RED}❌ $*${RESET}"; }
info() { echo -e "  ${CYAN}ℹ️  $*${RESET}"; }
header() { echo -e "\n${BOLD}$*${RESET}"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
WORKSPACE="${HOME}/.openclaw/workspace/main"
SHOW_SAMPLE=false
ALL_AGENTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      WORKSPACE="$2"; shift 2 ;;
    --sample)
      SHOW_SAMPLE=true; shift ;;
    --all-agents)
      ALL_AGENTS=true; shift ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Expand ~ in workspace path
WORKSPACE="${WORKSPACE/#\~/$HOME}"

# ---------------------------------------------------------------------------
# --sample: print example state and exit
# ---------------------------------------------------------------------------
if $SHOW_SAMPLE; then
  echo -e "\n${BOLD}Sample CURRENT_STATE.md (high-importance production task):${RESET}\n"
  cat <<'EOF'
# Current State
> Last updated: 2026-03-19T11:42:00Z

## Objective
Complete production database migration v2→v3 for user activity table (sharded, ~80M rows).

## Current Step
Migration script written and reviewed. Dry-run on staging passed.
**Not yet tested against production replica.**

## Key Decisions
- Using online schema change (pt-online-schema-change) to avoid table lock
- Backfill batch size: 5,000 rows / 500ms to stay under replication lag threshold
- Rollback plan: swap back via feature flag, no destructive drop until T+48h

## Next Action
Schedule test run against prod replica — waiting for Tao to confirm migration
window (UTC+10, Thursday 23:00). Do NOT proceed without explicit sign-off.

## Blockers
- ⚠️  BLOCKED: Tao hasn't confirmed migration window (UTC+10 Thu 23:00)
- ⚠️  Prod replica test not yet scheduled

## Risk
- Skipping production replica test → potential data loss on edge cases not covered by staging schema
- Migration window must be off-peak; violating this risks exceeding replication lag SLA (>30s triggers alert)

## Unsurfaced Results
- Staging dry-run log: /tmp/pt-osc-staging-2026-03-19.log (not yet reviewed for warnings)
EOF
  exit 0
fi

# ---------------------------------------------------------------------------
# --all-agents: detect all agent workspaces and run checks for each
# ---------------------------------------------------------------------------
OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
PLUGIN_DIR_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

detect_all_agent_workspaces() {
  if [[ ! -f "$CONFIG_FILE" ]] || ! command -v python3 &>/dev/null; then
    return 1
  fi
  python3 - "$CONFIG_FILE" "$OPENCLAW_DIR" <<'PYEOF'
import json, sys, os
config_file = sys.argv[1]
openclaw_dir = sys.argv[2]
with open(config_file) as f:
    data = json.load(f)
default_ws = data.get('defaults', {}).get('workspace', os.path.join(openclaw_dir, 'workspace', 'main'))
seen = set()
for agent in data.get('list', []):
    agent_id = agent.get('id', '')
    if not agent_id or agent_id in seen:
        continue
    seen.add(agent_id)
    name = agent.get('name', agent_id)
    workspace = agent.get('workspace', default_ws if agent_id == 'main' else os.path.join(openclaw_dir, 'workspaces', agent_id))
    workspace = os.path.expanduser(workspace)
    print('{}|{}|{}'.format(agent_id, name, workspace))
PYEOF
}

if $ALL_AGENTS; then
  echo -e "\n${BOLD}memory-continuity — Multi-Agent Verifier${RESET}"
  echo "────────────────────────────────────────────"

  AGENT_LINES=()
  while IFS= read -r line; do
    AGENT_LINES+=("$line")
  done < <(detect_all_agent_workspaces 2>/dev/null || true)

  if [[ ${#AGENT_LINES[@]} -eq 0 ]]; then
    echo -e "${RED}No agents detected. Is openclaw.json present and python3 available?${RESET}"
    exit 1
  fi

  TOTAL_PASS=0
  TOTAL_FAIL=0

  for line in "${AGENT_LINES[@]}"; do
    IFS='|' read -r agent_id agent_name agent_ws <<< "$line"
    echo -e "\n${BOLD}Agent: ${agent_name} (${agent_id})${RESET}"
    echo -e "  Workspace: ${agent_ws}"

    AGENT_ERRORS=0
    AGENT_WARNINGS=0

    # Layer 1: SKILL.md in workspace
    SKILL_PATH="${agent_ws}/skills/memory-continuity/SKILL.md"
    if [[ -f "$SKILL_PATH" ]]; then
      ok "SKILL.md installed"
    else
      fail "SKILL.md missing at ${SKILL_PATH}"
      AGENT_ERRORS=$((AGENT_ERRORS + 1))
    fi

    # Layer 2: continuity_doctor.py
    DOCTOR="${PLUGIN_DIR_SELF}/scripts/continuity_doctor.py"
    if command -v python3 &>/dev/null && [[ -f "$DOCTOR" ]]; then
      if python3 "$DOCTOR" --workspace "$agent_ws" &>/dev/null; then
        ok "continuity_doctor.py passed"
      else
        warn "continuity_doctor.py exited non-zero"
        AGENT_WARNINGS=$((AGENT_WARNINGS + 1))
      fi
    else
      warn "python3 or continuity_doctor.py unavailable — skipped"
      AGENT_WARNINGS=$((AGENT_WARNINGS + 1))
    fi

    # Layer 3: CURRENT_STATE.md
    STATE_FILE="${agent_ws}/memory/CURRENT_STATE.md"
    if [[ ! -f "$STATE_FILE" ]]; then
      warn "CURRENT_STATE.md not found (normal for new installs)"
      AGENT_WARNINGS=$((AGENT_WARNINGS + 1))
    else
      LINE_COUNT=$(grep -c '[^[:space:]]' "$STATE_FILE" || true)
      if [[ $LINE_COUNT -gt 2 ]]; then
        ok "CURRENT_STATE.md present (${LINE_COUNT} non-blank lines)"
      else
        warn "CURRENT_STATE.md appears empty or placeholder"
        AGENT_WARNINGS=$((AGENT_WARNINGS + 1))
      fi
    fi

    if [[ $AGENT_ERRORS -eq 0 ]]; then
      echo -e "  ${GREEN}→ PASS${RESET} (${AGENT_WARNINGS} warning(s))"
      TOTAL_PASS=$((TOTAL_PASS + 1))
    else
      echo -e "  ${RED}→ FAIL${RESET} (${AGENT_ERRORS} error(s), ${AGENT_WARNINGS} warning(s))"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  done

  echo ""
  echo "────────────────────────────────────────────"
  echo -e "${BOLD}Summary: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed (of ${#AGENT_LINES[@]} agents)${RESET}"
  [[ $TOTAL_FAIL -gt 0 ]] && exit 1 || exit 0
fi

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}memory-continuity — Installation Verifier${RESET}"
echo "────────────────────────────────────────────"

ERRORS=0
WARNINGS=0

# ===========================================================================
# Layer 1: Required files exist
# ===========================================================================
header "Layer 1: Required files"

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check_file() {
  local rel="$1"
  local path="${PLUGIN_DIR}/${rel}"
  if [[ -f "$path" ]]; then
    ok "$rel"
  else
    fail "$rel — NOT FOUND (expected at ${path})"
    ERRORS=$((ERRORS + 1))
  fi
}

check_file "SKILL.md"
check_file "scripts/continuity_doctor.py"
check_file "openclaw.plugin.json"

# ===========================================================================
# Layer 2: continuity_doctor.py runs without error
# ===========================================================================
header "Layer 2: Tool availability"

if ! command -v python3 &>/dev/null; then
  fail "python3 not found in PATH"
  ERRORS=$((ERRORS + 1))
else
  ok "python3 found ($(python3 --version 2>&1))"

  DOCTOR="${PLUGIN_DIR}/scripts/continuity_doctor.py"
  if [[ ! -f "$DOCTOR" ]]; then
    fail "continuity_doctor.py missing — skipping doctor check"
    ERRORS=$((ERRORS + 1))
  else
    info "Running: python3 scripts/continuity_doctor.py --workspace ${WORKSPACE}"
    echo ""
    if python3 "$DOCTOR" --workspace "$WORKSPACE" 2>&1 | sed 's/^/    /'; then
      echo ""
      ok "continuity_doctor.py exited cleanly"
    else
      echo ""
      warn "continuity_doctor.py exited with non-zero status (see output above)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
fi

# ===========================================================================
# Layer 3: CURRENT_STATE.md content check
# ===========================================================================
header "Layer 3: Workspace state"

STATE_FILE="${WORKSPACE}/memory/CURRENT_STATE.md"

if [[ ! -f "$STATE_FILE" ]]; then
  warn "CURRENT_STATE.md not found at: ${STATE_FILE}"
  warn "This is normal for a brand-new install — state will be created after your first session."
  WARNINGS=$((WARNINGS + 1))
else
  # Detect placeholder / trivial content:
  # - File is empty
  # - Only contains the header line "# Current State"
  # - Contains the phrase "No active" or "placeholder"
  CONTENT=$(cat "$STATE_FILE")
  LINE_COUNT=$(echo "$CONTENT" | grep -c '[^[:space:]]' || true)

  IS_PLACEHOLDER=false

  if [[ $LINE_COUNT -le 2 ]]; then
    IS_PLACEHOLDER=true
  elif ! echo "$CONTENT" | grep -qE '##\s+(Objective|Current Step|In Flight|Next Action|Blocked)'; then
    # Has some lines but none of the expected structured sections
    IS_PLACEHOLDER=true
  else
    # Check if the Objective section itself is trivial (placeholder text right after the heading)
    OBJECTIVE_VALUE=$(echo "$CONTENT" | awk '/^## Objective/{found=1; next} found && /^##/{exit} found && /[^[:space:]]/{print; exit}')
    if echo "$OBJECTIVE_VALUE" | grep -qiE '^\s*(no active|placeholder|todo|tbd|empty|n\/a|none|untitled)$'; then
      IS_PLACEHOLDER=true
    fi
  fi

  if $IS_PLACEHOLDER; then
    echo ""
    warn "CURRENT_STATE.md exists but appears to be empty or a placeholder."
    warn "The plugin is installed correctly, but your working state hasn't been"
    warn "captured yet. After your first real work session it will be populated"
    warn "automatically."
    echo ""
    warn "To see what a high-importance state entry looks like, run:"
    echo -e "    ${CYAN}bash scripts/verify.sh --sample${RESET}"
    WARNINGS=$((WARNINGS + 1))
  else
    ok "CURRENT_STATE.md found with substantive content (${LINE_COUNT} non-blank lines)"
    # Show last-updated line if present
    UPDATED=$(grep -m1 'Last updated' "$STATE_FILE" || true)
    [[ -n "$UPDATED" ]] && info "$UPDATED"
  fi
fi

# ===========================================================================
# Summary
# ===========================================================================
echo ""
echo "────────────────────────────────────────────"
if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All checks passed. memory-continuity is correctly installed.${RESET}"
elif [[ $ERRORS -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}Checks passed with ${WARNINGS} warning(s). Review warnings above.${RESET}"
else
  echo -e "${RED}${BOLD}${ERRORS} error(s), ${WARNINGS} warning(s). Installation may be incomplete.${RESET}"
  echo -e "${RED}Re-run the installer:  bash scripts/post-install.sh${RESET}"
fi
echo ""
