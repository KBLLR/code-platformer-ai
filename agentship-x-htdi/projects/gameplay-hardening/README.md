# Gameplay Hardening Initiative

Stabilise the CODE Platformer AI build so contributors can resume work without rediscovering tribal knowledge. This project tracks readiness work spanning gameplay systems, onboarding, and documentation.

## Objectives
- Audit current repo state (code quality, tests, dependencies, docs) and document gaps.
- Ensure local dev (Vite + Three.js) runs cleanly with reproducible `.env` usage.
- Capture outstanding gameplay polish tasks plus onboarding fixes in a shared backlog.
- Log every working session to keep human/AI collaborators aligned.

## Success Criteria
- `npm run dev`, `npm run build`, and onboarding flows succeed without console errors.
- Updated `agents/AGENTS.md` reflects this workflow and references the active project.
- Each task in `tasks.md` links to at least one session log and PR on completion.
- QA checklist run before release candidates with findings logged under `qa/`.

## Stakeholders
- **Driver:** CODE Platformer AI agent team
- **Reviewers:** Gameplay maintainers, onboarding designers
- **Consumers:** QA crew, future AI copilots

## Dependencies
- Three.js + Vite toolchain versions in `package.json`
- Tailwind 4 beta and AudioContext APIs across browsers
- Auth/onboarding mocks served via `landing.html` & `demo_auth.html`

## Artifacts
- `tasks.md` — canonical backlog and flow control.
- `sessions/` — timestamped work logs (clone from `sessions/session-template.md`).
- `qa/` — copy `qa-checklist.md` per test pass and attach evidence.
- `future-features/` — parking lot for ideas outside current scope.

> Commit session logs alongside the code changes they describe so every PR has a traceable narrative.
