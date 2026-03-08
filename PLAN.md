# Core-X-Native Battle Royale Plan for `code-platformer-AI`

**Summary**

- Recast the house as a Core-X-native 3D battle royale house, not a mixed 2.5D/3D experiment.
- Keep v1 scope: `3D only`, `1 human + 11 bots`, `local/browser runtime`, `generated arena layouts`, `Auto-Rig Pro canonical character pipeline`.
- Fix the current blockers before feature work:
  - Normalize the house identity to one canonical ID: `code-platformer-ai`.
  - Repair the broken asset model contract (`assets.json` nested models vs flat-array runtime assumptions).
  - Replace legacy/stale generation endpoints with canonical gateway `/v1/responses`.
  - Standardize characters onto one skinned, animated export contract; three current player GLBs are static meshes and one is only partially rigged.
- Ecosystem rule: directly reuse only shared Core-X libraries such as [openresponses.ts](/Users/davidcaballero/core-x-kbllr_0/core-x/lib/openresponses.ts), [a2a-client.ts](/Users/davidcaballero/core-x-kbllr_0/core-x/lib/a2a-client.ts), and [registry-client.ts](/Users/davidcaballero/core-x-kbllr_0/core-x/lib/registry-client.ts). Borrow patterns, not runtime imports, from other houses.

**Ecosystem Alignment**

- Normalize `house_id` everywhere to `code-platformer-ai`.
  - Update `house.manifest.json`, `functions.manifest.json`, AGENTS docs, orchestrator IDs, event names, RAG collection names, and regenerate registries.
  - Target collections become `house:code-platformer-ai:docs` and `house:code-platformer-ai:arena-presets`.
- Update the house manifest to declare the real ecosystem dependencies:
  - Services: `gateway`, `mlx-llm`, `mlx-rag`, `mlx-vision`, `mlx-embed`, `mlx-audio`, `event-bus`.
  - Related houses: `avatar-labs`, `memory-labs`, `flash-ui-mlx`.
  - Keep `house-functions`; add `mlx-rag` where tooling or authoring needs retrieval.
- Move all AI/generation transport to shared Core-X gateway clients.
  - Do not keep or expand `/v1/chat/completions` or `/v1/vision/chat` patterns found elsewhere in the repo.
  - The arena authoring surface uses `/v1/responses` with OpenResponses streaming and typed SSE parsing.
- Add A2A/event-bus integration using the shared client.
  - Broadcast: `code-platformer-ai.status`, `code-platformer-ai.match.started`, `code-platformer-ai.match.completed`, `code-platformer-ai.arena.generated`, `code-platformer-ai.asset.validation.failed`, `task.complete`, `health.pong`.
  - Subscribe: `task.request`, `health.ping`, `council.directive`.
  - Use `agent-avenue`’s A2A probe/flow style as the pattern for verification, not a custom bus implementation.
- Adopt the architecture patterns of other houses without hard-coupling to them.
  - `memory-labs`: scene registry, app shell, in-world authoring surface.
  - `smart-campus`: scene lifecycle and scene-config separation.
  - `avatar-labs`: asset manifest normalization, animation mixer discipline, clip metadata/timeline conventions.
  - `flash-ui-mlx`: streaming authoring UX and retry-safe OpenResponses generation.

**Runtime and Content Changes**

- Replace the current hard-coded `GameViverse` arena bootstrap with a scene-based runtime.
  - `LobbyScene`: house-aware authoring/seed selection.
  - `MatchScene`: live battle royale loop.
  - No active legacy 2.5D mode.
- Convert `StageGenerator` from a loose stage builder into a deterministic `ArenaConfig -> playable arena` compiler.
  - Generated outputs are structured layouts only: terrain tiles, ramps, cover clusters, loot sockets, spawn points, bot waypoints, and safe-zone phases.
  - No raw HTML scene generation in gameplay runtime.
- Add a `BattleRoyaleMatchDirector`.
  - Owns match phases, safe-zone shrink, loot distribution, bot roster fill, elimination tracking, spectate flow, and winner declaration.
  - No respawns in this mode.
- Replace the current orbital camera with a single-player chase camera.
  - Human controls: `WASD`, mouse aim/yaw, `Space` jump, left-click fire, `Shift` sprint, `E` interact/swap.
  - On death: spectate nearest surviving bot until match end.
