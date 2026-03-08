---
description: Validate character GLBs for sockets, clips, and manifest coverage
---

# Character Pipeline Validate

Verifies that all character GLBs in the manifest pass the
canonical export contract requirements.

## Steps

1. **Load manifest**

   ```bash
   cat public/characters/manifest.json
   ```

2. **Validate manifest schema**

   ```js
   import { validateCharacterManifest } from "./src/interfaces/CharacterManifestEntry.js";

   const manifest = await fetch("/characters/manifest.json").then((r) =>
     r.json(),
   );
   validateCharacterManifest(manifest);
   ```

3. **Validate each GLB** (requires Three.js + GLTFLoader)
   For each entry in manifest:
   - Load the `.glb` file via GLTFLoader
   - Check for `SkinnedMesh` (skinned, not static)
   - Check for required animation clips: idle, run, jump, fall, land, hit, death, equip, fire
   - Check for `weapon_socket_r` bone in skeleton

4. **Report results**
   ```
   ✅ player-001 (Alpha): 9/9 clips, socket found, skinned
   ⚠️ player-002 (Bravo): 6/9 clips (missing: fall, land, equip), static mesh
   ```

## Pass Criteria

- [ ] All manifest entries have unique IDs
- [ ] All referenced GLB files exist
- [ ] Characters with full clip sets pass validation
- [ ] Missing clips/sockets are reported as warnings
