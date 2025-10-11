// src/graphics.js
import * as THREE from "three";

/**
 * Graphics helper for Three.js-based platformer game
 */
export class Graphics {
  // Create a rectangle (PlaneGeometry, XY plane, Z=0 by default)
  static createRectangle(
    x = 0,
    y = 0,
    w = 1,
    h = 1,
    color = 0xffffff,
    border = false,
    borderColor = 0x000000,
  ) {
    const group = new THREE.Group();

    // Fill
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + w / 2, y + h / 2, 0);
    group.add(mesh);

    // Optional border as a Line (edges)
    if (border) {
      const borderGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, 0),
        new THREE.Vector3(x + w, y, 0),
        new THREE.Vector3(x + w, y + h, 0),
        new THREE.Vector3(x, y + h, 0),
        new THREE.Vector3(x, y, 0),
      ]);
      const borderMat = new THREE.LineBasicMaterial({ color: borderColor });
      const borderLine = new THREE.Line(borderGeom, borderMat);
      group.add(borderLine);
    }

    return group;
  }

  // Create a line in XY (for debugging, collision, etc.)
  static createLine(x1, y1, x2, y2, width = 0.05, color = 0xffffff) {
    // Three.js ignores `linewidth` except on some platforms
    const material = new THREE.LineBasicMaterial({ color });
    const points = [new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geometry, material);
  }

  // Create a bounding box for any object (debug visuals)
  static createBoundingBox(object3d, color = 0xff0000) {
    return new THREE.BoxHelper(object3d, color);
  }

  // Load a texture, return a Promise that resolves to a THREE.Texture
  static loadTexture(path) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(path, resolve, undefined, reject);
    });
  }

  // Add a mesh or group to the main scene (utility, just sugar)
  static addToScene(scene, obj) {
    scene.add(obj);
  }

  // Remove a mesh or group from scene
  static removeFromScene(scene, obj) {
    scene.remove(obj);
  }
}

// Example usage in your world loader or level rendering:
// import { Graphics } from "./graphics.js";
// const platform = Graphics.createRectangle(0, 0, 4, 1, 0x4444ff, true, 0xffffff);
// Graphics.addToScene(scene, platform);

// const debugLine = Graphics.createLine(0, 0, 10, 10, 0.1, 0xff0000);
// scene.add(debugLine);
