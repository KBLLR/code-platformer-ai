#!/usr/bin/env python3
"""
Local Agent Workflow CLI

This tool mirrors the GitHub workflows found in `.github/workflows/agents-*.yml`
and `.github/workflows/agent-auto-execute.yml`. It now shells out to the local
Claude, Codex, Gemini CLI, and Jules agents so the same automation can happen
outside of GitHub Actions.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable, Dict, List, Optional

try:
    from rich import box
    from rich.align import Align
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.table import Table
    from rich.text import Text
except ImportError as exc:
    raise SystemExit("Install 'rich' (pip install rich) to use the Agent CLI interface.") from exc


ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / "agentship-x-htdi"
PROMPTS_DIR = AGENTS_DIR / "prompts"
GEMINI_TRIAGE_LIBRARY = PROMPTS_DIR / "gemini_triage.json"
WORKFLOWS_DIR = ROOT / ".github" / "workflows"
PYTHON = os.environ.get("PYTHON", sys.executable)
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
CODEX_MODEL = "gpt-5.1-codex"
GEMINI_MODEL = "gemini-2.5-flash"
JULES_USAGE_FILE = AGENTS_DIR / "logs" / "jules-usage.json"
JULES_DAILY_LIMIT = 15
console = Console()
BANNER = r"""
   ____ ___   ____  ______   ____  _       ____  _   _ _______ ____   _____ _____ ____  
  / ___/ _ \ / ___||  ____| / ___|| |     / ___|| | | |__   __|  _ \ / ____| ____|___ \ 
 | |  | | | |\___ \| |__   | |    | |     \___ \| | | |  | |  | |_) | |    |  _|   __) |
 | |__| |_| | ___) |  __|  | |___ | |___   ___) | |_| |  | |  |  _ <| |____| |___ / __/ 
  \____\___/ |____/|_|      \____||_____| |____/ \___/   |_|  |_| \_\\_____|_____|_____|
