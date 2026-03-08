# Rigging Pipeline Setup Guide

The rigging pipeline is ready but requires Blender to be properly configured.

## Quick Setup (Choose One Method)

### Method A: MCP Blender Server (Recommended)

1. **Install Blender MCP Server Addon**
   ```bash
   # Clone the MCP Blender Server
   git clone https://github.com/poly-mcp/Blender-MCP-Server.git

   # Or download from: https://github.com/poly-mcp/Blender-MCP-Server
   ```

2. **Install in Blender**
   - Open Blender
   - Edit → Preferences → Add-ons
   - Click "Install..."
   - Select the addon ZIP file
   - Enable "MCP Blender Server"

3. **Start MCP Server**
   - In the addon preferences, click "Start Server"
   - Verify port is set to **9876**
   - Keep Blender open

4. **Test Connection**
   ```bash
   cd rigging-pipeline
   npm run check-blender
   ```

   Expected output:
   ```
   ✅ Blender MCP server is running!
   📦 Available tools: 51
   ```

5. **Process Characters**
   ```bash
   # Single character
   npm run rig -- process ../public/assets/models/player_001-v1.glb

   # All characters
   npm run rig -- batch
   ```

---

### Method B: Blender Command-Line (No MCP Required)

1. **Find Blender Path**
   ```bash
   # Linux
   which blender
   # Or: /usr/bin/blender

   # macOS
   /Applications/Blender.app/Contents/MacOS/Blender

   # Windows
   C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe
   ```

2. **Update Blender Path**
   Edit `rigging-pipeline/src/blender-cli.js`:
   ```javascript
   constructor(config = {}) {
     this.blenderPath = config.blenderPath || '/path/to/blender';
   }
   ```

   Or set environment variable:
   ```bash
   export BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
   ```

3. **Process Characters**
   ```bash
   cd rigging-pipeline

   # Single character
   npm run process -- single ../public/assets/models/player_001-v1.glb

   # All characters
   npm run process -- batch
   ```

---

## Current Status

✅ **Ready:**
- Rigging pipeline service structure
- MCP Blender client (HTTP-based)
- Blender CLI interface (fallback)
- Python scripts for rig enhancement
- Batch processing system
- Export optimization (Draco, WebP)

❌ **Needs Setup:**
- Blender MCP server on port 9876 (Method A)
- OR Blender command-line path (Method B)

## Verification

Test your setup:

```bash
cd rigging-pipeline

# Method A: Check MCP server
npm run check-blender

# Method B: Test Blender CLI
npm run process -- single ../public/assets/models/player_001-v1.glb
```

## Troubleshooting

### "Cannot connect to Blender MCP server"

**Problem**: MCP server addon not installed or not running

**Solution**:
1. Open Blender
2. Edit → Preferences → Add-ons
3. Search for "MCP"
4. Enable addon
5. Click "Start Server" in preferences
6. Verify port: 9876

### "spawn blender ENOENT"

**Problem**: Blender not in PATH

**Solution**:
```bash
# Add to ~/.bashrc or ~/.zshrc
export BLENDER_PATH="/path/to/blender"
export PATH="$PATH:/path/to/blender/directory"
```

Or update `rigging-pipeline/.env`:
```bash
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender
```

### "No armature found in model"

**Problem**: Model doesn't have a skeleton

**Solution**: Models need to be rigged before processing. Use Mixamo.com or AutoRig Pro to add skeleton first.

## Next Steps

Once Blender is configured:

1. ✅ Process all 4 characters (player_001-004)
2. ✅ Verify weapon sockets added
3. ✅ Test exports in `examples/minimal-viverse-character.html`
4. ✅ Update game to use rigged models
5. ✅ Deploy to S3/CDN

## Resources

- [Blender Download](https://www.blender.org/download/)
- [MCP Blender Server](https://github.com/poly-mcp/Blender-MCP-Server)
- [AutoRig Pro](https://www.lucky3d.fr/auto-rig-pro/)
- [Mixamo](https://www.mixamo.com/) (Free character rigging)
