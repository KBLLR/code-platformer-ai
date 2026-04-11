# code-platformer-ai Agents

## Paradigm

- House ID: `code-platformer-ai`
- Role: `Toybox Arena` runtime house
- Status/Type: `active · ui`
- Product lane: 2.5D platform battler, offline bots-first

## Product Truth

- Boot from [src/main.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/main.js)
- Runtime shell: [src/app/ToyboxArenaApp.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/app/ToyboxArenaApp.js)
- Do not route new work into removed battle-royale scenes or world-pack gameplay

## Fighter Pipeline

- Source roster meshes:
  - `blue`
  - `red`
  - `pink`
  - `black`
- Source mirrors live under [public/fighters/official-v1](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/official-v1)
- Rigged runtime exports are owned by `rigging-palace`
- Toybox consumes [public/fighters/catalog.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/catalog.json) plus per-fighter rigged runtime manifests

## Runtime / Dev

- Install: `npm install`
- Dev: `npm run dev`
- Contracts: `npm run validate:contracts`
- Smoke: `npm run test:smoke`
- Build: `npm run build`
