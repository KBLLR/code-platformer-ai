import * as THREE from "three"; // Import THREE for Vector3
import { Firearm } from "./firearm.js"; // Corrected path
import { Bullet } from "./bullet.js"; // Corrected path

class Minigun extends Firearm {
  constructor(pos = new THREE.Vector3()) {
    super(pos, 100); // 100ms cooldown for minigun (fast fire rate)
    this.ammunition = Bullet;
    this.name = "Minigun";
    this.type = "minigun"; // Type for asset loading, matching manifest tag
  }

  // Minigun uses the base Firearm.fire() method, which handles spawning one bullet.
  // No need to override unless minigun has unique firing pattern (e.g., multiple bullets per shot).
}
Minigun.Name = "Minigun"; // Static property

export { Minigun };
