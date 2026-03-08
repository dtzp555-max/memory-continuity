#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

REQUIRED_SECTIONS = [
    '## In Flight',
    '## Blocked / Waiting',
    '## Recently Finished',
    '## Next',
    '## Reset Summary',
]

AGENTS_MARKERS = [
    'CURRENT_STATE.md - Your Short-Term Workbench',
    'Dual reporting protocol',
    'Execution agent → main',
    'main → Tao',
]


def result(level: str, msg: str) -> tuple[str, str]:
    print(f'{level:<5} {msg}')
    return level, msg


def line_count(path: Path) -> int:
    try:
        return len(path.read_text().splitlines())
    except Exception:
        return 0


def has_sections(path: Path) -> list[str]:
    text = path.read_text()
    missing = [s for s in REQUIRED_SECTIONS if s not in text]
    return missing


def main() -> int:
    ap = argparse.ArgumentParser(description='Check continuity/CURRENT_STATE coverage and drift.')
    ap.add_argument('--main-workspace', required=True)
    ap.add_argument('--agents-root', required=True)
    args = ap.parse_args()

    main_ws = Path(args.main_workspace)
    agents_root = Path(args.agents_root)

    failures = 0
    warns = 0

    print('continuity doctor\n')

    # main AGENTS.md
    agents_md = main_ws / 'AGENTS.md'
    if not agents_md.exists():
        failures += 1
        result('FAIL', f'missing {agents_md}')
    else:
        text = agents_md.read_text()
        missing = [m for m in AGENTS_MARKERS if m not in text]
        if missing:
            failures += 1
            result('FAIL', f'AGENTS continuity markers missing: {", ".join(missing)}')
        else:
            result('PASS', 'AGENTS continuity rules present')

    # main CURRENT_STATE
    main_cs = main_ws / 'memory' / 'CURRENT_STATE.md'
    if not main_cs.exists():
        failures += 1
        result('FAIL', 'main CURRENT_STATE missing')
    else:
        missing = has_sections(main_cs)
        if missing:
            failures += 1
            result('FAIL', f'main CURRENT_STATE missing sections: {", ".join(missing)}')
        else:
            result('PASS', 'main CURRENT_STATE sections present')
        n = line_count(main_cs)
        if n > 50:
            warns += 1
            result('WARN', f'main CURRENT_STATE too long: {n} lines (cap 50)')
        else:
            result('PASS', f'main CURRENT_STATE length ok: {n} lines')

    # agent workspaces
    checked = 0
    missing_files = []
    missing_sections = []
    oversize = []

    if agents_root.exists():
        for ws in sorted([p for p in agents_root.iterdir() if p.is_dir()]):
            checked += 1
            cs = ws / 'memory' / 'CURRENT_STATE.md'
            if not cs.exists():
                missing_files.append(ws.name)
                continue
            missing = has_sections(cs)
            if missing:
                missing_sections.append((ws.name, missing))
            n = line_count(cs)
            if n > 30:
                oversize.append((ws.name, n))

    if missing_files:
        failures += 1
        result('FAIL', f'agent CURRENT_STATE missing: {", ".join(missing_files)}')
    else:
        result('PASS', f'agent CURRENT_STATE files present: {checked}/{checked}')

    if missing_sections:
        failures += 1
        details = '; '.join(f'{name}: {", ".join(m)}' for name, m in missing_sections)
        result('FAIL', f'agent CURRENT_STATE missing sections: {details}')
    else:
        result('PASS', 'agent CURRENT_STATE sections present')

    if oversize:
        warns += 1
        details = '; '.join(f'{name}: {n} lines' for name, n in oversize)
        result('WARN', f'agent CURRENT_STATE oversize: {details}')
    else:
        result('PASS', 'agent CURRENT_STATE length caps respected')

    print('\nSummary')
    print(f'- failures: {failures}')
    print(f'- warnings: {warns}')

    if failures:
        print('\nSuggested actions:')
        print('1. create/restore missing CURRENT_STATE files')
        print('2. restore AGENTS continuity section if missing')
        print('3. trim oversized CURRENT_STATE files')
        print('4. rerun continuity doctor')
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
