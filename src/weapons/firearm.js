import * as THREE from "three"; // Import THREE for Vector3
import { Weapon } from "./Weapon.js"; // Corrected path
import { Sounds } from "../sounds.js"; // Assuming sounds.js exists
import { GetUrlParam } from "../util.js"; // Assuming util.js exists
import { Level } from "../Level.js"; // Assuming Level.js exists

/*
 * Firearm Class
 * any kind of shootable weapon
 */
class Firearm extends Weapon {
  constructor(pos = new THREE.Vector3(), cooldown) {
    super(pos, cooldown);
    this.ammunition = null; // To be set by subclasses (e.g., Bullet)
    this.type = "gun"; // Default type for firearm, can be overridden by subclasses (e.g., minigun, shotgun)
  }

  /**
   * Fires a projectile of the defined ammunition type.
   * Overrides Weapon.fire()
   * @param {THREE.Scene} scene - The Three.js scene to add the projectile to.
   * @param {THREE.Vector3} direction - The firing direction.
   * @returns {Promise<THREE.Vector3>} The recoil vector.
   * @throws {Error} If ammunition type is not defined.
   */
  async fire(scene, direction) {
    if (!this.ammunition) {
      throw new Error(
        `Firearm: ${this.constructor.name} has undefined ammunition.`,
      );
    }
    if (this.hasCooldown) {
      return new THREE.Vector3(0, 0, 0); // No recoil if on cooldown
    }

    this._lastFired = performance.now();

    // Create projectile instance
    const projectile = new this.ammunition(this, direction);

    // If projectile has an async mesh loading method (like Arrow), call it.
    // Bullet creates its mesh in its constructor.
    if (projectile.ensureMesh) {
      await projectile.ensureMesh(scene);
    } else if (projectile.mesh) {
      // If mesh is already created (like Bullet), add it to scene
      scene.add(projectile.mesh);
    }

    // Add to Level or gameplay tracking
    Level.ActiveLevel?.addProjectile?.(projectile); // Level should track Projectile instances

    if (!GetUrlParam("no_sound")) {
      // Play sound based on the specific firearm type (Minigun, Shotgun, Gun)
      const soundName = this.constructor.name.toLowerCase();
      Sounds.Play(soundName, { volume: 0.5 });
    }

    // Calculate recoil: opposite direction of projectile velocity, scaled by impulse
    const recoil = new THREE.Vector3()
      .copy(projectile.vel)
      .negate() // Opposite direction
      .normalize() // Unit vector
      .multiplyScalar(projectile.getImpulse()); // Scale by impulse magnitude

    return recoil;
  }
}

export { Firearm };
