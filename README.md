# Toybox Arena

`code-platformer-ai` now ships one active product: `Toybox Arena`, a side-view 2.5D fantasy toybox platform battler built with `Vite + Three.js`.

## Product

- `1 human + 3 bots`
- Modes: `TDM`, `FFA`, `Survival`
- Combat: `ring-out + knockback`
- Items: movement boost, temporary shield, bomb, shell projectile, spring trap
- Input: keyboard + gamepad parity
- Roster: official Tencent starter source meshes `blue`, `red`, `pink`, `black`
- Animation pipeline: `rigging-palace` owns rigged runtime exports; Toybox falls back to procedural playback until those exports are ready

## Runtime

- Boot path: `/` only
- Entry file: [src/main.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/main.js)
- Active runtime:
  - [src/app/ToyboxArenaApp.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/app/ToyboxArenaApp.js)
  - [src/game/ToyboxMatch.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/game/ToyboxMatch.js)
  - [src/render/ToyboxRenderer.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/render/ToyboxRenderer.js)
  - [src/ui/ToyboxShell.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/ui/ToyboxShell.js)

## Official Fighter Assets

- Source mirrors:
  - [public/fighters/official-v1/blue.glb](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/official-v1/blue.glb)
  - [public/fighters/official-v1/red.glb](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/official-v1/red.glb)
  - [public/fighters/official-v1/pink.glb](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/official-v1/pink.glb)
  - [public/fighters/official-v1/black.glb](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/official-v1/black.glb)
- Runtime contract:
  - [public/fighters/catalog.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/catalog.json)
  - [src/interfaces/RiggedRuntimeFighter.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/interfaces/RiggedRuntimeFighter.js)

## Commands

```bash
npm install
npm run dev
npm run validate:contracts
npm run test:smoke
npm run build
```

## Notes

- The old battle-royale runtime is no longer the product path.
- If a rigged export is missing or stale, the runtime uses the Tencent source mesh plus procedural animation clips as a temporary fallback.
- If `rigging-palace` publishes ready exports later, Toybox will prefer the rigged runtime manifest automatically.
