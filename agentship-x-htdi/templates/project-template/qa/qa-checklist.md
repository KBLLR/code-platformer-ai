# QA Checklist — Project Template

> Duplicate this file per QA run and attach to the session log / PR summary.

## Metadata
- **Build / Commit**: `<hash>`
- **Environment**: `<local / staging / prod>`
- **Tester**: `<name>`
- **Date**: `<YYYY-MM-DD>`

## Pre-flight
- [ ] `npm install`
- [ ] Dev server smoke test (`npm run dev`, etc.)
- [ ] Production build succeeds
- [ ] Session log committed (`agents/projects/<project>/sessions/...`)

## Critical Paths

### 1. Core Experience
- [ ] Core scenario #1 behaves as expected
- [ ] Core scenario #2 behaves as expected
- [ ] No blocking console errors or warnings

### 2. UI / Flows
- [ ] All critical menus/pages load with correct copy
- [ ] Interactive controls respond (keyboard, pointer, touch)
- [ ] Animations/transitions meet UX specs

### 3. Integrations
- [ ] External services/API calls succeed
- [ ] Configuration/env vars resolved correctly
- [ ] Telemetry/logging free of repeated failures

### 4. Tooling / Export
- [ ] Command-line tools/scripts run cleanly
- [ ] Export or build artifacts produce expected files
- [ ] Docs/readme instructions align with current workflow

## Visual Checks
- [ ] Layout matches design mocks (spacing, colors, typography)
- [ ] No overlapping or clipped UI components
- [ ] Dark/light modes (if applicable) legible

## Regression / Smoke Notes
- 

## Follow-up Issues
- [ ] Logged in `agents/projects/<project>/tasks.md` (IDs: …)

## Sign-off
- ✅ / ⚠️ / ❌  — *Tester signature*
