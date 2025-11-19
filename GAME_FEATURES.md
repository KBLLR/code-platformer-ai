# CODE Platformer AI - Game Features & Controls

## Game Overview

**Cube Clash: Battle Arena** is a 3D multiplayer platformer battle game built with Three.js and WebGPU. Battle with friends in fast-paced arena combat with platforming mechanics, weapon pickups, and destructible environments.

## Core Features

### Graphics Engine
- **WebGPU Renderer** - Modern GPU acceleration with 10x performance improvement
- **WebGL Fallback** - Automatic fallback for compatibility
- **3D Character Models** - GLB models for all 4 players
- **Dynamic Lighting & Shadows** - Real-time shadow casting

### Multiplayer Support
- **Up to 4 Players** simultaneously
- **Keyboard Controls** for 2 local players
- **Gamepad Support** for 4 controllers
- **Split-screen ready** UI system

### Combat System
- **4 Weapon Types**:
  - **Bow** - Long-range precision weapon with arrows
  - **Gun** - Standard firearm with bullets
  - **Shotgun** - Close-range spread weapon
  - **Minigun** - Rapid-fire automatic weapon
- **Health System** - Configurable HP per player
- **Score Tracking** - Kill tracking and leaderboard
- **Weapon Spawns** - Mystery boxes with random weapons

### Physics & Movement
- **Jumping Mechanics** - Jump buffering and coyote time
- **Grounded Detection** - Accurate platform collision
- **Velocity-based Movement** - Smooth acceleration/deceleration
- **Gravity System** - Realistic falling physics

### Game Modes & Levels
- **Multiple Arenas**:
  - CODE Arena - Tech-themed battle arena
  - Google Campus - Office environment
  - Ballpit - Colorful playground arena
  - Basement - Underground combat zone
  - VR Arena - Virtual reality themed

### Player Progression
- **Money Collection** - Scattered throughout levels
- **Win Screens** - Victory animations per player
- **Score System** - Track kills and performance

## Controls

### Player 1 (Keyboard)
- **WASD** - Movement (A/D = left/right, W = jump)
- **F** - Shoot weapon
- **Space** - Alternative jump

### Player 2 (Keyboard)
- **Arrow Keys** - Movement (Left/Right arrows, Up = jump)
- **M** - Shoot weapon

### Gamepad Controls (Players 1-4)
- **Left Stick** - Move character
- **A Button** - Jump
- **Right Trigger / B Button** - Shoot weapon

### Menu Navigation
- **Mouse** - Click menu buttons
- **ESC** - Pause / Back to menu

## Technical Specifications

### Performance
- **60 FPS** target framerate
- **2x Pixel Ratio** cap for performance
- **Dynamic shadows** with WebGL fallback
- **Asset preloading** for smooth gameplay

### Asset System
- **GLB Model Loading** - 3D character and weapon models
- **Sound Effects** - Weapon sounds and theme music
- **Sprite Animations** - Player states (idle, run, jump, dead)
- **Video Backgrounds** - 13 background videos

### Authentication & Onboarding
- **Smart Campus Integration** - User authentication system
- **Onboarding Flow** - First-time player tutorial
- **Character Selection** - Choose player count and characters
- **Level Selection** - Pick your battle arena

## Development Features

### Developer Tools
- **Controller Status UI** - Debug gamepad connections
- **Renderer Info** - Display WebGPU/WebGL status
- **Console Logging** - Detailed game state logging
- **Hot Module Reload** - Vite dev server

### Configuration
- **game_config.js** - Centralized game configuration
  - Player HP
  - Weapon damage
  - Projectile lifespan
  - Physics constants

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
# Opens at http://localhost:5173/
```

### Production Build
```bash
npm run build
npm run preview
```

## Game Flow

1. **Landing Page** - Authentication / Login
2. **Onboarding** - First-time tutorial (optional)
3. **Main Menu** - Select game mode
4. **Character Select** - Choose number of players
5. **Level Select** - Pick battle arena
6. **Battle Arena** - Fight with platforming and weapons
7. **Victory Screen** - Winner announcement
8. **Return to Menu** - Play again or quit

## Future Enhancements

- AI opponents for single-player mode
- Network multiplayer (battle royale vision)
- Power-ups and special abilities
- More weapons and customization
- Tournament mode
- Replay system
- Custom level editor

## Credits

Based on the original "Fund Fun Factory 2018 - Factory Battle Royale"
Transformed into a modern 3D WebGPU battle arena game.
