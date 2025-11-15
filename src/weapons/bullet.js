// src/weapons/bullet.js

import * as THREE from "three";
import { Projectile } from "./Projectile.js";

class Bullet extends Projectile {
  /**
   * Bullet projectile for Three.js.
   * @param {Weapon} weapon - The weapon that fired this bullet.
   * @param {THREE.Vector3} direction - The firing direction.
   * @param {number} [radians_offset=0] - Direction offset in radians.
   */
  constructor(weapon, direction, radians_offset = 0) {
    // Projectile(weapon, initialDirection, shooting_velocity, mass, radians_offset)
    super(weapon, direction, 100, 0.05, radians_offset); // Bullet is fast (100 speed), very light (0.05 mass)
    this.name = "Bullet"; // For config lookups if needed

    // Create a visible Three.js mesh (small yellow sphere) directly here
    const geometry = new THREE.SphereGeometry(0.1, 8, 8); // radius, widthSegs, heightSegs
    const material = new THREE.MeshStandardMaterial({
      color: 0xffff44,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.pos); // Set initial mesh position
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.scale.set(0.5, 0.5, 0.5); // Smaller scale for bullet visually
  }

  /**
   * Update the bullet's position and mesh in the scene.
   * @param {number} dt - Delta time in ms.
   */
  update(dt) {
    super.update(dt); // Updates this.pos and this.mesh.position/rotation
  }
}
Bullet.Name = "Bullet"; // Static property for class name

export { Bullet };
