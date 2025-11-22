# OPENTASKS — Global Task Ledger

*Last updated: YYYY-MM-DD*

This file collects **all open tasks** from every project subdirectory under `/projects/*/tasks.md`.
It’s generated automatically so each agent can see what’s pending across the workspace.

---

## How It Works

When an agent starts a session or reads the latest handoff:

1. **Scan** all `tasks.md` files under `/projects/*/`.
2. **Parse** the “Backlog” and “In Progress” sections.
3. **Merge** their entries into this single ledger.
4. **Update timestamps** and maintain alphabetical or priority-based sorting.

A simple automation script (e.g. `scripts/collect_opentasks.py`) can do this before each agent run.

---

## Example Schema

| Project            | ID     | Title                    | Description                          | Priority | Owner | Status      | Notes |
| ------------------ | ------ | ------------------------ | ------------------------------------ | -------- | ----- | ----------- | ----- |
| gameplay-hardening | GH-001 | Add level physics tweaks | Stabilize collision with slope tiles | High     |       | Backlog     |       |
| ai-planner         | AI-005 | Improve RAG retrieval    | Adjust vector similarity thresholds  | Medium   |       | In Progress |       |

---

## Automation Script Sketch

```bash
# scripts/collect_opentasks.py
import os, re, datetime, pandas as pd

root = os.path.join(os.getcwd(), "projects")
entries = []

for dirpath, _, files in os.walk(root):
    if "tasks.md" in files:
        project = os.path.basename(dirpath)
        with open(os.path.join(dirpath, "tasks.md")) as f:
            text = f.read()
            for section in ["Backlog", "In Progress"]:
                matches = re.findall(r"\| ([^|]+) \| ([^|]+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|", text)
                for m in matches:
                    entries.append([project, *m, section])

df = pd.DataFrame(entries, columns=["Project", "ID", "Title", "Description", "Priority", "Owner", "Notes", "Status"])
df.to_markdown("OPENTASKS.md", index=False)
print("✅ OPENTASKS.md updated at", datetime.date.today())
```

---

## Agent Routine Integration

Each agent should:

* Run `scripts/collect_opentasks.py` before starting its task loop.
* Reference `OPENTASKS.md` when planning or assigning work.
* Append updates or completions in their local project `tasks.md` first, then regenerate this file.

---

## Notes

* Keep this file **read-only** for humans. Edit tasks only in their respective `projects/.../tasks.md`.
* The script should **ignore** `Done` and `Review / QA` sections to avoid clutter.
* Add timestamps or session IDs if you want traceability between this log and `HANDOFFS.md`.
