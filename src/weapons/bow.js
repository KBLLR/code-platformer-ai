// src/weapons/bow.js

import * as THREE from "three"; // Import THREE for Vector3
import { Weapon } from "./Weapon.js";
import { Arrow } from "./arrow.js";
import { Sounds } from "../sounds.js"; // Assuming sounds.js exists
import { GetUrlParam } from "../util.js"; // Assuming util.js exists
import { Level } from "../Level.js"; // Assuming Level.js exists

// Bow: shoots slow arrows, limited ammo, cooldown
class Bow extends Weapon {
  constructor(player, { arrows = 3, cooldown = 1000 } = {}) {
    // Weapon constructor expects a THREE.Vector3 for position, even if it's dynamic
    super(new THREE.Vector3(), cooldown);
    this.ammo = arrows;
    this.maxAmmo = arrows;
    this.name = "Bow"; // Instance name
    this.type = "bow"; // Type for asset loading, matching manifest tag
    this.player = player; // Set player reference
  }

  /**
   * Fires an arrow from the bow.
   * Overrides Weapon.fire()
   * @param {THREE.Scene} scene - The Three.js scene to add the projectile to.
   * @param {THREE.Vector3} direction - The firing direction.
   * @returns {Promise<THREE.Mesh | null>} The spawned arrow's mesh or null if on cooldown/no ammo.
   */
  async fire(scene, direction) {
    if (this.hasCooldown || this.ammo <= 0) return null;

    this.ammo -= 1;
    this._lastFired = performance.now();

    // Create an Arrow instance
    const arrow = new Arrow(this, direction);

    // Ensure the arrow's mesh is loaded and added to the scene
    await arrow.ensureMesh(scene); // Load the 3D model for the arrow

    // Add to Level or gameplay tracking
    Level.ActiveLevel?.addProjectile?.(arrow); // Level should track Projectile instances, not just meshes

    if (!GetUrlParam("no_sound")) {
      Sounds.Play("bow", { volume: 1.5 });
    }

    // Return the arrow's mesh
    return arrow.mesh;
  }

  reload() {
    this.ammo = this.maxAmmo;
  }

  // For HUD: Get ammo as string/number
  getAmmoStatus() {
    return this.ammo;
  }
}
Bow.Name = "Bow"; // Static property for class name (used in Firearm originally, now here for consistency)

export { Bow };
