# Prompt Library

This directory stores reusable prompt fragments for the local Agent CLI and the GitHub workflows.

## Gemini Triage Library

`gemini_triage.json` defines specialized workflows for the Gemini CLI. Each entry contains:

- `key` – Stable identifier shown in the CLI menu
- `title` / `description` – Human-readable summary
- `script` – Core narrative that is appended to the generated OPENTASK prompt
- `checklist` – Bullet list Gemini must report on
- `references` – Paths or docs Gemini should inspect first

When you select Gemini in `pnpm agents:cli`, the tool loads this library, lets you pick a workflow, and appends the selected script to the agent prompt. Add new entries to the JSON array whenever a repeatable triage scenario appears (e.g., shader audits, deployment reviews, UX polish).
