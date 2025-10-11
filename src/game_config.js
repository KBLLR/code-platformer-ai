// src/game_config.js

const DEFAULT_CONFIG = {
  resolution: 1,
  clear_color: 0x555555,
  // player_move_acc: 30, // Removed: unused in current 3D player update logic
  player_move_vel: 8, // Used for player horizontal movement
  // player_dash_vel: 50, // Removed: unused
  // player_dash_time: 42, // Removed: unused
  // player_dash_cooldown: 1000, // Removed: unused
  player_jump_height: 2.2, // Used for player jump initial velocity
  player_hp: 100, // Used for player health
  gravity: 35, // Used for player physics. Note: scaled by 0.0017 in Player.js
  respawn_time: 5000,
  healing: {
    amount_per_sec: 5,
    cooldown: 1000,
  },
  trophy: {
    passive_income: 100,
    pickup_bounty: 1000,
    steal_bounty: 2000,
  },
  win: 10000,
  // base_damage: 10, // Removed: damage calculation now relies on weapon/projectile specific configs
  damage: {
    // damage is calculated as base * projectile * weapon
    // base: 1, // Removed: now implicit or handled by weapon/projectile configs
    projectile: {
      arrow: 10,
      bullet: 1,
    },
    weapon: {
      bow: 10,
      gun: 30,
      minigun: 3,
      shotgun: 6,
    },
  },
  lifespan: {
    // defines the lifespan of projectiles for each weapon in ms. 0 or less are ignored
    weapon: {
      shotgun: 200,
    },
  },
  // size: { // Removed: specific 2D sprite sizing, not applicable to 3D models
  //   bow: 1.3,
  //   minigun: 1.3,
  //   gun: 0.5,
  // },
  // anchor: { // Removed: specific 2D sprite anchoring, not applicable to 3D models
  //   // x: greater => closer to body;  y: greater => lower;  default: [0.5, 0.5]
  //   gun: [0.3, 0.9],
  //   bow: [1.7, 0.5],
  //   minigun: [0.2, 1],
  //   shotgun: [0.5, 0.9],
  // },
  display_mov_vector: false, // Could be kept for debugging 3D movement vectors
  sound: {
    music_volume: 0.15,
  },
  // Setter to accept string clear color (hex string)
  set str_clear_color(cl) {
    this.clear_color = parseInt(cl, 16);
  },
};

// Singleton config (will be mutated by loader)
const game_config = { ...DEFAULT_CONFIG };

// Loads config.json and merges values into `game_config`
export async function loadGameConfig() {
  try {
    const res = await fetch("/data/config.json");
    if (!res.ok) throw new Error("Config JSON not found");
    const loaded = await res.json();
    Object.assign(game_config, loaded);
    if (loaded.str_clear_color) {
      game_config.str_clear_color = loaded.str_clear_color;
    }
  } catch (err) {
    console.error("Failed to load config.json, using defaults!", err);
  }
}

export { game_config };
