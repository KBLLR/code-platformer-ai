# Character Rigging Pipeline

Automated character rigging pipeline using MCP Blender + AutoRig Pro.

## Prerequisites

1. **Blender 4.2+** installed
2. **AutoRig Pro** addon installed (optional, for auto-rigging)
3. **MCP Blender Server** addon installed and running on port 9876

## Quick Start

### 1. Install Dependencies

```bash
cd rigging-pipeline
npm install
```

### 2. Check Blender Connection

```bash
npm run check-blender
```

Expected output:
```
✅ Blender MCP server is running!
📦 Available tools: 51
```

If this fails, make sure:
- Blender is open
- MCP server addon is enabled (Edit → Preferences → Add-ons)
- Server is listening on port 9876

### 3. Process Characters

**Single character:**
```bash
npm run rig -- process ../public/assets/models/player_001-v1.glb
```

**All characters (batch):**
```bash
npm run rig -- batch
```

## CLI Commands

### `check`
Check if Blender MCP server is running

```bash
npm run rig -- check
```

### `process <file>`
Process a single character model

```bash
npm run rig -- process path/to/character.glb
```

Options:
- Imports model to Blender
- Validates skeleton structure
- Adds weapon sockets (RightHand, LeftHand)
- Adds IK targets for aiming
- Exports optimized GLB with Draco compression
- Exports VRM for metaverse compatibility

### `batch`
Process all characters from manifest.json

```bash
npm run rig -- batch
```

Reads characters from `../public/characters/manifest.json` and processes all models.

## Output

Processed models are saved to:
```
../public/assets/models/rigged/
├── player_001.glb (optimized)
├── player_001.vrm (VRM avatar)
├── player_002.glb
├── player_002.vrm
├── player_003.glb
├── player_003.vrm
├── player_004.glb
└── player_004.vrm
```

## Pipeline Stages

Each character goes through 5 stages:

1. **Import** - Load model into Blender
2. **Validate** - Check skeleton structure
3. **Enhance** - Add weapon sockets and IK targets
4. **Export GLB** - Export with Draco compression + WebP textures
5. **Export VRM** - Export VRM avatar format (optional)

## Configuration

Edit `config/default.json` to customize:

```json
{
  "mcp": {
    "blender": {
      "port": 9876,
      "timeout": 60000
    }
  },
  "export": {
    "glb": {
      "dracoCompression": true,
      "dracoCompressionLevel": 10,
      "textureFormat": "webp",
      "maxTextureSize": 2048
    }
  }
}
```

## Troubleshooting

### "Cannot connect to Blender MCP server"

1. Open Blender
2. Go to Edit → Preferences → Add-ons
3. Search for "MCP"
4. Enable the MCP Server addon
5. Check that port is set to 9876
6. Click "Start Server"

### "No armature found in model"

Model must have a skeleton (armature) to be processed. If using raw mesh:

1. Import mesh to Blender manually
2. Add armature (Add → Armature)
3. Use AutoRig Pro to generate rig
4. Export and try again

### "Export failed"

Check Blender console for errors. Common issues:
- Missing VRM addon (for VRM export)
- Invalid bone structure
- Corrupted model data

## Python Scripts

Blender scripts are in `blender-scripts/`:

- `enhance_rig.py` - Adds weapon sockets and IK targets

These run inside Blender via MCP's Python executor.

## API Usage

You can also use the pipeline programmatically:

```javascript
import { RiggingPipeline } from './src/pipeline.js';

const pipeline = new RiggingPipeline();
await pipeline.initialize();

const result = await pipeline.processCharacter('path/to/character.glb', {
  id: 'my_character',
  addWeaponSockets: true,
  addIKTargets: true,
  exportVRM: true
});

await pipeline.shutdown();
```

## Next Steps

After rigging:

1. Test models in the example: `../examples/minimal-viverse-character.html`
2. Update game code to use rigged models
3. Add VRM avatar support if needed
4. Deploy to CDN/S3

## Resources

- [MCP Blender](https://github.com/poly-mcp/Blender-MCP-Server)
- [AutoRig Pro](https://www.lucky3d.fr/auto-rig-pro/doc/)
- [VRM Specification](https://vrm.dev/en/)
- [Viverse Toolkit](https://github.com/pmndrs/viverse)
