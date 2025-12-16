#!/usr/bin/env python3
"""Append handoff entries after labeled PR merges."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from utils import AGENTS_DIR, today

HANDOFF_FILE = AGENTS_DIR / "HANDOFFS.md"

def append_automation_line(line: str) -> None:
    """Append a single bullet line under the Automation Runs section."""
    content = HANDOFF_FILE.read_text(encoding="utf-8")
    marker = "## Automation Runs"
    bullet = f"- {line}"

    if marker not in content:
        insertion = f"{marker}\n\n{bullet}\n\n---\n"
        if "\n---\n" in content:
            content = content.replace("\n---\n", f"\n\n{insertion}\n---\n", 1)
        else:
            content = f"{content.rstrip()}\n\n{insertion}"
        HANDOFF_FILE.write_text(content, encoding="utf-8")
        return

    lines = content.splitlines()
    inserted = False
    for idx, line_text in enumerate(lines):
        if line_text.strip() == marker:
            insert_at = idx + 1
            while insert_at < len(lines) and not lines[insert_at].strip():
                insert_at += 1
            lines.insert(insert_at, bullet)
            inserted = True
            break
    if not inserted:
        lines.append(marker)
        lines.append("")
        lines.append(bullet)
    new_content = "\n".join(lines).rstrip() + "\n"
    HANDOFF_FILE.write_text(new_content, encoding="utf-8")


def load_event() -> dict:
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if not event_path:
        return {}
    path = Path(event_path)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def has_handoff_label(labels: list[dict]) -> bool:
    for label in labels:
        name = (label.get("name") or "").lower()
        if name.startswith("handoff"):
            return True
    return False


def strip_bullets(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        stripped = stripped.lstrip("-*• ").strip()
        if stripped:
            lines.append(stripped)
    return lines


def build_entry(
    title: str,
    codename: str,
    summary_lines: list[str],
    next_steps: list[str],
    notes: list[str],
    pr_number: int | None,
    branch: str | None,
) -> str:
    today_str = today()
    header = f"## Entry: {today_str} — \"{title}\" (Agent codename: `{codename}`)\n"
    summary_block = "\n".join([header, "\n**Summary**\n"] + [f"* {line}" for line in summary_lines])

    if not next_steps:
        next_steps = ["Review backlog and claim the next GH-00x task."]
    next_block = "\n".join(
        [
            "\n**Next Agent To-Do**\n",
            *(f"{idx}. {line}" for idx, line in enumerate(next_steps, start=1)),
        ],
    )

    if not notes:
        notes = []
    if pr_number:
        notes.append(f"Source PR: #{pr_number}")
    if branch:
        notes.append(f"Merged into `{branch}`")

    notes_block = ""
    if notes:
        notes_block = "\n".join(["\n**Notes**\n"] + [f"* {line}" for line in notes])

    entry = "\n".join([summary_block, next_block, notes_block, "\n---\n"])
    return entry.strip() + "\n"


def insert_entry_into_file(content: str, entry: str) -> str:
    marker = "\n---\n"
    if marker not in content:
        return content + "\n" + entry
    head, tail = content.split(marker, 1)
    return f"{head}{marker}\n\n{entry}{tail}"


def already_logged(content: str, title: str) -> bool:
    marker = f"\"{title}\""
    return marker in content


def main() -> int:
    parser = argparse.ArgumentParser(description="Append a handoff entry.")
    parser.add_argument("--title", help="Override the entry title")
    parser.add_argument("--codename", help="Agent codename override")
    parser.add_argument("--summary", action="append", help="Summary bullet (repeatable)")
    parser.add_argument("--next", dest="next_steps", action="append", help="Next-step bullet (repeatable)")
    parser.add_argument("--note", dest="notes", action="append", help="Note bullet (repeatable)")
    parser.add_argument("--force", action="store_true", help="Force entry even without event data")
    parser.add_argument("--append", dest="append_line", help="Append a single Automation Runs bullet")
    args = parser.parse_args()

    if args.append_line:
        append_automation_line(args.append_line)
        print(f"Appended automation note: {args.append_line}")
        return 0

    event = load_event()
    pr = event.get("pull_request") or {}
    action = event.get("action")
    merged = pr.get("merged")

    if event:
        if not (action == "closed" and merged):
            print("No merged pull_request event; skipping handoff entry.")
            return 0
        if not has_handoff_label(pr.get("labels", [])):
            print("Merged PR lacks `handoff` label; skipping.")
            return 0

    if not event and not args.force and not args.title:
        print("No event context and no manual data provided; nothing to do.")
        return 0

    title = args.title or pr.get("title") or "Handoff Update"
    codename = args.codename or (pr.get("merged_by") or {}).get("login") or os.getenv("GITHUB_ACTOR", "unknown")
    summary_lines = args.summary or strip_bullets(pr.get("body") or "")
    if not summary_lines:
        summary_lines = [f"Merged PR #{pr.get('number', 'N/A')}"]
    next_steps = args.next_steps or []
    notes = args.notes or []

    content = HANDOFF_FILE.read_text(encoding="utf-8")
    if already_logged(content, title) and not args.force:
        print("Entry already exists; skipping to avoid duplicates.")
        return 0

    entry = build_entry(
        title=title,
        codename=codename,
        summary_lines=summary_lines,
        next_steps=next_steps,
        notes=notes,
        pr_number=pr.get("number"),
        branch=(pr.get("base") or {}).get("ref"),
    )
    updated = insert_entry_into_file(content, entry)
    HANDOFF_FILE.write_text(updated, encoding="utf-8")
    print(f"Appended handoff entry for {title}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
