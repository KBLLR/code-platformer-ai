# Open Tasks Ledger

_Last updated: 2025-11-14_

| Project | Status | ID | Title | Description | Priority | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gameplay Hardening Initiative | In Progress | GH-001 | Repository readiness audit |  |  | Agent team | Covering doc refresh + AGENTS rewrite. |
| Gameplay Hardening Initiative | Backlog | GH-002 | Harden build + preview flow | Verify `npm run dev/build/preview` on clean install, capture env setup + blockers. | High |  | Requires fresh node install smoke test. |
| Gameplay Hardening Initiative | Backlog | GH-003 | Stabilise onboarding/menu UX | Record repro steps for onboarding, multiplayer menu, and level select issues; file bugs in tasks.md. | Medium |  | Coordinate with UX owners. |
| Gameplay Hardening Initiative | Backlog | GH-004 | QA checklist integration | Adapt `qa/qa-checklist.md` for CODE Platformer paths and link results per release. | Medium |  | Populate once initial audit passes. |
| WebGPU Battle Royale | Ready | WBR-001 | Replace WebGLRenderer with WebGPURenderer | Migrate src/Game.js to use THREE.WebGPURenderer with WebGPU availability check and WebGL fallback | Critical |  | First task - foundation for all rendering improvements |
| WebGPU Battle Royale | Backlog | WBR-002 | Test shader compatibility | Verify all existing shaders work with WebGPU, update materials if needed | High |  | Depends on WBR-001 |
| WebGPU Battle Royale | Backlog | WBR-005 | Refactor to InputManager architecture | Convert src/InputController.js to universal InputManager with device abstraction | High |  | Foundation for universal input support |
| WebGPU Battle Royale | Backlog | WBR-010 | Create AnimationController class | Build animation controller using THREE.AnimationMixer with state management | Critical |  | Foundation for character animations |
| WebGPU Battle Royale | Backlog | WBR-015 | Install Rapier physics library | Add @dimforge/rapier3d-compat dependency and initialize physics world | Critical |  | Foundation for realistic physics |
| WebGPU Battle Royale | Backlog | WBR-021 | Implement TerrainGenerator with noise | Create terrain generator using simplex noise with multi-octave generation | Critical |  | Foundation for procedural arenas |
| WebGPU Battle Royale | Backlog | WBR-036 | Set up Node.js WebSocket server | Create server with ws library, connection handling, and game loop (20 tick/sec) | Critical |  | Foundation for multiplayer |
| WebGPU Battle Royale | Backlog | WBR-041 | Create NetworkClient class | Build WebSocket client with connection management and message routing | Critical |  | Client-side multiplayer foundation |

> Generated via `agents/scripts/collect_opentasks.py`.
> WebGPU Battle Royale tasks manually added. See `agents/projects/webgpu-battle-royale/tasks.md` for all 104 tasks.
