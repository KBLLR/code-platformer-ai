#!/usr/bin/env python3
"""Generate repo sitemap files under agents/."""

from __future__ import annotations

import sys

from utils import AGENTS_DIR, EXCLUDED_DIRS, REPO_ROOT, ensure_dir, today, write_md

TOP_LEVEL_LIMIT = 8


def should_skip(entry: Path) -> bool:
    name = entry.name
    if name in EXCLUDED_DIRS:
        return True
    if name.startswith(".") and name not in {".github"}:
        return True
    return False


def generate_top_level() -> str:
    lines = [
        "# SITEMAP — Source Overview",
        "",
        f"_Last generated: {today()}_",
        "",
        "## Top-Level Directories",
        "",
    ]
    for entry in sorted(REPO_ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir() or should_skip(entry):
            continue
        lines.append(f"- `{entry.name}/`")
        subdirs = [
            child.name + "/"
            for child in sorted(entry.iterdir(), key=lambda p: p.name.lower())
            if child.is_dir() and not should_skip(child)
        ]
        if subdirs:
            preview = ", ".join(subdirs[:TOP_LEVEL_LIMIT])
            if len(subdirs) > TOP_LEVEL_LIMIT:
                preview += ", …"
            lines.append(f"  - {preview}")
    lines.extend(
        [
            "",
            "> Generated via `agents/scripts/generate_sitemap.py`.",
        ],
    )
    return "\n".join(lines)


def build_tree(prefix: str, path: Path, depth: int, lines: list[str]) -> None:
    indent = "  " * depth
    lines.append(f"{indent}{prefix}{path.name}/")
    children = [
        child
        for child in sorted(path.iterdir(), key=lambda p: p.name.lower())
        if child.is_dir() and not should_skip(child)
    ]
    for child in children:
        build_tree(prefix, child, depth + 1, lines)


def generate_detailed() -> str:
    lines = [
        "# SITEMAP_DETAILED — Directory Tree",
        "",
        f"_Last generated: {today()}_",
        "",
        "```",
    ]
    for entry in sorted(REPO_ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir() or should_skip(entry):
            continue
        build_tree("", entry, 0, lines)
    lines.append("```")
    lines.append("> Generated via `agents/scripts/generate_sitemap.py`.")
    return "\n".join(lines)


def main() -> int:
    ensure_dir(AGENTS_DIR)
    sitemap_path = AGENTS_DIR / "SITEMAP.md"
    detailed_path = AGENTS_DIR / "SITEMAP_DETAILED.md"

    top_level = generate_top_level()
    detailed = generate_detailed()

    write_md(sitemap_path, top_level)
    write_md(detailed_path, detailed)

    print(f"Updated {sitemap_path.relative_to(REPO_ROOT)}")
    print(f"Updated {detailed_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
