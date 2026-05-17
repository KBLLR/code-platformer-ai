import * as THREE from "three";
import { GLTFAssetLoader } from "./GLTFAssetLoader.js";
import { buildStageGroup, updateStageGroup } from "./StageFactory.js";

const FIGHTER_COLORS = {
  blue: "#4f7cff",
  red: "#f45b69",
  pink: "#ff7cc9",
  black: "#2a2d43",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeItemMesh(type) {
  const colorMap = {
    "movement-boost": "#7af8b9",
    "temporary-shield": "#7fd2ff",
    "bomb-throwable": "#ffba5f",
    "shell-projectile": "#a8ff8a",
    "spring-trap": "#ff8de1",
  };

  let geometry = new THREE.SphereGeometry(0.42, 20, 20);
  if (type === "shell-projectile") geometry = new THREE.TorusGeometry(0.35, 0.16, 12, 24);
  if (type === "spring-trap") geometry = new THREE.CylinderGeometry(0.2, 0.4, 0.7, 12);
  if (type === "bomb-throwable") geometry = new THREE.IcosahedronGeometry(0.42, 0);
  const color = colorMap[type] ?? "#ffffff";

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
      roughness: 0.28,
      metalness: 0.52,
    }),
  );
  mesh.castShadow = true;
  return mesh;
}

function makeFloorShadow() {
  return new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 24),
    new THREE.MeshBasicMaterial({ color: "#111827", transparent: true, opacity: 0.22 }),
  );
}

