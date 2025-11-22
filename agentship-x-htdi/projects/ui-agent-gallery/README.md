# UI Agent Gallery & Dossier

## Overview

This project tracks the work around the in-game agent discovery experiences:

- Rich local CLI (`pnpm agents:cli`) with multi-agent dispatcher and animated UX
- Agent JSON/GLB profile pipeline (`agents/profiles/*.json`, `agents/profiles/models/`)
- Web gallery (`/agent-gallery.html`) and Three.js dossier viewer (`/agent-card-view.html`)

Use these entry points to understand the system:

| Location | Purpose |
| --- | --- |
| `public/agent-gallery.html` | Tailwind grid that lists agents via JSON metadata |
| `public/agent-card-view.html` | Full-screen Three.js dossier powered by GLB models |
| `agents/profiles/README.md` | How to create Markdown + JSON profiles |
| `agents/profiles/validate-profile.cjs` | Ensures each profile has an `agentId` and prompts |

## How to Contribute

1. Pick a task from `tasks.md` (IDs `UAG-00X`) or add a new one.
1. Create/update JSON + GLB assets in `agents/profiles/`.
1. Run `node agents/profiles/validate-profile.cjs agents/profiles/<codename>.json`.
1. Preview via `pnpm dev` + `/agent-gallery.html` / `/agent-card-view.html`.
1. Log your work in `tasks.md` and add a handoff entry when finished.

## Current Goals

- Grow the agent catalog with more JSON/GLB pairs
- Integrate the gallery entry point with landing/onboarding flows
- Add search/filtering + caching so the viewer scales with many agents
