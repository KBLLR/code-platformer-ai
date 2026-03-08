# Game Systems Documentation

## Overview

This document describes the core game systems implemented in CODE Platformer AI, including the newly added **3D Generative Stage Module** and **Game Rules/Victory System**.

---

## 1. 3D Generative Stage Module

**File:** `src/StageGenerator.js`

### Purpose

Dynamically generate Three.js 3D scenes from JSON configuration instead of loading static level files. This enables:
- Procedural level generation
- Easy level prototyping
- Dynamic arena modifications during gameplay
- JSON-based level sharing

### Usage

#### Basic Generation

```javascript
import { StageGenerator } from "./StageGenerator.js";

const stageConfig = {
  name: "My Custom Arena",
  dimensions: { width: 34, height: 20 },
  theme: "code", // "code", "google", "ballpit", "basement"

  platforms: [
    { x: 0, y: 0, width: 34, height: 2 },  // Floor
    { x: 10, y: 8, width: 6, height: 1 },   // Platform
    { x: 14, y: 12, width: 6, height: 1 }   // Higher platform
  ],

  spawns: {
    players: [
      { x: 5, y: 10 },
      { x: 28, y: 10 }
    ],
    weapons: [
      { x: 17, y: 14, type: "random" }
    ],
    money: [
      { x: 8, y: 6 },
      { x: 25, y: 6 }
    ]
  },

  background: {
    type: "gradient",
    colors: ["#87CEEB", "#B0E0E6", "#F0F8FF"]
  },

  lighting: {
    ambient: { color: 0xffffff, intensity: 0.6 },
    directional: {
      color: 0xffffff,
      intensity: 0.8,
      position: [10, 15, 10],
      castShadow: true
    },
    fill: {
      color: 0x87ceeb,
      intensity: 0.3,
      position: [-5, 8, -5]
    }
  }
};

// Generate the stage
const level = await StageGenerator.generate(scene, stageConfig);
```

#### Using Templates

```javascript
// Generate from built-in templates
const level = await StageGenerator.generateFromTemplate(scene, "simple");
// or
const level = await StageGenerator.generateFromTemplate(scene, "complex");
```

### Stage Configuration Schema

```typescript
interface StageConfig {
  name: string;
  dimensions: { width: number; height: number };
  theme: "code" | "google" | "ballpit" | "basement" | "generic";

  platforms: Array<{
    x: number;        // Grid X position
    y: number;        // Grid Y position
    width: number;    // Width in tiles
    height: number;   // Height in tiles
    gid?: number;     // Tile GID (optional, default: 1)
    material?: string // Material override (optional)
  }>;

  spawns: {
    players: Array<{ x: number; y: number }>;
    weapons: Array<{ x: number; y: number; type?: string }>;
    money: Array<{ x: number; y: number }>;
  };

  background?: {
    type: "gradient" | "color" | "image";
    colors?: string[];  // For gradient/color
    image?: string;     // For image background
  };

  lighting?: {
    ambient?: { color: number; intensity: number };
    directional?: {
      color: number;
      intensity: number;
      position: [number, number, number];
      castShadow: boolean;
    };
    fill?: {
      color: number;
      intensity: number;
      position: [number, number, number];
    };
  };

  decorations?: Array<{
    type: "box" | "sphere" | "model";
    position: [number, number, number];
    scale?: [number, number, number];
    rotation?: [number, number, number];
    color?: number;
    model?: string; // Path to GLB model
  }>;
}
```

### Integration with Game.js

Replace static level loading:

```javascript
// OLD (static):
await loadLevelAsync(scene, lvl);

// NEW (generated):
const stageConfig = await fetch('/data/stages/arena_01.json').then(r => r.json());
const level = await StageGenerator.generate(scene, stageConfig);
Level.ActiveLevel = level;
```

---

## 2. Game Rules & Victory System

**File:** `src/GameRules.js`

### Purpose

Manages game state, victory conditions, player respawning, and match statistics. Provides a complete rule system for multiplayer battles.

### Usage

#### Initialize in Game.js

```javascript
import { GameRules } from "./GameRules.js";

// Create game rules instance
const gameRules = new GameRules();

// Start match when players are loaded
gameRules.startMatch(players);
```

#### Check Victory in Game Loop

