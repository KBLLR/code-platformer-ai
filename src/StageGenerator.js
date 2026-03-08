// src/StageGenerator.js  (Objective B — Arena Compiler)
// Accepts an ArenaConfig and compiles it into optimised Three.js geometry.
// No HTML/DOM output — pure 3D scene construction.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Materials ─────────────────────────────────────────────────────────────────

const MAT = {
  ground:    new THREE.MeshStandardMaterial({ color: 0x3d6b35, roughness: 0.9 }),
  groundRim: new THREE.MeshStandardMaterial({ color: 0x2a4a25, roughness: 0.9 }),
  cover:     new THREE.MeshStandardMaterial({ color: 0x6b5a3d, roughness: 0.8 }),
  safeZone:  new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
  safeRing:  new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true }),
  spawnGlow: new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
};

const WORLD_LOADER = new GLTFLoader();

export class StageGenerator {
  /**
   * Build the full arena from an ArenaConfig.
   * @param {import('./ArenaConfig.js').ArenaConfig} config
   * @param {THREE.Scene} scene
   * @returns {{ group: THREE.Group, safeZoneRing: THREE.Mesh, spawnMarkers: THREE.Mesh[] }}
   */
  static async generate(config, scene) {
    console.log(`[StageGenerator] Compiling arena (seed=${config.seed}, size=${config.size})`);

    const group = new THREE.Group();
    group.name = 'Arena';

    let coverGroup = null;
    const renderAsset = config.worldPack?.geometry?.renderAsset;

    if (renderAsset) {
      try {
        const worldMesh = await StageGenerator._loadWorldPackRenderAsset(renderAsset);
        group.add(worldMesh);
        StageGenerator._buildBoundaryWall(config, group);
      } catch (error) {
        console.warn(`[StageGenerator] Failed to load world-pack render asset "${renderAsset}": ${error.message}`);
        StageGenerator._buildGround(config, group);
        StageGenerator._buildBoundaryWall(config, group);
        StageGenerator._buildTerrainBands(config, group);
        coverGroup = StageGenerator._buildCoverClusters(config, group);
      }
    } else {
      StageGenerator._buildGround(config, group);
      StageGenerator._buildBoundaryWall(config, group);
      StageGenerator._buildTerrainBands(config, group);
      coverGroup = StageGenerator._buildCoverClusters(config, group);
    }

    const spawnMarkers = StageGenerator._buildSpawnMarkers(config, group);
    const safeZoneRing = StageGenerator._buildSafeZoneRing(config, group);

    StageGenerator._buildLighting(config, scene);
    scene.add(group);

    console.log(
      `[StageGenerator] Done — ` +
      `${config.coverClusters.length} cover clusters, ` +
      `${config.spawnPoints.length} spawns`
    );

    return { group, safeZoneRing, spawnMarkers, coverGroup };
  }

  static async _loadWorldPackRenderAsset(assetUrl) {
    const gltf = await new Promise((resolve, reject) => {
      WORLD_LOADER.load(assetUrl, resolve, undefined, reject);
    });

    const root = gltf.scene ?? new THREE.Group();
    root.name = 'WorldPackRender';
    root.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(root);
    if (Number.isFinite(bounds.min.y)) {
      root.position.y -= bounds.min.y;
    }

    return root;
  }

  static _buildGround(config, parent) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(config.size, 72),
      MAT.ground
    );
    disc.rotation.x = -Math.PI / 2;
    disc.receiveShadow = true;
    disc.userData.isGround = true;
    parent.add(disc);

    // Outer rim
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(config.size, config.size * 1.12, 72),
      MAT.groundRim
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.02;
    parent.add(rim);

    // Invisible physics floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(config.size * 2, 1, config.size * 2),
      MAT.ground
    );
    floor.position.y = -0.51;
    floor.visible = false;
    floor.userData.isTile = true;
    parent.add(floor);
  }

  static _buildBoundaryWall(config, parent) {
    const r = config.size * 1.05;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 20, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0d0d1a, side: THREE.BackSide, transparent: true, opacity: 0.75 })
    );
    wall.position.y = 10;
    parent.add(wall);
  }

  static _buildTerrainBands(config, parent) {
    for (const band of config.terrainBands) {
      if (Math.abs(band.elevationDelta) < 0.1) continue;
      const mat = MAT.ground.clone();
      mat.color.setHex(band.elevationDelta > 0 ? 0x4a7c3f : 0x355a2a);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(band.innerR, band.outerR, 56),
        mat
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = band.elevationDelta * 0.5;
      ring.receiveShadow = true;
      parent.add(ring);
    }
  }

  static _buildCoverClusters(config, parent) {
    const coverGroup = new THREE.Group();
    coverGroup.name = 'Cover';
    for (const cluster of config.coverClusters) {
      for (const piece of cluster.pieces) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(piece.width, piece.height, piece.depth),
          MAT.cover
        );
        mesh.position.set(cluster.cx + piece.offsetX, piece.height / 2, cluster.cz + piece.offsetZ);
        mesh.rotation.y = piece.rotation;
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.userData.isObstacle = true;
        coverGroup.add(mesh);
      }
    }
    parent.add(coverGroup);
    return coverGroup;
  }

  static _buildSpawnMarkers(config, parent) {
    return config.spawnPoints.map(spawn => {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 12),
        MAT.spawnGlow.clone()
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(spawn.x, 0.02, spawn.z);
      mesh.userData.isSpawnMarker = true;
      parent.add(mesh);
      return mesh;
    });
  }

  static _buildSafeZoneRing(config, parent) {
    const r = config.safeZonePhases[0].radius;

    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 72), MAT.safeZone.clone());
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.04;
    fill.name = 'SafeZoneFill';
    parent.add(fill);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 8, 72), MAT.safeRing.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    ring.name = 'SafeZoneRing';
    ring.userData.fill = fill;
    parent.add(ring);

    return ring;
  }

  static _buildLighting(config, scene) {
    if (scene.userData.stageLightingBuilt) return;
    scene.userData.stageLightingBuilt = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
    sun.position.set(config.size * 0.4, config.size * 0.8, config.size * 0.3);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = config.size * 4;
    const sc = config.size * 1.2;
    Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
    sun.shadow.bias = -0.0002;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8ab4f8, 0.25);
    fill.position.set(-config.size * 0.4, config.size * 0.3, -config.size * 0.3);
    scene.add(fill);
  }

  /**
   * Call every frame to keep the safe-zone ring in sync with ArenaConfig.safeZone.
   * @param {THREE.Mesh}  ring
   * @param {import('./ArenaConfig.js').ArenaConfig} config
   */
  static updateSafeZone(ring, config) {
    const { currentRadius, centerX, centerZ } = config.safeZone;
    const initR = config.safeZonePhases[0].radius;
    const scale = currentRadius / initR;

    ring.position.set(centerX, 0.5, centerZ);
    ring.scale.setScalar(scale);

    const fill = ring.userData.fill;
    if (fill) {
      fill.position.set(centerX, 0.04, centerZ);
      fill.scale.setScalar(scale);
    }

    const pulse = 0.5 + Math.sin(performance.now() * 0.002) * 0.2;
    ring.material.opacity = pulse;
  }
}
