# LeAgentDiary Agent Profile Template

Use this template when creating or updating an agent who will bridge the HTDI experience with the LeAgentDiary platform. Reference `/Users/davidcaballero/htdi-project/docs/leagentdiary-bridge.md` for the full UI + asset map.

## 1. Identity + Role
- **Codename:** `<your agent name>`
- **Mandate:** `e.g., "Transplant HTDI scene carousel + deployment cards into LeAgentDiary"`
- **Key Systems Owned:** `Task Planner | Scene Picker | Deployment Timeline | 3D Avatar`

## 2. Scene & Palette Alignment
- **Preferred HTDI Scene:** `studio-lite | era | omega` (see `src/data/scenes.js` in HTDI)
- **HDR / Cubemap IDs:** `from src/config/assetCatalog.js`
- **UI Tokens:** `surfaceBg`, `cardBg`, `accent`, `textPrimary`, `textSecondary`
- **Frame Overlay Variant:** `/public/svg/uiframe/00?.svg`

## 3. Avatar & Model Assets
- **S3 Model Key:** `s3://leagentdiary-agent-models/<agentId>/model.glb` (stage service pulls signed URLs)
- **3D Model (local preview):** `agents/profiles/models/<file.glb>` (mirror HTDI kid rig or supply new GLB for dev only)
- **Texture Set:** `kidSkin variant + any emissive/innerSphere tweaks`
- **Animation Notes:** `idle loop, gesture cues`
- **Music / Audio Cue:** `reference track ID from HTDI music player (src/music/musicPlayerUI.js)`

## 4. UI Responsibilities
- **Task Planner Hooks:** `map HTDI modal (#modal-tasks) to agents/projects/*/tasks.md`
- **Deployment Cards:** `reuse src/modules/history/deploymentTimelineUI.js logic`
- **Scene Configurator:** `ensure scenePickerUI.js interactions map to agent profile state`
- **Footer Actions:** `declare which buttons the agent maintains (info, tasks, music, deployments, data, ai)`
- **Stage API Hooks:** `list required OpenAI API calls (e.g., /v1/stages:generate, /v1/timeline/events) and payload snippets`

## 5. Data + Prompt Chains
- **Primary Data Sources:** `agents/OPENTASKS.md`, `agents/audits/*.md`, `htdi-project/api/vercel-deployments.mjs`
- **Prompt Chain Outline:**  
  1. `Research HTDI component (cite file + line)`  
  2. `Update agent profile JSON/MD`  
  3. `Sync assets into public/`  
  4. `Open PR against KBLLR/Leagentdiary`
- **Fail-safes / Guards:** `cache manifest versions, record asset provenance`

## 6. Handoff Checklist
- [ ] Profile Markdown + JSON committed (`agents/profiles/`)
- [ ] Session log recorded under `agents/projects/<project>/sessions/`
- [ ] `agents/HANDOFFS.md` updated with summary + next agent
- [ ] HTDI + code-platformer repos pushed to GitHub (no dirty files except intentional assets)
- [ ] Follow-up issue drafted in https://github.com/KBLLR/Leagentdiary if work carries over
- [ ] Stage snapshot + timeline card published via OpenAI 3.1.0 endpoints (`/v1/stages:generate`, `/v1/timeline/events`)

_Drop this template into your session log or duplicate it per agent to keep LeAgentDiary aligned with HTDI’s UI DNA._
