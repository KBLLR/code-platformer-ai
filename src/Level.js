// src/Level.js
import * as THREE from "three"; // <--- NEW: Import THREE for Vector3
import { game_config as conf } from "./game_config.js";

// Helper to fetch level JSON by name (e.g., "lvl_code")
export async function loadLevelData(levelName) {
  const url = `/src/data/level/${levelName}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Could not load level: ${levelName}`);
  return await resp.json();
}

export class Level {
  /**
   * Represents a game level, loaded from JSON data.
   * @param {object} levelData - The JSON data describing the level.
   */
  constructor(levelData) {
    this.name = levelData.name || "unnamed";
    this.layers = levelData.layers || [];
    this.tilesets = levelData.tilesets || [];
    this.canvas = levelData.canvas || { width: 1088, height: 640 }; // Total canvas size
    // Calculate map dimensions in tiles (assuming 32x32 tiles)
    this.width = this.canvas.width / 32;
    this.height = this.canvas.height / 32;

    this.scene = null; // <--- NEW: Reference to the Three.js scene this level belongs to

    // Spawns will be stored as world coordinates
    this.playerSpawns = this._extractSpawns("player_sp");
    this.weaponSpawns = this._extractSpawns("weapon_sp");
    this.moneySpawns = this._extractSpawns("money_sp");

    // Track active projectiles in the level
    this.projectiles = [];
  }

  /**
   * Sets the Three.js scene associated with this level.
   * This is typically called by the World loader.
   * @param {THREE.Scene} scene - The Three.js scene instance.
   */
  setScene(scene) {
    this.scene = scene;
  }

  /**
   * Extracts spawn locations from a layer and converts them to world coordinates.
   * @param {string} layerName - The name of the layer containing spawn points.
   * @returns {Array<THREE.Vector3>} An array of world coordinate vectors for spawn points.
   */
  _extractSpawns(layerName) {
    const layer = this.layers.find((l) => l.name === layerName);
    if (!layer || !layer.data) return [];
    const cols = this.width;
    let spawns = [];
    for (let i = 0; i < layer.data.length; ++i) {
      // Check if tile is not empty (Tiled exports empty tiles as -1 or 0 depending on version)
      if (layer.data[i] >= 0) {
        const gridX = i % cols;
        const gridY = Math.floor(i / cols);

        // Convert grid coordinates to world coordinates (centered on tile)
        // mapWidth/2 and mapHeight/2 offset to center the whole level around (0,0)
        // (this.height - 1 - gridY) converts Tiled's top-left origin to bottom-left (Y-up)
        const worldX = gridX - this.width / 2 + 0.5;
        const worldY = this.height - 1 - gridY - this.height / 2 + 0.5;
        const worldZ = 0; // Assuming 2D game in XY plane, Z is 0

        spawns.push(new THREE.Vector3(worldX, worldY, worldZ));
      }
    }
    return spawns;
  }

  getTileAt(layerName, x, y) {
    const layer = this.layers.find((l) => l.name === layerName);
    if (!layer) return -1;
    const cols = this.width;
    // Note: Tiled Y is top-down, but our internal physics/world Y is bottom-up.
    // If you need to map world Y to Tiled Y, you might need to inverse it here:
    // const tiledY = this.height - 1 - y;
    return layer.data[y * cols + x] ?? -1;
  }

  /**
   * Adds a projectile to the level's active projectiles list.
   * @param {Projectile} projectile - The projectile instance.
   */
  addProjectile(projectile) {
    this.projectiles.push(projectile);
  }

  /**
   * Removes a projectile from the level's active projectiles list.
   * Also removes its mesh from the scene.
   * @param {Projectile} projectile - The projectile instance to remove.
   */
  removeProjectile(projectile) {
    // Removed 'scene' parameter, now uses this.scene
    const index = this.projectiles.indexOf(projectile);
    if (index > -1) {
      this.projectiles.splice(index, 1);
      if (projectile.mesh && this.scene) {
        // Use this.scene
        this.scene.remove(projectile.mesh);
        // Dispose of geometry and material to prevent memory leaks
        if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
        if (projectile.mesh.material) {
          if (Array.isArray(projectile.mesh.material)) {
            projectile.mesh.material.forEach((m) => m.dispose());
          } else {
            projectile.mesh.material.dispose();
          }
        }
      }
    }
  }

  /**
   * Static property to hold the currently active level instance.
   * This is a common pattern for single-active-level games, but be mindful of global state.
   * @type {Level | null}
   */
  static ActiveLevel = null;

  /**
   * Asynchronously creates a Level instance by loading its data from a JSON file.
   * @param {string} levelName - The name of the level (e.g., "lvl_code").
   * @returns {Promise<Level>} A promise that resolves with the created Level instance.
   */
  static async create(levelName) {
    const data = await loadLevelData(levelName);
    return new Level(data);
  }

  /**
   * Synchronously creates a procedural Level instance.
   * @param {object} [options] - Options for procedural generation.
   * @param {number} [options.width=34] - Width of the procedural level in tiles.
   * @param {number} [options.height=20] - Height of the procedural level in tiles.
   * @returns {Level} The created procedural Level instance.
   */
  static createProcedural({ width = 34, height = 20 } = {}) {
    const size = width * height;
    let worldData = Array(size).fill(-1);
    // Floor
    for (let x = 0; x < width; x++) worldData[(height - 1) * width + x] = 1;
    // Add a few floating platforms
    for (let x = 5; x < width - 5; x += 3) {
      worldData[(height - 5) * width + x] = 1;
      worldData[(height - 10) * width + x] = 1;
    }
    // Player spawns in four corners (using GID 1 as a placeholder)
    let playerSp = Array(size).fill(-1);
    playerSp[2 * width + 2] = 1;
    playerSp[2 * width + width - 3] = 1;
    playerSp[(height - 2) * width + 2] = 1;
    playerSp[(height - 2) * width + width - 3] = 1;
    // One weapon in the center
    let weaponSp = Array(size).fill(-1);
    weaponSp[Math.floor(size / 2)] = 1;

    // Add money spawn example in center too, if wanted:
    let moneySp = Array(size).fill(-1);
    moneySp[Math.floor(size / 2)] = 1;

    return new Level({
      name: "Procedural",
      layers: [
        { name: "world", data: worldData },
        { name: "player_sp", data: playerSp },
        { name: "weapon_sp", data: weaponSp },
        { name: "money_sp", data: moneySp },
      ],
      canvas: { width: width * 32, height: height * 32 },
    });
  }
}
