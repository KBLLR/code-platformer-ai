// src/Physics.js
import * as THREE from "three"; // Added THREE import

export class Physics {
  /**
   * Checks if the bounding boxes of two Three.js objects intersect.
   * Assumes each object has a 'mesh' property that is a THREE.Object3D (Mesh, Group, etc.).
   * The bounding box for each mesh is computed dynamically.
   * @param {object} obj1 - The first object (e.g., a Player, Projectile, or any object with a .mesh property).
   * @param {object} obj2 - The second object.
   * @returns {boolean} True if their bounding boxes intersect, false otherwise.
   */
  static doBoxesIntersect(obj1, obj2) {
    const mesh1 = obj1.mesh;
    const mesh2 = obj2.mesh;

    if (!mesh1 || !mesh2) {
      console.warn(
        "Physics.doBoxesIntersect: One or both objects are missing meshes.",
      );
      return false;
    }

    // Create temporary bounding boxes for the meshes based on their current world geometry
    const box1 = new THREE.Box3().setFromObject(mesh1);
    const box2 = new THREE.Box3().setFromObject(mesh2);

    // Check for intersection
    return box1.intersectsBox(box2);
  }

  // Example: update all players with delta (call this in your game loop)
  static updatePlayers(players, delta) {
    for (const p of players) {
      p.update(delta);
      // Add world bounds or collision logic here as needed
    }
  }
}
