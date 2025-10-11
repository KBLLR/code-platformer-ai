// src/weapons/projectile.js
import * as THREE from "three";
// Assuming Movable might handle basic pos/vel. If not, Projectile will fully implement.
// For now, Projectile will manage its own pos and vel as THREE.Vector3.
// import { Movable } from '../game_object' // <-- If Movable exists and uses THREE.Vector3

/**
 * General projectile entity. This class is not meant to be instantiated
 * directly. It manages the projectile's position, velocity, lifespan, and damage.
 */
class Projectile {
  /**
   * Initializes a new projectile.
   * @param {Weapon} weapon - The weapon that fired this projectile.
   * @param {THREE.Vector3} initialDirection - The normalized firing direction.
   * @param {number} shooting_velocity - The speed of the projectile.
   * @param {number} mass - The mass of the projectile (for impulse/recoil).
   * @param {number} [radians_offset=0] - An angular offset from the weapon's direction (for spread).
   */
  constructor(
    weapon,
    initialDirection,
    shooting_velocity,
    mass,
    radians_offset = 0,
  ) {
    // This ES6 snippet prevents direct instatiation in order to ensure an "abstract" class
    if (new.target === Projectile) {
      throw new TypeError(
        "Cannot construct abstract Projectile instances directly",
      );
    }

    this.weapon = weapon;
    this.mass = mass;

    // Projectile's mesh, to be created by subclasses (e.g., Bullet, Arrow)
    this.mesh = null;

    // Position and velocity using THREE.Vector3
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();

    // Calculate initial position from weapon's nozzle
    if (this.weapon.mesh) {
      const weaponWorldPos = new THREE.Vector3();
      const weaponWorldDir = new THREE.Vector3();
      this.weapon.mesh.getWorldPosition(weaponWorldPos);
      this.weapon.mesh.getWorldDirection(weaponWorldDir);

      // The weapon's local X-axis is assumed to be its forward direction.
      // Use the weapon's world forward direction for initial velocity.
      this.pos.copy(weaponWorldPos);

      // Apply a small offset in the firing direction to ensure projectile spawns clear of weapon
      const spawnOffset = 0.5; // Adjust based on your weapon/projectile model size
      this.pos.addScaledVector(weaponWorldDir, spawnOffset);
    } else {
      // Fallback if weapon mesh is not ready (shouldn't happen if ensureMesh is awaited)
      this.pos.copy(this.weapon.pos); // Use weapon's initial constructor position
    }

    // Calculate initial velocity based on provided direction and speed
    // Apply radians_offset by rotating the initialDirection around the Z-axis (for XY plane spread)
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), radians_offset); // Rotate around Z-axis
    this.vel
      .copy(initialDirection)
      .applyQuaternion(quaternion)
      .multiplyScalar(shooting_velocity);

    // Set damage
    this.damage = weapon.damage;
    const projectileName = this.constructor.name.toLowerCase();
    const damageMultiplier = game_config.damage?.projectile?.[projectileName];
    if (damageMultiplier) {
      this.damage *= damageMultiplier;
    }

    // Set instantiation time for lifespan tracking
    this._spawn_time = Date.now();
  }

  /**
   * Updates the projectile's position and mesh.
   * @param {number} dt - Delta time in milliseconds.
   */
  update(dt) {
    // Update position based on velocity (mimicking Movable.update)
    // dt is typically in milliseconds, convert to seconds for typical physics
    const dtSeconds = dt / 1000;
    this.pos.addScaledVector(this.vel, dtSeconds);

    // Update the mesh's position
    if (this.mesh) {
      this.mesh.position.copy(this.pos);

      // Orient the projectile's mesh to face its direction of travel
      // Assuming the projectile's forward axis is local +X or +Z. Adjust accordingly.
      // E.g., if projectile's forward is +X, use lookAt(this.pos.clone().add(this.vel))
      // If projectile's forward is +Z (common for GLB models), use lookAt(this.pos.clone().add(this.vel))
      // and then rotate around its local X-axis by PI/2 if model is upright.
      // For general projectiles, aiming towards the velocity vector is good.
      if (this.vel.lengthSq() > 0.0001) {
        // Only orient if moving
        const targetPos = this.pos.clone().add(this.vel);
        this.mesh.lookAt(targetPos);
        // Additional rotation may be needed depending on the model's default orientation
        // e.g., if model points along +Y, you might need mesh.rotateX(Math.PI / 2);
        // For an arrow, typically it points along its length.
        // If the arrow model points along its local -Y axis, you might need:
        // this.mesh.rotateZ(-Math.PI / 2); // To align -Y to velocity vector
        // this.mesh.rotateY(Math.PI / 2); // To correctly orient if world Y is up
      }
    }
  }

  get lifespanExpired() {
    return (
      this.weapon.projectileLifespan > 0 &&
      Date.now() - this._spawn_time >= this.weapon.projectileLifespan
    );
  }

  /**
   * Gets the projectile's current impulse.
   * Impulse (p) = mass * velocity_magnitude
   * @returns {number} The impulse.
   */
  getImpulse() {
    return this.mass * this.vel.length();
  }
}

export { Projectile };
