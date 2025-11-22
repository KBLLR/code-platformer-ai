# Agent & Automation Overview

This guide summarizes the available AI agents, the automations that power them, and the recommended local workflow for shipping CODE Platformer AI improvements. Start here any time you need to understand which runner to use or how to bootstrap a task locally.

## Agent Roster

| Agent | Local CLI | GitHub Workflow | Best For | Notes |
| --- | --- | --- | --- | --- |
| Claude Sonnet 4.5 | `claude --print --model claude-sonnet-4-5-20250929` | `.github/workflows/agents-claude.yml` | Structured analysis, large edits | Deterministic summaries, pairs well with audit script follow-ups. |
| Codex (OpenAI GPT-5.1 Codex) | `codex exec --model gpt-5.1-codex` | `.github/workflows/agents-codex.yml` | Code-focused refactors, diff reviews | Writes `agents/audits/openai-summary.md`. CLI requires Codex login + `codex settings` defaults. |
| Gemini 2.5 Flash | `gemini --model gemini-2.5-flash --sandbox` | `.github/workflows/agents-gemini.yml` | Incident/triage workflows, multi-step plans | Supports the Gemini triage prompt library described below. Enable sandbox mode globally (`gemini settings --sandbox=ON`). |
| Jules | `jules new --repo <path>` | `.github/workflows/agents-jules-bridge.yml` | Long-running or async handoffs | Free tier capped at 15 runs/day (tracked in `agents/logs/jules-usage.json`). CLI dispatches tasks as issues + follow-up PRs. |

All runners share the same task surfaces (`agents/OPENTASKS.md`) and strictly confine edits to `agents/**` unless a task explicitly authorizes code changes elsewhere.

## Automation Stack

1. **agents-ci** (`.github/workflows/agents-ci.yml`) keeps `agents/audits`, `SITEMAP*.md`, and `OPENTASKS` in sync on `main`, weekly, or on-demand.
2. **agents-claude / agents-codex / agents-gemini** mirror the local runners in GitHub Actions. Each workflow shells into `agents/scripts` to run audits after the model completes a task.
3. **agents-jules-bridge** turns OPENTASKS rows into GitHub issues tagged for Jules so async agents can work outside CI quotas.
4. **agent-auto-execute** auto-picks the highest-priority backlog item, generates a session log + implementation prompt, and opens a draft PR tagging the requested reviewer.

### Failure Tolerance

The CLI (and Actions) now degrade gracefully: if a runner binary is missing or exits with an error (quota, auth, etc.), that step is marked failed and the next selected agent runs automatically. No manual editing is required—just install the missing CLI and rerun when convenient.

## Local Development Flow

1. **Sync deps** – `pnpm install` plus `pip install rich` (for the CLI) once per machine.
2. **Review backlog** – Run `pnpm agents:cli` (or `python scripts/agent_cli.py`) to view OPENTASKS grouped by project, then select a task.
3. **Pick runners** – Choose one or more agents. If a runner is unavailable locally, the CLI will skip it and continue to the next selection.
4. **Gemini triage (optional)** – When Gemini is selected, pick a triage template from the prompt library to pre-fill the workflow instructions.
5. **Capture outputs** – Each successful run writes a summary (`agents/audits/claude-summary.md`, `agents/audits/openai-summary.md`, `gemini-output.md`, `agents/audits/jules-summary.md`). Decide whether to run the audit/sitemap/opentask generators afterward.
6. **Commit with context** – Reference the task ID, include the generated session log, and tag `handoff` on PRs that end a workstream.

## Gemini Triage Prompt Library

Gemini has specialized prompts for triage-style work (incident response, bundle QA, and quick backlog grooming). These live under `agents/prompts/gemini_triage.json` and each entry contains:

- `key` – Stable identifier (e.g., `bug-bash`, `perf-triage`).
- `title` / `description` – Human-readable summary surfaced inside the CLI.
- `script` – Base instructions prepended to the generated task prompt.
- `checklist` – Optional bullet list the agent must cover (rendered in the CLI help panel).
- `references` – Handy links or repo paths Gemini should consult.

Use the CLI to select a template whenever Gemini is part of a run; the chosen script is automatically appended to the composed prompt so you get consistent triage output. To add a new template, append a JSON object to `gemini_triage.json`, commit it alongside any supporting docs, and rerun the CLI.

