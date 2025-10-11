// src/Weapons.js
import * as THREE from "three";
import { LoaderManager } from "./LoaderManager.js";

// Singleton instance of LoaderManager
const loader = new LoaderManager();
loader.loadManifest().catch((err) => {
  console.error("Failed to load assets manifest for Weapons.js:", err);
});

export class Weapons {
  /**
   * Gets the 3D mesh for a specific weapon type.
   * Caches loaded models.
   * @param {Weapon} weaponInstance - An instance of the Weapon (e.g., Bow, Shotgun).
   * @param {number} [variant=0] - Optional variant index for the model.
   * @returns {Promise<THREE.Group>} The loaded 3D model (GLTF scene).
   */
  static async getWeaponMesh(weaponInstance, variant = 0) {
    const weaponName = weaponInstance.constructor.name.toLowerCase();
    // Use the weapon's type property if available, fallback to constructor name
    const query = weaponInstance.type || weaponName;

    let model;
    try {
      model = await loader.loadGLB(query);
      if (!model) {
        console.warn(`No 3D model found for weapon type: ${query}.`);
        // Fallback to a simple placeholder if model is not found
        model = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.2, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x888888 }),
        );
      }
    } catch (error) {
      console.error(`Error loading GLB for weapon ${query}:`, error);
      // Fallback to a simple placeholder on error
      model = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x888888 }),
      );
    }

    // Ensure the model is a clone so each weapon instance gets its own mesh
    const clonedModel = model.clone();
    clonedModel.traverse((child) => {
      if (child.isMesh) {
        // Ensure materials are also cloned to avoid sharing issues
        child.material = child.material.clone();
        child.castShadow = true;
      }
    });

    // Default scaling for weapons if necessary, adjust as per your model's size
    clonedModel.scale.set(0.5, 0.5, 0.5); // Adjust as needed
    return clonedModel;
  }

  /**
   * Gets the 3D mesh for a specific projectile type.
   * For simplicity, Bullet creates its own mesh. Arrow will load a GLB.
   * @param {Projectile} projectileInstance - An instance of the Projectile (e.g., Arrow, Bullet).
   * @param {number} [variant=0] - Optional variant index.
   * @returns {Promise<THREE.Group | THREE.Mesh>} The loaded 3D model.
   */
  static async getProjectileMesh(projectileInstance, variant = 0) {
    const projectileName = projectileInstance.constructor.name.toLowerCase();

    // Bullet creates its own mesh (simple sphere) so we don't load one here.
    // For other projectiles like Arrow, load a dedicated GLB.
    if (projectileName === "arrow") {
      let model;
      try {
        model = await loader.loadGLB("arrow"); // Query by tag "arrow"
        if (!model) {
          console.warn(
            `No 3D model found for projectile type: ${projectileName}.`,
          );
          model = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xbb4400 }),
          );
        }
      } catch (error) {
        console.error(
          `Error loading GLB for projectile ${projectileName}:`,
          error,
        );
        model = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xbb4400 }),
        );
      }
      const clonedModel = model.clone();
      clonedModel.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.castShadow = true;
        }
      });
      clonedModel.scale.set(0.1, 0.1, 0.1); // Adjust scale for arrow if needed
      return clonedModel;
    }

    // If it's a type that creates its own mesh (like Bullet),
    // or if no specific model is defined, return null or a generic placeholder.
    return null;
  }
}
