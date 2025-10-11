// src/game_object.js
import * as THREE from "three";

// Pure logic class: can be used for collision, bounds, platformer logic, etc.
class GameObject {
  /**
   * Initializes a new game object.
   * @param {THREE.Vector3} pos - The center position of the object in 3D space.
   * @param {THREE.Vector3} scale - The dimensions (width, height, depth) of the object.
   */
  constructor(
    pos = new THREE.Vector3(0, 0, 0),
    scale = new THREE.Vector3(1, 1, 1),
  ) {
    this.pos = pos;
    this.scale = scale;
    this.mesh = null; // Attach your THREE.Mesh or Group here if needed
  }

  // Getters for individual components (assuming scale represents dimensions)
  get x() {
    return this.pos.x;
  }
  get y() {
    return this.pos.y;
  }
  get z() {
    return this.pos.z;
  }
  get width() {
    return this.scale.x;
  }
  get height() {
    return this.scale.y;
  }
  get depth() {
    return this.scale.z;
  }

  /**
   * Returns a Three.js AABB (Axis-Aligned Bounding Box) for this object.
   * Assumes `this.pos` is the center and `this.scale` are the dimensions.
   * @returns {THREE.Box3} The bounding box.
   */
  getBoundingBox() {
    return new THREE.Box3().setFromCenterAndSize(this.pos, this.scale);
  }

  /**
   * Helper for debugging: adds a visible wireframe box representing the object's bounds to the scene.
   * @param {THREE.Scene} scene - The Three.js scene.
   * @param {number} color - The color of the debug box (hexadecimal).
   * @returns {THREE.Mesh} The debug mesh.
   */
  addDebugBox(scene, color = 0xff0000) {
    const boxGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.depth,
    );
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const mesh = new THREE.Mesh(boxGeometry, material);
    // Position the debug mesh at the object's center
    mesh.position.copy(this.pos);
    scene.add(mesh);
    return mesh;
  }
}

// Example movable, with velocity
class Movable extends GameObject {
  /**
   * Initializes a new movable object.
   * @param {THREE.Vector3} pos - The center position.
   * @param {THREE.Vector3} scale - The dimensions.
   */
  constructor(pos, scale) {
    super(pos, scale);
    this.vel = new THREE.Vector3(0, 0, 0);
  }

  /**
   * Updates the movable object's position based on its velocity.
   * @param {number} dt - Delta time (e.g., in seconds for physics, or milliseconds scaled appropriately).
   */
  update(dt = 1) {
    this.pos.add(this.vel.clone().multiplyScalar(dt));
    // If a mesh is attached, update its position to match the GameObject's logic position
    if (this.mesh) this.mesh.position.copy(this.pos);
  }
}

export { GameObject, Movable };
