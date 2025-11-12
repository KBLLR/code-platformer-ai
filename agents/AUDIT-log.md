# CODE Platformer — AUDIT Log

**Date:** 2025-11-12  
**LLM Auditor:** GPT-5 Codex (agent)  
**Project:** Gameplay Hardening Initiative  
**Author:** Agent Team  
**Tags:** audit, readiness, gameplay, workflow

---

## Good State — Definition

The build is considered **ready for handoff** when the following criteria hold true:

1. **Code quality** — Core gameplay modules (`Game.js`, `Physics.js`, `World.js`) compile and follow current logging + alias conventions. Formatting and linting remain manual; establish prettier/eslint to prevent drift.
2. **Testing** — No automated tests exist. Introduce `vitest` for deterministic math/AI utilities and capture manual QA evidence with `qa/qa-checklist.md`.
3. **Dependencies** — `npm install` succeeds with Vite 6 + Tailwind 4 beta. No `npm audit` record; schedule a sweep before tagging releases.
4. **Documentation** — Repo root README is light; `agents/AGENTS.md` and `agents/projects/gameplay-hardening/README.md` become the living sources for workflow + scope.
5. **Environments** — Dev relies on `.env` (Audio/auth URLs) but sample file is missing. Provide `.env.example` so agents can boot without guessing secrets.
6. **Version control** — Single initial commit; feature work must branch off `main` and link tasks + session logs for traceability.
7. **Stakeholders** — Gameplay maintainers and onboarding designers align via `tasks.md` + session logs; future AI copilots read `AGENTS.md` before executing tasks.

---

## Actions to Reach Good State

1. **Code review**

   * [ ] Run style sweep (prettier/eslint) across `src/` to baseline formatting.
   * [ ] Inventory TODOs/log noise in `GameController`, `Onboarding`, `Sounds`.

2. **Test pass**

   * [ ] Add first `vitest` spec around `Physics.js` collision helpers.
   * [ ] Document manual smoke process in `qa/qa-checklist.md` after each run.

3. **Deps sweep**

   * [ ] Execute `npm audit --production` and capture findings in tasks backlog.
   * [ ] Pin Tailwind beta updates; record upgrade notes inside project README.

4. **Docs refresh**

   * [x] Stand up `agents/projects/gameplay-hardening` (scope, tasks, sessions).
   * [ ] Publish `.env.example` and link it from `AGENTS.md`.

5. **Infra check**

   * [ ] Validate onboarding/auth redirects (`landing.html`, `demo_auth.html`) still resolve after build.
   * [ ] Confirm sound assets remain reachable when served from `vite preview`.

6. **VC hygiene**

   * [ ] Require every PR to cite a `tasks.md` ID and attach session log filenames.
   * [ ] Capture QA checklist link in PR description before merge.

---

## Agent Note

This audit underpins the contributor workflow documented in `agents/AGENTS.md` (also mirrored per-project inside `agents/audits/` via `agents/scripts/generate_audit.py`). New agents should:

1. Read this log to understand readiness gaps.
2. Claim a task ID from `agents/projects/gameplay-hardening/tasks.md`.
3. Start a session log before coding, reference it in commits/PRs, and update the QA checklist after validation.
