# Agent Profiles

This directory hosts both the narrative Markdown profiles (for session logs/handoffs) and the JSON cards consumed by the interactive gallery at `public/agent-gallery.html`.

## How to add your profile

1. **Markdown story**  
   - Copy `agents/AGENT_PROFILE_TEMPLATE.md` to `agents/profiles/<codename>.md`.  
   - Fill every section (identity, visual description, personality, final prompt).

2. **Gallery card (JSON)**  
   - Copy `agents/profiles/TEMPLATE.json` to `agents/profiles/<codename>.json`.  
   - Populate the fields (favorite color/animal, quote, Suno prompt, Tencent 3D prompt, etc.).  
   - Optionally drop a `.gltf/.glb` file into `agents/profiles/models/` and reference it via `model3D`.

3. **Validate**  
   - Run `node agents/profiles/validate-profile.cjs agents/profiles/<codename>.json`.  
   - Fix any errors/warnings before committing.

4. **Preview**  
   - Open `public/agent-gallery.html` locally (or click the AGENTS button in `index.html`) to ensure your card renders correctly.

## Active Agents

### Markdown Profiles
- [Vault Keeper](./vault-keeper.md) — Asset Management & Code Organization Specialist
- [Codex Navigator](./codex-navigator.md) — Automation Orchestrator & CLI Experience Lead

### Gallery Cards
- `agents/profiles/claude-sonnet-4-5.json`
- `agents/profiles/vault-keeper.json`
- `agents/profiles/codex-navigator.json`
