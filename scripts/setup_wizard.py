#!/usr/bin/env python3
# setup_wizard.py — Interactive post-install wizard for memory-continuity skill
#
# Guides the user through:
#   Step 1/4: Select default model
#   Step 2/4: Configure per-agent models
#   Step 3/4: Review changes + OCP check
#   Step 4/4: Restart gateway
#
# Usage:
#   python3 scripts/setup_wizard.py
#
# Requires Python 3.6+

import sys
import os
import json
import subprocess
import termios
import tty
import signal

# ---------------------------------------------------------------------------
# Terminal colors (ANSI)
# ---------------------------------------------------------------------------
GREEN  = "\033[32m"
YELLOW = "\033[33m"
CYAN   = "\033[36m"
RED    = "\033[31m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

def green(s):  return f"{GREEN}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def cyan(s):   return f"{CYAN}{s}{RESET}"
def red(s):    return f"{RED}{s}{RESET}"
def bold(s):   return f"{BOLD}{s}{RESET}"
def dim(s):    return f"{DIM}{s}{RESET}"

# ---------------------------------------------------------------------------
# Key reading (raw terminal, no curses dependency)
# ---------------------------------------------------------------------------
UP_ARROW    = "UP"
DOWN_ARROW  = "DOWN"
ENTER_KEY   = "ENTER"
CTRL_C      = "CTRL_C"

def _read_key():
    """Read a single keypress from stdin. Returns a key name string."""
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == "\x03":
            return CTRL_C
        if ch in ("\r", "\n"):
            return ENTER_KEY
        if ch == "\x1b":
            # Escape sequence — read more
            ch2 = sys.stdin.read(1)
            if ch2 == "[":
                ch3 = sys.stdin.read(1)
                if ch3 == "A":
                    return UP_ARROW
                if ch3 == "B":
                    return DOWN_ARROW
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)

# ---------------------------------------------------------------------------
# Clean exit on Ctrl+C anywhere
# ---------------------------------------------------------------------------
def _handle_sigint(sig, frame):
    print(f"\n\n{yellow('已取消，未做任何修改')}")
    sys.exit(0)

signal.signal(signal.SIGINT, _handle_sigint)

# ---------------------------------------------------------------------------
# Arrow-key menu selector
# ---------------------------------------------------------------------------
def arrow_select(prompt, options, default_index=0):
    """
    Display a list of options with arrow-key navigation.
    Returns the selected index, or raises SystemExit on Ctrl+C.
    """
    selected = default_index
    n = len(options)

    # Hide cursor
    sys.stdout.write("\033[?25l")
    sys.stdout.flush()

    def _render():
        # Move cursor up to re-draw
        sys.stdout.write(f"\033[{n}A\r")
        for i, opt in enumerate(options):
            if i == selected:
                prefix = f"  {CYAN}▶ {BOLD}"
                suffix = RESET
            else:
                prefix = "    "
                suffix = ""
            sys.stdout.write(f"\r{prefix}{opt}{suffix}\n")
        sys.stdout.flush()

    # Initial render
    if prompt:
        print(prompt)
    for i, opt in enumerate(options):
        print(f"    {opt}")

    try:
        while True:
            _render()
            key = _read_key()
            if key == CTRL_C:
                sys.stdout.write("\033[?25h")
                sys.stdout.flush()
                print(f"\n\n{yellow('已取消，未做任何修改')}")
                sys.exit(0)
            elif key == UP_ARROW:
                selected = (selected - 1) % n
            elif key == DOWN_ARROW:
                selected = (selected + 1) % n
            elif key == ENTER_KEY:
                break
    finally:
        sys.stdout.write("\033[?25h")
        sys.stdout.flush()

    return selected

