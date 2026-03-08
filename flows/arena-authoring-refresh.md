---
description: Generate or refine arena configs, validate, and ingest notes into RAG
---

# Arena Authoring Refresh

AI-assisted arena design loop using OpenResponses for generation
and RAG for persisting design notes.

## Steps

1. **Generate ArenaConfig via OpenResponses**

   ```js
   import { OpenResponsesClient } from "./src/core-x/OpenResponsesClient.js";
   import { validateArenaConfig } from "./src/interfaces/ArenaConfig.js";

   const client = new OpenResponsesClient("http://localhost:8090");
   const response = await client.chat(
     "Generate a JSON ArenaConfig for a neon-themed battle royale arena with 12 spawn points.",
     "default",
   );
   const config = JSON.parse(response);
   validateArenaConfig(config); // Throws if malformed
   ```

2. **Validate config**
   - Must have >= 12 spawn points
   - Must have >= 1 safe zone phase
   - Theme must be from allowed list

3. **Fallback**
   - If AI output is invalid, use `createDefaultArenaConfig(seed)` template.

4. **Ingest notes into RAG**
   - POST design notes to `http://localhost:8090/v1/documents`
   - Collection: `house:code-platformer-ai:arena-presets`

## Pass Criteria

- [ ] AI-generated configs pass validation
- [ ] Invalid configs are rejected with clear errors
- [ ] Fallback to seeded defaults works
- [ ] Notes ingested into RAG collection
