# Running Rigging Pipeline on macOS

## Current Situation

✅ Blender is running on your Mac at `/Applications/Blender.app`
✅ MCP server is running on port 9876
❌ Can't connect from Linux container

**Solution**: Run the pipeline directly on your Mac!

---

## Setup on Mac (One-Time)

### 1. Copy the Project

```bash
# On your Mac terminal:
cd ~/Desktop  # or wherever you want
git clone <your-repo-url> code-platformer-ai
cd code-platformer-ai/rigging-pipeline
```

Or if you already have it:
```bash
cd /path/to/code-platformer-ai
git pull origin claude/viverse-toolkit-integration-01STiT2NonQ3cWs2K2CnGQ3y
cd rigging-pipeline
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Verify Blender MCP Connection

```bash
npm run check-blender
```

**Expected output**:
```
✅ Blender MCP server is running!
📦 Available tools: 51
```

---

## Processing Characters

### Process All Characters

```bash
npm run rig -- batch
```

This will:
1. Import each character GLB into Blender
2. Find the armature
3. Add weapon sockets (weapon_socket_r, weapon_socket_l)
4. Add IK targets for aiming
5. Export optimized GLB (Draco + WebP)
6. Export VRM for metaverse avatars

**Output**:
```
../public/assets/models/rigged/
├── player_001.glb
├── player_001.vrm
├── player_002.glb
├── player_002.vrm
├── player_003.glb
├── player_003.vrm
├── player_004.glb
└── player_004.vrm
```

### Process Single Character

```bash
npm run rig -- process ../public/assets/models/player_001-v1.glb
```

---

## Alternative: Manual Processing

If the automated pipeline has issues, you can process manually:

### Manual Steps (Per Character)

1. **Open Blender**
2. **Import GLB**: File → Import → glTF 2.0 (.glb/.gltf)
3. **Find Armature**: Select in Outliner (looks like skeleton icon)
4. **Switch to Pose Mode**: Ctrl+Tab or dropdown at top
5. **Add Weapon Socket**:
   - Select "RightHand" bone (or mixamorigRightHand)
   - Add → Empty → Plain Axes
   - Name it: `weapon_socket_r`
   - Press Ctrl+P → Bone (to parent to hand)
   - Adjust position: Move it slightly forward in front of palm
6. **Repeat for Left Hand** (optional):
   - Name it: `weapon_socket_l`
7. **Export GLB**:
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Check: "Draco Mesh Compression"
   - Check: "WebP Textures"
   - Compression Level: 6
   - Export to: `../public/assets/models/rigged/player_001.glb`

---

## Troubleshooting

### "npm: command not found"

Install Node.js:
```bash
brew install node
```

### "Connection refused on port 9876"

Restart MCP server in Blender:
1. Edit → Preferences → Add-ons
2. Find "MCP Blender Server"
3. Click "Disconnect from MCP server"
4. Click "Running on port 9876" to restart

### "Module not found"

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## What You'll Get

### Before (Current):
```
player_001-v1.glb (4.4MB)
- Armature with Mixamo bones
- Animations (idle, run, jump, etc.)
- Textures
```

### After (Enhanced):
```
player_001.glb (2-3MB, 30-40% smaller!)
- Everything from before
- weapon_socket_r (right hand attachment)
- weapon_socket_l (left hand attachment)
- IK targets for aiming
- Draco compressed meshes
- WebP compressed textures

player_001.vrm (VRM format)
- VRM avatar for metaverse platforms
- Works in VRChat, Cluster, VIVERSE
```

---

## Next Steps After Processing

### 1. Copy Rigged Models Back to Project

```bash
# On your Mac
cd /path/to/code-platformer-ai
cp rigging-pipeline/../public/assets/models/rigged/*.glb public/assets/models/
cp rigging-pipeline/../public/assets/models/rigged/*.vrm public/assets/models/
```

### 2. Update Character Config

Edit `src/config/characters.js` to use rigged models:

```javascript
{
  id: 'player_001',
  glb: '/assets/models/player_001.glb',  // Changed from player_001-v1.glb
  weapon_socket: 'weapon_socket_r',      // Changed from RightHand
  // ... rest stays the same
}
```

### 3. Test in Browser

```bash
npx http-server . -p 8080
# Open: http://localhost:8080/examples/minimal-viverse-character.html
```

### 4. Commit and Push

```bash
git add public/assets/models/rigged/
git add src/config/characters.js
git commit -m "feat: add rigged character models with weapon sockets"
git push origin claude/viverse-toolkit-integration-01STiT2NonQ3cWs2K2CnGQ3y
```

---

## Quick Reference

```bash
# Check connection
npm run check-blender

# Process all
npm run rig -- batch

# Process one
npm run rig -- process ../public/assets/models/player_001-v1.glb

# Test output
open ../public/assets/models/rigged/
```

---

**TL;DR**:
1. Open Terminal on your Mac
2. `cd /path/to/code-platformer-ai/rigging-pipeline`
3. `npm install`
4. `npm run rig -- batch`
5. Wait ~5-10 minutes for all 4 characters
6. Done! ✅
