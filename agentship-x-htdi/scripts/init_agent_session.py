#!/usr/bin/env python3
"""Create a pre-filled session log for the chosen project."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from utils import (
    AGENTS_DIR,
    TEMPLATES_DIR,
    ensure_dir,
    now_ts,
    today,
)

SESSION_TEMPLATE = TEMPLATES_DIR / "project-template" / "sessions" / "session-template.md"


def populate_template(raw: str, title: str, tasks: list[str]) -> str:
    date = today()
    start_time = now_ts().split("T")[1].replace("-", ":")
    assoc = ", ".join(tasks) if tasks else ""

    content = raw.replace("`YYYY-MM-DD`", f"`{date}`", 1)
    content = content.replace("**Start Time**: `HH:MM`", f"**Start Time**: `{start_time}`", 1)
    content = content.replace("**Working Title**:", f"**Working Title**: {title}", 1)
    content = content.replace(
        "**Associated Tasks / Issues**: `#123`, `Feature Foo`, etc.",
        f"**Associated Tasks / Issues**: {assoc}",
        1,
    )
    return content


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize a new session log.")
    parser.add_argument("--project", default="gameplay-hardening", help="Project folder name under agents/projects/")
    parser.add_argument("--title", default="Working Session", help="Working session title")
    parser.add_argument("--task", action="append", dest="tasks", help="Task IDs to associate (repeatable)")
    args = parser.parse_args()

    project_dir = AGENTS_DIR / "projects" / args.project
    if not project_dir.exists():
        print(f"Project folder not found: {project_dir}")
        return 1

    sessions_dir = ensure_dir(project_dir / "sessions")
    if not SESSION_TEMPLATE.exists():
        print(f"Missing session template: {SESSION_TEMPLATE}")
        return 1

    template = SESSION_TEMPLATE.read_text(encoding="utf-8")
    content = populate_template(template, args.title, args.tasks or [])

    filename = f"{now_ts()}-session.md"
    target = sessions_dir / filename
    counter = 1
    while target.exists():
        target = sessions_dir / f"{filename}-{counter}"
        counter += 1

    target.write_text(content, encoding="utf-8")
    rel_path = target.relative_to(AGENTS_DIR.parent)
    print(f"Session log created at {rel_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