```javascript
function animate() {
  requestAnimationFrame(animate);

  // ... existing update logic ...

  // Check victory conditions
  const winner = gameRules.checkVictory(players);
  if (winner) {
    gameRules.showVictoryScreen();
    // Optionally stop game loop or show menu
    return;
  }

  // Update respawns
  gameRules.updateRespawns(players, Level.ActiveLevel);

  // ... render ...
}
```

#### Handle Player Death

```javascript
// When a player dies (e.g., from projectile collision)
function onPlayerHit(player, playerIndex, killerIndex) {
  player.health -= damage;

  if (player.health <= 0) {
    gameRules.handlePlayerDeath(player, playerIndex, killerIndex);
  }
}
```

### Victory Conditions

The system supports multiple victory conditions:

1. **Money** (default) - First to reach $10,000
2. **Elimination** - Last player standing
3. **Time Limit** - Most money when time expires
4. **Kills** - First to reach kill limit

Set victory condition:

```javascript
gameRules.victoryCondition = "money";      // Default
gameRules.victoryCondition = "elimination"; // Battle royale
gameRules.victoryCondition = "time";        // Timed match
gameRules.victoryCondition = "kills";       // Deathmatch
```

### Match Statistics

Get real-time statistics:

```javascript
const stats = gameRules.getMatchStats(players);

console.log(stats);
// {
//   duration: 123.45,
//   gameState: "playing",
//   players: [
//     { index: 0, health: 80, money: 5000, kills: 3, deaths: 1, alive: true },
//     { index: 1, health: 0, money: 2000, kills: 1, deaths: 2, alive: false },
//     ...
//   ]
// }
```

### Respawn System

**Automatic Respawning:**
- Players respawn after `game_config.respawn_time` (default: 5000ms)
- Respawn at player spawn points defined in level
- Health restored to max
- Velocity reset

**Manual Control:**

```javascript
// Disable respawning for elimination mode
gameRules.victoryCondition = "elimination";

// Manual respawn
gameRules.respawnPlayer(player, playerIndex, Level.ActiveLevel);
```

### UI Integration

Create victory screen in HTML:

```html
<div id="victory-screen" style="display: none;">
  <div class="victory-content">
    <h1 id="winner-text">Player 1 Wins!</h1>
    <p id="victory-reason">Reached $10,000!</p>
    <div id="victory-stats"></div>
    <button onclick="restartMatch()">Play Again</button>
  </div>
</div>
```

The `GameRules.showVictoryScreen()` will automatically populate this HTML.

---

## 3. Current Game Systems Status

### ✅ Fully Implemented

| System | File | Status |
|--------|------|--------|
| **Life Bars** | `src/ui/player_ui.js` | ✅ Health bars, UI updates |
| **Game Loop** | `src/Game.js` | ✅ 60 FPS loop, delta time |
| **Physics** | `src/Player.js`, `src/Physics.js` | ✅ Movement, jumping, gravity |
| **Input** | `src/InputController.js` | ✅ Keyboard + gamepad |
| **Combat** | `src/weapons/`, `src/Player.js` | ✅ 4 weapons, projectiles |
| **3D Rendering** | `src/Game.js` | ✅ WebGPU/WebGL |
| **Stage Generator** | `src/StageGenerator.js` | ✅ JSON → Three.js scene |
| **Game Rules** | `src/GameRules.js` | ✅ Victory, respawn, stats |

### ⚠️ Needs Integration

| System | Status | Next Steps |
|--------|--------|-----------|
| **Victory Checking** | ⚠️ Module ready, not integrated | Add to `Game.js` loop |
| **Player Respawns** | ⚠️ Module ready, not integrated | Call in `Game.js` loop |
| **Collision Detection** | ⚠️ Partial (platforms only) | Add projectile → player collision |
| **Victory UI** | ⚠️ Logic ready, no HTML | Create victory screen HTML |

### ❌ Not Yet Implemented

| System | Priority | Description |
|--------|----------|-------------|
| **AI Opponents** | Medium | `src/AI.js` exists but not functional |
| **Network Multiplayer** | Low | Future WebGPU Battle Royale feature |
| **Power-ups** | Low | Temporary boosts, shields |
| **Leaderboard** | Low | Persistent stats tracking |

---

## 4. Integration Guide

### Step 1: Integrate GameRules

In `src/Game.js`:

