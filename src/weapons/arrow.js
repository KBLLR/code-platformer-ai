// src/weapons/arrow.js

import { Projectile } from "./projectile.js";
import { Weapons } from "../Weapons.js"; // Import Weapons utility

/**
 * A special slow flying projectile (Arrow)
 */
class Arrow extends Projectile {
  /**
   * Initializes an Arrow projectile.
   * @param {Weapon} bow - The Bow weapon that fired this arrow.
   * @param {THREE.Vector3} direction - The firing direction.
   */
  constructor(bow, direction) {
    // Projectile(weapon, initialDirection, shooting_velocity, mass, radians_offset)
    super(bow, direction, 35, 0.1); // Arrow is slow (35 speed), has some mass (0.1)
    this.name = "Arrow"; // For config lookups if needed
  }

  /**
   * Asynchronously loads the arrow mesh. This must be called after instantiation
   * and before adding to scene, typically by the Weapon that fires it.
   * @param {THREE.Scene} scene - The scene to add the mesh to.
   * @returns {Promise<void>}
   */
  async ensureMesh(scene) {
    if (!this.mesh) {
      this.mesh = await Weapons.getProjectileMesh(this);
      if (this.mesh) {
        this.mesh.position.copy(this.pos);
        // Arrows usually point along their length (e.g. +X). Need to orient it.
        // If the model itself comes pointing along Y-axis, then rotate accordingly.
        // Assuming model points along +X, no initial rotation needed if lookAt handles it.
        this.mesh.scale.set(0.1, 0.1, 0.1); // Adjust scale for your arrow model
        scene.add(this.mesh);
      }
    }
  }

  /**
   * Update Arrow's position and mesh.
   * @param {number} dt - Delta time in ms.
   */
  update(dt) {
    super.update(dt); // Updates this.pos and this.mesh.position/rotation
  }
}
Arrow.Name = "Arrow"; // Static property for class name

export { Arrow };
