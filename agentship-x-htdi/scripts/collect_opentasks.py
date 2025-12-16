#!/usr/bin/env python3
"""Aggregate Backlog + In Progress tasks across agent projects."""

from __future__ import annotations

from pathlib import Path
import sys

from utils import (
    AGENTS_DIR,
    project_display_name,
    section_lines,
    parse_markdown_table,
    today,
    markdown_table,
    write_md,
)

TARGET_FILE = AGENTS_DIR / "OPENTASKS.md"


def extract_tasks(tasks_path: Path, project_name: str) -> list[dict[str, str]]:
    markdown = tasks_path.read_text(encoding="utf-8")
    tasks: list[dict[str, str]] = []

    for section_name, status in (("Backlog", "Backlog"), ("In Progress", "In Progress")):
        lines = section_lines(markdown, section_name)
        if not lines:
            continue
        _, rows = parse_markdown_table(lines)
        for row in rows:
            if not row.get("ID"):
                continue
            tasks.append(
                {
                    "Project": project_name,
                    "Status": status,
                    "ID": row.get("ID", ""),
                    "Title": row.get("Title", ""),
                    "Description": row.get("Description", ""),
                    "Priority": row.get("Priority", ""),
                    "Owner": row.get("Owner", ""),
                    "Notes": row.get("Notes", ""),
                },
            )
    return tasks


def main() -> int:
    projects_dir = AGENTS_DIR / "projects"
    all_tasks: list[dict[str, str]] = []

    for project_dir in sorted(projects_dir.iterdir()):
        if not project_dir.is_dir():
            continue
        tasks_md = project_dir / "tasks.md"
        if not tasks_md.exists():
            continue
        project_name = project_display_name(project_dir)
        all_tasks.extend(extract_tasks(tasks_md, project_name))

    header = [
        "# Open Tasks Ledger",
        "",
        f"_Last updated: {today()}_",
        "",
    ]

    if not all_tasks:
        header.append("No open tasks found. Update `tasks.md` files to populate this view.\n")
        write_md(TARGET_FILE, "\n".join(header))
        print("No open tasks to record.")
        return 0

    columns = ["Project", "Status", "ID", "Title", "Description", "Priority", "Owner", "Notes"]
    # Sort by project then status
    status_weight = {"In Progress": 0, "Backlog": 1}
    sorted_rows = sorted(
        all_tasks,
        key=lambda r: (r["Project"].lower(), status_weight.get(r["Status"], 99), r["ID"]),
    )
    lines = header + [markdown_table(sorted_rows, columns)]

    lines.append("\n> Generated via `agents/scripts/collect_opentasks.py`.")
    write_md(TARGET_FILE, "\n".join(lines))
    print(f"Updated {TARGET_FILE.relative_to(AGENTS_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
