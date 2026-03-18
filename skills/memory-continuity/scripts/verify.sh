#!/usr/bin/env bash
# verify.sh — Verify memory-continuity skill is installed and working correctly
#
# Usage:
#   bash scripts/verify.sh [--workspace <path>] [--agent-id <id>]
#
# Options:
#   --workspace <path>   Agent workspace to verify (default: ~/.openclaw/workspace/main)
#   --agent-id <id>      Agent ID to check skill registration (default: main)
#   --sample             Print a sample high-stakes CURRENT_STATE.md and exit
#
# Exit codes:
#   0 = all checks passed
#   1 = warnings (skill works but something needs attention)
#   2 = critical failure (skill is not functioning)

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
WORKSPACE="${HOME}/.openclaw/workspace/main"
AGENT_ID="main"
SAMPLE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --agent-id)  AGENT_ID="$2";  shift 2 ;;
    --sample)    SAMPLE_ONLY=true; shift ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

WORKSPACE="${WORKSPACE/#\~/$HOME}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*"; }
info() { echo -e "  ${CYAN}ℹ${RESET} $*"; }

WARNINGS=0
FAILURES=0

pass_warn() { WARNINGS=$((WARNINGS + 1)); warn "$@"; }
pass_fail() { FAILURES=$((FAILURES + 1)); fail "$@"; }

# ── Sample mode ─────────────────────────────────────────────────────────────
if $SAMPLE_ONLY; then
  cat <<'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sample HIGH-STAKES CURRENT_STATE.md
(This is what makes an agent surface state instead of ignoring it)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Current State
> Last updated: 2026-03-19T07:30:00+10:00

## Objective
Deploy ocp v0.4.0 to production — mid-rollout, 30% traffic on new version

## Current Step
Blue-green deployment in progress. New pod (ocp-v040) is healthy but
/health endpoint shows elevated latency (340ms vs baseline 80ms).
Root cause not yet found. Rollback is armed but not triggered.

## Key Decisions
- Rollback threshold: p99 latency > 500ms for 5 consecutive minutes
- Traffic split: 30% new / 70% old (Tao approved, 2026-03-19 07:15)
- Do NOT fully cut over until latency root cause is confirmed

## Next Action
Check ocp-v040 logs for slow Claude API calls:
  kubectl logs -l app=ocp-v040 --tail=200 | grep "duration_ms"

## Blockers
None — waiting on log analysis results

## Unsurfaced Results
None
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY this works: concrete system at risk, named versions, specific
numbers, clear next command, time-stamped decision. An agent reading
this knows exactly what to do — it will ALWAYS surface this.

WHY placeholder content fails: "[One sentence about what you're doing]"
reads as template noise. Agents treat it as "nothing important here."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
  exit 0
fi

# ── Header ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}memory-continuity verify${RESET}"
echo -e "Workspace : ${WORKSPACE}"
echo -e "Agent ID  : ${AGENT_ID}"
echo -e "Skill dir : ${SKILL_DIR}"
echo ""

# ============================================================================
# LAYER 1: Static — skill files
# ============================================================================
echo -e "${BOLD}── Layer 1: Skill files ──────────────────────────────────────────${RESET}"

for f in SKILL.md skill.json scripts/continuity_doctor.py scripts/post-install.sh references/template.md; do
  if [[ -f "${SKILL_DIR}/${f}" ]]; then
    ok "${f}"
  else
    pass_fail "${f} is missing"
  fi
done

# Validate skill.json
if command -v python3 &>/dev/null && [[ -f "${SKILL_DIR}/skill.json" ]]; then
  if python3 -c "import json,sys; json.load(open('${SKILL_DIR}/skill.json'))" 2>/dev/null; then
    ok "skill.json is valid JSON"
  else
    pass_fail "skill.json is not valid JSON"
  fi
fi

echo ""

# ============================================================================
# LAYER 2: Static — doctor tool correctness
# ============================================================================
echo -e "${BOLD}── Layer 2: Doctor tool ──────────────────────────────────────────${RESET}"

TMPDIR_BASE="$(mktemp -d /tmp/mc-verify-XXXXXX)"
trap 'rm -rf "$TMPDIR_BASE"' EXIT

DOCTOR="${SKILL_DIR}/scripts/continuity_doctor.py"

# Test 2a: MISSING file → should exit 2 (CRITICAL)
WORKSPACE_MISSING="${TMPDIR_BASE}/missing"
mkdir -p "${WORKSPACE_MISSING}/memory"
OUT=$(python3 "$DOCTOR" --workspace "$WORKSPACE_MISSING" 2>&1) || true
if echo "$OUT" | grep -q "CRITICAL"; then
  ok "Doctor correctly reports CRITICAL when CURRENT_STATE.md is missing"
else
  pass_fail "Doctor failed to report CRITICAL for missing file"
fi

# Test 2b: PLACEHOLDER content → should flag INFO/WARNING
WORKSPACE_PLACEHOLDER="${TMPDIR_BASE}/placeholder"
mkdir -p "${WORKSPACE_PLACEHOLDER}/memory"
cat > "${WORKSPACE_PLACEHOLDER}/memory/CURRENT_STATE.md" << 'PLACEHOLDER'
# Current State
> Last updated: 2099-01-01T00:00:00Z

## Objective
[One sentence: what are we trying to accomplish]