- Rebuild character runtime around one canonical export contract.
  - Add `public/characters/manifest.json` modeled after avatar manifest normalization, with `id`, `file`, `display_name`, `skeleton_id`, `required_clips`, `weapon_socket`, and `tags`.
  - Every runtime character gets one `AnimationMixer`, one state machine, and one required socket name: `weapon_socket_r`.
  - Required clips: `idle`, `run`, `jump`, `fall`, `land`, `hit`, `death`, `equip`, `fire`.
- Character authoring pipeline is fixed:
  - Auto-Rig Pro Quick Rig in `Convert` mode for the canonical rig.
  - Auto-Rig Pro Remap for sourced motions.
  - Export `.glb` with embedded clips according to Blender glTF action/NLA rules.
  - `avatar-labs` is the reference house for animation runtime discipline, but its head/avatar runtime is not imported into the game.

**Interfaces and Automation**

- Introduce these house-facing interfaces:
  - `ArenaConfig`: `seed`, `theme`, `bounds`, `terrainBands`, `coverClusters`, `spawnPoints`, `lootPoints`, `botWaypoints`, `safeZonePhases`, `lighting`, `sky`.
  - `CharacterManifestEntry`: `id`, `file`, `display_name`, `skeleton_id`, `required_clips`, `weapon_socket`, `tags`.
  - `MatchStatusEvent`: `match_id`, `arena_id`, `phase`, `alive_count`, `human_alive`, `winner_id?`, `severity?`.
- Update `functions.manifest.json` to expose ecosystem-relevant tools instead of only local gameplay helpers.
  - Keep: stage/rules/physics/HUD tools where still valid.
  - Add: `generate_arena_config`, `validate_character_asset`, `simulate_match`, `publish_match_status`, `ingest_arena_notes`.
- Add three house flows, following the same flow-first automation style used in other houses.
  - `battle-royale-match-smoke`: boot seeded match, verify status events, verify winner path.
  - `arena-authoring-refresh`: generate or refine arena configs, validate them, ingest accepted notes into RAG.
  - `character-pipeline-validate`: validate GLBs, sockets, clips, and manifest coverage before runtime use.
- Keep cross-house reuse disciplined.
  - Shared Core-X libs are imported directly.
  - Other houses are referenced through manifest contracts, A2A, copied patterns, or shared schema, not direct source imports.

**Test Plan**

- Registry/identity tests:
  - One canonical `house_id` across manifest, orchestrator, functions, registries, A2A events, and RAG collections.
- Asset/runtime tests:
  - `assets.json` normalization resolves players/weapons correctly.
  - All runtime character GLBs pass validation for skin, clip set, and socket.
  - Match runtime boots with one human plus eleven bots and reaches a clean win condition.
- Arena generation tests:
  - `ArenaConfig` validation rejects malformed AI output.
  - `ArenaConfig -> StageGenerator -> spawn/loot/zone extraction` is deterministic for a seed.
  - AI generation falls back to seeded templates when gateway output is invalid.
- Ecosystem tests:
  - `/v1/responses` generation works through the shared OpenResponses client.
  - Event-bus messages appear in history with the correct `house_id` and correlation IDs.
  - House flows can run end-to-end without custom local shims.
- Acceptance criteria:
  - The house can generate, load, and play a valid battle royale arena using only canonical Core-X protocols.
  - The game surfaces match lifecycle through A2A/status events.
  - Character content is produced through a repeatable Blender/Auto-Rig Pro export path, not per-model exceptions.

**Assumptions**

- Canonical house ID is `code-platformer-ai`.
- The folder path stays `houses/code-platformer-AI`; only logical IDs are normalized.
- Voice, SAiD, and avatar-performance crossover are out of the v1 gameplay loop; only the animation/manifest/runtime patterns from `avatar-labs` are reused.
- Arena generation is retrieval-assisted structured authoring, not full 3D world synthesis.
- Build/runtime verification is still blocked until dependencies are installed in this environment; earlier `npm run build` failed because `vite` was not available.

**Research Anchors**

- [Auto-Rig Pro Quick Rig](https://www.lucky3d.fr/auto-rig-pro/doc/quick_rig_doc.html)
- [Auto-Rig Pro Game Engine Export](https://www.lucky3d.fr/auto-rig-pro/doc/ge_export_doc.html)
- [Auto-Rig Pro Remap](https://www.lucky3d.fr/auto-rig-pro/doc/remap_doc.html)
- [Blender glTF 2.0 Exporter](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
