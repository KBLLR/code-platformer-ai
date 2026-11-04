# Featured Stage Generation Agent Roadmap

**Date:** 2026-06-23
**Status:** Under development
**Applies to:** Toybox Arena, Code Platformer AI, battle-royale stage generation

## Purpose

Toybox should treat stage generation as a gameplay capability inside Code Platformer AI, not as a dependency on a standalone `world-generative-labs` house.

The planned agent will generate battle-royale arena candidates for Toybox, using the existing stage/runtime contracts and validating the result against gameplay constraints before a stage can be used in a match.

## Intended Role

The stage generation agent turns a match or arena brief into a playable Toybox stage configuration.

Inputs:

- Match mode and player count.
- Battle-royale constraints, including spawn safety, platform reachability, pickup distribution, camera readability, and bot navigation.
- Theme direction from Toybox, HTDI featured-agent context, or a hand-authored arena brief.
- Existing StageGenerator-compatible JSON where available.

Outputs:

- A validated arena brief.
- A StageGenerator-compatible stage configuration.
- Spawn, platform, pickup, hazard, lighting, camera, and theme directives.
- Validation notes for gameplay balance and render safety.

## Skills Under Development

- `arena-brief-parser`: normalize a user or agent request into Toybox arena requirements.
- `platform-layout-generator`: generate traversable platform layouts for battle-royale play.
- `spawn-and-pickup-balancer`: distribute players, bots, weapons, and pickups fairly.
- `bot-navigation-check`: reject layouts with unreachable or degenerate combat spaces.
- `arena-theme-selector`: map creative direction into Toybox-safe visuals and lighting.
- `stagegenerator-export`: emit a StageGenerator-compatible JSON configuration.

## Boundaries

- Toybox owns gameplay/runtime rules, stage validation, and battle-royale feel.
- HTDI owns profile-aware featured-agent display stages.
- Rigged character assets remain resolved through Rigging Portal and Warehouse contracts.
- No standalone World Generative Labs house is required for this path.

## Acceptance Criteria

1. A Toybox arena brief can produce a deterministic stage configuration.
2. The stage configuration passes spawn, traversal, pickup, and camera validation.
3. The generated stage can be loaded by the Toybox StageGenerator path.
4. The same skill family can be reused for HTDI display stages without importing Toybox gameplay logic.

## Prototype Status (2026-11-04)

The first working slice is in the repo. The stage is generated deterministically from a seed and an optional brief, validated against a contract, and loaded into a match only when explicitly requested.

| Spec skill | Prototype module | State |
| --- | --- | --- |
| `arena-brief-parser` | `src/stage/arenaBrief.js` (+ optional planner in `src/stage/stageAgent.js`) | keyword parser; injected planner with deterministic fallback, no network |
| `platform-layout-generator` | `src/stage/StageGenerator.js` | `balanced` / `vertical` / `wide` layouts, 1–4 tiers |
| `spawn-and-pickup-balancer` | `src/stage/StageGenerator.js` + `src/stage/stageRules.js` | geometric placement and separation; no balance scoring yet |
| `bot-navigation-check` | `src/stage/stageRules.js#analyzeReachability` | analytical jump graph from runtime physics and weakest fighter |
| `arena-theme-selector` | `src/stage/stageThemes.js` | 6 palette themes; no lighting or props yet |
| `stagegenerator-export` | `src/content/stageContract.js` (`toybox-generated-stage-v1`) | contract + validator; superset of catalog stage shape |

Acceptance criteria against this prototype:

1. A brief + seed produces a deterministic stage configuration: yes (`pnpm run test:stages`, including a golden fingerprint).
2. The configuration passes spawn and traversal validation: yes. Pickup checks are geometric only; camera checks cover render-safe bounds only.
3. The generated stage loads through the Toybox runtime path: yes, opt-in via `?stageSeed=<seed>&stageBrief=<text>` or `resolveMatchStage({ generated })`.
4. Reuse for HTDI display stages: not started. The generator and contract have no gameplay imports beyond `MATCH_PHYSICS` / `ITEM_TYPES`.

Usage:

```js
import { generateStage } from "./src/stage/StageGenerator.js";
const stage = generateStage({ seed: "demo", brief: "tall ember tower, chaotic", fighters });
```

See `progress.md` (2026-11-04) for verification details and what's left.