```javascript
import { GameRules } from "./GameRules.js";

// Global game rules instance
let gameRules;

export async function initGame(canvas, { lvl = 0, character = 0 } = {}) {
  // ... existing setup ...

  // Initialize game rules
  gameRules = new GameRules();
  gameRules.victoryCondition = "money"; // or "elimination", "time", "kills"
  gameRules.matchDuration = 0; // 0 = no limit, or set time in seconds

  // Start match after players load
  gameRules.startMatch(players);

  // ... rest of init ...
}

function animate() {
  // ... existing loop ...

  // Check victory
  const winner = gameRules.checkVictory(players);
  if (winner) {
    gameRules.showVictoryScreen();
    // Pause game or return to menu
    return;
  }

  // Update respawns
  gameRules.updateRespawns(players, Level.ActiveLevel);

  // ... render ...
}
```

### Step 2: Use StageGenerator

Create a stage config JSON file in `public/data/stages/custom_arena.json`:

```json
{
  "name": "Custom Arena",
  "dimensions": { "width": 34, "height": 20 },
  "theme": "code",
  "platforms": [
    { "x": 0, "y": 0, "width": 34, "height": 2 },
    { "x": 8, "y": 8, "width": 6, "height": 1 },
    { "x": 20, "y": 8, "width": 6, "height": 1 }
  ],
  "spawns": {
    "players": [{ "x": 5, "y": 10 }, { "x": 28, "y": 10 }],
    "weapons": [{ "x": 17, "y": 10 }],
    "money": [{ "x": 8, "y": 6 }, { "x": 25, "y": 6 }]
  }
}
```

Load in `Game.js`:

```javascript
import { StageGenerator } from "./StageGenerator.js";

// In initGame():
const stageConfig = await fetch('/data/stages/custom_arena.json').then(r => r.json());
Level.ActiveLevel = await StageGenerator.generate(scene, stageConfig);
```

### Step 3: Create Victory UI

Add to `index.html`:

```html
<div id="victory-screen" class="victory-screen">
  <div class="victory-content">
    <h1 id="winner-text"></h1>
    <p id="victory-reason"></p>
    <div id="victory-stats"></div>
    <button onclick="location.reload()">Play Again</button>
    <button onclick="window.location='index.html'">Main Menu</button>
  </div>
</div>
```

Add to `styles/index.css`:

```css
.victory-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.victory-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 3rem;
  border-radius: 20px;
  text-align: center;
  color: white;
}

.victory-content h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.victory-content button {
  margin: 1rem 0.5rem;
  padding: 1rem 2rem;
  font-size: 1.2rem;
  cursor: pointer;
  border: none;
  border-radius: 10px;
  background: white;
  color: #667eea;
  font-weight: bold;
}
```

---

## 5. Example: Complete Game Session

```javascript
// 1. Generate custom stage
const config = await fetch('/data/stages/battle_arena.json').then(r => r.json());
const level = await StageGenerator.generate(scene, config);

// 2. Load players
await loadPlayers(scene, 4);

// 3. Start match
gameRules.startMatch(players);
gameRules.victoryCondition = "money";

// 4. Game loop checks victory
function animate() {
  // Update game state
  updatePlayers(deltaTime);
  updateProjectiles(deltaTime);

  // Check for winner
  const winner = gameRules.checkVictory(players);
  if (winner) {
    gameRules.showVictoryScreen();
    return; // Stop game
  }

  // Handle respawns
  gameRules.updateRespawns(players, level);

  // Render
  renderer.render(scene, camera);
}
```

---

## 6. Configuration Reference

### game_config.js

```javascript
{
  player_hp: 100,          // Starting health
  win: 10000,              // Money to win
  respawn_time: 5000,      // Respawn delay (ms)
  gravity: 35,             // Gravity strength
  player_move_vel: 8,      // Movement speed
  player_jump_height: 2.2, // Jump height

  damage: {
    projectile: {
      arrow: 10,
      bullet: 1
    },
    weapon: {
      bow: 10,
      gun: 30,
      minigun: 3,
      shotgun: 6
    }
  },

  trophy: {
    passive_income: 100,   // Money per second when holding trophy
    pickup_bounty: 1000,   // Money for picking up trophy
    steal_bounty: 2000     // Money for stealing trophy
  }
}
```

---

## Summary

**Two major systems added:**

1. **StageGenerator** - Generate 3D levels from JSON instead of static files
2. **GameRules** - Victory conditions, respawning, match stats

**Integration needed:**
- Add `GameRules` to main game loop
- Create victory screen HTML/CSS
- Implement projectile collision detection
- Add player death handling

**Result:**
Complete game lifecycle from match start → gameplay → victory → restart!
