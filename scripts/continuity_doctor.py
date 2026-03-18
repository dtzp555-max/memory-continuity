#!/usr/bin/env python3
"""
continuity_doctor.py — Diagnostic tool for memory-continuity skill.

Checks workspace health and reports issues. Does NOT auto-repair.

Usage:
    python3 continuity_doctor.py --workspace /path/to/workspace
    python3 continuity_doctor.py --workspace ~/.openclaw/workspace/main
"""

import argparse
import os
import sys
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Severity levels
# ---------------------------------------------------------------------------
class Severity:
    OK = "OK"
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


# ---------------------------------------------------------------------------
# Collector
# ---------------------------------------------------------------------------
class DiagnosticReport:
    def __init__(self):
        self.entries: list[tuple[str, str]] = []
        self._worst = Severity.OK

    def add(self, severity: str, message: str):
        self.entries.append((severity, message))
        rank = {Severity.OK: 0, Severity.INFO: 1, Severity.WARNING: 2, Severity.CRITICAL: 3}
        if rank.get(severity, 0) > rank.get(self._worst, 0):
            self._worst = severity

    def print_report(self):
        for severity, message in self.entries:
            tag = f"[{severity}]".ljust(12)
            print(f"{tag}{message}")
        print()
        print(f"Overall status: {self._worst}")

    @property
    def exit_code(self) -> int:
        if self._worst == Severity.CRITICAL:
            return 2
        if self._worst == Severity.WARNING:
            return 1
        return 0


# ---------------------------------------------------------------------------
# Required sections in CURRENT_STATE.md
# ---------------------------------------------------------------------------
REQUIRED_SECTIONS = [
    "Objective",
    "Current Step",
    "Key Decisions",
    "Next Action",
    "Blockers",
    "Unsurfaced Results",
]

PLACEHOLDER_PATTERNS = [
    r"\[.*?\]",  # anything in square brackets like [One sentence: ...]
]


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

def check_existence(workspace: Path, report: DiagnosticReport) -> Optional[Path]:
    """Check that memory/CURRENT_STATE.md exists."""
    state_file = workspace / "memory" / "CURRENT_STATE.md"
    if not state_file.exists():
        report.add(Severity.CRITICAL, "memory/CURRENT_STATE.md does not exist")
        return None
    report.add(Severity.OK, "memory/CURRENT_STATE.md exists")
    return state_file


def check_staleness(state_file: Path, workspace: Path, report: DiagnosticReport):
    """Check if the state file is older than the most recent activity."""
    mtime = datetime.fromtimestamp(state_file.stat().st_mtime, tz=timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - mtime).total_seconds()
    age_hours = age_seconds / 3600

    if age_hours > 24:
        report.add(
            Severity.WARNING,
            f"CURRENT_STATE.md is stale (last modified {age_hours:.1f}h ago)",
        )
    elif age_hours > 4:
        report.add(
            Severity.INFO,
            f"CURRENT_STATE.md last modified {age_hours:.1f}h ago",
        )
    else:
        report.add(Severity.OK, f"CURRENT_STATE.md is fresh ({age_hours:.1f}h old)")


def check_template_compliance(state_file: Path, report: DiagnosticReport) -> dict:
    """Check all required sections are present and not placeholder-only."""
    content = state_file.read_text(encoding="utf-8")
    sections_found: dict[str, str] = {}

    for section in REQUIRED_SECTIONS:
        # Match ## Section or ## Section\n
        pattern = rf"##\s+{re.escape(section)}\s*\n(.*?)(?=\n##\s|\Z)"
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            report.add(Severity.WARNING, f"Missing section: ## {section}")
            continue

        body = match.group(1).strip()
        sections_found[section] = body

        # Check for placeholder text
        if body and all(re.fullmatch(p, body) for p in PLACEHOLDER_PATTERNS):
            report.add(Severity.INFO, f"Section '{section}' still contains placeholder text")

    if len(sections_found) == len(REQUIRED_SECTIONS):
        report.add(Severity.OK, "Template compliance: all sections present")

    return sections_found


def check_unsurfaced_results(sections: dict, report: DiagnosticReport):
    """Check if there are unsurfaced results that need attention."""
    results = sections.get("Unsurfaced Results", "").strip().lower()
    if results and results != "none":
        report.add(
            Severity.WARNING,
            "Unsurfaced Results section is not empty — review needed",
        )
    else:
        report.add(Severity.OK, "No unsurfaced results pending")


def check_archive(workspace: Path, sections: dict, report: DiagnosticReport):
    """Check session archive consistency."""
    archive_dir = workspace / "memory" / "session_archive"

    if not archive_dir.exists() or not list(archive_dir.glob("*.md")):
        report.add(Severity.INFO, "No session archives found (first session?)")
        return

    archives = sorted(archive_dir.glob("*.md"))
    latest_archive = archives[-1]
    report.add(Severity.OK, f"Found {len(archives)} session archive(s), latest: {latest_archive.name}")

    # Compare objectives
    current_objective = sections.get("Objective", "").strip()
    archive_content = latest_archive.read_text(encoding="utf-8")
    obj_match = re.search(r"##\s+Objective\s*\n(.*?)(?=\n##\s|\Z)", archive_content, re.DOTALL)
    if obj_match:
        archive_objective = obj_match.group(1).strip()
        if archive_objective != current_objective and current_objective:
            report.add(
                Severity.INFO,
                "Archive objective differs from current objective (task switch?)",
            )


def check_tasks_alignment(workspace: Path, sections: dict, report: DiagnosticReport):
    """Optional: check if objective aligns with tasks.md if it exists."""
    tasks_file = workspace / "tasks.md"
    if not tasks_file.exists():
        return

    objective = sections.get("Objective", "").strip().lower()
    if not objective:
        return

    tasks_content = tasks_file.read_text(encoding="utf-8").lower()
    # Very rough heuristic: check if any significant word from objective appears in tasks
    words = [w for w in objective.split() if len(w) > 4]
    matches = sum(1 for w in words if w in tasks_content)
    if words and matches == 0:
        report.add(
            Severity.INFO,
            "Objective does not seem to match any content in tasks.md",
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_doctor(workspace_path: str) -> int:
    workspace = Path(workspace_path).expanduser().resolve()
    report = DiagnosticReport()

    print(f"Continuity Doctor — scanning: {workspace}")
    print("=" * 60)

    if not workspace.exists():
        report.add(Severity.CRITICAL, f"Workspace does not exist: {workspace}")
        report.print_report()
        return report.exit_code

    # Run all checks
    state_file = check_existence(workspace, report)

    if state_file:
        check_staleness(state_file, workspace, report)
        sections = check_template_compliance(state_file, report)
        check_unsurfaced_results(sections, report)
        check_archive(workspace, sections, report)
        check_tasks_alignment(workspace, sections, report)

    print()
    report.print_report()
    return report.exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Continuity Doctor — diagnose memory-continuity health"
    )
    parser.add_argument(
        "--workspace",
        required=True,
        help="Path to the OpenClaw workspace to check",
    )
    args = parser.parse_args()
    sys.exit(run_doctor(args.workspace))
