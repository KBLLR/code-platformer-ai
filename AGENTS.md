# code-platformer-AI Agents

## Paradigm (House-Level)

- House ID: `code-platformer-ai`
- Role: Core-X-native 3D Battle Royale House
- Status/Type: active · ui
- This house participates in the Core-X ecosystem by emitting and consuming **OpenResponses** events via the Event Bus. No local schema forks.

## Sources of Truth (No Split Brain)

- `/registries/houses.registry.json`
- `/registries/agents.registry.json`
- `/registries/services.registry.json`
- `/registries/models.registry.json` (model-zoo)
- Event Bus: `http://localhost:8085/events` (SSE) and `POST http://localhost:8085/emit`

## Interfaces

- No registered endpoints.

## Services

- No registered services.

## Orchestration & Linking

- Orchestrator: none registered
- Local link: n/a
- Dev script: listed in registry

## Communication (OpenResponses)

- Emit events using the canonical OpenResponses schema (no local copies).
- Subscribe to the Event Bus SSE stream for activity.
- Use `response.*` and `tool.*` events for agent activity and tool calls.

## RAG / Knowledge (if applicable)

- Collection naming: `house:code-platformer-ai:<collection>`
- Use gateway `http://localhost:8090` for RAG (`/v1/search`, `/v1/documents`). Direct 8092 is admin-only.

## Runtime / Dev

- Run `npm install` then `npm run dev` (vite).

## Notes

- If you add new endpoints/services, update `/registries/houses.registry.json` and regenerate registries.
