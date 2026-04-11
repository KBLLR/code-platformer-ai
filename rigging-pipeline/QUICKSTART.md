# Quick Start Guide - Rigging Pipeline

## Current Status

Your characters are **already well-optimized**:
- player_001-v1.glb: 4.4MB ✓
- player_002-v1.glb: 4.0MB ✓
- player_003-v1.glb: 4.3MB ✓
- player_004-v1.glb: 4.4MB ✓

All under the 5MB target! 🎉

## Why Run the Pipeline?

The pipeline adds:
1. **Weapon sockets** - Proper attachment points for guns
2. **IK targets** - Better weapon aiming with CCDIKSolver
3. **VRM export** - Metaverse-compatible avatars
4. **Enhanced animations** - Retargeting support

---

## Starting the MCP Blender Server

### Step 1: Check if Blender is Running

```bash
ps aux | grep -i blender
```

If Blender isn't open, start it first.

### Step 2: Install MCP Server Addon

**Option A: From GitHub**
```bash
# Download the addon
git clone https://github.com/poly-mcp/Blender-MCP-Server.git
cd Blender-MCP-Server
zip -r blender-mcp-server.zip .
```

**Option B: Direct Download**
Go to: https://github.com/poly-mcp/Blender-MCP-Server/releases

### Step 3: Install in Blender

1. Open Blender
2. Edit → Preferences (or ⌘, on Mac)
3. Add-ons tab
4. Click **"Install..."** button (top right)
5. Select the ZIP file
6. Search for "MCP" in addons list
7. **Check the checkbox** to enable it

### Step 4: Start the Server

In the addon preferences (click the arrow to expand):
- Set **Port**: `9876`
- Click **"Start Server"** button
- You should see: "Server running on port 9876"

### Step 5: Test Connection

```bash
cd /home/user/code-platformer-ai/rigging-pipeline
npm run check-blender
```

Expected output:
```
✅ Blender MCP server is running!
📦 Available tools: 51
```

---

## If MCP Server Won't Work

### Alternative: Use Existing Models As-Is

Your models are already optimized! Just use them:

```javascript
// In your game code
import { loadCharacter } from './src/CharacterLoader.js';

const character = await loadCharacter({
  id: 'player_001',
  displayName: 'Agent One',
  glb: '/assets/models/player_001-v1.glb',
  weapon_socket: 'RightHand', // or 'mixamorigRightHand'
  required_clips: ['idle', 'run', 'jump', 'fall', 'attack', 'die']
}, scene);
```

### Alternative: Manual Weapon Sockets

If you need weapon sockets, add them manually in Blender:

1. Open character in Blender
2. Find the armature
3. Go to Pose Mode (Ctrl+Tab)
4. Select RightHand bone
5. Add → Empty → Plain Axes
6. Name it `weapon_socket_r`
7. Parent to bone (Ctrl+P → Bone)
8. Export GLB

---

## Troubleshooting

### "Connection refused" on port 9876

**Cause**: MCP server not started

**Fix**:
1. Open Blender
2. Edit → Preferences → Add-ons
3. Find "MCP Blender Server"
4. Click **"Start Server"** in addon preferences

### "spawn blender ENOENT"

**Cause**: Blender not in PATH

**Fix**:
```bash
# Find Blender
which blender
find / -name blender 2>/dev/null | head -n 3

# Add to PATH or set env var
export BLENDER_PATH="/path/to/blender"
```

### Port Already in Use

**Cause**: Something else on port 9876

**Fix**:
```bash
# Find what's using it
lsof -i :9876

# Change port in addon preferences
# Update rigging-pipeline/config/default.json
```

---

## Quick Commands

```bash
# Test MCP connection
npm run check-blender

# Process single character (MCP)
npm run rig -- process ../public/assets/models/player_001-v1.glb

# Process all characters (MCP)
npm run rig -- batch

# Process single character (CLI - no MCP)
npm run process -- single ../public/assets/models/player_001-v1.glb

# Process all characters (CLI - no MCP)
npm run process -- batch
```

---

## Current Character Status

✅ **Models exist and are optimized**
✅ **Animations included**
✅ **Ready to use in game**

❓ **Missing (optional enhancements)**:
- Dedicated weapon sockets (currently using hand bones)
- IK targets for advanced aiming
- VRM export for metaverse compatibility

**Recommendation**: Test the current models in the example first:

```bash
cd /home/user/code-platformer-ai
npx http-server . -p 8080
# Open: http://localhost:8080/examples/minimal-viverse-character.html
```

If they work well, you might not need to run the rigging pipeline at all! 🎮
