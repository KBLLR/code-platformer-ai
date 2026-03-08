# Viverse Character Examples

This directory contains minimal examples demonstrating the Viverse toolkit integration.

## Examples

### 1. Minimal Viverse Character (`minimal-viverse-character.html`)

A standalone HTML file demonstrating:
- Character loading with GLTFLoader
- Animation state machine
- Keyboard controls
- Basic physics (gravity, jumping)
- Weapon socket visualization

#### How to Run

**Option A: Local HTTP Server**
```bash
# From project root
npx http-server . -p 8080

# Open browser
open http://localhost:8080/examples/minimal-viverse-character.html
```

**Option B: Python Server**
```bash
# From project root
python3 -m http.server 8080

# Open browser
open http://localhost:8080/examples/minimal-viverse-character.html
```

**Option C: VS Code Live Server**
1. Install "Live Server" extension
2. Right-click `minimal-viverse-character.html`
3. Select "Open with Live Server"

#### Controls

| Key | Action |
|-----|--------|
| **W/A/S/D** | Move character |
| **Space** | Jump |
| **Shift** | Sprint (2x speed) |
| **C** | Crouch |
| **Click** | Shoot animation |
| **R** | Reload animation |
| **1/2/3** | Manually trigger idle/walk/run |

#### Requirements

- Modern browser with ES6 modules support
- Character model at `./public/assets/models/male_y2k_outfit.glb`
- Or any GLB model with Mixamo-style animations

#### Troubleshooting

**Character not loading?**
- Check browser console for errors
- Verify GLB file path exists
- Ensure HTTP server is running (required for modules)

**Animations not playing?**
- Check that GLB contains animation clips
- Animation names should match: idle, walk, run, jump, etc.
- Use rigging pipeline to add missing animations

**Performance issues?**
- Reduce model polygon count (<50k vertices)
- Optimize textures (WebP, max 2048px)
- Use Draco compression

## Creating Your Own Character

### Method 1: Using the Rigging Pipeline (Recommended)

```bash
# Start the rigging pipeline service
cd rigging-pipeline
npm install
npm start

# Rig a character
curl -X POST http://localhost:3001/api/rig/character \
  -H "Content-Type: application/json" \
  -d '{
    "modelPath": "./models/my-character.fbx",
    "metadata": {
      "id": "my_character",
      "name": "My Character"
    },
    "rigType": "mixamo",
    "exportFormats": ["glb", "vrm"]
  }'

# Check status
curl http://localhost:3001/api/rig/status/JOB_ID
```

### Method 2: Manual Rigging

1. **Import to Blender** (4.2+)
   - File → Import → FBX/OBJ

2. **Install AutoRig Pro**
   - Edit → Preferences → Add-ons → Install
   - Enable "AutoRig Pro"

3. **Rig Character**
   - Select character mesh
   - AutoRig Pro → Auto-Rig → Biped
   - Choose "Mixamo" bone naming

4. **Add Animations**
   - Download from Mixamo.com (in place, without skin)
   - Import animations: File → Import → FBX
   - Retarget to your rig

5. **Export GLB**
   - File → Export → glTF 2.0 (.glb)
   - Format: GLB
   - Include: Selected Objects, Animations
   - Compression: Draco
   - Texture Format: WebP

6. **Test in Example**
   - Copy GLB to `./public/assets/models/`
   - Update `characterUrl` in `minimal-viverse-character.html`
   - Reload browser

## Animation Clip Requirements

For full functionality, your character should have these animation clips:

### Locomotion
- `idle` - Standing still (loop)
- `walk` - Walking forward (loop)
- `run` - Running (loop)
- `sprint` - Fast run (loop)
- `crouch` - Crouched idle (loop)

### Airborne
- `jump` - Jump start (once)
- `fall` - Falling loop (loop)
- `land` - Landing impact (once)

### Combat
- `shoot_rifle` - Rifle shooting (once)
- `shoot_shotgun` - Shotgun shooting (once)
- `reload` - Weapon reload (once)

### Reactions
- `hit_reaction` - Taking damage (once)
- `death` - Death animation (once, terminal)

## Bone Structure

Characters should use **Mixamo bone naming**:

```
mixamorigHips
├─ mixamorigSpine
│  ├─ mixamorigSpine1
│  │  ├─ mixamorigSpine2
│  │  │  ├─ mixamorigNeck
│  │  │  │  └─ mixamorigHead
│  │  │  ├─ mixamorigLeftShoulder
│  │  │  │  └─ mixamorigLeftArm
│  │  │  │     └─ mixamorigLeftForeArm
│  │  │  │        └─ mixamorigLeftHand
│  │  │  └─ mixamorigRightShoulder
│  │  │     └─ mixamorigRightArm
│  │  │        └─ mixamorigRightForeArm
│  │  │           └─ mixamorigRightHand
├─ mixamorigLeftUpLeg
│  └─ mixamorigLeftLeg
│     └─ mixamorigLeftFoot
│        └─ mixamorigLeftToeBase
└─ mixamorigRightUpLeg
   └─ mixamorigRightLeg
      └─ mixamorigRightFoot
         └─ mixamorigRightToeBase
```

## Weapon Sockets

Weapons attach to bone named:
- `weapon_socket_r` (preferred)
- Or fallback to `mixamorigRightHand`

Create weapon socket in Blender:
1. Select armature
2. Edit Mode
3. Create bone named "weapon_socket_r"
4. Parent to "mixamorigRightHand"
5. Position at grip point

## File Size Optimization

Target: **<5MB per character** (down from 50MB)

### Techniques

**1. Draco Compression**
```javascript
// In Blender export settings
Compression: Draco
Compression Level: 10
```

**2. Texture Optimization**
```bash
# Convert to WebP
cwebp input.png -q 90 -o output.webp

# Resize textures
magick input.png -resize 2048x2048 output.png
```

**3. Mesh Decimation**
- Blender: Modifiers → Decimate
- Ratio: 0.5 (reduce to 50% of polygons)
- Target: <50,000 vertices

**4. Remove Unused Data**
- Delete unused materials
- Delete unused vertex groups
- Delete unused UV maps

## Next Steps

1. **Read the full tech spec**: `../VIVERSE_TOOLKIT_INTEGRATION.md`
2. **Set up rigging pipeline**: `../rigging-pipeline/README.md`
3. **Integrate into game**: `../src/CharacterLoader.js`
4. **Add VRM support**: `@pixiv/three-vrm` integration

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Mixamo Characters](https://www.mixamo.com/)
- [AutoRig Pro](https://www.lucky3d.fr/auto-rig-pro/doc/)
- [VRM Specification](https://vrm.dev/en/)
- [Viverse Toolkit](https://github.com/pmndrs/viverse)

---

**Questions?** Check the main `VIVERSE_TOOLKIT_INTEGRATION.md` documentation.
