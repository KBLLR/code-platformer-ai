# QA Checklist — CODE Platformer AI

> Duplicate this file per QA run and attach to the session log / PR summary.

## Metadata
- **Build / Commit**: `<hash>`
- **Environment**: `<local / staging / prod>`
- **Tester**: `<name>`
- **Date**: `<YYYY-MM-DD>`

## Pre-flight
- [ ] `npm install`
- [ ] `npm run dev` (smoke HMR, console clean)
- [ ] `npm run build`
- [ ] `npm run preview`
- [ ] Session log committed (`agents/projects/gameplay-hardening/sessions/…`)

## Critical Paths

### 1. Game Boot & Rendering
- [ ] `index.html` loads canvas + HUD without blank frames
- [ ] Level geometry, lighting, and shaders render on initial spawn
- [ ] Camera follow + zoom responds to keyboard + pointer controls
- [ ] No `THREE.WebGLRenderer` warnings in console

### 2. Menus & Onboarding
- [ ] `landing.html` auth mock redirects into onboarding
- [ ] Onboarding flow completes and stores state in localStorage
- [ ] Main menu buttons show/hide appropriate wraps; level select populates entries
- [ ] Character select enforces player count + starts game without reload

### 3. Audio & Assets
- [ ] `Sounds.LoadSounds` resolves; theme loops at 15% volume
- [ ] Missing asset warnings handled via LoaderManager (no 404s)
- [ ] Muting/unmuting or focusing tab resumes AudioContext

### 4. Multiplayer & Input
- [ ] Keyboard + gamepad bindings respond in GameController
- [ ] Human player count respected when launching from menu/onboarding
- [ ] HUD indicators update positions + scores per player

### 5. Build Output
- [ ] `dist/` contains hashed assets; entry HTML references relative paths
- [ ] `vite preview` serves without 404s for wasm/audio assets
- [ ] `.env` overrides applied correctly (check `VITE_*` usage)

## Visual Checks
- [ ] Canvas + HUD align with design tokens (Tailwind classes)
- [ ] Menu transitions (Main, Level, Character) show/hide without jumps
- [ ] No debug overlays (stats pane, bounding boxes) remain in prod build

## Regression / Smoke Notes
- 

## Follow-up Issues
- [ ] Logged in `agents/projects/gameplay-hardening/tasks.md` (IDs: …)

## Sign-off
- ✅ / ⚠️ / ❌  — *Tester signature*
