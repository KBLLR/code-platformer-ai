# Toybox / code-platformer-ai Agents

Toybox Arena is the 2.5D platform battler runtime house. It consumes rigged character outputs; it does not own rigging.

## House Contract

- House ID: `code-platformer-ai`
- Tier: `House`
- Role: Toybox Arena runtime
- Product lane: 2.5D platform battler, offline bots-first
- Canonical identity: `house.manifest.json`

## Product Truth

- Boot: `src/main.js`
- Runtime shell: `src/app/ToyboxArenaApp.js`
- Do not route new work into removed battle-royale scenes or old world-pack gameplay.

## Fighter Pipeline

- Source roster meshes: `blue`, `red`, `pink`, `black`
- Source mirrors: `public/fighters/official-v1`
- Local catalog: `public/fighters/catalog.json`
- Rigged runtime exports are owned and published by `rigging-portal`.
- Toybox consumes rigged assets through runtime manifests, publish receipts, and Warehouse bindings.

Do not hardcode raw S3, Drive, or rigging workbench paths in Toybox. Shared rigged-character assets should resolve through Warehouse contracts.

## Runtime / Dev

- Install: `npm install`
- Dev: `npm run dev`
- Contracts: `npm run validate:contracts`
- Smoke: `npm run test:smoke`
- Build: `npm run build`

## Implementation Rules

- Keep gameplay/runtime logic in Toybox.
- Keep rigging/export/publish logic in Rigging Portal.
- Preserve gamepad support and menu/rematch flows when changing gameplay UI.
- Treat fighter manifests as contracts; update validation when changing their shape.

## Verification

```bash
npm run validate:contracts
npm run test:smoke
npm run build
```
