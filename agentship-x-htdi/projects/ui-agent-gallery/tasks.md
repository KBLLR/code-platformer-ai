# Task Ledger — UI Agent Gallery

Track UI/3D showcase tasks here. Keep the table sorted by priority.

## Backlog

| ID | Title | Description | Priority | Owner | Notes |
|----|-------|-------------|----------|-------|-------|
| UAG-004 | Landing/onboarding entry point | Wire the AGENTS gallery into landing/onboarding flows so new players see the team immediately. | Medium | | Could be a CTA in `landing.html` or onboarding carousel. |
| UAG-005 | Gallery search & filters | Allow filtering by provider, role, or completion status once the list grows. | Medium | | Consider client-side search over JSON metadata. |

## In Progress

| ID | Title | Started | Owner | Notes |
|----|-------|---------|-------|-------|

## Done

| ID | Title | Completed | Outcome |
|----|-------|-----------|---------|
| UAG-001 | Rich CLI multi-agent UX | 2025-11-15 | `scripts/agent_cli.py` now uses Rich tables/spinners, multi-agent dispatch, Jules quota tracker, and root-relative navigation so operators can drive CLI automation comfortably. |
| UAG-002 | Agent gallery + JSON pipeline | 2025-11-15 | Restored `public/agent-gallery.html`, JSON templates, validator, and GLB slots so any agent can publish their profile card from metadata alone. |
| UAG-003 | Three.js dossier view | 2025-11-15 | Ported the full-screen Three.js UI (centered background text, tweakpane controls, GLB loader) to `/agent-card-view.html` and tied it to profile metadata/prompts. |

> Add/remove rows as needed, but keep the structure predictable.