# ---------------------------------------------------------------------------
# Yes/No prompt
# ---------------------------------------------------------------------------
def yes_no(prompt, default_yes=True):
    """Ask a yes/no question. Returns True for yes."""
    hint = "[Y/n]" if default_yes else "[y/N]"
    while True:
        try:
            ans = input(f"{prompt} {hint}: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print(f"\n\n{yellow('已取消，未做任何修改')}")
            sys.exit(0)
        if ans == "":
            return default_yes
        if ans in ("y", "yes"):
            return True
        if ans in ("n", "no"):
            return False
        print(yellow("  请输入 Y 或 N"))

# ---------------------------------------------------------------------------
# Progress header
# ---------------------------------------------------------------------------
def print_step(n, total, title):
    print()
    print(bold(cyan(f"步骤 {n}/{total}: {title}")))
    print(cyan("─" * 56))

# ---------------------------------------------------------------------------
# Find openclaw.json
# ---------------------------------------------------------------------------
OPENCLAW_JSON_PATHS = [
    os.path.expanduser("~/.openclaw/openclaw.json"),
    "/etc/openclaw/openclaw.json",
]

def find_openclaw_json():
    for p in OPENCLAW_JSON_PATHS:
        if os.path.isfile(p):
            return p
    return None

def load_config(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def save_config(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

# ---------------------------------------------------------------------------
# Model list
# ---------------------------------------------------------------------------
MODELS = [
    ("claude-sonnet-4-6", "推荐：综合能力最强，速度均衡"),
    ("claude-opus-4-6",   "能力最强，适合复杂任务，较慢"),
    ("claude-haiku-4-5",  "速度最快，适合简单任务"),
]
KEEP_CURRENT = "（保持当前设置）"
KEEP_UNCHANGED = "（保持不变）"

def model_display_options(include_keep_current=False, include_keep_unchanged=False):
    lines = []
    for m, desc in MODELS:
        lines.append(f"{m:<25} {dim(desc)}")
    if include_keep_current:
        lines.append(KEEP_CURRENT)
    if include_keep_unchanged:
        lines.append(KEEP_UNCHANGED)
    return lines

def model_values(include_keep_current=False, include_keep_unchanged=False):
    vals = [m for m, _ in MODELS]
    if include_keep_current:
        vals.append(None)  # None = keep current
    if include_keep_unchanged:
        vals.append(None)
    return vals

# ---------------------------------------------------------------------------
# Step 1: Default model selection
# ---------------------------------------------------------------------------
def step1_default_model(config):
    print_step(1, 4, "选择默认 Model")
    print()
    print("┌─────────────────────────────────────────────────────┐")
    print("│  选择 OpenClaw 默认 Model                           │")
    print("│                                                      │")
    print("│  claude-sonnet-4-6  ← 推荐：综合能力最强，速度均衡  │")
    print("│  claude-opus-4-6       能力最强，适合复杂任务，较慢  │")
    print("│  claude-haiku-4-5      速度最快，适合简单任务        │")
    print("│  （保持当前设置）                                    │")
    print("└─────────────────────────────────────────────────────┘")
    print()

    current = (config
               .get("agents", {})
               .get("defaults", {})
               .get("model", {})
               .get("primary", None))

    if current:
        print(f"  {dim('当前默认 Model:')} {cyan(current)}")
    else:
        print(f"  {dim('当前默认 Model:')} {yellow('(未设置)')}")
    print()

    # Find default selection index
    default_idx = len(MODELS)  # default: keep current
    if current:
        for i, (m, _) in enumerate(MODELS):
            if m == current:
                default_idx = i
                break

    options = model_display_options(include_keep_current=True)
    print(f"  {bold('使用 ↑↓ 方向键选择，Enter 确认:')}")
    print()
    idx = arrow_select(None, options, default_index=default_idx)

    if idx >= len(MODELS):
        # Keep current
        chosen_model = current  # may be None
        print(f"\n  {green('✓')} 保持当前设置: {cyan(current) if current else yellow('(未设置)')}")
        return chosen_model, False  # (value, changed)
    else:
        chosen_model = MODELS[idx][0]
        changed = (chosen_model != current)
        print(f"\n  {green('✓')} 选择: {cyan(chosen_model)}")
        return chosen_model, changed

# ---------------------------------------------------------------------------
# Step 2: Agent model configuration
# ---------------------------------------------------------------------------
def step2_agent_config(config, default_model):
    print_step(2, 4, "Agent Model 配置")
    print()

    agent_options = [
        "不修改任何 Agent（默认）",
        "全部按默认 Model 修改",
        "逐一配置每个 Agent",
    ]
    print(f"  {bold('选择配置方式:')}")
    print()
    mode_idx = arrow_select(None, agent_options, default_index=0)
    print()

    agents = config.get("agents", {}).get("list", [])
    agent_changes = {}  # agent_id -> {"primary": ..., "fallback": ...}

    if mode_idx == 0:
        print(f"  {green('✓')} 不修改任何 Agent")
        return agent_changes

    if mode_idx == 1:
        # Apply default model to all agents
        if not default_model:
            print(f"  {yellow('⚠️  未设置默认 Model，跳过批量修改')}")
            return agent_changes
        for agent in agents:
            aid = agent.get("id", "")
            if not aid:
                continue
            current_primary = (agent.get("model", {}) or {}).get("primary", None)
            if current_primary != default_model:
                agent_changes[aid] = {"primary": default_model, "fallback": None, "keep_fallback": True}
        print(f"  {green('✓')} 已将 {len(agent_changes)} 个 Agent 的 primary 设为 {cyan(default_model)}")
        return agent_changes

    # mode_idx == 2: configure one by one
    if not agents:
        print(f"  {yellow('openclaw.json 中没有找到 Agent 列表')}")
        return agent_changes

    for agent in agents:
        aid = agent.get("id", "")
        aname = agent.get("name", aid)
        if not aid:
            continue

        cur_model_block = agent.get("model", {}) or {}
        cur_primary  = cur_model_block.get("primary", None)
        cur_fallback = cur_model_block.get("fallback", None)

        print()
        print(f"  {bold(cyan('Agent:'))} {aname} ({dim(aid)})")
        print(f"    current primary:  {cyan(cur_primary) if cur_primary else yellow('(未设置)')}")
        print(f"    current fallback: {cyan(cur_fallback) if cur_fallback else yellow('(未设置)')}")
        print()

        # Pick primary
        print(f"    {bold('选择新 primary Model (↑↓ Enter):')}")
        print()
        primary_options = model_display_options(include_keep_unchanged=True)
        primary_vals    = model_values(include_keep_unchanged=True)
        # Default: keep unchanged
        p_default = len(MODELS)
        if cur_primary:
            for i, (m, _) in enumerate(MODELS):
                if m == cur_primary:
                    p_default = i
                    break

        p_idx = arrow_select(None, primary_options, default_index=p_default)
        new_primary = primary_vals[p_idx] if p_idx < len(MODELS) else cur_primary
        print(f"\n    {green('✓')} primary: {cyan(new_primary) if new_primary else yellow('(保持不变)')}")

        # Pick fallback
        print()
        print(f"    {bold('选择新 fallback Model (↑↓ Enter):')}")
        print()
        fallback_options = model_display_options() + ["（跳过 / 不设置 fallback）"]
        f_default = len(MODELS)  # skip
        if cur_fallback:
            for i, (m, _) in enumerate(MODELS):
                if m == cur_fallback:
                    f_default = i
                    break

        f_idx = arrow_select(None, fallback_options, default_index=f_default)
        if f_idx < len(MODELS):
            new_fallback = MODELS[f_idx][0]
        else:
            new_fallback = cur_fallback  # keep existing

        print(f"\n    {green('✓')} fallback: {cyan(new_fallback) if new_fallback else yellow('(保持不变)')}")

        # Record changes only if something actually differs
        primary_changed  = (new_primary  is not None and new_primary  != cur_primary)
        fallback_changed = (new_fallback is not None and new_fallback != cur_fallback)
        if primary_changed or fallback_changed:
            agent_changes[aid] = {
                "primary":  new_primary  if primary_changed  else cur_primary,
                "fallback": new_fallback if fallback_changed else cur_fallback,
            }

        # Ask whether to continue to next agent
        print()
        try:
            cont = input(f"  还需要修改其他 Agent 吗？[Y/n]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print(f"\n\n{yellow('已取消，未做任何修改')}")
            sys.exit(0)
        if cont in ("n", "no"):
            break

    return agent_changes

# ---------------------------------------------------------------------------
# Step 3: Summary + OCP check + confirm
# ---------------------------------------------------------------------------
OCP_MODELS_NEEDING_PROXY = ("claude-local", "claude-sonnet", "claude-opus", "claude-haiku")

def _needs_ocp(model_name):
    if not model_name:
        return False
    return any(kw in model_name for kw in OCP_MODELS_NEEDING_PROXY)

def _ocp_running():
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "3", "http://localhost:3456/health"],
            capture_output=True, text=True
        )
        return result.returncode == 0 and result.stdout.strip() != ""
    except Exception:
        return False

def step3_summary_confirm(config, new_default_model, default_changed, agent_changes):
    print_step(3, 4, "确认修改")
    print()

    # Build summary lines
    current_default = (config
                       .get("agents", {})
                       .get("defaults", {})
                       .get("model", {})
                       .get("primary", None))

    has_any_change = default_changed or bool(agent_changes)

    if not has_any_change:
        return False  # caller will handle "no changes" message

    print(f"  {bold('即将应用以下修改:')}")
    print()

    if default_changed:
        old_str = cyan(current_default) if current_default else yellow("(未设置)")
        new_str = cyan(new_default_model)
        print(f"    {bold('[defaults]')}  {old_str}  →  {new_str}")

    agents = config.get("agents", {}).get("list", [])
    agent_map = {a.get("id", ""): a for a in agents if a.get("id")}

    for aid, change in agent_changes.items():
        agent = agent_map.get(aid, {})
        cur_primary = (agent.get("model", {}) or {}).get("primary", None)
        new_primary = change.get("primary", cur_primary)
        old_str = cyan(cur_primary) if cur_primary else yellow("(未设置)")
        new_str = cyan(new_primary) if new_primary else yellow("(未设置)")
        aname = agent.get("name", aid)
        if cur_primary == new_primary:
            print(f"    {bold(aname + ':')}{'':4}不变")
        else:
            print(f"    {bold(aname + ':')}{'':4}{old_str}  →  {new_str}")

    print()

    # OCP check
    all_new_models = []
    if default_changed and new_default_model:
        all_new_models.append(new_default_model)
    for aid, change in agent_changes.items():
        if change.get("primary"):
            all_new_models.append(change["primary"])
        if change.get("fallback"):
            all_new_models.append(change["fallback"])

    needs_ocp = any(_needs_ocp(m) for m in all_new_models)
    if needs_ocp and not _ocp_running():
        print(f"  {yellow('⚠️  检测到你选择的 Model 需要 openclaw-claude-proxy (ocp)')}")
        print(f"  {yellow('   但 ocp 目前未运行。建议先安装并启动 ocp。')}")
        print()
        try:
            ans = input(f"  继续 [c] / 退出查看 ocp 安装文档 [q]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print(f"\n\n{yellow('已取消，未做任何修改')}")
            sys.exit(0)
        if ans in ("q", "quit", "exit"):
            print()
            print(f"  {cyan('请参考 ocp 安装文档: https://github.com/openclaw/openclaw-claude-proxy')}")
            print(f"  {yellow('已退出，未做任何修改')}")
            sys.exit(0)

    confirmed = yes_no("  确认应用？", default_yes=True)
    return confirmed

# ---------------------------------------------------------------------------
# Apply changes to openclaw.json
# ---------------------------------------------------------------------------
def apply_changes(config, new_default_model, default_changed, agent_changes):
    if default_changed and new_default_model is not None:
        agents_block = config.setdefault("agents", {})
        defaults_block = agents_block.setdefault("defaults", {})
        model_block = defaults_block.setdefault("model", {})
        model_block["primary"] = new_default_model

    if agent_changes:
        agents_list = config.get("agents", {}).get("list", [])
        for agent in agents_list:
            aid = agent.get("id", "")
            if aid in agent_changes:
                change = agent_changes[aid]
                if "model" not in agent or agent["model"] is None:
                    agent["model"] = {}
                if change.get("primary") is not None:
                    agent["model"]["primary"] = change["primary"]
                if change.get("fallback") is not None:
                    agent["model"]["fallback"] = change["fallback"]

# ---------------------------------------------------------------------------
# Step 4: Restart gateway
# ---------------------------------------------------------------------------
def step4_restart_gateway():
    print_step(4, 4, "重启 Gateway")
    print()
    restart = yes_no("  配置已更新。是否立即重启 Gateway 以使配置生效？", default_yes=True)
    if not restart:
        print(f"  {dim('跳过重启。请手动运行: openclaw gateway restart')}")
        return

    print(f"  {cyan('正在执行: openclaw gateway restart ...')}")
    try:
        result = subprocess.run(
            ["openclaw", "gateway", "restart"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"  {green('✓ Gateway 重启成功')}")
            if result.stdout.strip():
                print(f"  {dim(result.stdout.strip())}")
        else:
            print(f"  {yellow('⚠️  Gateway 重启返回非零退出码')}")
            if result.stderr.strip():
                print(f"  {red(result.stderr.strip())}")
    except FileNotFoundError:
        print(f"  {yellow('⚠️  未找到 openclaw 命令。请手动重启 Gateway。')}")
    except Exception as e:
        print(f"  {red(f'重启失败: {e}')}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print()
    print(bold(cyan("╔══════════════════════════════════════════════════════╗")))
    print(bold(cyan("║   OpenClaw Memory-Continuity 配置向导                ║")))
    print(bold(cyan("╚══════════════════════════════════════════════════════╝")))
    print()

    # Check if stdin is a tty — if not, skip interactive wizard
    if not sys.stdin.isatty():
        print(f"  {yellow('非交互式终端，跳过配置向导')}")
        sys.exit(0)

    # Find config file
    config_path = find_openclaw_json()
    if not config_path:
        print(f"  {red('错误: 未找到 openclaw.json')}")
        print(f"  {dim('已搜索以下路径:')}")
        for p in OPENCLAW_JSON_PATHS:
            print(f"    {dim(p)}")
        print(f"  {yellow('请先初始化 OpenClaw 配置，再运行此向导')}")
        sys.exit(1)

    print(f"  {dim('配置文件:')} {cyan(config_path)}")

    config = load_config(config_path)

    # ── Step 1 ──────────────────────────────────────────────────────────────
    new_default_model, default_changed = step1_default_model(config)

    # ── Step 2 ──────────────────────────────────────────────────────────────
    agent_changes = step2_agent_config(config, new_default_model)

    # ── Check for any changes ───────────────────────────────────────────────
    has_any_change = default_changed or bool(agent_changes)
    if not has_any_change:
        print()
        print(f"  {green('无需修改，配置保持不变 ✅')}")
        print()
        sys.exit(0)

    # ── Step 3 ──────────────────────────────────────────────────────────────
    confirmed = step3_summary_confirm(
        config, new_default_model, default_changed, agent_changes
    )

    if not confirmed:
        print()
        print(f"  {yellow('已取消，未做任何修改')}")
        print()
        sys.exit(0)

    # Write changes
    apply_changes(config, new_default_model, default_changed, agent_changes)
    save_config(config_path, config)
    print(f"\n  {green('✓ 配置已写入')} {cyan(config_path)}")

    # ── Step 4 ──────────────────────────────────────────────────────────────
    step4_restart_gateway()

    print()
    print(bold(green("╔══════════════════════════════════════════════════════╗")))
    print(bold(green("║   配置向导完成 ✅                                    ║")))
    print(bold(green("╚══════════════════════════════════════════════════════╝")))
    print()


if __name__ == "__main__":
    main()
