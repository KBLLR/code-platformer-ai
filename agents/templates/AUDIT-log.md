# Project — AUDIT Log

**Date:** YYYY-MM-DD
**LLM Auditor:** [Name / Model]
**Project:** [Project Name]
**Author:** [Your Name]
**Tags:** [audit, checklist, readiness, project-state]

---

## Good State — Definition

The project is in a **good state** when it can be safely resumed, handed off, or deployed without surprises.

### Criteria

1. **Code quality** — [Describe status]
2. **Testing** — [Unit/integration/E2E results or summary]
3. **Dependencies** — [Up-to-date status, audits done]
4. **Documentation** — [Setup/API/operator notes status]
5. **Environments** — [Dev/stage/prod reproducibility]
6. **Version control** — [Branching, PR status]
7. **Stakeholders** — [Awareness of current state & next steps]

---

## Actions to Reach Good State

1. **Code review**

   - [ ] Review changed modules
   - [ ] Normalize formatting

2. **Test pass**

   - [ ] Run CI locally (`npm test`, `npm run build`, etc.)
   - [ ] Fix or quarantine flaky tests

3. **Deps sweep**

   - [ ] Run audits (`npm audit`, `pip audit`, etc.)
   - [ ] Upgrade minor/patch versions
   - [ ] Document major updates

4. **Docs refresh**

   - [ ] Update `README.project.md`, `tasks.md`, session logs
   - [ ] Confirm env vars, tokens, external services

5. **Infra check**

   - [ ] Verify integrations (WebSocket, Home Assistant, etc.)
   - [ ] Confirm URLs, ports, and secrets

6. **VC hygiene**

   - [ ] Ensure PRs link to tasks
   - [ ] Reference session logs in PRs

---

## Agent Note

Generate an `AGENTS.md` (Repository Guidelines) for new agents/contributors including:

- project layout
- run/build/test commands
- naming + style rules
- PR & contribution expectations

**Purpose:** keep human and AI collaborators aligned.
