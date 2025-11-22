# WebGPU Battle Royale Architecture Proposal
## CODE Platformer AI → 3D Multiplayer Battle Royale

**Date:** 2025-11-14
**Version:** 1.0
**Status:** Proposed Architecture

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [WebGPU Integration Strategy](#2-webgpu-integration-strategy)
3. [Controller Diversity & Input System](#3-controller-diversity--input-system)
4. [Procedural Stage Generation](#4-procedural-stage-generation)
5. [Character Rigging & Animation System](#5-character-rigging--animation-system)
6. [Advanced Physics Architecture](#6-advanced-physics-architecture)
7. [Multiplayer Networking Architecture](#7-multiplayer-networking-architecture)
8. [Integrated System Architecture](#8-integrated-system-architecture)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Performance Targets & Optimization](#10-performance-targets--optimization)

---

## 1. Executive Summary

### Vision
Transform CODE Platformer AI from a local 2.5D platformer into a **WebGPU-powered 3D multiplayer battle royale** with procedurally generated stages, diverse controller support, animated characters, and realistic physics.

### Key Objectives

1. **WebGPU Rendering** - 10x performance improvement for large-scale scenes
2. **Universal Controllers** - Keyboard, gamepad, touch, mouse, accessibility options
3. **Endless Stages** - Procedural generation factory for unique battle arenas
4. **Living Characters** - Skeletal animation with combat/locomotion states
5. **Realistic Physics** - Ragdoll, projectiles, destructible environments
6. **50-100 Player Multiplayer** - WebSocket + WebRTC hybrid networking

### Architecture Pillars

```
┌─────────────────────────────────────────────────────────────┐
│                     WebGPU Renderer Core                     │
│          (THREE.WebGPURenderer + Compute Shaders)           │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐  ┌─────▼──────┐  ┌───▼────────┐
│ Input  │  │Procedural  │  │ Animation  │
│System  │  │Generation  │  │  System    │
└───┬────┘  └─────┬──────┘  └───┬────────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────────┐  ┌─▼──────────┐  ┌▼──────────┐
│  Physics   │  │ Networking │  │   Game    │
│   Engine   │  │   Layer    │  │   Logic   │
└────────────┘  └────────────┘  └───────────┘
```

---

## 2. WebGPU Integration Strategy

### 2.1 Renderer Migration

**Phase 1: Direct Swap (Week 1)**

```javascript
// src/renderers/WebGPURenderer.js
import * as THREE from 'three';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

export async function createRenderer(canvas) {
  // Check WebGPU availability
  if (await WebGPU.isAvailable()) {
    console.log('[Renderer] Using WebGPU');

    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      forceWebGL: false, // Use WebGPU when available
    });

    // WebGPU-specific optimizations
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap; // Better for WebGPU
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    return renderer;
  } else {
    console.warn('[Renderer] WebGPU unavailable, falling back to WebGL');
    return new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  }
}
```

**Update Game.js:**
```javascript
// src/Game.js (updated)
import { createRenderer } from './renderers/WebGPURenderer.js';

export async function initGame(canvas, options) {
  renderer = await createRenderer(canvas);
  // ... rest of init
}
```

**Browser Compatibility:**
- Chrome/Edge 113+ ✅
- Firefox 126+ ✅
- Safari 18+ ✅
- Fallback to WebGL for older browsers

### 2.2 Compute Shader Integration

**Use Cases:**
1. Procedural terrain generation
2. Particle systems (100,000+ particles)
3. Physics simulation offload
4. Frustum culling on GPU
5. Animation blending

**Example: Terrain Generation Compute Shader**

```javascript
// src/generation/TerrainComputeShader.js
import { Fn, texture, storage, instanceIndex } from 'three/tsl';

export const terrainGenerationShader = Fn(() => {
  const noiseTexture = texture(noiseTextureNode);
  const heightData = storage(heightBuffer, 'vec4', heightBuffer.count);

  const index = instanceIndex;
  const x = index % terrainWidth;
  const z = floor(index / terrainWidth);

  // Multi-octave Perlin noise
  const uv = vec2(x, z).div(terrainWidth);
  const height = noiseTexture.sample(uv).r * 100.0;

  heightData.element(index).assign(vec4(x, height, z, 1.0));
})();

// Usage in generation system
export class GPUTerrainGenerator {
  async generateChunk(chunkX, chunkZ) {
    const computeNode = terrainGenerationShader;
    const computeTexture = await renderer.computeAsync(computeNode);

    // Read back height data and create mesh
    const heightData = await computeTexture.readAsync();
    return this.createMeshFromHeights(heightData);
  }
}
```

### 2.3 Performance Gains Expected

| Metric | WebGL | WebGPU | Improvement |
|--------|-------|--------|-------------|
| Draw Calls/Frame | 1000 | 10,000+ | 10x |
| Particle Count | 10,000 | 100,000+ | 10x |
| Terrain Generation | CPU (200ms) | GPU (20ms) | 10x |
| Shadow Quality | Medium | Ultra | 2x |
| Overall FPS (100 players) | 15 FPS | 60 FPS | 4x |

---

## 3. Controller Diversity & Input System

### 3.1 Universal Input Architecture

```javascript
// src/input/InputManager.js

export class InputManager {
  constructor() {
    this.devices = new Map(); // deviceId -> InputDevice
    this.bindings = new Map(); // action -> Set<InputBinding>

    // Initialize all input systems
    this.keyboard = new KeyboardInput();
    this.gamepad = new GamepadInput();
    this.touch = new TouchInput();
    this.mouse = new MouseInput();
    this.accessibility = new AccessibilityInput();
  }

  // Unified action polling
  isActionPressed(playerId, action) {
    const device = this.devices.get(playerId);
    if (!device) return false;

    return device.isActionActive(action);
  }

  // Get analog values (for movement, aiming)
  getActionValue(playerId, action) {
    const device = this.devices.get(playerId);
    if (!device) return 0;

    return device.getActionValue(action);
  }

  // Get 2D vector (for movement, camera)
  getActionVector(playerId, action) {
    const device = this.devices.get(playerId);
    if (!device) return new THREE.Vector2(0, 0);

    return device.getActionVector(action);
  }
}
```

### 3.2 Input Device Implementations

#### A. Enhanced Keyboard Input

```javascript
// src/input/devices/KeyboardInput.js
export class KeyboardInput extends InputDevice {
  constructor() {
    super('keyboard');
    this.keys = new Map();
    this.bindings = {
      // WASD + Arrow keys for movement
      'move_forward': ['KeyW', 'ArrowUp'],
      'move_back': ['KeyS', 'ArrowDown'],
      'move_left': ['KeyA', 'ArrowLeft'],
      'move_right': ['KeyD', 'ArrowRight'],

      // Actions
      'jump': ['Space'],
      'crouch': ['ControlLeft', 'KeyC'],
      'sprint': ['ShiftLeft'],
      'interact': ['KeyE'],
      'reload': ['KeyR'],

      // Combat
      'fire': ['Mouse0'], // Left click
      'aim': ['Mouse1'],  // Right click
      'ability1': ['KeyQ'],
      'ability2': ['KeyF'],

      // UI
      'inventory': ['Tab'],
      'map': ['KeyM'],
      'pause': ['Escape'],
    };
  }

  getActionVector(action) {
    if (action === 'movement') {
      const x = (this.isPressed('move_right') ? 1 : 0) -
                (this.isPressed('move_left') ? 1 : 0);
      const y = (this.isPressed('move_forward') ? 1 : 0) -
                (this.isPressed('move_back') ? 1 : 0);
      return new THREE.Vector2(x, y).normalize();
    }
    return super.getActionVector(action);
  }
}
```

#### B. Touch Controls (Mobile)

```javascript
// src/input/devices/TouchInput.js
export class TouchInput extends InputDevice {
  constructor() {
    super('touch');
    this.joysticks = [];
    this.buttons = [];

    this.createUI();
  }

  createUI() {
    // Virtual joystick for movement (left side)
    this.movementJoystick = new VirtualJoystick({
      position: 'bottom-left',
      size: 120,
      maxDistance: 60,
      zone: 'left-half',
    });

    // Virtual joystick for camera (right side)
    this.cameraJoystick = new VirtualJoystick({
      position: 'bottom-right',
      size: 120,
      maxDistance: 60,
      zone: 'right-half',
    });

    // Action buttons
    this.jumpButton = new TouchButton({
      position: { right: 20, bottom: 200 },
      size: 70,
      icon: '↑',
      action: 'jump',
    });

    this.fireButton = new TouchButton({
      position: { right: 20, bottom: 120 },
      size: 70,
      icon: '🎯',
      action: 'fire',
    });

    this.crouchButton = new TouchButton({
      position: { right: 100, bottom: 120 },
      size: 60,
      icon: '⬇',
      action: 'crouch',
    });
  }

  getActionVector(action) {
    if (action === 'movement') {
      return this.movementJoystick.getValue();
    } else if (action === 'camera') {
      return this.cameraJoystick.getValue();
    }
    return new THREE.Vector2(0, 0);
  }
}
```

#### C. Mouse & Keyboard (PC)

```javascript
// src/input/devices/MouseInput.js
export class MouseInput extends InputDevice {
  constructor() {
    super('mouse');
    this.position = new THREE.Vector2();
    this.delta = new THREE.Vector2();
    this.locked = false;

    // Pointer lock for FPS-style camera
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.delta.x = e.movementX;
        this.delta.y = e.movementY;
      }
    });
  }

  getCameraDelta() {
    const delta = this.delta.clone();
    this.delta.set(0, 0); // Reset after read
    return delta;
  }
}
```

#### D. Accessibility Input

```javascript
// src/input/devices/AccessibilityInput.js
export class AccessibilityInput extends InputDevice {
  constructor() {
    super('accessibility');

    // Eye tracking support (experimental)
    this.eyeTracker = new EyeTrackingInput();

    // Voice commands
    this.voiceInput = new VoiceCommandInput([
      { phrase: 'jump', action: 'jump' },
      { phrase: 'fire', action: 'fire' },
      { phrase: 'reload', action: 'reload' },
    ]);

    // Single switch input (for severe motor impairments)
    this.switchInput = new SwitchScanningInput({
      scanSpeed: 1000, // ms per item
      confirmKey: 'Space',
    });

    // Configurable button sizes
    this.buttonScale = 1.5; // 150% larger buttons
    this.highContrast = true;
  }
}
```

### 3.3 Input Configuration UI

```javascript
// src/ui/InputConfigMenu.js
export class InputConfigMenu {
  constructor() {
    this.presets = {
      'pc_default': { /* WASD + Mouse */ },
      'console': { /* Gamepad optimized */ },
      'mobile': { /* Touch controls */ },
      'accessibility': { /* Assisted controls */ },
    };
  }

  showRemapping() {
    // Allow players to rebind any action to any input
    // Save to localStorage for persistence
  }

  showSensitivitySettings() {
    // Mouse sensitivity
    // Joystick dead zones
    // Aim assist strength (for gamepad/touch)
  }
}
```

---

## 4. Procedural Stage Generation

### 4.1 Generation System Architecture

```
┌────────────────────────────────────────────────┐
│         Procedural Generation Factory          │
└────────────────┬───────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
┌────▼─────┐ ┌──▼──────┐ ┌─▼─────────┐
│ Terrain  │ │Structure│ │  Biome    │
│Generator │ │Generator│ │ Generator │
└────┬─────┘ └──┬──────┘ └─┬─────────┘
     │           │           │
     └───────────┼───────────┘
                 │
          ┌──────▼──────┐
          │ GPU Compute │
          │   Shaders   │
          └─────────────┘
```

### 4.2 Terrain Generator (GPU-Accelerated)

```javascript
// src/generation/TerrainGenerator.js
import { createNoise3D } from 'simplex-noise';

export class TerrainGenerator {
  constructor(renderer, seed) {
    this.renderer = renderer;
    this.seed = seed;
    this.noise = createNoise3D(() => seed);

    // Terrain parameters
    this.chunkSize = 256; // 256x256 vertices per chunk
    this.tileSize = 1; // 1 unit per tile
    this.maxHeight = 50;
    this.waterLevel = 0;

    // Biome system
    this.biomes = new BiomeSystem();
  }

  async generateArena(centerX, centerZ, radius = 1000) {
    const startTime = performance.now();

    // Calculate chunk coverage
    const chunks = this.calculateChunks(centerX, centerZ, radius);

    // Generate all chunks in parallel (GPU compute)
    const chunkPromises = chunks.map(({ x, z }) =>
      this.generateChunk(x, z)
    );

    const generatedChunks = await Promise.all(chunkPromises);

    // Stitch chunks together
    const arena = this.stitchChunks(generatedChunks);

    // Add structures
    await this.addStructures(arena);

    // Add props (trees, rocks, buildings)
    await this.populateArena(arena);

    // Create play zone boundary
    arena.playZone = this.createPlayZone(centerX, centerZ, radius);

    console.log(`[TerrainGen] Arena generated in ${performance.now() - startTime}ms`);
    return arena;
  }

  async generateChunk(chunkX, chunkZ) {
    // Use GPU compute shader for height generation
    const heightData = await this.computeHeightmap(chunkX, chunkZ);

    // Create geometry from height data
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize * this.tileSize,
      this.chunkSize * this.tileSize,
      this.chunkSize - 1,
      this.chunkSize - 1
    );

    // Apply heights to vertices
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < heightData.length; i++) {
      positions[i * 3 + 2] = heightData[i]; // Z = height
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    // Determine biome and apply materials
    const biome = this.biomes.getBiomeAt(chunkX, chunkZ);
    const material = biome.getMaterial();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Flat terrain
    mesh.position.set(
      chunkX * this.chunkSize * this.tileSize,
      0,
      chunkZ * this.chunkSize * this.tileSize
    );
    mesh.receiveShadow = true;

    return {
      x: chunkX,
      z: chunkZ,
      mesh,
      heightData,
      biome,
    };
  }

  computeHeightmap(chunkX, chunkZ) {
    const heights = new Float32Array(this.chunkSize * this.chunkSize);

    for (let z = 0; z < this.chunkSize; z++) {
      for (let x = 0; x < this.chunkSize; x++) {
        const worldX = chunkX * this.chunkSize + x;
        const worldZ = chunkZ * this.chunkSize + z;

        // Multi-octave noise for realistic terrain
        let height = 0;
        let amplitude = 1;
        let frequency = 0.005;

        // 4 octaves
        for (let octave = 0; octave < 4; octave++) {
          height += this.noise(
            worldX * frequency,
            worldZ * frequency,
            0
          ) * amplitude;

          amplitude *= 0.5;
          frequency *= 2;
        }

        // Normalize to [0, maxHeight]
        height = (height + 1) * 0.5 * this.maxHeight;

        heights[z * this.chunkSize + x] = height;
      }
    }

    return heights;
  }

  addStructures(arena) {
    const structures = new StructureGenerator(this.seed);

    // Add buildings, bunkers, towers
    const numBuildings = Math.floor(Math.random() * 20) + 30;

    for (let i = 0; i < numBuildings; i++) {
      const position = this.findFlatArea(arena);
      if (!position) continue;

      const buildingType = structures.randomType([
        'warehouse',
        'apartment',
        'bunker',
        'tower',
        'shop',
      ]);

      const building = structures.generate(buildingType, position);
      arena.addStructure(building);
    }
  }

  populateArena(arena) {
    const props = new PropGenerator(this.seed);

    arena.chunks.forEach(chunk => {
      const biome = chunk.biome;

      // Density based on biome
      const density = biome.propDensity; // 0-1
      const numProps = Math.floor(chunk.area * density);

      for (let i = 0; i < numProps; i++) {
        const position = this.randomPositionInChunk(chunk);
        const propType = biome.randomProp();

        const prop = props.generate(propType, position);
        arena.addProp(prop);
      }
    });
  }

  createPlayZone(centerX, centerZ, radius) {
    // Circular play zone that shrinks over time
    return {
      center: new THREE.Vector3(centerX, 0, centerZ),
      currentRadius: radius,
      targetRadius: radius,
      shrinkRate: 5, // units per second
      damagePerSecond: 5, // damage outside zone

      // Visual boundary
      boundary: this.createZoneBoundary(centerX, centerZ, radius),

      shrinkTo(newRadius, duration) {
        this.targetRadius = newRadius;
        this.shrinkRate = (this.currentRadius - newRadius) / duration;
      },

      update(deltaTime) {
        if (this.currentRadius > this.targetRadius) {
          this.currentRadius -= this.shrinkRate * deltaTime;
          this.currentRadius = Math.max(this.currentRadius, this.targetRadius);
          this.updateBoundary();
        }
      },
    };
  }
}
```

### 4.3 Biome System

```javascript
// src/generation/BiomeSystem.js
export class BiomeSystem {
  constructor() {
    this.biomes = [
      {
        name: 'grassland',
        color: 0x7EC850,
        propDensity: 0.3,
        props: ['tree_oak', 'tree_pine', 'rock', 'bush'],
        weights: [0.4, 0.3, 0.2, 0.1],
      },
      {
        name: 'desert',
        color: 0xEDC9AF,
        propDensity: 0.1,
        props: ['cactus', 'rock', 'dead_tree'],
        weights: [0.5, 0.3, 0.2],
      },
      {
        name: 'urban',
        color: 0x808080,
        propDensity: 0.05,
        props: ['dumpster', 'car', 'streetlight'],
        weights: [0.4, 0.4, 0.2],
      },
      {
        name: 'industrial',
        color: 0x555555,
        propDensity: 0.02,
        props: ['container', 'crate', 'barrel'],
        weights: [0.5, 0.3, 0.2],
      },
    ];
  }

  getBiomeAt(x, z) {
    // Use noise to determine biome
    const moisture = this.moistureNoise(x, z);
    const temperature = this.temperatureNoise(x, z);

    if (moisture < 0.3 && temperature > 0.7) {
      return this.biomes.find(b => b.name === 'desert');
    } else if (moisture > 0.6) {
      return this.biomes.find(b => b.name === 'grassland');
    } else if (temperature < 0.3) {
      return this.biomes.find(b => b.name === 'industrial');
    } else {
      return this.biomes.find(b => b.name === 'urban');
    }
  }
}
```

### 4.4 Structure Generator

```javascript
// src/generation/StructureGenerator.js
export class StructureGenerator {
  constructor(seed) {
    this.seed = seed;
    this.templates = this.loadTemplates();
  }

  generate(type, position) {
    const template = this.templates[type];
    if (!template) {
      console.warn(`[StructureGen] Unknown type: ${type}`);
      return null;
    }

    // Procedurally modify template
    const variation = this.createVariation(template);

    // Build structure from voxels/prefabs
    const structure = this.buildStructure(variation, position);

    // Add loot spawns
    this.addLootSpawns(structure);

    return structure;
  }

  loadTemplates() {
    return {
      warehouse: {
        size: { x: 20, y: 8, z: 30 },
        walls: 'metal',
        roof: 'corrugated',
        floors: 2,
        lootTier: 'high',
      },
      apartment: {
        size: { x: 15, y: 12, z: 15 },
        walls: 'concrete',
        roof: 'flat',
        floors: 3,
        lootTier: 'medium',
      },
      bunker: {
        size: { x: 10, y: 5, z: 10 },
        walls: 'concrete',
        underground: true,
        floors: 1,
        lootTier: 'high',
      },
      // ... more templates
    };
  }
}
```

### 4.5 Generation Factory

```javascript
// src/generation/GenerationFactory.js
export class GenerationFactory {
  async createBattleRoyaleArena(matchId) {
    const seed = this.generateSeed(matchId);

    console.log(`[GenFactory] Creating arena with seed: ${seed}`);

    const terrainGen = new TerrainGenerator(renderer, seed);
    const arena = await terrainGen.generateArena(0, 0, 2000);

    // Add weapon spawns
    const weaponSpawns = this.generateWeaponSpawns(arena, 100);
    arena.weaponSpawns = weaponSpawns;

    // Add loot crates
    const lootCrates = this.generateLootCrates(arena, 50);
    arena.lootCrates = lootCrates;

    // Define match progression
    arena.shrinkSchedule = [
      { time: 60, radius: 1500 },  // 1 min: shrink to 1.5km
      { time: 180, radius: 1000 }, // 3 min: shrink to 1km
      { time: 300, radius: 500 },  // 5 min: shrink to 500m
      { time: 420, radius: 200 },  // 7 min: shrink to 200m
      { time: 540, radius: 50 },   // 9 min: final circle
    ];

    return arena;
  }

  generateSeed(matchId) {
    // Combine match ID with timestamp for uniqueness
    const timestamp = Date.now();
    return `${matchId}_${timestamp}`;
  }
}
```

---

## 5. Character Rigging & Animation System

### 5.1 Animation Architecture

```javascript
// src/animation/AnimationController.js

export class AnimationController {
  constructor(model, animationClips) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
    this.currentState = 'idle';
    this.previousState = null;

    // Load animation clips
    animationClips.forEach(clip => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    });

    // State machine
    this.stateMachine = new AnimationStateMachine(this);
  }

  playAnimation(name, options = {}) {
    const action = this.actions.get(name);
    if (!action) {
      console.warn(`[AnimController] Animation not found: ${name}`);
      return;
    }

    const {
      loop = THREE.LoopRepeat,
      fadeIn = 0.2,
      fadeOut = 0.2,
      timeScale = 1,
    } = options;

    // Fade out current animation
    if (this.previousState) {
      const prevAction = this.actions.get(this.previousState);
      if (prevAction) {
        prevAction.fadeOut(fadeOut);
      }
    }

    // Fade in new animation
    action.reset();
    action.setLoop(loop);
    action.timeScale = timeScale;
    action.fadeIn(fadeIn);
    action.play();

    this.previousState = this.currentState;
    this.currentState = name;
  }

  update(deltaTime, playerState) {
    // Update state machine
    this.stateMachine.update(playerState);

    // Update mixer
    this.mixer.update(deltaTime);
  }
}
```

### 5.2 Animation State Machine

```javascript
// src/animation/AnimationStateMachine.js

export class AnimationStateMachine {
  constructor(controller) {
    this.controller = controller;
    this.states = this.defineStates();
    this.transitions = this.defineTransitions();
  }

  defineStates() {
    return {
      'idle': {
        animation: 'idle',
        loop: true,
        timeScale: 1,
      },
      'walk': {
        animation: 'walk',
        loop: true,
        timeScale: 1,
      },
      'run': {
        animation: 'run',
        loop: true,
        timeScale: 1.2,
      },
      'sprint': {
        animation: 'sprint',
        loop: true,
        timeScale: 1.5,
      },
      'jump': {
        animation: 'jump',
        loop: false,
        timeScale: 1,
      },
      'fall': {
        animation: 'fall',
        loop: true,
        timeScale: 1,
      },
      'land': {
        animation: 'land',
        loop: false,
        timeScale: 1,
      },
      'crouch': {
        animation: 'crouch_idle',
        loop: true,
        timeScale: 1,
      },
      'crouch_walk': {
        animation: 'crouch_walk',
        loop: true,
        timeScale: 0.8,
      },
      'attack_rifle': {
        animation: 'shoot_rifle',
        loop: false,
        timeScale: 1,
      },
      'attack_shotgun': {
        animation: 'shoot_shotgun',
        loop: false,
        timeScale: 1,
      },
      'reload': {
        animation: 'reload',
        loop: false,
        timeScale: 1,
      },
      'hit': {
        animation: 'hit_reaction',
        loop: false,
        timeScale: 1,
      },
      'death': {
        animation: 'death',
        loop: false,
        timeScale: 1,
      },
    };
  }

  defineTransitions() {
    return {
      'idle': ['walk', 'run', 'jump', 'crouch', 'attack_rifle', 'attack_shotgun', 'hit', 'death'],
      'walk': ['idle', 'run', 'jump', 'crouch', 'attack_rifle', 'attack_shotgun'],
      'run': ['idle', 'walk', 'sprint', 'jump', 'attack_rifle'],
      'sprint': ['run', 'walk', 'jump'],
      'jump': ['fall'],
      'fall': ['land', 'death'],
      'land': ['idle', 'walk', 'run'],
      'crouch': ['crouch_walk', 'idle'],
      'crouch_walk': ['crouch', 'walk'],
      'attack_rifle': ['idle', 'walk', 'run', 'reload'],
      'attack_shotgun': ['idle', 'walk', 'reload'],
      'reload': ['idle', 'walk'],
      'hit': ['idle', 'death'],
      'death': [], // Terminal state
    };
  }

  update(playerState) {
    const {
      velocity,
      grounded,
      crouching,
      attacking,
      weapon,
      health,
      reloading,
    } = playerState;

    let targetState = this.controller.currentState;

    // Death has highest priority
    if (health <= 0) {
      targetState = 'death';
    }
    // Hit reaction
    else if (playerState.justHit) {
      targetState = 'hit';
    }
    // Reload
    else if (reloading) {
      targetState = 'reload';
    }
    // Attack
    else if (attacking && weapon) {
      targetState = weapon.type === 'rifle' ? 'attack_rifle' : 'attack_shotgun';
    }
    // Aerial states
    else if (!grounded) {
      if (velocity.y > 0) {
        targetState = 'jump';
      } else {
        targetState = 'fall';
      }
    }
    // Ground locomotion
    else {
      const speed = velocity.length();

      if (crouching) {
        targetState = speed > 0.1 ? 'crouch_walk' : 'crouch';
      } else {
        if (speed < 0.1) {
          targetState = 'idle';
        } else if (speed < 4) {
          targetState = 'walk';
        } else if (speed < 8) {
          targetState = 'run';
        } else {
          targetState = 'sprint';
        }
      }
    }

    // Check if transition is valid
    if (this.canTransition(this.controller.currentState, targetState)) {
      if (targetState !== this.controller.currentState) {
        const state = this.states[targetState];
        this.controller.playAnimation(state.animation, {
          loop: state.loop ? THREE.LoopRepeat : THREE.LoopOnce,
          timeScale: state.timeScale,
        });
      }
    }
  }

  canTransition(from, to) {
    if (from === to) return true;
    const validTransitions = this.transitions[from] || [];
    return validTransitions.includes(to);
  }
}
```

### 5.3 Character Model Requirements

**Expected GLB Structure:**
```
character.glb
├── Skeleton (armature)
│   ├── Root
│   ├── Hips
│   ├── Spine
│   ├── Chest
│   ├── Neck
│   ├── Head
│   ├── LeftShoulder → LeftArm → LeftHand
│   ├── RightShoulder → RightArm → RightHand
│   ├── LeftLeg → LeftFoot
│   └── RightLeg → RightFoot
├── Mesh (skinned to skeleton)
└── AnimationClips[]
    ├── idle
    ├── walk
    ├── run
    ├── sprint
    ├── jump
    ├── fall
    ├── land
    ├── crouch_idle
    ├── crouch_walk
    ├── shoot_rifle
    ├── shoot_shotgun
    ├── reload
    ├── hit_reaction
    └── death
```

**Integration with Player:**
```javascript
// src/Player.js (updated)
import { AnimationController } from './animation/AnimationController.js';

async function makePlayer(mesh, idx, scene) {
  // Extract animations from GLTF
  const animations = mesh.animations || [];

  // Create animation controller
  const animController = new AnimationController(mesh, animations);

  const player = {
    // ... existing properties
    animController,

    update(deltaTime) {
      // ... existing physics

      // Update animation based on state
      this.animController.update(deltaTime, {
        velocity: this.velocity,
        grounded: this.grounded,
        crouching: this.crouching,
        attacking: this.isAttacking,
        weapon: this.currentWeapon,
        health: this.health,
        reloading: this.reloading,
        justHit: this.hurtTimer > 0,
      });
    }
  };

  return player;
}
```

### 5.4 IK (Inverse Kinematics) for Weapon Holding

```javascript
// src/animation/IKController.js
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';

export class WeaponIKController {
  constructor(skeleton, weapon) {
    this.skeleton = skeleton;
    this.weapon = weapon;

    // Find hand bones
    this.rightHand = skeleton.getBoneByName('RightHand');
    this.leftHand = skeleton.getBoneByName('LeftHand');

    // Create IK solver for weapon grip
    this.ikSolver = new CCDIKSolver(skeleton, [
      {
        target: 0, // Right hand target
        effector: this.rightHand.index,
        links: [
          { index: skeleton.getBoneByName('RightArm').index },
          { index: skeleton.getBoneByName('RightShoulder').index },
        ],
      },
      {
        target: 1, // Left hand target
        effector: this.leftHand.index,
        links: [
          { index: skeleton.getBoneByName('LeftArm').index },
          { index: skeleton.getBoneByName('LeftShoulder').index },
        ],
      },
    ]);
  }

  update() {
    // Position targets at weapon grip points
    this.ikSolver.update();
  }
}
```

---

## 6. Advanced Physics Architecture

### 6.1 Physics Engine Selection

**Recommended: Rapier Physics (Rust/WASM)**

**Why Rapier:**
- ✅ High performance (Rust compiled to WASM)
- ✅ 3D rigid body physics
- ✅ Collision detection and response
- ✅ Joints and constraints
- ✅ Character controller built-in
- ✅ Active maintenance
- ✅ Small bundle size (~500KB)

**Installation:**
```bash
npm install @dimforge/rapier3d-compat
```

### 6.2 Physics System Implementation

```javascript
// src/physics/PhysicsWorld.js
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  async init() {
    await RAPIER.init();

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.bodies = new Map(); // entityId -> RigidBody
    this.colliders = new Map(); // entityId -> Collider

    // Configure simulation
    this.world.integrationParameters.dt = 1 / 60; // Fixed 60Hz
    this.world.integrationParameters.numSolverIterations = 4;
    this.world.integrationParameters.numAdditionalFrictionIterations = 2;

    console.log('[PhysicsWorld] Initialized with Rapier');
  }

  createCharacterController(player) {
    // Create character rigid body (kinematic)
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        player.mesh.position.x,
        player.mesh.position.y,
        player.mesh.position.z
      );

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create capsule collider (typical for characters)
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4) // height, radius
      .setDensity(1.0)
      .setFriction(0.5)
      .setRestitution(0.0);

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    // Create character controller
    const characterController = this.world.createCharacterController(0.01);
    characterController.enableSnapToGround(0.5);
    characterController.enableAutostep(0.5, 0.2, false);
    characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    characterController.setMinSlopeSlideAngle(30 * Math.PI / 180);

    this.bodies.set(player.id, rigidBody);
    this.colliders.set(player.id, collider);

    return {
      rigidBody,
      collider,
      controller: characterController,
    };
  }

  createProjectile(projectile) {
    // Create dynamic rigid body for projectile
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        projectile.mesh.position.x,
        projectile.mesh.position.y,
        projectile.mesh.position.z
      )
      .setLinvel(
        projectile.velocity.x,
        projectile.velocity.y,
        projectile.velocity.z
      )
      .setCcdEnabled(true); // Continuous collision detection for fast projectiles

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Sphere collider for bullet
    const colliderDesc = RAPIER.ColliderDesc.ball(0.05)
      .setDensity(0.1)
      .setRestitution(0.3);

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    this.bodies.set(projectile.id, rigidBody);
    this.colliders.set(projectile.id, collider);

    return { rigidBody, collider };
  }

  createTerrainCollider(terrainMesh) {
    // Create static collider from terrain mesh
    const vertices = terrainMesh.geometry.attributes.position.array;
    const indices = terrainMesh.geometry.index.array;

    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setFriction(0.7)
      .setRestitution(0.1);

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    console.log('[PhysicsWorld] Terrain collider created');
    return { rigidBody, collider };
  }

  update(deltaTime) {
    // Step physics simulation
    this.world.step();

    // Sync physics bodies to Three.js meshes
    this.bodies.forEach((rigidBody, entityId) => {
      const entity = this.getEntityById(entityId);
      if (!entity || !entity.mesh) return;

      const translation = rigidBody.translation();
      const rotation = rigidBody.rotation();

      entity.mesh.position.set(translation.x, translation.y, translation.z);
      entity.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    // Handle collision events
    this.handleCollisions();
  }

  handleCollisions() {
    this.world.forEachCollisionPair((collider1, collider2, started) => {
      if (started) {
        const entity1 = this.getEntityByCollider(collider1);
        const entity2 = this.getEntityByCollider(collider2);

        if (entity1 && entity2) {
          this.onCollision(entity1, entity2);
        }
      }
    });
  }

  onCollision(entity1, entity2) {
    // Handle projectile hits
    if (entity1.type === 'projectile' && entity2.type === 'player') {
      entity2.takeDamage(entity1.damage, entity1.owner);
      this.removeProjectile(entity1);
    } else if (entity2.type === 'projectile' && entity1.type === 'player') {
      entity1.takeDamage(entity2.damage, entity2.owner);
      this.removeProjectile(entity2);
    }

    // Handle projectile terrain hits
    if (entity1.type === 'projectile' || entity2.type === 'projectile') {
      const projectile = entity1.type === 'projectile' ? entity1 : entity2;
      this.removeProjectile(projectile);
    }
  }
}
```

### 6.3 Character Controller Integration

```javascript
// src/Player.js (updated with physics)

export async function makePlayer(mesh, idx, scene, physicsWorld) {
  const player = {
    // ... existing properties

    // Physics components
    physics: physicsWorld.createCharacterController(player),

    moveWithPhysics(deltaTime) {
      const movement = new THREE.Vector3();

      // Get desired movement from input
      if (this.inputLeft) movement.x -= 1;
      if (this.inputRight) movement.x += 1;
      if (this.inputForward) movement.z -= 1;
      if (this.inputBack) movement.z += 1;

      movement.normalize();
      movement.multiplyScalar(this.moveSpeed * deltaTime);

      // Apply movement via character controller
      this.physics.controller.computeColliderMovement(
        this.physics.collider,
        movement
      );

      // Get corrected movement (after collision resolution)
      const correctedMovement = this.physics.controller.computedMovement();

      // Apply to rigid body
      const currentPos = this.physics.rigidBody.translation();
      this.physics.rigidBody.setNextKinematicTranslation({
        x: currentPos.x + correctedMovement.x,
        y: currentPos.y + correctedMovement.y,
        z: currentPos.z + correctedMovement.z,
      });

      // Check if grounded
      this.grounded = this.physics.controller.computedGrounded();
    },

    jumpWithPhysics() {
      if (this.grounded) {
        const currentVel = this.physics.rigidBody.linvel();
        this.physics.rigidBody.setLinvel({
          x: currentVel.x,
          y: this.jumpForce,
          z: currentVel.z,
        }, true);
      }
    },
  };

  return player;
}
```

### 6.4 Ragdoll Physics (Death Animation)

```javascript
// src/physics/RagdollController.js

export class RagdollController {
  constructor(skeleton, physicsWorld) {
    this.skeleton = skeleton;
    this.physicsWorld = physicsWorld;
    this.ragdollBodies = new Map();
    this.ragdollJoints = [];
  }

  createRagdoll() {
    // Create rigid body for each bone
    this.skeleton.bones.forEach(bone => {
      const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          bone.getWorldPosition(new THREE.Vector3()).x,
          bone.getWorldPosition(new THREE.Vector3()).y,
          bone.getWorldPosition(new THREE.Vector3()).z
        );

      const rigidBody = this.physicsWorld.world.createRigidBody(rigidBodyDesc);

      // Create collider based on bone
      const colliderDesc = this.getColliderForBone(bone);
      const collider = this.physicsWorld.world.createCollider(colliderDesc, rigidBody);

      this.ragdollBodies.set(bone.name, { rigidBody, collider, bone });
    });

    // Create joints between bones
    this.createJoints();
  }

  getColliderForBone(bone) {
    // Heuristic: use capsule for limbs, sphere for head
    if (bone.name.includes('Head')) {
      return RAPIER.ColliderDesc.ball(0.15);
    } else if (bone.name.includes('Arm') || bone.name.includes('Leg')) {
      return RAPIER.ColliderDesc.capsule(0.2, 0.05);
    } else {
      return RAPIER.ColliderDesc.cuboid(0.15, 0.2, 0.1);
    }
  }

  createJoints() {
    // Create ball joints between connected bones
    const jointPairs = [
      ['Hips', 'Spine'],
      ['Spine', 'Chest'],
      ['Chest', 'Neck'],
      ['Neck', 'Head'],
      // ... more pairs
    ];

    jointPairs.forEach(([bone1Name, bone2Name]) => {
      const body1 = this.ragdollBodies.get(bone1Name);
      const body2 = this.ragdollBodies.get(bone2Name);

      if (body1 && body2) {
        const jointDesc = RAPIER.JointData.ball(
          new RAPIER.Vector3(0, 0, 0),
          new RAPIER.Vector3(0, 0, 0)
        );

        const joint = this.physicsWorld.world.createImpulseJoint(
          jointDesc,
          body1.rigidBody,
          body2.rigidBody,
          true
        );

        this.ragdollJoints.push(joint);
      }
    });
  }

  activate() {
    // Disable kinematic control, enable ragdoll
    this.ragdollBodies.forEach(({ rigidBody }) => {
      rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    });
  }

  update() {
    // Sync bone transforms from physics
    this.ragdollBodies.forEach(({ rigidBody, bone }) => {
      const translation = rigidBody.translation();
      const rotation = rigidBody.rotation();

      bone.position.set(translation.x, translation.y, translation.z);
      bone.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
  }
}
```

---

## 7. Multiplayer Networking Architecture

### 7.1 Network Architecture Overview

```
┌─────────────┐      WebSocket       ┌─────────────┐
│   Client 1  │◄───────────────────►│             │
└─────────────┘                      │             │
┌─────────────┐      WebSocket       │   Game      │
│   Client 2  │◄───────────────────►│   Server    │
└─────────────┘                      │  (Node.js)  │
      ...                            │             │
┌─────────────┐      WebSocket       │             │
│  Client 100 │◄───────────────────►│             │
└─────────────┘                      └─────────────┘
                                             │
                                             ▼
                                     ┌───────────────┐
                                     │  Match State  │
                                     │   Database    │
                                     │  (Redis/SQL)  │
                                     └───────────────┘
```

### 7.2 Server Architecture

```javascript
// server/GameServer.js
import { WebSocketServer } from 'ws';
import { MatchManager } from './MatchManager.js';
import { PlayerManager } from './PlayerManager.js';

export class GameServer {
  constructor(port = 8080) {
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.matchManager = new MatchManager();
    this.playerManager = new PlayerManager();

    // Tick rate: 20 updates per second
    this.tickRate = 20;
    this.tickInterval = 1000 / this.tickRate;

    this.setupServer();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('[Server] New connection');

      const player = this.playerManager.createPlayer(ws);

      ws.on('message', (data) => {
        this.handleMessage(player, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(player);
      });

      // Send welcome message
      this.send(ws, {
        type: 'connected',
        playerId: player.id,
        serverTime: Date.now(),
      });
    });

    // Start game loop
    this.startGameLoop();

    console.log(`[Server] Listening on port ${this.port}`);
  }

  startGameLoop() {
    let lastTime = Date.now();

    setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Update all matches
      this.matchManager.updateMatches(deltaTime);

      // Send state updates to clients
      this.broadcastStateUpdates();

    }, this.tickInterval);
  }

  handleMessage(player, data) {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join_queue':
        this.matchManager.addToQueue(player);
        break;

      case 'input':
        // Player input update
        player.updateInput(message.input);
        break;

      case 'ping':
        // Measure latency
        this.send(player.ws, {
          type: 'pong',
          clientTime: message.timestamp,
          serverTime: Date.now(),
        });
        break;

      default:
        console.warn(`[Server] Unknown message type: ${message.type}`);
    }
  }

  broadcastStateUpdates() {
    this.matchManager.matches.forEach(match => {
      const snapshot = match.createSnapshot();

      // Send to all players in match
      match.players.forEach(player => {
        this.send(player.ws, {
          type: 'state_update',
          snapshot,
          serverTime: Date.now(),
        });
      });
    });
  }

  send(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}
```

### 7.3 Match Manager

```javascript
// server/MatchManager.js

export class MatchManager {
  constructor() {
    this.matches = new Map();
    this.matchQueue = [];
    this.matchIdCounter = 0;

    // Queue processing
    setInterval(() => this.processQueue(), 5000);
  }

  addToQueue(player) {
    if (!this.matchQueue.includes(player)) {
      this.matchQueue.push(player);
      console.log(`[MatchManager] Player ${player.id} added to queue (${this.matchQueue.length} waiting)`);

      player.send({
        type: 'queue_joined',
        position: this.matchQueue.length,
      });
    }
  }

  processQueue() {
    // Create matches when enough players
    const playersPerMatch = 50;

    while (this.matchQueue.length >= playersPerMatch) {
      const players = this.matchQueue.splice(0, playersPerMatch);
      this.createMatch(players);
    }
  }

  async createMatch(players) {
    const matchId = this.matchIdCounter++;

    console.log(`[MatchManager] Creating match ${matchId} with ${players.length} players`);

    // Generate arena
    const arena = await this.generateArena(matchId);

    const match = new Match(matchId, players, arena);
    this.matches.set(matchId, match);

    // Notify players
    players.forEach((player, index) => {
      player.send({
        type: 'match_starting',
        matchId,
        spawnPosition: arena.spawnPoints[index],
        players: players.map(p => ({ id: p.id, name: p.name })),
      });
    });

    // Start match after countdown
    setTimeout(() => match.start(), 5000);
  }

  async generateArena(matchId) {
    const { GenerationFactory } = await import('../src/generation/GenerationFactory.js');
    const factory = new GenerationFactory();
    return factory.createBattleRoyaleArena(matchId);
  }

  updateMatches(deltaTime) {
    this.matches.forEach(match => {
      match.update(deltaTime);

      // Remove finished matches
      if (match.state === 'finished') {
        this.matches.delete(match.id);
        console.log(`[MatchManager] Match ${match.id} finished, removed`);
      }
    });
  }
}
```

### 7.4 Client Networking

```javascript
// src/network/NetworkClient.js

export class NetworkClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.playerId = null;

    // State synchronization
    this.serverState = null;
    this.latency = 0;
    this.clockOffset = 0;

    // Prediction and reconciliation
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.lastProcessedInput = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[Network] Connected to server');
        this.connected = true;
        this.startPingInterval();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        console.log('[Network] Disconnected from server');
        this.connected = false;
      };

      this.ws.onerror = (error) => {
        console.error('[Network] Error:', error);
        reject(error);
      };
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.playerId = message.playerId;
        this.syncClock(message.serverTime);
        break;

      case 'state_update':
        this.handleStateUpdate(message);
        break;

      case 'pong':
        this.updateLatency(message);
        break;

      case 'match_starting':
        this.onMatchStarting(message);
        break;

      default:
        console.warn(`[Network] Unknown message type: ${message.type}`);
    }
  }

  sendInput(input) {
    if (!this.connected) return;

    // Add sequence number for reconciliation
    const sequencedInput = {
      sequence: this.inputSequence++,
      ...input,
      timestamp: this.getServerTime(),
    };

    this.send({
      type: 'input',
      input: sequencedInput,
    });

    // Store for reconciliation
    this.pendingInputs.push(sequencedInput);

    // Client-side prediction: apply input immediately
    this.applyInput(sequencedInput);
  }

  handleStateUpdate(message) {
    const { snapshot, serverTime } = message;

    this.serverState = snapshot;
    this.syncClock(serverTime);

    // Server reconciliation
    this.reconcileState(snapshot);

    // Interpolation for other players
    this.interpolateRemotePlayers(snapshot);
  }

  reconcileState(snapshot) {
    // Find our player in snapshot
    const serverPlayer = snapshot.players.find(p => p.id === this.playerId);
    if (!serverPlayer) return;

    // Check if server processed inputs we haven't acknowledged
    if (serverPlayer.lastProcessedInput > this.lastProcessedInput) {
      this.lastProcessedInput = serverPlayer.lastProcessedInput;

      // Remove acknowledged inputs
      this.pendingInputs = this.pendingInputs.filter(
        input => input.sequence > this.lastProcessedInput
      );

      // Reapply unacknowledged inputs
      let predictedState = serverPlayer;
      this.pendingInputs.forEach(input => {
        predictedState = this.applyInput(input, predictedState);
      });

      // Update local player position
      this.localPlayer.mesh.position.copy(predictedState.position);
      this.localPlayer.velocity.copy(predictedState.velocity);
    }
  }

  interpolateRemotePlayers(snapshot) {
    // Render remote players in the past for smooth interpolation
    const renderTime = this.getServerTime() - 100; // 100ms behind

    snapshot.players.forEach(playerData => {
      if (playerData.id === this.playerId) return; // Skip local player

      const player = this.getPlayerById(playerData.id);
      if (!player) return;

      // Interpolate between previous and current position
      player.mesh.position.lerp(playerData.position, 0.5);
      player.mesh.quaternion.slerp(playerData.rotation, 0.5);

      // Update animation state
      player.animController.playAnimation(playerData.animation);
    });
  }

  startPingInterval() {
    setInterval(() => {
      this.send({
        type: 'ping',
        timestamp: Date.now(),
      });
    }, 1000);
  }

  updateLatency(message) {
    const now = Date.now();
    this.latency = (now - message.clientTime) / 2;
    this.syncClock(message.serverTime);
  }

  syncClock(serverTime) {
    const now = Date.now();
    this.clockOffset = serverTime - now;
  }

  getServerTime() {
    return Date.now() + this.clockOffset;
  }

  send(data) {
    if (this.connected) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

### 7.5 Lag Compensation Techniques

**Implemented:**
1. **Client-Side Prediction** - Apply inputs immediately
2. **Server Reconciliation** - Correct prediction errors
3. **Entity Interpolation** - Smooth movement of remote players
4. **Extrapolation** - Predict remote player movement during packet loss
5. **Snapshot Compression** - Delta compression for bandwidth savings

---

## 8. Integrated System Architecture

### 8.1 Complete System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Side                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │ Input Manager  │  │ Network Client │  │  UI Manager   │  │
│  │ (Universal)    │  │ (Prediction)   │  │  (Menus/HUD)  │  │
│  └────────┬───────┘  └────────┬───────┘  └───────────────┘  │
│           │                    │                              │
│           ▼                    ▼                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Game Logic Controller                     │  │
│  │  - Player State Management                             │  │
│  │  - Weapon Systems                                      │  │
│  │  - Combat Resolution                                   │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Physics System (Rapier)                   │  │
│  │  - Character Controllers                               │  │
│  │  - Projectile Physics                                  │  │
│  │  - Collision Detection                                 │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Animation System (Three.js)                  │  │
│  │  - State Machines                                      │  │
│  │  - IK Controllers                                      │  │
│  │  - Ragdoll Physics                                     │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Rendering System (WebGPU)                      │  │
│  │  - THREE.WebGPURenderer                                │  │
│  │  - Compute Shaders                                     │  │
│  │  - Post-Processing                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │ WebSocket
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                         Server Side                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               WebSocket Server                         │  │
│  │  - Connection Management                               │  │
│  │  - Message Routing                                     │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Match Manager                            │  │
│  │  - Matchmaking Queue                                   │  │
│  │  - Match Lifecycle                                     │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Server Game Simulation                      │  │
│  │  - Authoritative Physics                               │  │
│  │  - Combat Resolution                                   │  │
│  │  - Anti-Cheat Validation                               │  │
│  │  - Play Zone Management                                │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          Procedural Generation Service                 │  │
│  │  - Terrain Generation                                  │  │
│  │  - Structure Placement                                 │  │
│  │  - Loot Distribution                                   │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               State Database                           │  │
│  │  - Match History                                       │  │
│  │  - Player Stats                                        │  │
│  │  - Leaderboards                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Data Flow Example: Player Shoots Weapon

```
1. Player presses fire button
   ↓
2. InputManager detects action
   ↓
3. Client-side prediction: Apply immediately
   ├→ Play muzzle flash effect
   ├→ Play sound effect
   ├→ Create client-side projectile
   └→ Trigger attack animation
   ↓
4. Send input to server via NetworkClient
   ↓
5. Server receives input
   ↓
6. Server validates input (anti-cheat)
   ├→ Check cooldown
   ├→ Check ammo
   ├→ Check player state (alive, not reloading)
   └→ If valid, proceed
   ↓
7. Server simulates projectile
   ├→ Raycast from weapon position
   ├→ Check for hits
   └→ If hit, apply damage
   ↓
8. Server sends state update to all clients
   ↓
9. Clients receive update
   ├→ Local player: Reconcile prediction
   └→ Remote players: Interpolate positions
   ↓
10. If hit, update health UI and play hit animation
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1: WebGPU Migration**
- [ ] Replace WebGLRenderer with WebGPURenderer
- [ ] Test compatibility with existing shaders
- [ ] Implement fallback for unsupported browsers
- [ ] Benchmark performance improvements

**Week 2: Input System Expansion**
- [ ] Refactor InputController to InputManager
- [ ] Implement TouchInput with virtual joysticks
- [ ] Add MouseInput with pointer lock
- [ ] Create AccessibilityInput foundation
- [ ] Build input configuration UI

**Week 3: Animation System**
- [ ] Set up AnimationController class
- [ ] Create AnimationStateMachine
- [ ] Integrate with Player class
- [ ] Test with placeholder animations
- [ ] Document animation requirements for artists

**Week 4: Physics Engine Integration**
- [ ] Install Rapier physics library
- [ ] Create PhysicsWorld wrapper
- [ ] Migrate Player to character controller
- [ ] Test collision detection
- [ ] Benchmark performance

### Phase 2: Content Generation (Weeks 5-8)

**Week 5-6: Procedural Terrain**
- [ ] Implement TerrainGenerator with noise
- [ ] Create BiomeSystem
- [ ] Add chunk-based generation
- [ ] GPU compute shader optimization
- [ ] Test performance with large terrains

**Week 7: Structure & Props**
- [ ] Build StructureGenerator
- [ ] Create structure templates
- [ ] Implement PropGenerator
- [ ] Add loot spawn system
- [ ] Test variety and distribution

**Week 8: Play Zone System**
- [ ] Create shrinking play zone mechanics
- [ ] Implement damage outside zone
- [ ] Visual boundary effects
- [ ] Test zone progression

### Phase 3: Networking (Weeks 9-14)

**Week 9-10: Server Infrastructure**
- [ ] Set up Node.js WebSocket server
- [ ] Implement MatchManager
- [ ] Create Match class with game loop
- [ ] Build matchmaking queue
- [ ] Test with dummy clients

**Week 11-12: Client Networking**
- [ ] Create NetworkClient class
- [ ] Implement client-side prediction
- [ ] Add server reconciliation
- [ ] Entity interpolation
- [ ] Latency measurement

**Week 13: Anti-Cheat & Security**
- [ ] Server-authoritative validation
- [ ] Input sanitization
- [ ] Movement validation (speed hacks)
- [ ] Hit registration validation
- [ ] Rate limiting

**Week 14: Network Optimization**
- [ ] Snapshot compression
- [ ] Bandwidth optimization
- [ ] Network culling (spatial)
- [ ] Connection quality handling
- [ ] Reconnection system

### Phase 4: Battle Royale Features (Weeks 15-20)

**Week 15-16: Game Mode**
- [ ] Match lifecycle (lobby, plane, game, end)
- [ ] Player spawning system
- [ ] Elimination and spectator mode
- [ ] Victory condition
- [ ] Match statistics

**Week 17: Loot System**
- [ ] Weapon pickup system
- [ ] Armor and equipment
- [ ] Inventory management
- [ ] Rarity tiers
- [ ] Loot table balancing

**Week 18: Advanced Combat**
- [ ] Headshot detection
- [ ] Damage falloff
- [ ] Weapon spread patterns
- [ ] Recoil systems
- [ ] Weapon balancing

**Week 19-20: UI/UX**
- [ ] Match HUD redesign
- [ ] Mini-map
- [ ] Kill feed
- [ ] Spectator UI
- [ ] End-game screen
- [ ] Leaderboards

### Phase 5: Polish & Optimization (Weeks 21-24)

**Week 21: Performance Optimization**
- [ ] LOD system implementation
- [ ] Frustum culling optimization
- [ ] Object pooling
- [ ] Memory leak fixes
- [ ] Mobile optimization

**Week 22: Visual Polish**
- [ ] Post-processing effects
- [ ] Particle systems (muzzle flash, impact)
- [ ] Environmental effects (weather)
- [ ] Improved lighting
- [ ] Texture quality pass

**Week 23: Audio**
- [ ] 3D spatial audio
- [ ] Weapon sound variations
- [ ] Footstep system
- [ ] Ambient sounds
- [ ] Dynamic music

**Week 24: Testing & QA**
- [ ] Load testing (100 players)
- [ ] Bug fixing
- [ ] Balance adjustments
- [ ] Accessibility testing
- [ ] Cross-browser testing

---

## 10. Performance Targets & Optimization

### 10.1 Target Metrics

| Metric | Target | Baseline (Current) | Strategy |
|--------|--------|-------------------|----------|
| FPS (50 players) | 60 | 15 | WebGPU + LOD + Culling |
| FPS (100 players) | 60 | N/A | Network culling + Instancing |
| Arena Generation | <10s | N/A | GPU compute shaders |
| Network Latency | <50ms | N/A | Geographic server distribution |
| Memory Usage | <2GB | 500MB | Asset compression + pooling |
| Bundle Size | <15MB | 2MB | Code splitting + compression |

### 10.2 Optimization Strategies

**Rendering:**
1. **LOD System** - Multiple detail levels for distant objects
2. **Frustum Culling** - Don't render off-screen objects
3. **Occlusion Culling** - Don't render hidden objects
4. **Instanced Rendering** - Batch similar objects
5. **Texture Atlasing** - Reduce draw calls
6. **Shader Optimization** - Simplified shaders for distant objects

**Networking:**
1. **Network Culling** - Only sync nearby players
2. **Delta Compression** - Send only changed data
3. **Priority System** - More updates for nearby players
4. **Area of Interest** - Reduce update frequency for distant players

**Physics:**
1. **Spatial Partitioning** - Octree for collision detection
2. **Sleeping Objects** - Disable physics for stationary objects
3. **Simplified Colliders** - Use primitives instead of mesh colliders
4. **Fixed Timestep** - Consistent physics simulation

**Memory:**
1. **Object Pooling** - Reuse projectiles, particles
2. **Asset Streaming** - Load chunks on demand
3. **Texture Compression** - Use compressed formats
4. **Garbage Collection** - Minimize allocations in hot paths

---

## Conclusion

This architecture transforms CODE Platformer AI into a modern, scalable WebGPU-powered battle royale game with:

1. **10x Performance** via WebGPU and compute shaders
2. **Universal Accessibility** with diverse input methods
3. **Infinite Variety** through procedural generation
4. **Immersive Characters** with full skeletal animation
5. **Realistic Physics** using Rapier engine
6. **Massive Multiplayer** supporting 50-100 players

**Timeline:** 24 weeks (6 months) with 2-3 developers

**Risk Mitigation:**
- Phased approach with testable milestones
- Proven technologies (Three.js, Rapier, WebSocket)
- Graceful degradation (WebGL fallback, smaller matches)
- Performance budgets enforced at each phase

**Next Steps:**
1. Review and approve architecture
2. Set up development environment
3. Begin Phase 1: Foundation
4. Hire additional developers if needed
5. Establish testing infrastructure

---

**Ready to build the future of web-based battle royale gaming!** 🚀