## Getting Started Checklist

1. Authenticate the four CLIs (`claude`, `codex`, `gemini`, `jules`) plus export `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `JULES_API_KEY` in your terminal (or rely on GitHub secrets when running workflows remotely).
2. Review recent activity in `agents/AUDIT-log.md` and `agents/HANDOFFS.md` to understand context.
3. Grab the latest tasks with `pnpm agents:update` whenever you switch branches to avoid stale documentation.
4. Use the CLI’s fallback behavior to chain runners—for example, Claude → Gemini → Jules—to guarantee progress even if one provider reports downtime.

With these pieces in place you can rapidly hand off work between agents, capture the resulting artifacts, and keep the CODE Platformer automation loop humming.

## LeAgentDiary Integration Playbook

**Goal:** unify the HTDI 3D scene + UI shell, this repo's agent directory, and the destination repo at https://github.com/KBLLR/Leagentdiary.

### Source Repositories
1. `/Users/davidcaballero/htdi-project` — canonical scene picker, deployment cards, task planner, and asset catalog. Docs live in `docs/leagentdiary-bridge.md`.
2. `/Users/davidcaballero/code-platformer-AI` — agent profiles, prompts, logs, and automation scripts. New template: `agents/templates/leagentdiary-profile-template.md`.
3. `/Users/davidcaballero/Leagentdiary` (clone of `git@github.com:KBLLR/Leagentdiary.git`) — target surface where both inputs land. Pull latest `main` before merging upstream work.

### Git Sync Routine
1. `cd htdi-project && git status` → add/remove `.DS_Store`, commit `docs/leagentdiary-bridge.md`, and push to `origin main`.
2. `cd code-platformer-AI && git status` → commit `agents/templates/leagentdiary-profile-template.md` + `agents/AUTOMATION_OVERVIEW.md`, then `git push origin main`.
3. `cd Leagentdiary && git remote -v` → add upstreams if needed: `git remote add htdi ../htdi-project`, `git remote add agents ../code-platformer-AI`. Use `git subtree` or `rsync` to import the UI shell + agent data.
4. After each push, create PRs in their respective GitHub repos so automation/CI runs (`agents-ci` in this repo, Vite build in HTDI).

### Multi-Agent Prompt Chain
1. **Research Agent** — run in HTDI repo, cite concrete files (e.g., `src/modules/history/deploymentTimelineUI.js:1`, `index.html:469`). Output: refreshed `docs/leagentdiary-bridge.md`.
2. **Profile Agent** — run in this repo, duplicate `agents/templates/leagentdiary-profile-template.md` to `agents/profiles/<codename>.md` + JSON, log session, update `agents/HANDOFFS.md`.
3. **Stage/Integrator Agent** — operate inside the new `leagentdiary-stage-service` repo (clean scaffold). It consumes profile JSON, calls the OpenAI 3.1.0 endpoints listed below, and emits stage links for the LeAgentDiary UI. Backend extensions live alongside `gen_idea_lab`.
4. **Timeline/QA Agent** — posts `/v1/timeline/events` updates to the LeAgentDiary repo and validates with `npm run dev`/`npm run build` across all three codebases, recording findings under `agents/projects/<project>/qa/`.

Trigger chain locally via `pnpm agents:cli`, selecting multiple runners (e.g., Claude → Codex → Jules) so each stage hands off automatically. Document every transfer in `agents/HANDOFFS.md` referencing the relevant repo + commit hash.

### Shared Asset & API Surface
- **S3 Model Bucket** — Store every GLB/texture under `s3://leagentdiary-agent-models/{agentId}/`. The stage service retrieves signed URLs via `gen_idea_lab` and never depends on repo-local binaries.
- **OpenAI API 3.1.0 Endpoints** — All new services (asset sync, stage generation, timeline, memory) must expose OpenAI-compatible endpoints:  
  - `POST /v1/agents/profiles:sync` (ingest profile payloads)  
  - `POST /v1/stages:generate` + `GET /v1/stages/{id}` (build HTDI-style stages)  
  - `POST /v1/timeline/events` (link scenes to LeAgentDiary cards)  
  - `POST /v1/memory/snapshots` + `POST /v1/memory/snapshots:query` (write/query provenance)  
Tie each response to S3 URLs + provenance IDs so downstream agents can hydrate UI cards or initiate conversations with the right context.
