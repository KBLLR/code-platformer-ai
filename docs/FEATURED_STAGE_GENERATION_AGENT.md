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
