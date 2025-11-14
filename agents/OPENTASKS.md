# Open Tasks Ledger

_Last updated: 2025-11-14_

| Project | Status | ID | Title | Description | Priority | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gameplay Hardening Initiative | In Progress | GH-001 | Repository readiness audit |  |  | Agent team | Covering doc refresh + AGENTS rewrite. |
| Gameplay Hardening Initiative | Backlog | GH-002 | Harden build + preview flow | Verify `npm run dev/build/preview` on clean install, capture env setup + blockers. | High |  | Requires fresh node install smoke test. |
| Gameplay Hardening Initiative | Backlog | GH-003 | Stabilise onboarding/menu UX | Record repro steps for onboarding, multiplayer menu, and level select issues; file bugs in tasks.md. | Medium |  | Coordinate with UX owners. |
| Gameplay Hardening Initiative | Backlog | GH-004 | QA checklist integration | Adapt `qa/qa-checklist.md` for CODE Platformer paths and link results per release. | Medium |  | Populate once initial audit passes. |
| WebGPU Battle Royale Transformation | Backlog | ID | Title | Description | Priority | Owner | Notes |
| WebGPU Battle Royale Transformation | Backlog | ID | Title | Description | Priority | Owner | Notes |
| WebGPU Battle Royale Transformation | Backlog | ID | Title | Description | Priority | Owner | Notes |
| WebGPU Battle Royale Transformation | Backlog | ID | Title | Description | Priority | Owner | Notes |
| WebGPU Battle Royale Transformation | Backlog | WBR-001 | Replace WebGLRenderer with WebGPURenderer | Swap renderer in src/Game.js, implement fallback detection | Critical |  | Architecture: Section 2.1 |
| WebGPU Battle Royale Transformation | Backlog | WBR-002 | Test WebGPU compatibility | Verify shadow maps, tone mapping, and materials work with WebGPU | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-003 | Implement browser fallback system | Detect WebGPU availability, fallback to WebGL gracefully | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-004 | Benchmark WebGPU performance | Measure FPS improvements, draw calls, particle counts | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-005 | Refactor InputController to InputManager | Create universal input architecture with device abstraction | High |  | Architecture: Section 3.1 |
| WebGPU Battle Royale Transformation | Backlog | WBR-006 | Implement TouchInput system | Add virtual joysticks and touch buttons for mobile | High |  | Architecture: Section 3.2.B |
| WebGPU Battle Royale Transformation | Backlog | WBR-007 | Add MouseInput with pointer lock | Implement FPS-style mouse camera control | Medium |  | Architecture: Section 3.2.C |
| WebGPU Battle Royale Transformation | Backlog | WBR-008 | Create AccessibilityInput system | Eye tracking, voice commands, switch scanning support | Low |  | Architecture: Section 3.2.D |
| WebGPU Battle Royale Transformation | Backlog | WBR-009 | Build input configuration UI | Rebinding interface, sensitivity settings, presets | Medium |  | Architecture: Section 3.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-010 | Create AnimationController class | Animation mixer, state tracking, clip management | Critical |  | Architecture: Section 5.1 |
| WebGPU Battle Royale Transformation | Backlog | WBR-011 | Implement AnimationStateMachine | State definitions, transition logic, update system | Critical |  | Architecture: Section 5.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-012 | Integrate animations with Player | Update Player.js to use animation controller | High |  | Architecture: Section 5.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-013 | Document character model requirements | GLB structure, skeleton, animation clip specifications | Medium |  | Architecture: Section 5.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-014 | Implement IK for weapon holding | Hand placement on weapons using IK solver | Medium |  | Architecture: Section 5.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-015 | Install Rapier physics library | Add @dimforge/rapier3d-compat dependency | Critical |  | Architecture: Section 6.1 |
| WebGPU Battle Royale Transformation | Backlog | WBR-016 | Create PhysicsWorld wrapper | Initialize Rapier world, manage bodies and colliders | Critical |  | Architecture: Section 6.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-017 | Implement character controller | Capsule collider, kinematic body, ground detection | Critical |  | Architecture: Section 6.2, 6.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-018 | Add projectile physics | Dynamic rigid bodies for bullets, collision detection | High |  | Architecture: Section 6.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-019 | Create terrain colliders | Static trimesh colliders from terrain geometry | High |  | Architecture: Section 6.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-020 | Migrate Player movement to physics | Replace custom physics with Rapier character controller | High |  | Architecture: Section 6.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-021 | Install simplex-noise library | Add procedural generation dependency | High |  | Architecture: Section 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-022 | Create TerrainGenerator class | Noise-based height map generation, chunk system | Critical |  | Architecture: Section 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-023 | Implement GPU compute shader for terrain | Offload heightmap computation to GPU | High |  | Architecture: Section 2.2, 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-024 | Create BiomeSystem | Define biomes, moisture/temperature noise, prop distribution | High |  | Architecture: Section 4.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-025 | Build StructureGenerator | Procedural building generation with templates | High |  | Architecture: Section 4.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-026 | Implement structure templates | Warehouse, apartment, bunker, tower templates | Medium |  | Architecture: Section 4.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-027 | Create PropGenerator | Trees, rocks, vehicles, environmental props | Medium |  | Architecture: Section 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-028 | Build GenerationFactory | Main factory for creating complete arenas | Critical |  | Architecture: Section 4.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-029 | Implement weapon spawn system | Procedural weapon placement in arenas | High |  | Architecture: Section 4.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-030 | Create loot crate system | Randomized loot containers in arenas | High |  | Architecture: Section 4.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-031 | Build play zone mechanics | Shrinking circle with damage system | Critical |  | Architecture: Section 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-032 | Create zone boundary visuals | Circle outline, effects, warning system | Medium |  | Architecture: Section 4.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-033 | Implement zone shrink schedule | Timed progression, configurable stages | High |  | Architecture: Section 4.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-034 | Test arena generation performance | Ensure <10s generation time for 2km² arena | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-035 | Optimize chunk loading/unloading | LOD and streaming for large terrains | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-036 | Set up Node.js WebSocket server | Create server project, WebSocket setup | Critical |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-037 | Implement MatchManager | Queue system, match creation, lifecycle | Critical |  | Architecture: Section 7.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-038 | Create Match class | Server-side match simulation, tick rate, state | Critical |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-039 | Build PlayerManager | Player tracking, connection handling | High |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-040 | Implement server game loop | 20 tick/sec update, physics simulation | Critical |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-041 | Create NetworkClient class | Client-side WebSocket connection | Critical |  | Architecture: Section 7.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-042 | Implement client-side prediction | Apply inputs immediately, store for reconciliation | Critical |  | Architecture: Section 7.4, 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-043 | Add server reconciliation | Correct prediction errors from server updates | Critical |  | Architecture: Section 7.4, 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-044 | Implement entity interpolation | Smooth remote player movement | High |  | Architecture: Section 7.4, 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-045 | Build latency compensation | Clock sync, ping measurement | High |  | Architecture: Section 7.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-046 | Create state snapshot system | Efficient state serialization | High |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-047 | Implement server-authoritative validation | Input validation, anti-cheat checks | Critical |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-048 | Add movement validation | Speed hack detection, position verification | High |  | Architecture: Section 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-049 | Implement hit registration validation | Server-side raycast verification | High |  | Architecture: Section 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-050 | Build rate limiting system | Prevent input flooding, DoS protection | Medium |  | Architecture: Section 7.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-051 | Implement snapshot compression | Delta compression for bandwidth savings | High |  | Architecture: Section 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-052 | Add network culling | Spatial partitioning, only sync nearby players | High |  | Architecture: Section 7.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-053 | Create reconnection system | Handle disconnects, rejoin matches | Medium |  | Architecture: Section 7.4 |
| WebGPU Battle Royale Transformation | Backlog | WBR-054 | Implement lobby system | Pre-match lobby, player ready status | Medium |  | Architecture: Section 7.3 |
| WebGPU Battle Royale Transformation | Backlog | WBR-055 | Create match lifecycle system | Lobby → Plane → Game → End states | Critical |  | Architecture: Section 4.5 |
| WebGPU Battle Royale Transformation | Backlog | WBR-056 | Implement player spawning | Random spawn points, parachute drop | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-057 | Build elimination tracking | Death tracking, kill credits | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-058 | Create spectator mode | Watch other players after elimination | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-059 | Implement victory condition | Last player/team standing detection | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-060 | Build match statistics | Kills, damage, survival time tracking | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-061 | Create weapon pickup system | Interact with weapons, equip/drop | Critical |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-062 | Implement armor system | Armor items, damage reduction | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-063 | Build inventory management | UI for managing items, hotkeys | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-064 | Create loot rarity system | Common, rare, epic, legendary tiers | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-065 | Implement loot tables | Balanced drop rates per tier | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-066 | Add headshot detection | Bone-based hit detection for bonus damage | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-067 | Implement damage falloff | Distance-based damage reduction | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-068 | Create weapon spread patterns | Recoil and accuracy systems | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-069 | Enhance recoil system | Weapon-specific recoil patterns | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-070 | Balance weapon damage | Testing and tuning all weapons | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-071 | Redesign match HUD | Health, armor, ammo, minimap, zone timer | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-072 | Implement mini-map | Top-down view, player positions, zone | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-073 | Create kill feed | Recent eliminations display | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-074 | Build spectator UI | Camera controls, player list | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-075 | Design end-game screen | Victory/defeat, statistics, leaderboard | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-076 | Implement leaderboards | Top players, seasonal rankings | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-077 | Implement LOD system | Multiple detail levels for models | High |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-078 | Optimize frustum culling | Efficient off-screen object culling | High |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-079 | Add occlusion culling | Don't render objects behind walls | Medium |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-080 | Implement instanced rendering | Batch similar objects (trees, rocks) | High |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-081 | Create texture atlasing | Reduce draw calls with texture atlases | Medium |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-082 | Implement object pooling | Reuse projectiles, particles, effects | High |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-083 | Add spatial partitioning | Octree for physics optimization | High |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-084 | Optimize physics sleeping | Disable physics for stationary objects | Medium |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-085 | Implement asset streaming | Load chunks on demand | Medium |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-086 | Add DRACO compression | Compress GLB models by 90% | High |  | Architecture: Section 6.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-087 | Mobile optimization pass | Touch controls, reduced graphics settings | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-088 | Create post-processing effects | Bloom, DOF, color grading | Medium |  | Architecture: Section 10.2 |
| WebGPU Battle Royale Transformation | Backlog | WBR-089 | Implement particle systems | Muzzle flash, impact effects, explosions | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-090 | Add environmental effects | Weather system (rain, fog, wind) | Low |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-091 | Enhance lighting system | Dynamic shadows, GI approximation | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-092 | Texture quality pass | High-res textures for key assets | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-093 | Implement 3D spatial audio | Positional audio for weapons, footsteps | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-094 | Add weapon sound variations | Multiple sound samples per weapon | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-095 | Create footstep system | Surface-based footstep sounds | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-096 | Implement ambient audio | Environmental sounds per biome | Low |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-097 | Add dynamic music system | Intensity-based music transitions | Low |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-098 | Conduct load testing | Test 100 concurrent players | Critical |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-099 | Performance profiling | Identify and fix bottlenecks | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-100 | Bug fixing sprint | Address all critical and high bugs | Critical |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-101 | Balance gameplay | Tune weapons, loot, zone timing | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-102 | Accessibility testing | Test all accessibility features | Medium |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-103 | Cross-browser testing | Chrome, Firefox, Safari, Edge compatibility | High |  |  |
| WebGPU Battle Royale Transformation | Backlog | WBR-104 | Create ragdoll physics | Death animations with physics | Medium |  | Architecture: Section 6.4 |

> Generated via `agents/scripts/collect_opentasks.py`.
