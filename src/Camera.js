// src/Camera.js
import * as THREE from "three";

export class GameCamera {
  constructor({
    type = "perspective",
    aspect = window.innerWidth / window.innerHeight,
    fov = 65,
    orthoSize = 22,
  } = {}) {
    this.type = type;
    this.aspect = aspect;

    if (type === "orthographic") {
      const d = orthoSize;
      this.camera = new THREE.OrthographicCamera(
        -d * aspect,
        d * aspect,
        d,
        -d,
        0.1,
        1000,
      );
      this.camera.position.set(0, d, d);
    } else {
      this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
      this.camera.position.set(0, 10, 36);
    }
    this.camera.lookAt(0, 8, 0);
    // this.targetOffset = { x: 0, y: 8, z: 0 }; // Default look-at - removed, as it was unused
  }

  resize(width, height) {
    this.aspect = width / height;
    if (this.type === "orthographic") {
      const d = Math.abs(this.camera.top);
      this.camera.left = -d * this.aspect;
      this.camera.right = d * this.aspect;
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.aspect = this.aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Centers the camera on all players.
   * Note: If using OrbitControls, this method might conflict.
   * You might need to disable OrbitControls (e.g., `controls.enabled = false;`)
   * when dynamically moving the camera.
   * @param {Array<object>} players - An array of player objects, each expected to have a .mesh.position property.
   */
  followPlayers(players) {
    if (!players.length) return;
    let avgX = 0,
      avgY = 0;
    for (const p of players) {
      avgX += p.mesh.position.x;
      avgY += p.mesh.position.y;
    }
    avgX /= players.length;
    avgY /= players.length;
    this.camera.position.x = avgX;
    this.camera.position.y = avgY + 8; // Keep a bit above the players
    this.camera.lookAt(avgX, avgY, 0); // Look at their average position
  }

  // Call this if you want camera fixed (e.g., for main menu or specific level view)
  lockToCenter() {
    this.camera.position.set(0, 10, 36);
    this.camera.lookAt(0, 8, 0);
  }
}
