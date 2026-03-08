# Viverse Toolkit Integration - Technical Specification

**Project**: CODE Platformer AI
**Version**: 2.0
**Date**: 2026-03-08
**Status**: In Development

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Viverse Toolkit Components](#viverse-toolkit-components)
4. [Integration Points](#integration-points)
5. [Rigging Pipeline](#rigging-pipeline)
6. [Character Animation System](#character-animation-system)
7. [Asset Pipeline](#asset-pipeline)
8. [API Reference](#api-reference)
9. [Migration Guide](#migration-guide)
10. [Performance Optimization](#performance-optimization)

---

## Overview

### What is Viverse Toolkit?

**@pmndrs/viverse** (v0.2.6) is a comprehensive 3D toolkit for web-based virtual worlds, providing:
- Character animation systems with Mixamo bone mapping
- Physics integration with Rapier
- Advanced collision detection (BVH)
- VRM avatar support (@pixiv/three-vrm v3.4.4)
- Timeline-based animation orchestration

### Integration Goals

1. **Modernize character loading** - Replace static GLB imports with dynamic Viverse system
2. **Automated rigging pipeline** - MCP Blender + AutoRig Pro for consistent character rigs
3. **Animation retargeting** - Universal animation library that works across all characters
4. **VRM avatar support** - Enable metaverse-compatible character formats
5. **Performance optimization** - Reduce model sizes from 50MB to <5MB
6. **Reusable ecosystem pipeline** - Portable rigging system for any project

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       GAME RUNTIME (Browser)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CharacterLoader.js                                           │  │
│  │  ├─ Viverse Character Animation                              │  │
│  │  ├─ VRM Avatar Loading (@pixiv/three-vrm)                    │  │
│  │  └─ Animation State Machine                                  │  │
│  └─────────────────┬────────────────────────────────────────────┘  │
│                    │                                                 │
│  ┌─────────────────▼────────────────────────────────────────────┐  │
│  │  AnimationController.js (Viverse-powered)                     │  │
│  │  ├─ Mixamo bone mapping                                       │  │
│  │  ├─ IK Solver (CCDIKSolver) for weapon aiming               │  │
│  │  ├─ Animation blending & transitions                          │  │
│  │  └─ State machine: idle→walk→run→jump→shoot→death            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ CDN/S3 Assets
                                    │
┌───────────────────────────────────┴─────────────────────────────────┐
│                    ASSET PIPELINE (Build-time)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Rigging Pipeline Service (Node.js)                           │  │
│  │  ├─ MCP Blender Client                                        │  │
│  │  ├─ AutoRig Pro Automation                                    │  │
│  │  ├─ Animation Retargeting                                     │  │
│  │  └─ Export: GLB (optimized) + VRM (avatar)                   │  │
│  └─────────────────┬────────────────────────────────────────────┘  │
│                    │                                                 │
│  ┌─────────────────▼────────────────────────────────────────────┐  │
│  │  MCP Blender Server (Port 9876)                               │  │
│  │  ├─ Blender 4.2+ Automation                                   │  │
│  │  ├─ AutoRig Pro Plugin                                        │  │
│  │  ├─ VRM Exporter                                              │  │
│  │  └─ 51 Tools (poly-mcp/Blender-MCP-Server)                   │  │
│  └─────────────────┬────────────────────────────────────────────┘  │
│                    │                                                 │
│  ┌─────────────────▼────────────────────────────────────────────┐  │
│  │  Asset Storage & Distribution                                 │  │
│  │  ├─ S3: s3://leagentdiary-agent-models/{agentId}/            │  │
│  │  ├─ CDN: https://cdn.leagentdiary.com                        │  │
│  │  └─ Google Drive: Shared model library                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Raw Model (FBX/OBJ/VRM)
    ↓
[Google Drive / Local Storage]
    ↓
[Rigging Pipeline API]
    ├─ Validate mesh topology
    ├─ Import to Blender (MCP)
    ├─ AutoRig Pro: Generate skeleton
    ├─ Setup IK targets for weapons
    ├─ Retarget animations (Mixamo)
    ├─ Optimize mesh & textures
    └─ Export GLB + VRM
    ↓
[S3 Upload + CDN Distribution]
    ↓
[manifest.json Update]
    ↓
[Game Runtime]
    ├─ CharacterLoader.js fetches GLB/VRM
    ├─ Viverse AnimationController loads clips
    ├─ AnimationStateMachine manages states
    └─ Render character with animations
```

---

## Viverse Toolkit Components

### 1. Character Animation System

**Location**: `@pmndrs/viverse/dist/animation/`

#### Key Features
- **Mixamo Bone Mapping**: Pre-configured bone structure for Mixamo-rigged characters
- **Animation Retargeting**: Universal animation clips that work across different characters
- **Blend Trees**: Smooth transitions between animation states
- **IK Solvers**: Inverse kinematics for weapon aiming and foot placement

#### Bone Structure (Mixamo Standard)

```javascript
const MIXAMO_BONES = {
  // Core skeleton
  hips: 'mixamorigHips',
  spine: 'mixamorigSpine',
  chest: 'mixamorigSpine1',
  upperChest: 'mixamorigSpine2',
  neck: 'mixamorigNeck',
  head: 'mixamorigHead',

  // Left arm
  leftShoulder: 'mixamorigLeftShoulder',
  leftUpperArm: 'mixamorigLeftArm',
  leftLowerArm: 'mixamorigLeftForeArm',
  leftHand: 'mixamorigLeftHand',
  leftThumb: 'mixamorigLeftHandThumb1',
  leftIndex: 'mixamorigLeftHandIndex1',
  leftMiddle: 'mixamorigLeftHandMiddle1',
  leftRing: 'mixamorigLeftHandRing1',
  leftPinky: 'mixamorigLeftHandPinky1',

  // Right arm
  rightShoulder: 'mixamorigRightShoulder',
  rightUpperArm: 'mixamorigRightArm',
  rightLowerArm: 'mixamorigRightForeArm',
  rightHand: 'mixamorigRightHand',
  rightThumb: 'mixamorigRightHandThumb1',
  rightIndex: 'mixamorigRightHandIndex1',
  rightMiddle: 'mixamorigRightHandMiddle1',
  rightRing: 'mixamorigRightHandRing1',
  rightPinky: 'mixamorigRightHandPinky1',

  // Left leg
  leftUpperLeg: 'mixamorigLeftUpLeg',
  leftLowerLeg: 'mixamorigLeftLeg',
  leftFoot: 'mixamorigLeftFoot',
  leftToeBase: 'mixamorigLeftToeBase',

  // Right leg
  rightUpperLeg: 'mixamorigRightUpLeg',
  rightLowerLeg: 'mixamorigRightLeg',
  rightFoot: 'mixamorigRightFoot',
  rightToeBase: 'mixamorigRightToeBase'
};
```

### 2. VRM Avatar Support

**Package**: `@pixiv/three-vrm` (v3.4.4)

#### VRM Features
- **Humanoid Rig**: Standardized bone mapping across all avatars
- **Spring Bones**: Hair, cloth, and accessory physics
- **Expression Morphs**: Facial animations and lip-sync
- **Look-At**: Eye tracking and gaze direction
- **Meta Information**: Avatar name, author, license

#### VRM Export Configuration

```javascript
const VRM_CONFIG = {
  version: '1.0',
  metadata: {
    title: 'Agent Character',
    author: 'CODE Platformer AI',
    contactInformation: 'https://github.com/KBLLR/code-platformer-ai',
    licenseType: 'redistribution_prohibited',
    allowedUserName: 'onlyAuthor',
    violentUsage: 'disallow',
    sexualUsage: 'disallow',
    commercialUsage: 'disallow'
  },
  humanoid: {
    armStretch: 0.05,
    legStretch: 0.05,
    upperArmTwist: 0.5,
    lowerArmTwist: 0.5,
    upperLegTwist: 0.5,
    lowerLegTwist: 0.5,
    feetSpacing: 0,
    hasTranslationDoF: false
  },
  firstPerson: {
    firstPersonBone: 'mixamorigHead',
    firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 },
    meshAnnotations: []
  }
};
```

### 3. Physics Integration

**Package**: `@pmndrs/viverse` (Rapier physics engine)

#### Features
- **Rigid Body Dynamics**: Character physics simulation
- **Collision Detection**: BVH (Bounding Volume Hierarchy) optimization
- **Ragdoll Physics**: Death animations with realistic body mechanics
- **Ground Detection**: Automatic foot placement and surface alignment

---

## Integration Points

### CharacterLoader.js Enhancement

**File**: `/src/CharacterLoader.js`

#### Before (Static GLB Loading)

```javascript
export async function loadCharacter(entry, scene) {
  const gltf = await new Promise((resolve, reject) => {
    _loader.load(entry.glb, resolve, undefined, reject);
  });

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = new Map();

  for (const logicalName of entry.required_clips) {
    const clip = resolveClip(gltf.animations, logicalName, entry.clip_aliases);
    if (clip) {
      actions.set(logicalName, mixer.clipAction(clip));
    }
  }

  return { root: gltf.scene, mixer, anim: new AnimationStateMachine(mixer, actions) };
}
```

#### After (Viverse Integration)

```javascript
import { loadCharacterAnimation, createAnimationController } from '@pmndrs/viverse';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

export async function loadCharacter(entry, scene) {
  console.log(`[CharacterLoader] Loading "${entry.id}" from ${entry.glb}`);

  // Load GLB with VRM support
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf = await loader.loadAsync(entry.glb);
  const root = gltf.scene;

  // Extract VRM avatar if available
  let vrm = null;
  if (entry.vrm && gltf.userData.vrm) {
    vrm = gltf.userData.vrm;
    console.log(`[CharacterLoader] VRM avatar loaded for "${entry.id}"`);
  }

  // Setup Viverse animation controller
  const animController = createAnimationController(root, {
    boneMapping: 'mixamo', // Use Mixamo bone structure
    ikSolvers: {
      rightHand: { target: 'weapon_socket_r', chain: 3 },
      leftHand: { target: 'weapon_socket_l', chain: 3 }
    },
    blendTime: 0.3 // Smooth transitions
  });

  // Load animations with Viverse
  const animations = {};
  for (const clipName of entry.required_clips) {
    const clip = await loadCharacterAnimation(root, clipName, {
      source: 'mixamo',
      retarget: true,
      loop: ['idle', 'run', 'fall'].includes(clipName)
    });

    if (clip) {
      animations[clipName] = clip;
      animController.addClip(clipName, clip);
    }
  }

  // Fallback to GLB embedded animations
  const rawClips = gltf.animations || [];
  for (const rawClip of rawClips) {
    const logicalName = normalizeClipName(rawClip.name);
    if (!animations[logicalName]) {
      animController.addClip(logicalName, rawClip);
    }
  }

  // Setup animation state machine
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();

  animController.getAllClips().forEach((clip, name) => {
    const action = mixer.clipAction(clip);
    action.setLoop(
      ['idle', 'run', 'fall'].includes(name) ? THREE.LoopRepeat : THREE.LoopOnce
    );
    actions.set(name, action);
  });

  const anim = new AnimationStateMachine(mixer, actions);

  // Weapon socket
  const weaponSocket = findWeaponSocket(root, entry.weapon_socket || 'weapon_socket_r');

  return {
    root,
    mixer,
    anim,
    weaponSocket,
    animController, // NEW: Viverse controller
    vrm,             // NEW: VRM avatar data
    clips: new Map(rawClips.map(c => [c.name, c]))
  };
}

function normalizeClipName(rawName) {
  // Convert various naming conventions to logical names
  // "Armature|idle" → "idle"
  // "mixamorig|Walk" → "walk"
  return rawName.split('|').pop().toLowerCase().trim();
}
```

### AnimationStateMachine.js Enhancement

**File**: `/src/AnimationStateMachine.js`

#### State Transitions with Viverse

```javascript
import { BlendTree } from '@pmndrs/viverse';

export class AnimationStateMachine {
  constructor(mixer, actions, viverseController) {
    this.mixer = mixer;
    this.actions = actions;
    this.viverse = viverseController;
    this.currentName = null;
    this.currentAction = null;

    // Setup blend tree for locomotion
    this.locomotionBlend = new BlendTree({
      states: ['idle', 'walk', 'run', 'sprint'],
      blendParameter: 'speed', // 0 = idle, 1 = walk, 2 = run, 3 = sprint
      blendTime: 0.3
    });
  }

  play(name, fadeTime = 0.3) {
    const action = this.actions.get(name);
    if (!action) {
      console.warn(`[AnimationStateMachine] No action "${name}"`);
      return;
    }

    // Fade out current animation
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(fadeTime);
    }

    // Fade in new animation
    action.reset().fadeIn(fadeTime).play();

    this.currentName = name;
    this.currentAction = action;

    // Update Viverse controller
    if (this.viverse) {
      this.viverse.playAnimation(name, { fadeTime });
    }
  }

  playBlended(speed) {
    // Blend between locomotion states based on speed
    let stateName;
    if (speed < 0.1) stateName = 'idle';
    else if (speed < 1.5) stateName = 'walk';
    else if (speed < 3.0) stateName = 'run';
    else stateName = 'sprint';

    this.locomotionBlend.setParameter('speed', speed);
    this.play(stateName, 0.2);
  }

  update(delta) {
    this.mixer.update(delta);

    if (this.viverse) {
      this.viverse.update(delta);
    }

    this.locomotionBlend.update(delta);
  }
}
```

---

## Rigging Pipeline

### MCP Blender Integration

**Selected Server**: [poly-mcp/Blender-MCP-Server](https://github.com/poly-mcp/Blender-MCP-Server)

#### Features
- **51 Tools**: Comprehensive Blender automation
- **Thread-Safe**: Concurrent job processing
- **Auto-Dependencies**: Automatic plugin installation
- **AutoRig Pro Ready**: Pre-configured for character rigging

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              Rigging Pipeline Orchestrator                      │
│              (Node.js Service + MCP Client)                     │
└────────────┬──────────────────────────────┬────────────────────┘
             │                               │
   ┌─────────▼─────────┐         ┌─────────▼──────────┐
   │  MCP Blender      │         │  Asset Pipeline    │
   │  Server           │◄───────►│  S3 + CDN          │
   │  (Port 9876)      │         │  + Google Drive    │
   └────────┬──────────┘         └────────────────────┘
            │
   ┌────────▼───────────────────────────────────┐
   │  Blender Automation Layer                  │
   │  ├─ Character Import (FBX/GLB/OBJ/VRM)    │
   │  ├─ AutoRig Pro Automation                 │
   │  ├─ Animation Retargeting                  │
   │  ├─ IK Rig Setup (weapon sockets)         │
   │  └─ Export: GLB (optimized) + VRM         │
   └────────┬───────────────────────────────────┘
            │
   ┌────────▼───────────────────────────────────┐
   │  Quality Assurance                         │
   │  ├─ Bone structure validation              │
   │  ├─ Animation clip verification            │
   │  ├─ Mesh topology checks                   │
   │  └─ Performance metrics                    │
   └────────────────────────────────────────────┘
```

### Pipeline Stages

#### Stage 1: Input Validation

```javascript
// rigging-pipeline/src/stages/01-input.js

export class InputStage {
  supportedFormats = ['fbx', 'obj', 'glb', 'gltf', 'dae', 'vrm', 'blend'];

  async processRawModel(modelPath, metadata) {
    // Validate file format
    const validation = await this.validateInputFile(modelPath);
    if (!validation.valid) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    // Extract metadata
    const modelInfo = {
      format: this.detectFormat(modelPath),
      vertexCount: validation.vertexCount,
      materialCount: validation.materialCount,
      hasSkeleton: validation.hasSkeleton,
      animationCount: validation.animationCount,
      sourceMetadata: metadata
    };

    return { modelPath, metadata: modelInfo, ready: true };
  }
}
```

#### Stage 2: AutoRig Pro Automation

```python
# rigging-pipeline/blender-scripts/autorig_automation.py

import bpy
from autorig import autorig_core

def setup_autorig(character_mesh, rig_preset='mixamo'):
    """Automate AutoRig Pro for Mixamo-compatible rigging"""

    # Initialize AutoRig Pro
    autorig = autorig_core.get_autorig()

    # Generate rig with Mixamo bone naming
    bone_mapping = {
        'hips': 'mixamorigHips',
        'spine': 'mixamorigSpine',
        'chest': 'mixamorigSpine1',
        'neck': 'mixamorigNeck',
        'head': 'mixamorigHead',
        # ... (full mapping)
    }

    # Generate skeleton
    armature = autorig.generate_rig(
        mesh=character_mesh,
        bone_mapping=bone_mapping,
        ik_legs=True,
        ik_arms=True,
        finger_controllers=True
    )

    # Setup weapon IK targets
    setup_weapon_ik(armature)

    # Auto weight painting
    autorig.auto_weight_paint(character_mesh)

    return armature

def setup_weapon_ik(armature):
    """Create IK targets for CCDIKSolver weapon aiming"""

    # Right hand IK chain
    create_ik_target('weapon_socket_r', 'mixamorigRightHand')

    # Left hand IK chain
    create_ik_target('weapon_socket_l', 'mixamorigLeftHand')
```

#### Stage 3: Animation Retargeting

```javascript
// rigging-pipeline/src/stages/04-animation-retargeting.js

export class AnimationRetargeter {
  async retargetFromMixamo(sourceClipPath, targetRig) {
    const result = await this.mcp.retargetAnimation(
      sourceClipPath,
      targetRig,
      {
        boneMapping: this.mixamoBoneMap,
        preserveRootMotion: false, // Remove for platformer
        frameRate: 30
      }
    );
    return result;
  }

  async batchRetarget(animationLibrary, targetRig) {
    const requiredClips = [
      'idle', 'walk', 'run', 'jump', 'fall', 'land',
      'crouch', 'shoot_rifle', 'shoot_shotgun', 'reload',
      'hit_reaction', 'death'
    ];

    const results = [];
    for (const clipName of requiredClips) {
      const sourcePath = animationLibrary[clipName];
      if (sourcePath) {
        const retargeted = await this.retargetFromMixamo(sourcePath, targetRig);
        results.push({ name: clipName, clip: retargeted });
      }
    }
    return results;
  }
}
```

#### Stage 4: Export Optimization

```javascript
// rigging-pipeline/src/stages/05-export.js

export class ExportStage {
  async exportCharacter(riggedModel, animations, metadata) {
    // Export optimized GLB
    const glbPath = await this.mcp.exportGLB(riggedModel.name,
      `/tmp/export/${metadata.id}.glb`,
      {
        includeAnimations: true,
        optimizeMeshes: true,
        dracoCompression: true, // Reduce size by ~70%
        textureFormat: 'webp',  // Smaller than PNG/JPG
        maxTextureSize: 2048,   // Limit resolution
        targetFileSize: 5 * 1024 * 1024 // 5MB target (vs 50MB current)
      }
    );

    // Export VRM avatar
    const vrmPath = await this.mcp.exportVRM(
      riggedModel.armature.name,
      `/tmp/export/${metadata.id}.vrm`,
      {
        version: '1.0',
        metadata: VRM_CONFIG.metadata
      }
    );

    return { glb: glbPath, vrm: vrmPath };
  }
}
```

### API Endpoints

```javascript
// rigging-pipeline/src/api/server.js

const app = express();

// Submit rigging job
app.post('/api/rig/character', async (req, res) => {
  const { modelPath, metadata, animations } = req.body;

  const job = await pipeline.submitJob({
    modelPath,
    metadata,
    animations,
    options: {
      rigType: req.body.rigType || 'mixamo',
      exportFormats: ['glb', 'vrm'],
      optimizations: {
        targetFileSize: 5 * 1024 * 1024,
        dracoCompression: true
      }
    }
  });

  res.json({ jobId: job.id, status: 'queued' });
});

// Get job status
app.get('/api/rig/status/:jobId', async (req, res) => {
  const job = await pipeline.getJob(req.params.jobId);
  res.json({
    jobId: job.id,
    status: job.status, // queued, processing, completed, failed
    progress: job.progress,
    result: job.result
  });
});

// Batch retarget animations
app.post('/api/retarget/batch', async (req, res) => {
  const { targetRig, animationLibrary } = req.body;
  const job = await pipeline.submitRetargetJob({ targetRig, animationLibrary });
  res.json({ jobId: job.id });
});

app.listen(3001);
```

---

## Character Animation System

### Animation States

```javascript
const ANIMATION_STATES = {
  // Locomotion
  idle: { loop: true, priority: 0, blendTime: 0.3 },
  walk: { loop: true, priority: 1, blendTime: 0.3 },
  run: { loop: true, priority: 1, blendTime: 0.3 },
  sprint: { loop: true, priority: 1, blendTime: 0.2 },
  crouch: { loop: true, priority: 1, blendTime: 0.4 },

  // Airborne
  jump: { loop: false, priority: 2, blendTime: 0.1 },
  fall: { loop: true, priority: 2, blendTime: 0.2 },
  land: { loop: false, priority: 2, blendTime: 0.1 },

  // Combat
  shoot_rifle: { loop: false, priority: 3, blendTime: 0.1 },
  shoot_shotgun: { loop: false, priority: 3, blendTime: 0.1 },
  reload: { loop: false, priority: 3, blendTime: 0.2 },

  // Reactions
  hit_reaction: { loop: false, priority: 4, blendTime: 0.05 },
  death: { loop: false, priority: 5, blendTime: 0.2, terminal: true }
};
```

### State Transitions

```javascript
const TRANSITIONS = {
  idle: ['walk', 'run', 'jump', 'crouch', 'shoot_rifle', 'shoot_shotgun'],
  walk: ['idle', 'run', 'jump', 'crouch'],
  run: ['idle', 'walk', 'jump', 'sprint'],
  sprint: ['run', 'jump'],
  crouch: ['idle', 'walk'],
  jump: ['fall', 'land'],
  fall: ['land', 'death'],
  land: ['idle', 'walk', 'run'],
  shoot_rifle: ['idle', 'walk', 'run', 'reload'],
  shoot_shotgun: ['idle', 'walk', 'run', 'reload'],
  reload: ['idle', 'walk', 'run'],
  hit_reaction: ['idle', 'walk', 'run', 'death'],
  death: [] // Terminal state
};
```

### IK Weapon Aiming

```javascript
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

export function setupWeaponIK(character, weaponTarget) {
  const skeleton = character.root.skeleton;

  // Right hand IK chain for weapon grip
  const rightHandChain = {
    target: weaponTarget.position,
    effector: skeleton.getBoneByName('mixamorigRightHand'),
    links: [
      { bone: skeleton.getBoneByName('mixamorigRightShoulder') },
      { bone: skeleton.getBoneByName('mixamorigRightArm') },
      { bone: skeleton.getBoneByName('mixamorigRightForeArm') }
    ]
  };

  const ikSolver = new CCDIKSolver(skeleton, [rightHandChain]);

  return ikSolver;
}
```

---

## Asset Pipeline

### Model Sources

```javascript
const MODEL_SOURCES = {
  // Local repository
  local: {
    path: './agents/profiles/models/',
    format: 'glb'
  },

  // S3 Bucket (LeAgentDiary)
  s3: {
    bucket: 's3://leagentdiary-agent-models/{agentId}/',
    cdnBase: 'https://cdn.leagentdiary.com'
  },

  // Google Drive (shared library)
  googleDrive: {
    folderId: '1E--cdM5eKdIj2bSiUnnmOyuEFElKp4US',
    accessType: 'public'
  }
};
```

### Upload Workflow

```javascript
// rigging-pipeline/src/integrations/asset-pipeline.js

export class AssetPipelineIntegration {
  async uploadRiggedCharacter(characterId, exports, metadata) {
    // Upload GLB
    await this.s3.putObject({
      Bucket: 'leagentdiary-agent-models',
      Key: `${characterId}/model.glb`,
      Body: fs.createReadStream(exports.glb.path),
      ContentType: 'model/gltf-binary',
      ACL: 'public-read'
    });

    // Upload VRM
    await this.s3.putObject({
      Bucket: 'leagentdiary-agent-models',
      Key: `${characterId}/avatar.vrm`,
      Body: fs.createReadStream(exports.vrm.path),
      ContentType: 'application/gltf-binary',
      ACL: 'public-read'
    });

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(exports.glb.path);
    await this.uploadThumbnail(`${characterId}/thumbnail.png`, thumbnail);

    // Update manifest
    await this.updateManifest(characterId, exports, metadata);
  }
}
```

### Manifest Structure

```json
{
  "characters": [
    {
      "id": "agent_five",
      "displayName": "Agent Five",
      "glb": "https://cdn.leagentdiary.com/agent_five/model.glb",
      "vrm": "https://cdn.leagentdiary.com/agent_five/avatar.vrm",
      "thumbnail": "https://cdn.leagentdiary.com/agent_five/thumbnail.png",
      "weapon_socket": "weapon_socket_r",
      "required_clips": [
        "idle", "walk", "run", "jump", "fall", "land",
        "crouch", "shoot_rifle", "reload", "hit_reaction", "death"
      ],
      "clip_aliases": {
        "idle": ["idle", "Idle", "IDLE", "Armature|idle"],
        "walk": ["walk", "Walk", "WALK", "Armature|walk"]
      },
      "metadata": {
        "version": "2.0",
        "rigType": "mixamo",
        "fileSize": 4892672,
        "vertexCount": 12456,
        "uploadDate": "2026-03-08T10:30:00Z"
      }
    }
  ]
}
```

---

## API Reference

### Rigging Pipeline SDK

```javascript
import { RiggingSDK } from 'rigging-pipeline/sdk';

const sdk = new RiggingSDK('http://localhost:3001');

// Rig a character
const result = await sdk.rigCharacter('/path/to/character.fbx', {
  metadata: {
    id: 'agent_five',
    name: 'Agent Five',
    author: 'KBLLR'
  },
  rigType: 'mixamo',
  exportFormats: ['glb', 'vrm'],
  animations: {
    idle: '/animations/idle.fbx',
    walk: '/animations/walk.fbx',
    run: '/animations/run.fbx'
  }
});

console.log(result.exports); // { glb: '...', vrm: '...' }
```

### Viverse Animation API

```javascript
import { loadCharacterAnimation, createAnimationController } from '@pmndrs/viverse';

// Load animation for Mixamo-rigged character
const idleClip = await loadCharacterAnimation(characterRoot, 'idle', {
  source: 'mixamo',
  retarget: true,
  loop: true
});

// Create animation controller
const controller = createAnimationController(characterRoot, {
  boneMapping: 'mixamo',
  ikSolvers: {
    rightHand: { target: weaponSocket, chain: 3 }
  },
  blendTime: 0.3
});

controller.addClip('idle', idleClip);
controller.playAnimation('idle');
```

### VRM Avatar API

```javascript
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// Load VRM avatar
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const gltf = await loader.loadAsync('character.vrm');
const vrm = gltf.userData.vrm;

// Access humanoid bones
const rightHand = vrm.humanoid.getRawBoneNode('rightHand');

// Update spring bones (hair/cloth physics)
vrm.springBoneManager?.update(delta);

// Look-at target
vrm.lookAt?.target = targetPosition;
```

---

## Migration Guide

### Migrating Existing GLB Models

```javascript
// scripts/migrate-existing-models.js

import { RiggingPipeline } from '../src/pipeline.js';

async function migrateExistingModels() {
  const pipeline = new RiggingPipeline();

  // Load current manifest
  const manifest = JSON.parse(
    await fs.readFile('./public/characters/manifest.json', 'utf8')
  );

  for (const character of manifest.characters) {
    console.log(`[Migration] Processing ${character.id}...`);

    // Download existing GLB
    const glbPath = await downloadModel(character.glb);

    // Enhance rig
    const enhanced = await pipeline.enhanceExistingRig(glbPath, {
      addIKTargets: true,
      optimizeMeshes: true,
      addMissingAnimations: true
    });

    // Export optimized formats
    const exports = await pipeline.export(enhanced, {
      formats: ['glb', 'vrm'],
      optimize: true
    });

    // Upload to S3
    await assetPipeline.uploadRiggedCharacter(character.id, exports);

    console.log(`✅ ${character.id} migrated`);
    console.log(`  Old: ${(character.metadata.fileSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  New: ${(exports.glb.size / 1024 / 1024).toFixed(2)}MB`);
  }
}

migrateExistingModels();
```

### Migration Checklist

- [ ] Backup existing models to S3 archive
- [ ] Install Blender + AutoRig Pro + MCP server
- [ ] For each character:
  - [ ] Import to Blender via MCP
  - [ ] Add IK targets for weapon sockets
  - [ ] Optimize mesh (reduce to <50k vertices)
  - [ ] Compress textures (WebP, max 2048px)
  - [ ] Retarget missing animation clips
  - [ ] Export GLB + VRM
  - [ ] Upload to S3
  - [ ] Update manifest
  - [ ] Test in CharacterLoader

---

## Performance Optimization

### File Size Reduction

**Before**: 50MB per character
**After**: <5MB per character (10x reduction)

#### Techniques

1. **Draco Compression**: Geometry compression (~70% reduction)
2. **WebP Textures**: Image compression (~50% reduction vs PNG)
3. **Texture Atlasing**: Combine multiple textures
4. **LOD (Level of Detail)**: Multiple quality levels
5. **Mesh Decimation**: Reduce polygon count

```javascript
// Export with optimizations
const glbPath = await mcp.exportGLB(model, outputPath, {
  dracoCompression: true,
  dracoCompressionLevel: 10, // Max compression
  textureFormat: 'webp',
  textureQuality: 90,
  maxTextureSize: 2048,
  decimationRatio: 0.8 // Reduce mesh to 80% of original
});
```

### Loading Performance

```javascript
// Lazy load VRM only when needed
let vrm = null;
if (entry.vrm && needVRMFeatures) {
  vrm = await loader.loadAsync(entry.vrm);
}

// Preload common animations
const preloadClips = ['idle', 'walk', 'run'];
await Promise.all(
  preloadClips.map(name =>
    loadCharacterAnimation(root, name, { source: 'mixamo' })
  )
);
```

### Runtime Optimization

```javascript
// Use animation mixing pools
const mixer = new THREE.AnimationMixer(root);
mixer.timeScale = 1.0;

// Limit IK solver iterations
const ikSolver = new CCDIKSolver(skeleton, chains);
ikSolver.maxIterations = 10; // Balance quality vs performance

// Update only visible characters
if (character.isVisible) {
  character.mixer.update(delta);
  character.ikSolver?.update();
}
```

---

## Appendix

### File Locations

**Integration Points**:
- `/src/CharacterLoader.js` - Viverse integration
- `/src/AnimationStateMachine.js` - State machine with blend trees
- `/public/characters/manifest.json` - Character metadata

**Rigging Pipeline**:
- `/rigging-pipeline/src/pipeline.js` - Main orchestrator
- `/rigging-pipeline/src/mcp/blender-client.js` - MCP Blender client
- `/rigging-pipeline/blender-scripts/autorig_automation.py` - AutoRig Pro automation

**Configuration**:
- `/rigging-pipeline/config/default.json` - Pipeline configuration
- `/.env` - Environment variables (API keys, S3 credentials)

### Dependencies

```json
{
  "dependencies": {
    "@pmndrs/viverse": "^0.2.6",
    "@pixiv/three-vrm": "^3.4.4",
    "@pmndrs/timeline": "^0.3.7",
    "three-mesh-bvh": "^0.8.3",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "aws-sdk": "^2.1600.0",
    "express": "^4.19.0"
  }
}
```

### References

- [Viverse Toolkit Documentation](https://github.com/pmndrs/viverse)
- [VRM Specification](https://vrm.dev/en/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Blender MCP Server](https://github.com/poly-mcp/Blender-MCP-Server)
- [AutoRig Pro Docs](https://www.lucky3d.fr/auto-rig-pro/doc/)
- [Mixamo Bone Reference](https://www.mixamo.com/)

---

**End of Technical Specification**
**Last Updated**: 2026-03-08
**Version**: 2.0
