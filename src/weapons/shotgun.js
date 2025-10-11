import * as THREE from "three"; // Import THREE for Vector3
import { Weapon } from "./Weapon.js"; // Corrected path
import { Bullet } from "./bullet.js"; // Corrected path
import { Sounds } from "../sounds.js"; // Assuming sounds.js exists
import { GetUrlParam } from "../util.js"; // Assuming util.js exists
import { Level } from "../Level.js"; // Assuming Level.js exists

class Shotgun extends Weapon {
  constructor(pos = new THREE.Vector3()) {
    super(pos, 750); // 750ms cooldown for shotgun
    this._number_bullets = 6; // Number of bullets per shot
    this.name = "Shotgun";
    this.type = "shotgun"; // Type for asset loading, matching manifest tag
  }

  /**
   * Fires multiple bullets in a spread pattern.
   * Overrides Weapon.fire()
   * @param {THREE.Scene} scene - The Three.js scene to add the projectiles to.
   * @param {THREE.Vector3} direction - The primary firing direction.
   * @returns {Promise<THREE.Vector3>} The summed recoil vector.
   */
  async fire(scene, direction) {
    if (this.hasCooldown) {
      return new THREE.Vector3(0, 0, 0); // No recoil if on cooldown
    }

    this._lastFired = performance.now();

    let totalRecoil = new THREE.Vector3(0, 0, 0);
    const spreadAngleDegrees = 20; // Total spread angle
    const startOffsetDegrees = -spreadAngleDegrees / 2; // Start from negative half of spread

    for (let i = 0; i < this._number_bullets; ++i) {
      // Calculate angular offset for each bullet
      const currentOffsetDegrees =
        startOffsetDegrees +
        i * (spreadAngleDegrees / (this._number_bullets - 1));
      const radians_offset = currentOffsetDegrees * (Math.PI / 180);

      // Create Bullet with direction offset
      const bullet = new Bullet(this, direction, radians_offset);

      // Add bullet mesh to scene (Bullet creates its own mesh in its constructor)
      if (bullet.mesh) {
        scene.add(bullet.mesh);
      }

      // Add to Level or gameplay tracking
      Level.ActiveLevel?.addProjectile?.(bullet);

      // Sum up recoil
      totalRecoil.add(
        new THREE.Vector3()
          .copy(bullet.vel)
          .negate()
          .normalize()
          .multiplyScalar(bullet.getImpulse()),
      );
    }

    if (!GetUrlParam("no_sound")) {
      Sounds.Play("shotgun");
    }

    return totalRecoil;
  }
}
Shotgun.Name = "Shotgun"; // Static property

export { Shotgun };