## Current Step
[What step are we on]

## Key Decisions
- [Decision placeholder]

## Next Action
[Exactly what should happen next]

## Blockers
None

## Unsurfaced Results
None
PLACEHOLDER
OUT=$(python3 "$DOCTOR" --workspace "$WORKSPACE_PLACEHOLDER" 2>&1) || true
if echo "$OUT" | grep -qE "INFO|WARNING"; then
  ok "Doctor correctly flags placeholder content (agents won't surface this)"
else
  pass_warn "Doctor did not flag placeholder content — agents may ignore it"
fi

# Test 2c: HIGH-STAKES content → should exit 0 (healthy)
WORKSPACE_GOOD="${TMPDIR_BASE}/good"
mkdir -p "${WORKSPACE_GOOD}/memory"
cat > "${WORKSPACE_GOOD}/memory/CURRENT_STATE.md" << 'HIGHSTAKES'
# Current State
> Last updated: 2099-01-01T00:00:00Z

## Objective
Deploy ocp v0.4.0 to production — mid-rollout, 30% traffic on new version

## Current Step
Blue-green deployment in progress. New pod healthy but latency elevated (340ms vs 80ms baseline).
Root cause investigation in progress. Rollback armed.

## Key Decisions
- Rollback threshold: p99 latency > 500ms for 5 consecutive minutes
- Traffic split: 30% new / 70% old (approved 2026-03-19 07:15)

## Next Action
kubectl logs -l app=ocp-v040 --tail=200 | grep "duration_ms"

## Blockers
None

## Unsurfaced Results
None
HIGHSTAKES
EXIT_CODE=0
OUT=$(python3 "$DOCTOR" --workspace "$WORKSPACE_GOOD" 2>&1) || EXIT_CODE=$?
if [[ $EXIT_CODE -le 1 ]]; then
  ok "Doctor passes high-stakes content (agents will surface this on recovery)"
else
  pass_fail "Doctor incorrectly rejects valid high-stakes content (exit $EXIT_CODE)"
  echo "    Doctor output:"
  echo "$OUT" | sed 's/^/      /'
fi

# Test 2d: UNSURFACED RESULTS → should flag WARNING
WORKSPACE_UNSURFACED="${TMPDIR_BASE}/unsurfaced"
mkdir -p "${WORKSPACE_UNSURFACED}/memory"
cat > "${WORKSPACE_UNSURFACED}/memory/CURRENT_STATE.md" << 'UNSURFACED'
# Current State
> Last updated: 2099-01-01T00:00:00Z

## Objective
Deploy ocp to production

## Current Step
Codex worker returned deployment report, not yet shown to user.

## Key Decisions
- Deploy window confirmed

## Next Action
Show Codex result to Tao

## Blockers
None

## Unsurfaced Results
Codex finished: 3 files changed, tests passed, PR #42 created.
UNSURFACED
OUT=$(python3 "$DOCTOR" --workspace "$WORKSPACE_UNSURFACED" 2>&1) || true
if echo "$OUT" | grep -q "WARNING"; then
  ok "Doctor correctly warns on non-empty Unsurfaced Results"
else
  pass_warn "Doctor did not warn on non-empty Unsurfaced Results"
fi

echo ""

# ============================================================================
# LAYER 3: Live workspace check
# ============================================================================
echo -e "${BOLD}── Layer 3: Your workspace (${WORKSPACE}) ──────────────────────────${RESET}"

STATE_FILE="${WORKSPACE}/memory/CURRENT_STATE.md"

if [[ ! -f "$STATE_FILE" ]]; then
  info "No CURRENT_STATE.md found — this is normal for a fresh install"
  info "Create one when you start a task: it's how the agent remembers across sessions"
  info "Run: bash scripts/verify.sh --sample  to see what good content looks like"
else
  EXIT_CODE=0
  python3 "$DOCTOR" --workspace "$WORKSPACE" 2>&1 | sed 's/^/  /' || EXIT_CODE=$?
  if [[ $EXIT_CODE -eq 0 ]]; then
    ok "Live workspace is healthy"
  elif [[ $EXIT_CODE -eq 1 ]]; then
    warn "Live workspace has warnings (see above)"
    WARNINGS=$((WARNINGS + 1))
  else
    fail "Live workspace has critical issues (see above)"
    FAILURES=$((FAILURES + 1))
  fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BOLD}── Result ────────────────────────────────────────────────────────${RESET}"

if [[ $FAILURES -gt 0 ]]; then
  echo -e "  ${RED}${BOLD}FAILED${RESET} — ${FAILURES} critical issue(s), ${WARNINGS} warning(s)"
  echo ""
  echo "  The skill is not functioning correctly. Check errors above."
  exit 2
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}WARNINGS${RESET} — ${WARNINGS} issue(s) found"
  echo ""
  echo "  The skill works but needs attention. Review warnings above."
  exit 1
else
  echo -e "  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET}"
  echo ""
  echo "  memory-continuity is installed and working correctly."
  echo ""
  echo "  Quick test:"
  echo "    1. Start a task with your agent"
  echo "    2. Send /new to reset the session"
  echo "    3. Send 'continue' or '刚才说到哪了'"
  echo "    4. The agent should surface your task state — not ask what you were doing"
  echo ""
  echo "  Tip: run --sample to see what high-stakes content looks like."
  exit 0
fi
