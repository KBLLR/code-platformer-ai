# House Profile: code-platformer-ai

## Identity

- House ID: `code-platformer-ai`
- Product: `Toybox Arena`
- Status: `active`
- Product type: `ui`

## Mission

Build and ship a browser-native 2.5D platform battler with a clean Three.js runtime, local-first content manifests, and a fighter pipeline that consumes approved rigged exports from `rigging-portal`.

## Active Runtime

- Boot: [src/main.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/main.js)
- Shell: [src/ui/ToyboxShell.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/ui/ToyboxShell.js)
- Simulation: [src/game/ToyboxMatch.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/game/ToyboxMatch.js)
- Render: [src/render/ToyboxRenderer.js](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/src/render/ToyboxRenderer.js)

## Content Contracts

- Fighters: [public/fighters/catalog.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/fighters/catalog.json)
- Stages: [public/stages/index.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/stages/index.json)
- Modes: [public/modes/index.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/modes/index.json)
- Challenges: [public/challenges/index.json](/Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI/public/challenges/index.json)

## Runtime Constraints

- No active battle-royale product path
- No live dependency on event bus for local match play
- `rigging-portal` owns rigged export production
- Tencent `black/blue/pink/red.glb` files remain the source-of-truth starter roster meshes
