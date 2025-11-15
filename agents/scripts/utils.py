#!/usr/bin/env python3
"""Shared helpers for agent automation scripts."""

from __future__ import annotations

import datetime as _dt
import re
import subprocess
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / "agents"
TEMPLATES_DIR = AGENTS_DIR / "templates"

EXCLUDED_DIRS = {
    ".DS_Store",
    ".git",
    ".idea",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    "out",
    "coverage",
    "node_modules",
    "tmp",
}


def today() -> str:
    """Return the current date as YYYY-MM-DD."""
    return _dt.datetime.now().strftime("%Y-%m-%d")


def now_ts() -> str:
    """Return timestamp suitable for filenames (e.g., 2025-11-12T09-30)."""
    return _dt.datetime.now().strftime("%Y-%m-%dT%H-%M")


def ensure_dir(path: Path) -> Path:
    """Ensure directory exists and return it."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_readme_summary(readme_path: Path, fallback: str | None = None) -> str:
    """Grab the first descriptive paragraph from a README."""
    if not readme_path.exists():
        return fallback or "Summary pending — update the project README."

    lines: List[str] = []
    for raw_line in readme_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            if lines:
                break
            continue
        if line.startswith("#"):
            # skip headings
            continue
        lines.append(line)
    summary = " ".join(lines).strip()
    return summary or (fallback or "Summary pending — update the project README.")


def project_display_name(project_dir: Path) -> str:
    """Derive a friendly name for a project folder."""
    readme = project_dir / "README.md"
    if readme.exists():
        for line in readme.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped.lstrip("# ").strip()
    # Fallback to folder name converted to title case
    return project_dir.name.replace("-", " ").title()


def parse_markdown_table(lines: Iterable[str]) -> Tuple[List[str], List[Dict[str, str]]]:
    """
    Parse a markdown table into headers and row dicts.

    Expects the first line with pipes to contain headers and the second to be the separator.
    """
    rows: List[Dict[str, str]] = []
    headers: List[str] | None = None
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if headers is None:
            headers = cells
            continue
        if _is_separator_row(cells):
            continue
        row = {headers[i]: cells[i] if i < len(cells) else "" for i in range(len(headers))}
        if any(value for value in row.values()):
            rows.append(row)
    if headers is None:
        headers = []
    return headers, rows


def _is_separator_row(cells: List[str]) -> bool:
    """Return True if row looks like markdown separator (---)."""
    return all(bool(re.fullmatch(r"[:-]+", cell.replace(" ", ""))) for cell in cells)


def section_lines(markdown: str, heading: str) -> List[str]:
    """Return the lines for the given `## heading` block."""
    pattern = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.IGNORECASE)
    lines = markdown.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if pattern.match(line.strip()):
            start = idx + 1
            break
    if start is None:
        return []
    collected: List[str] = []
    for line in lines[start:]:
        if line.strip().startswith("## "):
            break
        collected.append(line)
    return collected


def slugify(text: str) -> str:
    """Slugify text for filenames or anchors."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def markdown_table(rows: List[Dict[str, str]], headers: List[str]) -> str:
    """Render a markdown table with normalized pipe usage."""
    if not headers:
        keys = {key for row in rows for key in row.keys()}
        headers = sorted(keys)
    if not headers:
        raise ValueError("markdown_table requires at least one header")

    normalized_rows: List[List[str]] = []
    for row in rows:
        normalized_rows.append([row.get(header, "").strip() for header in headers])

    header_row = "| " + " | ".join(headers) + " |"
    divider = "| " + " | ".join(["---" for _ in headers]) + " |"
    body = ["| " + " | ".join(values) + " |" for values in normalized_rows]
    table_lines = [header_row, divider]
    table_lines.extend(body)
    return "\n".join(table_lines)


def write_md(path: Path, content: str) -> None:
    """Normalize markdown spacing, trim trailing whitespace, and write to disk."""
    lines_in = content.splitlines()
    normalized: List[str] = []
    blank_streak = 0
    for raw_line in lines_in:
        line = raw_line.rstrip()
        if not line:
            blank_streak += 1
            if blank_streak > 2:
                continue
        else:
            blank_streak = 0
        normalized.append(line)
    text = "\n".join(normalized).rstrip() + "\n"
    path.write_text(text, encoding="utf-8")


def safe_commit(paths: Sequence[str | Path], message: str) -> None:
    """Stage the provided paths and create a commit when diffs exist."""
    str_paths = [str(Path(p)) for p in paths]
    if not str_paths:
        return
    subprocess.run(["git", "add", *str_paths], check=False)
    result = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if result.returncode == 0:
        print("safe_commit: no staged changes, skipping commit.")
        return
    subprocess.run(["git", "commit", "-m", message], check=True)


def read_md(path: Path) -> str:
    """Read markdown text with utf-8 encoding."""
    return path.read_text(encoding="utf-8")


def get_agents_root() -> Path:
    """Return the agents/ directory root."""
    return AGENTS_DIR
