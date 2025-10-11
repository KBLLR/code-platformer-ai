// src/weapon_spawns/normal_weapon_spawn.js

import * as THREE from "three"; // Import Three.js for Vector3, rotations etc.
import { WeaponSpawn } from "@/weapon_spawns/weapon_spawn"; // Correct path to parent class
import { Weapons } from "@/Weapons"; // Correct path to Weapons utility class

/**
 * Implementation for the normal weapon spawn.
 * Holds a single weapon which a player can pick up.
 * The weapon is displayed beforehand and respawns every 5 seconds (random weapon).
 */
class NormalWeaponSpawn extends WeaponSpawn {
  /**
   * Initializes the NormalWeaponSpawn.
   * @param {THREE.Vector3} pos - The world position of the spawn box.
   * @param {THREE.Scene} scene - The Three.js scene to which the spawn box and weapon will be added.
   */
  constructor(pos, scene) {
    // Position, cooldown (5000ms = 5 seconds)
    // The super constructor (WeaponSpawn) is assumed to add its own mesh (the box) to the scene.
    super(pos, 5000);
    this._nextWeapon = null; // The Weapon *instance* (e.g., new Bow(), new Shotgun())
    this._nextWeaponMesh = null; // The THREE.Group (GLB model) of the weapon instance

    // Ensure the spawn box mesh is loaded and then set the next weapon
    // We need to wait for the super's _ensureMesh to complete.
    // If WeaponSpawn doesn't expose its mesh promise, we might need to await it here.
    // Assuming WeaponSpawn's constructor initiates loading its mesh and this.mesh is set later.
    this.ensureSpawnMeshReady(scene)
      .then(() => {
        this._SetNextWeapon(); // Set the initial weapon
      })
      .catch((error) => {
        console.error(
          "NormalWeaponSpawn: Failed to initialize spawn box mesh. Cannot set next weapon.",
          error,
        );
      });
  }

  /**
   * Overrides the base class's Update.
   * Calls super.Update() for cooldown logic.
   */
  Update(dt) {
    super.Update(dt); // Handles cooldown, etc.
    // Optional: Add a subtle animation to the displayed weapon inside the box
    if (this._nextWeaponMesh) {
      this._nextWeaponMesh.rotation.y += dt * 0.5; // Rotate slowly
      // Maybe a slight hover animation
      // this._nextWeaponMesh.position.y = 0.2 + Math.sin(performance.now() * 0.002) * 0.05;
    }
  }

  /**
   * Player takes the displayed weapon.
   * Removes the weapon's mesh from the spawn box and returns the Weapon instance.
   * @returns {object | null} The Weapon instance, or null if on cooldown.
   */
  TakeWeapon() {
    // Call super.TakeWeapon() to apply cooldown and perform base logic
    const takenWeapon = super.TakeWeapon();

    if (takenWeapon) {
      if (this._nextWeaponMesh && this.mesh) {
        this.removeDisplayedWeaponMesh(this._nextWeaponMesh); // Use parent's method
        this._nextWeaponMesh = null; // Clear the reference
      }
      this._nextWeapon = null; // Clear the instance reference
      console.log(
        "[NormalWeaponSpawn] Weapon taken. Displayed weapon removed.",
      );
    }
    return takenWeapon;
  }

  /**
   * Resets the weapon spawn. Sets a new random weapon.
   */
  ResetWeapon() {
    super.ResetWeapon(); // Resets cooldown
    this._SetNextWeapon(); // Sets a new weapon and displays it
    console.log("[NormalWeaponSpawn] Weapon spawn reset. New weapon set.");
  }

  /**
   * Selects a new random weapon instance and loads its 3D model,
   * then displays it inside the spawn box.
   */
  async _SetNextWeapon() {
    // If there's an old weapon mesh displayed, remove it first
    if (this._nextWeaponMesh && this.mesh) {
      this.removeDisplayedWeaponMesh(this._nextWeaponMesh); // Use parent's method
      this._nextWeaponMesh = null;
    }

    this._nextWeapon = Weapons.GetRandomWeapon(); // Get a new Weapon instance
    console.log(
      `[NormalWeaponSpawn] Next weapon determined: ${this._nextWeapon.constructor.name}`,
    );

    try {
      // Load the 3D model for the new weapon
      const weaponMesh = await Weapons.getWeaponMesh(this._nextWeapon);
      this._nextWeaponMesh = weaponMesh;

      // Position and orient the weapon model locally relative to the spawn box's mesh
      // These values need to be tuned based on your GLB models and spawn box size.
      this._nextWeaponMesh.position.set(0, 0.2, 0.05); // Slightly above center, slightly forward
      this._nextWeaponMesh.scale.set(0.35, 0.35, 0.35); // Scale down to fit inside the box
      this._nextWeaponMesh.rotation.set(0, Math.PI / 4, 0); // Rotate for display (e.g., 45 deg around Y)

      // Add the weapon's mesh as a child of the spawn box's mesh
      if (this.mesh) {
        // Ensure the spawn box's mesh exists
        this.displayWeaponMesh(this._nextWeaponMesh); // Use parent's method
        console.log(
          `[NormalWeaponSpawn] Displaying ${this._nextWeapon.constructor.name} in spawn box.`,
        );
      } else {
        console.warn(
          "[NormalWeaponSpawn] Spawn box mesh not ready, cannot display weapon.",
        );
      }
    } catch (error) {
      console.error(
        `[NormalWeaponSpawn] Failed to load or display weapon mesh for ${this._nextWeapon.constructor.name}:`,
        error,
      );
      this._nextWeapon = null; // Clear weapon if mesh loading fails
    }
  }
}

export { NormalWeaponSpawn };
