// src/Trophy.js
import * as THREE from "three";
import { GameObject } from "@/game_object.js";
import { LoaderManager } from "@/LoaderManager.js";
import { game_config as conf } from "@/game_config.js";
import { Sounds } from "@/sounds.js";
import { GetUrlParam } from "@/util.js";

class Trophy extends GameObject {
  static loader = new LoaderManager();
  static _meshTemplate = null;

  constructor(lvl, spawn_at_pos = undefined) {
    super(new THREE.Vector3(), new THREE.Vector3(0.7, 0.7, 0.1));

    this._player = null;

    console.log(
      "[Trophy.js] Trophy instance created. Ensuring mesh template...",
    );
    this._ensureMeshTemplate()
      .then(() => {
        this.mesh = Trophy._meshTemplate.clone();
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.rotation.y = Math.PI / 4;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        console.log("[Trophy.js] Trophy mesh cloned and initialized.");
        this.moveToLevel(lvl, spawn_at_pos);
      })
      .catch((error) => {
        console.error(
          "[Trophy.js] Failed to load Trophy mesh template, using fallback cube:",
          error,
        );
        this.mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xaaaa00 }),
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.moveToLevel(lvl, spawn_at_pos);
      });
  }

  static async _ensureMeshTemplate() {
    if (Trophy._meshTemplate) {
      console.log("[Trophy.js] Mesh template already exists.");
      return;
    }

    await Trophy.loader.loadManifest();
    console.log("[Trophy.js] Mesh template: LoaderManager manifest loaded.");

    try {
      const moneyTexture = await Trophy.loader.loadTexture("diverse", null, 1);
      console.log("[Trophy.js] Mesh template: Money texture loaded.");

      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        map: moneyTexture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.5,
      });
      Trophy._meshTemplate = new THREE.Mesh(geometry, material);
      Trophy._meshTemplate.scale.set(0.7, 0.7, 0.1);
      console.log("[Trophy.js] Mesh template: Created.");
    } catch (error) {
      console.error(
        "[Trophy.js] Mesh template: Could not load money texture, creating fallback.",
        error,
      );
      Trophy._meshTemplate = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.7, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xcccccc }),
      );
    }
  }

  moveToLevel(lvl, spawn_at_pos = undefined) {
    // Use lvl.scene which is set in World.js
    if (!lvl || !lvl.scene) {
      console.error(
        "Trophy: Cannot move to level, level or its scene is undefined.",
      );
      return;
    }

    if (this.mesh && this.mesh.parent) {
      this.mesh.removeFromParent();
    }

    if (spawn_at_pos) {
      this.pos.copy(spawn_at_pos);
      this.pos.y += 0.5;
      this.pos.z += 0.1;
    } else {
      // Default to center of the level if no specific position given
      // This needs to be carefully aligned with World.js tile centering.
      this.pos.set(0, 0, 0.1); // Default to world origin for now, adjust based on actual level center
      // Example: If World.js centers the map at (0,0) with its tiles spanning -width/2 to +width/2
      // Then (0,0,0.1) is indeed the center of the level in 3D.
    }

    if (this.mesh) {
      this.mesh.position.copy(this.pos);
      lvl.scene.add(this.mesh); // Add to the level's scene
      console.log(
        `[Trophy.js] Trophy moved to level at ${this.pos.x},${this.pos.y},${this.pos.z}.`,
      );
    }

    this._player = undefined;
  }

  Update(dt) {
    super.update(dt);

    if (this._player) {
      this._player.score += conf.trophy.passive_income * dt; // dt is in seconds

      if (this.mesh && this._player.mesh) {
        // Adjust local position relative to player's mesh
        this.mesh.position.set(0.2, 1.5, 0.05);
        this.mesh.rotation.z += dt * 2;
      }
    } else {
      if (this.mesh) {
        // Hover effect and rotation when not picked up
        this.mesh.position.y =
          this.pos.y + Math.sin(performance.now() * 0.005) * 0.2;
        this.mesh.rotation.z += dt * 0.5;
      }
    }
  }

  moveToPlayer(player) {
    if (!player || !player.mesh) {
      console.error(
        "Trophy: Cannot move to player, player or player.mesh is undefined.",
      );
      return;
    }
    if (this.mesh && this.mesh.parent) {
      this.mesh.removeFromParent();
    }

    this._player = player;
    this._player.score += conf.trophy.pickup_bounty;
    console.log(
      `[Trophy.js] Trophy picked up by Player ${player.player_number + 1}.`,
    );

    this._player.mesh.add(this.mesh); // Attach to player's mesh
    this.mesh.position.set(0.05, 1.5, 0); // Local position relative to player
    this.mesh.scale.set(0.2, 0.2, 0.05);
    this.mesh.rotation.set(Math.PI / 2, 0, 0);

    if (!GetUrlParam("no_sound")) {
      Sounds.Play("reward");
    }
  }

  get player() {
    return this._player;
  }

  get isPickedUp() {
    return !!this._player;
  }
}

export { Trophy };