export class ToyboxRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();
    this.assets = new GLTFAssetLoader();
    this.previewRoot = new THREE.Group();
    this.matchRoot = new THREE.Group();
    this.activeStage = null;
    this.previewKey = "";
    this.playerViews = new Map();
    this.pickupViews = new Map();
    this.projectileViews = new Map();
    this.trapViews = new Map();
    this.previewPresentation = null;
  }

  setRuntimeSettings(settings) {
    const changed = this.assets.setRuntimeSettings(settings);
    if (changed) {
      this.previewKey = "";
    }
    return changed;
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#fff4dd");
    this.scene.fog = new THREE.Fog("#fff4dd", 24, 52);

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 7, 24);
    this.camera.lookAt(0, 5, 0);

    const hemi = new THREE.HemisphereLight("#fff7de", "#b1d8ff", 1.15);
    const sun = new THREE.DirectionalLight("#ffffff", 1.35);
    sun.position.set(9, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    this.scene.add(hemi, sun, this.previewRoot, this.matchRoot);

    this.matchRoot.visible = false;

    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async showShellPreview({ fighter, stage, tab }) {
    const nextKey = `${fighter.id}:${stage.id}:${tab}`;
    if (nextKey === this.previewKey) return;
    this.previewKey = nextKey;
    this.matchRoot.visible = false;
    this.previewRoot.visible = true;
    this._disposeGroup(this.previewRoot);
    this.previewRoot.clear();
    this.previewPresentation = null;

    const stageRuntime = buildStageGroup(stage, { preview: true });
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.2, 1.3, 32),
      new THREE.MeshStandardMaterial({
        color: "#ffefbf",
        emissive: "#fff3d5",
        emissiveIntensity: 0.12,
        roughness: 0.48,
        metalness: 0.18,
      }),
    );
    podium.position.set(0, -0.2, 1.6);
    podium.castShadow = true;
    podium.receiveShadow = true;

    const podiumTop = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.45, 0.24, 32),
      new THREE.MeshStandardMaterial({
        color: FIGHTER_COLORS[fighter.id] ?? "#94a3b8",
        emissive: FIGHTER_COLORS[fighter.id] ?? "#94a3b8",
        emissiveIntensity: 0.22,
        roughness: 0.28,
        metalness: 0.45,
      }),
    );
    podiumTop.position.set(0, 0.45, 1.6);

    const fighterView = await this.assets.createFighterInstance(fighter);
    fighterView.root.position.set(0, 0.55, 1.55);
    fighterView.root.rotation.y = tab === "fighters" ? Math.PI * 0.12 : -Math.PI * 0.18;
    fighterView.root.scale.multiplyScalar(tab === "fighters" ? 1.08 : 0.96);
    fighterView.setPreviewAnimation();

    const shadow = makeFloorShadow();
    shadow.position.set(0, 0.02, 1.6);
    shadow.rotation.x = -Math.PI / 2;

    this.previewRoot.add(stageRuntime.group, podium, podiumTop, shadow, fighterView.root);
    this.previewPresentation = fighterView;
    this.activeStage = stageRuntime;
    this.camera.position.set(tab === "fighters" ? 0 : 2.8, 8.2, tab === "fighters" ? 16 : 21);
    this.camera.lookAt(0, 4.2, 0);
  }

  async startMatch(snapshot) {
    this.previewRoot.visible = false;
    this.matchRoot.visible = true;
    this._disposeGroup(this.matchRoot);
    this.matchRoot.clear();
    this.playerViews.clear();
    this.pickupViews.clear();
    this.projectileViews.clear();
    this.trapViews.clear();

    this.activeStage = buildStageGroup(snapshot.stage, { preview: false });
    this.matchRoot.add(this.activeStage.group);

    for (const player of snapshot.players) {
      const presentation = await this.assets.createFighterInstance(player.fighter);
      presentation.root.position.set(player.x, player.y, player.z);
      presentation.root.rotation.y = player.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
      const shadow = makeFloorShadow();
      shadow.rotation.x = -Math.PI / 2;
      this.matchRoot.add(presentation.root, shadow);
      this.playerViews.set(player.playerId, { presentation, shadow, baseScale: presentation.root.scale.clone() });
    }

    snapshot.pickups.forEach((pickup) => {
      const mesh = makeItemMesh(pickup.type);
      mesh.position.set(pickup.x, pickup.y, 0);
      this.pickupViews.set(pickup.pickupId, mesh);
      this.matchRoot.add(mesh);
    });

    this.camera.position.set(0, 6.8, 24);
    this.camera.lookAt(0, 4, 0);
  }

  update(snapshot, delta) {
    if (!this.scene) return;
    if (snapshot && snapshot.stage && this.matchRoot.visible) {
      updateStageGroup(this.activeStage, snapshot);
      this._syncPlayers(snapshot.players, delta);
      this._syncPickups(snapshot.pickups);
      this._syncProjectiles(snapshot.projectiles);
      this._syncTraps(snapshot.traps);
      this._updateMatchCamera(snapshot);
      return;
    }

    if (this.previewRoot.visible) {
      this.previewRoot.rotation.y += delta * 0.08;
      this.previewPresentation?.update(delta);
      this.camera.lookAt(0, 4.2, 0);
      if (this.activeStage) {
        updateStageGroup(this.activeStage, {
          elapsed: performance.now() * 0.001,
          hazardFloor: this.activeStage.baseHazardFloor,
        });
      }
    }
  }

  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  _syncPlayers(players, delta) {
    players.forEach((player) => {
      const view = this.playerViews.get(player.playerId);
      if (!view) return;
      view.presentation.root.visible = player.alive || player.respawnTimer > 0;
      view.shadow.visible = player.alive;
      if (!view.presentation.root.visible) return;

      view.presentation.root.position.set(player.x, player.y, player.z);
      view.presentation.root.rotation.y = player.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
      view.presentation.root.scale.set(
        view.baseScale.x * (player.shieldTimer > 0 ? 1.05 : 1),
        view.baseScale.y * (player.boostTimer > 0 ? 1.04 : 1),
        view.baseScale.z,
      );
      view.presentation.applyMatchAnimation(player);
      view.presentation.update(delta);

      view.shadow.position.set(player.x, 0.05, player.z);
      view.shadow.scale.setScalar(1 + Math.abs(player.vy) * 0.01);
    });
  }

  _syncPickups(pickups) {
    for (const pickup of pickups) {
      let mesh = this.pickupViews.get(pickup.pickupId);
      if (!mesh) {
        mesh = makeItemMesh(pickup.type);
        this.pickupViews.set(pickup.pickupId, mesh);
        this.matchRoot.add(mesh);
      }
      mesh.visible = pickup.available;
      mesh.position.set(pickup.x, pickup.y, 0);
      mesh.rotation.y += 0.03;
      mesh.position.y += Math.sin(performance.now() * 0.004 + pickup.x) * 0.008;
    }
  }

  _syncProjectiles(projectiles) {
    const nextIds = new Set();
    projectiles.forEach((projectile, index) => {
      const id = `${projectile.ownerId}:${projectile.type}:${index}`;
      nextIds.add(id);
      let mesh = this.projectileViews.get(id);
      if (!mesh) {
        mesh = makeItemMesh(projectile.type);
        mesh.scale.setScalar(0.8);
        this.projectileViews.set(id, mesh);
        this.matchRoot.add(mesh);
      }
      mesh.position.set(projectile.x, projectile.y, 0.8);
      mesh.rotation.x += 0.14;
      mesh.rotation.y += 0.08;
      mesh.visible = true;
    });

    for (const [id, mesh] of this.projectileViews) {
      if (nextIds.has(id)) continue;
      this.matchRoot.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.projectileViews.delete(id);
    }
  }

  _syncTraps(traps) {
    const nextIds = new Set();
    traps.forEach((trap, index) => {
      const id = `${trap.ownerId}:trap:${index}`;
      nextIds.add(id);
      let mesh = this.trapViews.get(id);
      if (!mesh) {
        mesh = makeItemMesh("spring-trap");
        this.trapViews.set(id, mesh);
        this.matchRoot.add(mesh);
      }
      mesh.visible = true;
      mesh.position.set(trap.x, trap.y + 0.28, 0);
      mesh.rotation.z += 0.05;
    });

    for (const [id, mesh] of this.trapViews) {
      if (nextIds.has(id)) continue;
      this.matchRoot.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.trapViews.delete(id);
    }
  }

  _updateMatchCamera(snapshot) {
    const activePlayers = snapshot.players.filter((player) => player.alive);
    const focusX = activePlayers.length
      ? activePlayers.reduce((sum, player) => sum + player.x, 0) / activePlayers.length
      : 0;
    const focusY = activePlayers.length
      ? activePlayers.reduce((sum, player) => sum + player.y, 0) / activePlayers.length
      : 4;
    const width = activePlayers.length
      ? Math.max(...activePlayers.map((player) => player.x)) - Math.min(...activePlayers.map((player) => player.x))
      : 0;
    const desiredZ = clamp(20 + width * 0.35, 20, 26);
    this.camera.position.x += (focusX - this.camera.position.x) * 0.08;
    this.camera.position.y += (focusY + 4.8 - this.camera.position.y) * 0.08;
    this.camera.position.z += (desiredZ - this.camera.position.z) * 0.08;
    this.camera.lookAt(focusX, focusY + 1.2, 0);
  }

  _disposeGroup(group) {
    group.traverse((child) => {
      if (child.userData?.fighterPresentation?.dispose) {
        child.userData.fighterPresentation.dispose();
      }
      if (child.isMesh) {
        if (!child.userData.keepSharedGeometry) {
          child.geometry?.dispose?.();
        }
        if (Array.isArray(child.material)) {
          child.material.forEach((entry) => entry.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      }
    });
  }
}
