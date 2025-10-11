import { RandomWeaponSpawn } from "./weapon_spawns/random_weapon_spawn.js";
import { NormalWeaponSpawn } from "./weapon_spawns/normal_weapon_spawn.js";
import { Physics } from "./Physics.js";

/**
 * Holds all the spawns in the world
 */
class Spawns {
  constructor() {
    this._weapon_spawns = [];
    this._player_spawns = [];
    this._trophy_spawns = [];
  }

  /**
   * Update all spawns, checking for intersection with players.
   * Call this per-frame in your game loop, for all players!
   */
  Update(dt, players = []) {
    for (let wp_spawn of this._weapon_spawns) {
      wp_spawn.Update(dt);
      // Check each player for weapon pickup
      for (const player of players) {
        if (wp_spawn.hasWeapon && Physics.doBoxesIntersect(wp_spawn, player)) {
          player.setWeapon(wp_spawn.takeWeapon());
        }
      }
    }
  }

  /**
   * Adds a new weapon spawn to the scene.
   * type: Type of weapon spawn. [1: RandomWeaponSpawn, 2: NormalWeaponSpawn]
   * pos: THREE.Vector3 (or plain {x, y, z})
   * scene: THREE.Scene
   */
  AddWeaponSpawn(type, pos, scene) {
    let spawn = null;
    switch (type) {
      case 1:
        spawn = new RandomWeaponSpawn(pos);
        break;
      case 2:
        spawn = new NormalWeaponSpawn(pos);
        break;
      default:
        return;
    }
    this._weapon_spawns.push(spawn);
    if (spawn.mesh) scene.add(spawn.mesh); // Expect your spawns to have .mesh for Three.js
  }

  AddTrophySpawn(pos) {
    this._trophy_spawns.push(pos);
  }

  AddPlayerSpawn(pos) {
    this._player_spawns.push(pos);
  }

  get playerSpawnpointCount() {
    return this._player_spawns.length;
  }

  get trophySpawnpointCount() {
    return this._trophy_spawns.length;
  }

  GetRandomPlayerSpawn() {
    return this._player_spawns[
      Math.floor(Math.random() * this._player_spawns.length)
    ];
  }

  GetDifferentPlayerSpawns(number_of_spawns) {
    if (number_of_spawns > this._player_spawns.length) {
      throw new Error(
        `'${this._player_spawns.length}' player spawnpoints are available. '${number_of_spawns}' were requested.`,
      );
    } else if (number_of_spawns === this._player_spawns.length) {
      return this._player_spawns;
    } else {
      const spawns = [];
      while (spawns.length !== number_of_spawns) {
        const sp = this.GetRandomPlayerSpawn();
        if (!spawns.includes(sp)) spawns.push(sp);
      }
      return spawns;
    }
  }

  GetRandomTrophySpawn() {
    return this._trophy_spawns[
      Math.floor(Math.random() * this._trophy_spawns.length)
    ];
  }
}

export { Spawns };
