// src/Weapon.js
import * as THREE from "three";
import { Weapons } from "@/Weapons.js"; // Corrected path
import { game_config } from "@/game_config.js";
import { Level } from "@/Level.js"; // Assuming Level is in parent dir

class Weapon {
  /**
   * Abstract: should only be subclassed, not instantiated directly!
   */
  constructor(pos = new THREE.Vector3(0, 0, 0), cooldown = 500) {
    if (new.target === Weapon) {
      throw new TypeError(
        "Cannot construct abstract Weapon instances directly",
      );
    }
    this.pos = pos.clone(); // Initial spawn position, typically overridden when picked up
    this._cooldown = cooldown;
    this._lastFired = performance.now();
    this._player = null; // Reference to the Player object holding this weapon

    // Set damage from config if present
    this.damage = 1;
    // Lowercase constructor name for config lookup
    const wName = this.constructor.name.toLowerCase();
    if (game_config.damage?.weapon?.[wName])
      this.damage = game_config.damage.weapon[wName];

    // Projectile lifespan from config
    // Default to -1 (infinite) if not specified
    this.projectileLifespan = -1;
    if (game_config.lifespan?.weapon?.[wName])
      this.projectileLifespan = game_config.lifespan.weapon[wName];

    // For Three.js: weapon mesh (the 3D model)
    this.mesh = null;
    // Default facing right along positive X axis
    this._lastDir = new THREE.Vector3(1, 0, 0);
  }

  /**
   * Should be called after weapon is picked up or scene is ready.
   * Loads or attaches the mesh for this weapon (from asset loader).
   * @param {THREE.Scene} scene - The Three.js scene to add the mesh to.
   * @param {number} [variant=0] - Optional variant for the weapon model.
   * @returns {Promise<void>}
   */
  async ensureMesh(scene, variant = 0) {
    if (!this.mesh) {
      // Use the static Weapons.getWeaponMesh to load the model
      this.mesh = await Weapons.getWeaponMesh(this, variant);
      // If the weapon is picked up, it should be parented to the player's mesh
      // For now, it's just added to the scene at its initial position.
      this.mesh.position.copy(this.pos);
      scene.add(this.mesh);
    }
  }

  /**
   * Per-frame update for the weapon, e.g. orient to player, animate, etc.
   * @param {object} input - An object providing input, e.g., a getViewDir method.
   */
  update(input) {
    if (!this.mesh) return;

    // Get the aiming direction. This input might come from player mouse/controller, etc.
    // Assuming input.getViewDir(this) returns a THREE.Vector3 representing aim direction.
    let dir = input?.getViewDir?.(this) || this._lastDir;
    // Normalize to ensure it's a unit vector for direction calculations
    dir.normalize();
    this._lastDir.copy(dir); // Store for next frame/projectile spawn

    // Orient the weapon mesh to face the direction.
    // Assuming the weapon model's "forward" is along its local X-axis.
    // The model will be rotated around its local Z-axis to point towards dir (XY plane).
    const angle = Math.atan2(dir.y, dir.x);
    this.mesh.rotation.z = angle;

    // Handle flipping for left/right facing.
    // If aiming left (dir.x < 0), rotate 180 degrees around local Y-axis.
    // This assumes the model is generally symmetrical or has a defined front.
    if (dir.x < 0) {
      this.mesh.rotation.y = Math.PI; // Flip 180 degrees
    } else {
      this.mesh.rotation.y = 0; // Normal orientation
    }

    // If the weapon is attached to a player, its position should be managed by the player's animation system
    // or set relative to the player's hand/camera. For now, assume it's moving with its player.
    if (this._player && this._player.mesh) {
      // Simple offset from player's mesh position
      // This is a placeholder. A proper system would parent to a bone.
      this.mesh.position.copy(this._player.mesh.position);
      this.mesh.position.y += 0.5; // Slightly above player's base
      this.mesh.position.x += dir.x * 0.5; // Slightly in front of player
      this.mesh.position.z += dir.z * 0.5; // For 3D depth
    }
  }

  get player() {
    return this._player;
  }
  set player(p) {
    this._player = p;
  }

  /** True if on cooldown */
  get hasCooldown() {
    return performance.now() - this._lastFired < this._cooldown;
  }

  /**
   * Fires a projectile from this weapon.
   * This is the general method to be overridden by subclasses (e.g., Firearm, Bow).
   * Subclasses should call `super.fire(scene, dir)` or implement their own logic
   * for spawning projectiles, recoil, and sound effects.
   *
   * @param {THREE.Scene} scene - The Three.js scene to add the projectile to.
   * @param {THREE.Vector3} [dir=null] - The firing direction. If null, uses last known direction.
   * @param {number} [variant=0] - Optional variant for projectile model/texture.
   * @returns {Promise<THREE.Object3D | null>} The spawned projectile's mesh or null if on cooldown.
   */
  async fire(scene, dir = null, variant = 0) {
    if (this.hasCooldown) return null;
    this._lastFired = performance.now();

    dir = dir || this._lastDir; // Use last known direction if not provided
    dir.normalize(); // Ensure direction is a unit vector

    // Subclasses will define which projectile type to create (e.g., new Arrow(this, dir))
    // This abstract method is mainly for cooldown management and direction passing.
    // Projectiles should be instantiated and their meshes added to the scene by subclasses.
    console.warn(
      "Weapon: fire() method is abstract, must be implemented by subclass.",
    );
    return null; // Placeholder
  }
}

export { Weapon };