"""


def print_banner() -> None:
    gradient = Text.from_ansi(BANNER)
    gradient.stylize("bold magenta", 0, len(BANNER))
    console.print(Panel.fit(Align.center(gradient), border_style="magenta"))


def group_tasks_by_project(tasks: List[OpenTask]) -> Dict[str, List[OpenTask]]:
    grouped: Dict[str, List[OpenTask]] = defaultdict(list)
    for task in tasks:
        grouped[task.project].append(task)
    return dict(sorted(grouped.items(), key=lambda item: item[0].lower()))


def display_task_catalog(tasks: List[OpenTask]) -> None:
    if not tasks:
        console.print("[yellow]No tasks available to display.[/]")
        return
    console.print(
        Panel(
            Align.center(
                f"{len(tasks)} open tasks • {len(group_tasks_by_project(tasks))} projects",
            ),
            title="OPENTASKS Overview",
            border_style="cyan",
        )
    )
    for project, items in group_tasks_by_project(tasks).items():
        table = Table(
            title=f"{project} ({len(items)} task(s))",
            header_style="bold magenta",
            box=box.MINIMAL_DOUBLE_HEAD,
            border_style="magenta",
        )
        table.add_column("ID", style="bold cyan")
        table.add_column("Title", style="bold")
        table.add_column("Priority", justify="center")
        table.add_column("Status", justify="center")
        table.add_column("Notes", style="dim")
        for item in items:
            table.add_row(
                item.task_id,
                item.title,
                item.priority or "n/a",
                item.status or "n/a",
                item.notes or "",
            )
        console.print(table)


def select_project(tasks: List[OpenTask]) -> Optional[str]:
    grouped = group_tasks_by_project(tasks)
    if not grouped:
        console.print("[yellow]No projects to select.[/]")
        return None
    table = Table(
        title="Select a project",
        box=box.SIMPLE_HEAVY,
        header_style="bold",
        border_style="cyan",
    )
    table.add_column("#", justify="right", style="cyan", width=3)
    table.add_column("Project")
    table.add_column("# Tasks", justify="right")
    projects = list(grouped.keys())
    for idx, name in enumerate(projects, 1):
        table.add_row(str(idx), name, str(len(grouped[name])))
    table.caption = "Enter number to choose a project, 'all' to view everything, or press Enter to cancel."
    console.print(table)

    while True:
        choice = console.input("Project selection: ").strip().lower()
        if not choice:
            return None
        if choice in {"all", "*"}:
            return "__all__"
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(projects):
                return projects[idx - 1]
        console.print("[red]Invalid selection. Try again.[/]")


def select_task_with_projects(tasks: List[OpenTask]) -> Optional[OpenTask]:
    project_choice = select_project(tasks)
    if not project_choice:
        return None
    if project_choice == "__all__":
        filtered = tasks
    else:
        filtered = [task for task in tasks if task.project == project_choice]
    if not filtered:
        console.print("[yellow]No tasks found for that selection.[/]")
        return None

    table = Table(
        title=f"Tasks in {project_choice if project_choice != '__all__' else 'all projects'}",
        header_style="bold magenta",
        box=box.MINIMAL,
        border_style="magenta",
    )
    table.add_column("#", justify="right", style="cyan", width=3)
    table.add_column("ID", style="bold yellow")
    table.add_column("Title")
    table.add_column("Priority", justify="center")
    table.add_column("Notes", style="dim")
    for idx, task in enumerate(filtered, 1):
        table.add_row(
            str(idx),
            task.task_id,
            task.title,
            task.priority or "n/a",
            task.notes or "",
        )
    table.caption = "Enter a number to pick a task or press Enter to cancel."
    console.print(table)

    while True:
        choice = console.input("Task selection: ").strip()
        if not choice:
            return None
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(filtered):
                return filtered[idx - 1]
        console.print("[red]Invalid selection. Try again.[/]")


@dataclass
class OpenTask:
    project: str
    status: str
    task_id: str
    title: str
    description: str
    priority: str
    owner: str
    notes: str

    def short_label(self) -> str:
        note_suffix = f" · {self.notes}" if self.notes else ""
        return f"[{self.priority or 'n/a'}] {self.task_id}: {self.title}{note_suffix}"


@dataclass
class GeminiTriageTemplate:
    key: str
    title: str
    description: str
    script: str
    checklist: List[str]
    references: List[str]


def read_opentasks() -> List[OpenTask]:
    path = AGENTS_DIR / "OPENTASKS.md"
    if not path.exists():
        raise SystemExit("agents/OPENTASKS.md not found.")

    rows: List[OpenTask] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|") or line.startswith("| ---"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 8 or cells[0] == "Project":
            continue
        rows.append(
            OpenTask(
                project=cells[0],
                status=cells[1],
                task_id=cells[2],
                title=cells[3],
                description=cells[4],
                priority=cells[5],
                owner=cells[6],
                notes=cells[7],
            )
        )
    return rows


def select_from_list(prompt: str, options: List[str]) -> Optional[int]:
    if not options:
        console.print("[yellow]No options available.[/]")
        return None

    table = Table(
        title=prompt,
        show_header=False,
        box=box.SIMPLE,
        highlight=True,
        caption="Press Enter to cancel.",
        border_style="cyan",
    )
    for idx, option in enumerate(options, 1):
        table.add_row(f"[bold cyan]{idx}[/]", option)
    console.print(table)

    while True:
        choice = console.input("[bold]Select a number[/]: ").strip()
        if not choice:
            return None
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(options):
                return idx - 1
        console.print("[red]Invalid choice, try again.[/]")


def select_task(tasks: List[OpenTask]) -> Optional[OpenTask]:
    return select_task_with_projects(tasks)


def load_gemini_triage_templates() -> List[GeminiTriageTemplate]:
    if not GEMINI_TRIAGE_LIBRARY.exists():
        return []
    try:
        data = json.loads(GEMINI_TRIAGE_LIBRARY.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        console.print(
            Panel(
                f"Could not parse {GEMINI_TRIAGE_LIBRARY.relative_to(ROOT)}:\n{exc}",
                title="Gemini triage library error",
                border_style="red",
            )
        )
        return []
    templates: List[GeminiTriageTemplate] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key", "").strip()
        title = entry.get("title", "").strip()
        script = entry.get("script", "").strip()
        if not key or not title or not script:
            continue
        templates.append(
            GeminiTriageTemplate(
                key=key,
                title=title,
                description=entry.get("description", "").strip(),
                script=script,
                checklist=[item.strip() for item in entry.get("checklist", []) if item.strip()],
                references=[item.strip() for item in entry.get("references", []) if item.strip()],
            )
        )
    return templates


def select_gemini_triage_template(templates: List[GeminiTriageTemplate]) -> Optional[GeminiTriageTemplate]:
    if not templates:
        console.print(
            "[yellow]Gemini triage library not found (agents/prompts/gemini_triage.json). "
            "Create it to enable predefined flows.[/]"
        )
        return None
    table = Table(
        title="Gemini triage workflows",
        header_style="bold magenta",
        box=box.SIMPLE_HEAVY,
        border_style="magenta",
    )
    table.add_column("#", justify="right", style="cyan", width=3)
    table.add_column("Key", style="bold")
    table.add_column("Title")
    table.add_column("Description")
    for idx, template in enumerate(templates, 1):
        table.add_row(str(idx), template.key, template.title, template.description or "n/a")
    table.caption = "Enter a number to apply a workflow or press Enter to skip."
    console.print(table)

    while True:
        choice = console.input("Gemini triage selection: ").strip()
        if not choice:
            return None
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(templates):
                return templates[idx - 1]
        console.print("[red]Invalid selection. Try again.[/]")


def describe_gemini_template(template: GeminiTriageTemplate) -> None:
    checklist = "\n".join(f"- {item}" for item in template.checklist) if template.checklist else "n/a"
    references = "\n".join(f"- {item}" for item in template.references) if template.references else "n/a"
    body = textwrap.dedent(
        f"""\
        [bold]{template.title}[/] ({template.key})

        {template.description or 'No description provided.'}

        [bold]Workflow Script[/]
        {template.script}

        [bold]Checklist[/]
        {checklist}

        [bold]References[/]
        {references}
        """
    ).strip()
    console.print(Panel(body, title="Gemini triage workflow applied", border_style="cyan"))


def prepend_gemini_triage_prompt(base_prompt: str, template: GeminiTriageTemplate) -> str:
    sections = [
        f"### Gemini Triage Workflow: {template.title}",
        f"Scenario: {template.description or 'n/a'}",
        "Workflow Script:",
        textwrap.dedent(template.script).strip(),
    ]
    if template.checklist:
        sections.append("Checklist:")
        sections.extend(f"- {item}" for item in template.checklist)
    if template.references:
        sections.append("References to consult:")
        sections.extend(f"- {item}" for item in template.references)
    triage_block = "\n".join(sections)
    return f"{base_prompt.rstrip()}\n\n---\n{triage_block}\n"


def select_models(model_options: Dict[str, Dict[str, str]]) -> List[str]:
    table = Table(
        title="Choose model runner(s)",
        show_header=True,
        header_style="bold magenta",
        box=box.SIMPLE_HEAVY,
        border_style="magenta",
    )
    table.add_column("#", justify="right", width=3)
    table.add_column("Agent", style="bold")
    table.add_column("Workflow file", style="dim")
    for idx, (key, data) in enumerate(model_options.items(), 1):
        table.add_row(str(idx), f"{data['label']} ([cyan]{key}[/])", data["workflow"])
    table.caption = "Enter numbers separated by commas, 'all', or press Enter to cancel."
    console.print(table)

    selection = console.input("[bold]Selection[/]: ").strip()
    if not selection:
        return []
    keys = list(model_options.keys())
    if selection.lower() in {"all", "*"}:
        return keys
    chosen: List[str] = []
    tokens = [token.strip() for token in selection.replace(",", " ").split() if token.strip()]
    for token in tokens:
        if not token.isdigit():
            console.print(f"[yellow]Ignoring invalid entry:[/] {token}")
            continue
        idx = int(token)
        if 1 <= idx <= len(keys):
            key = keys[idx - 1]
            if key not in chosen:
                chosen.append(key)
        else:
            console.print(f"[yellow]Ignoring out-of-range entry:[/] {token}")
    return chosen


def run_subprocess(args: List[str]) -> None:
    subprocess.run(args, check=True, cwd=ROOT)


GENERATOR_CHOICES = [
    ("Run all (audit + sitemap + opentasks)", ["generate_audit.py", "generate_sitemap.py", "collect_opentasks.py"]),
    ("Only generate_audit.py", ["generate_audit.py"]),
    ("Only generate_sitemap.py", ["generate_sitemap.py"]),
    ("Only collect_opentasks.py", ["collect_opentasks.py"]),
    ("Skip generator run", []),
]


def run_agent_generators(selected_scripts: List[str]) -> None:
    if not selected_scripts:
        console.print("[yellow]Skipping generator scripts.[/]")
        return
    console.print("\n[bold]Running agent auxiliary scripts (agents-ci parity)...[/]\n")
    for script in selected_scripts:
        with console.status(f"[cyan]Running {script}...[/]", spinner="dots"):
            run_subprocess([PYTHON, str(AGENTS_DIR / "scripts" / script)])


def prompt_yes_no(question: str, default: bool = False) -> bool:
    suffix = "Y/n" if default else "y/N"
    while True:
        ans = console.input(f"{question} [{suffix}]: ").strip().lower()
        if not ans:
            return default
        if ans in {"y", "yes"}:
            return True
        if ans in {"n", "no"}:
            return False
        console.print("[yellow]Please respond with 'y' or 'n'.[/]")


def choose_generator_scripts() -> List[str]:
    table = Table(
        title="Agent Documentation Scripts",
        box=box.SIMPLE_HEAVY,
        border_style="cyan",
        header_style="bold magenta",
    )
    table.add_column("#", justify="right", style="cyan", width=3)
    table.add_column("Action")
    for idx, (label, _) in enumerate(GENERATOR_CHOICES, 1):
        table.add_row(str(idx), label)
    table.caption = "Pick an option to run docs scripts (Enter to skip)."
    console.print(table)

    choice = console.input("Generator selection: ").strip()
    if not choice:
        return []
    if choice.isdigit():
        idx = int(choice)
        if 1 <= idx <= len(GENERATOR_CHOICES):
            return GENERATOR_CHOICES[idx - 1][1]
    console.print("[yellow]Invalid selection. Skipping generators.[/]")
    return []


def compose_prompt(task: OpenTask, table_text: str) -> str:
    return textwrap.dedent(
        f"""\
        Execute this task: {task.task_id} — {task.title}

        Description: {task.description or 'n/a'}
        Priority: {task.priority or 'n/a'}
        Owner: {task.owner or 'Unassigned'}
        Notes: {task.notes or 'None'}

        Available OPENTASKS:
        {table_text}

        Execute the task by:
        1. Understanding what needs to be done
        2. Suggesting changes to files under agents/**
        3. Providing a concise summary of next steps

        Available scripts to reference:
        - agents/scripts/generate_audit.py
        - agents/scripts/generate_sitemap.py
        - agents/scripts/collect_opentasks.py
        """
    )


def load_jules_usage() -> Dict[str, int]:
    if not JULES_USAGE_FILE.exists():
        return {}
    try:
        return json.loads(JULES_USAGE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_jules_usage(usage: Dict[str, int]) -> None:
    JULES_USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    JULES_USAGE_FILE.write_text(json.dumps(usage, indent=2), encoding="utf-8")


def jules_runs_today() -> int:
    usage = load_jules_usage()
    return int(usage.get(date.today().isoformat(), 0))


def record_jules_run() -> None:
    usage = load_jules_usage()
    today_key = date.today().isoformat()
    usage[today_key] = int(usage.get(today_key, 0)) + 1
    save_jules_usage(usage)


def ensure_jules_quota_ack() -> bool:
    used = jules_runs_today()
    remaining = max(0, JULES_DAILY_LIMIT - used)
    console.print(
        Panel.fit(
            f"Jules runs are asynchronous with a free tier limit of [bold]{JULES_DAILY_LIMIT}[/] per day.\n"
            f"Used today: [bold]{used}[/] • Remaining: [bold]{remaining}[/]",
            title="Jules Quota",
            border_style="magenta",
        )
    )
    if remaining <= 0:
        return prompt_yes_no("Daily Jules quota reached. Send task to Jules anyway?", False)
    return True


def save_summary(path: Path, agent_label: str, task: OpenTask, summary: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"# {agent_label} Task: {task.task_id}\n\n{summary.strip()}\n", encoding="utf-8")
    console.print(f"[green]✓[/] {agent_label} runner wrote: [bold]{path.relative_to(ROOT)}[/]")


def _run_cli(command: List[str], agent_label: str, *, input_text: str | None = None) -> str:
    """Execute an agent CLI command and return its stdout."""
    try:
        result = subprocess.run(
            command,
            input=input_text,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
    except FileNotFoundError as exc:
        missing = Path(exc.filename or "")
        raise RuntimeError(
            f"{agent_label} CLI not found ({missing.name if missing.name else exc.filename}). "
            "Install the CLI or ensure it is on PATH."
        ) from exc
    if result.returncode != 0:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        details = stderr or stdout or "(no output)"
        raise RuntimeError(f"{agent_label} CLI failed:\n{details}")
    return result.stdout.strip()


def run_claude_cli(task: OpenTask, prompt: str, output: Path) -> None:
    command = ["claude", "--print", "--model", CLAUDE_MODEL, prompt]
    summary = _run_cli(command, "Claude")
    save_summary(output, "Claude", task, summary)


def run_codex_cli(task: OpenTask, prompt: str, output: Path) -> None:
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = Path(tmp.name)
    command = [
        "codex",
        "exec",
        "--model",
        CODEX_MODEL,
        "--output-last-message",
        str(tmp_path),
        prompt,
    ]
    stdout = _run_cli(command, "Codex")
    if tmp_path.exists():
        summary = tmp_path.read_text(encoding="utf-8").strip()
        tmp_path.unlink(missing_ok=True)
        if not summary:
            summary = stdout.strip()
    else:
        summary = stdout.strip()
    if not summary:
        summary = "Codex CLI completed without returning a final message."
    save_summary(output, "Codex", task, summary)


def run_gemini_cli(task: OpenTask, prompt: str, output: Path) -> None:
    command = ["gemini", "--model", GEMINI_MODEL, "--prompt", prompt, "--output-format", "text"]
    summary = _run_cli(command, "Gemini")
    save_summary(output, "Gemini", task, summary)


def run_jules_cli(task: OpenTask, prompt: str, output: Path) -> None:
    if not ensure_jules_quota_ack():
        raise RuntimeError("Jules run skipped by user (quota reached).")
    description = textwrap.dedent(
        f"""{task.task_id} - {task.title}

Priority: {task.priority or 'n/a'}
Notes: {task.notes or 'None'}

Detailed instructions:
{prompt}
"""
    ).strip()
    command = ["jules", "new", "--repo", str(ROOT), description]
    summary = _run_cli(command, "Jules")
    save_summary(output, "Jules", task, summary)
    record_jules_run()
    used = jules_runs_today()
    remaining = max(0, JULES_DAILY_LIMIT - used)
    print(f"Jules run dispatched asynchronously. {remaining} run(s) remaining today.")


MODEL_RUNNERS: Dict[str, Dict[str, object]] = {
    "claude": {
        "label": "Claude Sonnet 4.5 (Claude CLI)",
        "workflow": ".github/workflows/agents-claude.yml",
        "handler": run_claude_cli,
        "output": AGENTS_DIR / "audits" / "claude-summary.md",
    },
    "codex": {
        "label": "OpenAI via Codex CLI",
        "workflow": ".github/workflows/agents-codex.yml",
        "handler": run_codex_cli,
        "output": AGENTS_DIR / "audits" / "openai-summary.md",
    },
    "gemini": {
        "label": "Gemini 2.5 Flash (Gemini CLI)",
        "workflow": ".github/workflows/agents-gemini.yml",
        "handler": run_gemini_cli,
        "output": ROOT / "gemini-output.md",
    },
    "jules": {
        "label": "Jules (Google asynchronous agent)",
        "workflow": ".github/workflows/agents-jules-bridge.yml",
        "handler": run_jules_cli,
        "output": AGENTS_DIR / "audits" / "jules-summary.md",
    },
}


def run_model_mode(tasks: List[OpenTask]) -> None:
    model_keys = select_models(MODEL_RUNNERS)
    if not model_keys:
        return
    task = select_task(tasks)
    if not task:
        return

    table_text = (AGENTS_DIR / "OPENTASKS.md").read_text(encoding="utf-8")
    console.print(
        Panel(
            Align.center(
                f"[bold yellow]{task.task_id}[/] • {task.title}\n"
                f"Priority: [bold]{task.priority or 'n/a'}[/]  Owner: [bold]{task.owner or '—'}[/]\n"
                f"Notes: {task.notes or 'None'}"
            ),
            title="✨ Task Selected ✨",
            border_style="cyan",
        )
    )
    base_prompt = compose_prompt(task, table_text)
    prompts_by_runner: Dict[str, str] = {key: base_prompt for key in model_keys}

    if "gemini" in model_keys:
        templates = load_gemini_triage_templates()
        if not templates:
            console.print(
                "[yellow]No Gemini triage templates found (agents/prompts/gemini_triage.json). Using base prompt.[/]"
            )
        else:
            selection = select_gemini_triage_template(templates)
            if selection:
                describe_gemini_template(selection)
                prompts_by_runner["gemini"] = prepend_gemini_triage_prompt(base_prompt, selection)
            else:
                console.print("[yellow]Gemini triage workflow skipped.[/]")

    successes = 0
    for model_key in model_keys:
        runner = MODEL_RUNNERS[model_key]
        handler: Callable[[OpenTask, str, Path], None] = runner["handler"]  # type: ignore[assignment]
        output_path: Path = runner["output"]  # type: ignore[assignment]
        console.print(f"\n[bold underline]{runner['label']}[/] starting...")
        with Progress(
            SpinnerColumn(style="cyan"),
            TextColumn("[progress.description]{task.description}"),
            transient=True,
        ) as progress:
            task_id_prog = progress.add_task(f"[cyan]Running {runner['label']}[/]", total=None)
            try:
                prompt_for_runner = prompts_by_runner.get(model_key, base_prompt)
                handler(task, prompt_for_runner, output_path)
                successes += 1
                progress.update(task_id_prog, description=f"[green]Finished {runner['label']}[/]")
            except RuntimeError as exc:
                progress.update(task_id_prog, description=f"[red]Failed {runner['label']}[/]")
                console.print(
                    Panel(
                        f"{exc}\nSee {runner['workflow']} for the reference workflow.",
                        title=f"{runner['label']} failed",
                        border_style="red",
                    )
                )
                console.print("[yellow]Continuing to next agent...[/]\n")

    if successes:
        scripts_to_run = choose_generator_scripts()
        if scripts_to_run:
            try:
                run_agent_generators(scripts_to_run)
            except subprocess.CalledProcessError as err:
                console.print(f"[red]Generator script failed:[/] {err}")
    else:
        console.print("[red]No agent runs succeeded. Fix the issues above and try again.[/]")


def list_projects() -> List[str]:
    if not (AGENTS_DIR / "projects").exists():
        return []
    return sorted(
        p.name for p in (AGENTS_DIR / "projects").iterdir() if p.is_dir() and not p.name.startswith(".")
    )


def run_auto_executor() -> None:
    projects = list_projects()
    if not projects:
        console.print("[yellow]No projects found under agents/projects.[/]")
        return
    idx = select_from_list("Choose a project for agent auto-execute:", projects)
    if idx is None:
        return
    project = projects[idx]

    task_id = console.input("Specific task ID (leave empty to auto-pick): ").strip()
    agent_codename = console.input("Agent codename (optional): ").strip()

    args = [PYTHON, str(AGENTS_DIR / "scripts" / "agent_executor.py"), "--project", project]
    if task_id:
        args += ["--task", task_id]
    else:
        args.append("--auto-pick")
    if agent_codename:
        args += ["--agent", agent_codename]

    console.print(
        Panel(
            f"Running agent_executor with args:\n[dim]{' '.join(args)}[/]",
            title="Agent Auto-Execute",
            border_style="green",
        )
    )
    with console.status("[cyan]agent_executor.py running...[/]", spinner="line"):
        run_subprocess(args)


def print_workflow_summary() -> None:
    table = Table(title="Workflow Summary", header_style="bold magenta", box=box.MINIMAL_DOUBLE_HEAD)
    table.add_column("Workflow")
    table.add_column("Name")
    for path in sorted(WORKFLOWS_DIR.glob("agents-*.yml")):
        name_line = next((line for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("name:")), "")
        table.add_row(str(path.relative_to(ROOT)), name_line.replace("name:", "").strip())
    auto_name = next(
        (
            line
            for line in (WORKFLOWS_DIR / "agent-auto-execute.yml").read_text(encoding="utf-8").splitlines()
            if line.startswith("name:")
        ),
        "",
    )
    table.add_row(".github/workflows/agent-auto-execute.yml", auto_name.replace("name:", "").strip())
    console.print(table)


def main() -> None:
    try:
        tasks = read_opentasks()
    except SystemExit as exc:
        print(exc)
        return

    print_banner()
    display_task_catalog(tasks)
    actions = [
        ("Run model task(s) via Claude/Codex/Gemini/Jules", run_model_mode),
        ("Prepare task via agent_auto_execute", lambda _: run_auto_executor()),
        ("Print workflow summary", lambda _: print_workflow_summary()),
        ("Quit", None),
    ]

    while True:
        console.rule("[bold blue]CODE Platformer Agent CLI[/]")
        menu = Table(show_header=False, box=box.SIMPLE)
        menu.add_column("#", justify="right", style="cyan", width=3)
        menu.add_column("Action")
        for idx, (label, _) in enumerate(actions, 1):
            menu.add_row(str(idx), label)
        console.print(menu)

        choice = console.input("Choose an option: ").strip()
        if not choice.isdigit():
            console.print("[red]Enter a number from the list.[/]")
            continue
        idx = int(choice) - 1
        if not 0 <= idx < len(actions):
            console.print("[red]Invalid choice.[/]")
            continue
        label, handler = actions[idx]
        if handler is None:
            console.print("Bye!")
            return
        try:
            handler(tasks)
        except subprocess.CalledProcessError as err:
            console.print(f"[red]Command failed:[/] {err}")
        except KeyboardInterrupt:
            console.print("\n[yellow]Operation cancelled.[/]")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Exiting.[/]")
