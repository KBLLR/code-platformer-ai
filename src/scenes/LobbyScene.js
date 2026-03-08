/**
 * LobbyScene — House-aware lobby with arena seed selection.
 *
 * Replaces the menu flow from main.js.
 * Renders a 3D preview of the arena and a "START MATCH" UI.
 * On start: transitions to MatchScene via SceneManager.
 */
import * as THREE from "three";
import { createDefaultArenaConfig } from "../interfaces/ArenaConfig.js";

export class LobbyScene {
  constructor() {
    this.threeScene = null;
    this.camera = null;
    this.sceneManager = null;

    // Lobby state
    this.seed = Math.floor(Math.random() * 100000);
    this.playerCount = 1;
    this.uiOverlay = null;
    this._disposed = false;
  }

  /**
   * Initialize the lobby scene.
   * @param {{ renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, sceneManager: import('./SceneManager.js').SceneManager }} params
   */
  async init(params) {
    this.sceneManager = params.sceneManager;

    // Create Three.js scene
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x0a0a2e);
    this.threeScene.fog = new THREE.FogExp2(0x0a0a2e, 0.015);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);
    this.camera.position.set(0, 30, 50);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    this.threeScene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.0);
    directional.position.set(20, 40, 20);
    directional.castShadow = true;
    this.threeScene.add(directional);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a3e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.threeScene.add(ground);

    // Arena preview — a ring of placeholder cubes showing spawn locations
    this._createArenaPreview();

    // Floating title
    this._createParticleField();

    // UI Overlay
    this._createUI();

    // Slow camera orbit
    this._cameraAngle = 0;
  }

  /**
   * Create a preview of spawn points as glowing cubes.
   */
  _createArenaPreview() {
    const config = createDefaultArenaConfig(this.seed);
    this._previewGroup = new THREE.Group();

    // Spawn point indicators
    const spawnGeo = new THREE.BoxGeometry(1.5, 3, 1.5);
    for (const sp of config.spawnPoints) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
        emissive: new THREE.Color().setHSL(Math.random(), 0.8, 0.3),
        roughness: 0.3,
        metalness: 0.7,
      });
      const mesh = new THREE.Mesh(spawnGeo, mat);
      mesh.position.set(sp.x, sp.y + 1.5, sp.z);
      mesh.castShadow = true;
      this._previewGroup.add(mesh);
    }

    // Cover cluster indicators
    const coverGeo = new THREE.BoxGeometry(2, 2, 2);
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      roughness: 0.7,
      metalness: 0.3,
      transparent: true,
      opacity: 0.6,
    });
    for (const cluster of config.coverClusters) {
      for (let i = 0; i < Math.min(cluster.density, 4); i++) {
        const mesh = new THREE.Mesh(coverGeo, coverMat);
        const angle = (i / cluster.density) * Math.PI * 2;
        mesh.position.set(
          cluster.center.x + Math.cos(angle) * cluster.radius * 0.5,
          1,
          cluster.center.z + Math.sin(angle) * cluster.radius * 0.5
        );
        mesh.castShadow = true;
        this._previewGroup.add(mesh);
      }
    }

    // Arena boundary ring
    const ringGeo = new THREE.RingGeometry(config.bounds.width / 2 - 0.5, config.bounds.width / 2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this._previewGroup.add(ring);

    this.threeScene.add(this._previewGroup);
  }

  /**
   * Create a particle field for atmosphere.
   */
  _createParticleField() {
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x6688ff,
      size: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    this._particles = new THREE.Points(geo, mat);
    this.threeScene.add(this._particles);
  }

  /**
   * Create the lobby HTML overlay.
   */
  _createUI() {
    this.uiOverlay = document.createElement("div");
    this.uiOverlay.id = "lobby-overlay";
    this.uiOverlay.innerHTML = `
      <div style="
        position: fixed; inset: 0; z-index: 100;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        pointer-events: none; font-family: 'Inter', 'Segoe UI', sans-serif;
      ">
        <h1 style="
          font-size: 3.5rem; font-weight: 900; letter-spacing: 0.05em;
          color: #fff; text-shadow: 0 0 40px rgba(0,255,136,0.5), 0 0 80px rgba(0,100,255,0.3);
          margin-bottom: 0.5rem;
        ">CUBE CLASH</h1>
        <p style="
          font-size: 1.1rem; color: rgba(255,255,255,0.6); letter-spacing: 0.15em;
          text-transform: uppercase; margin-bottom: 2.5rem;
        ">BATTLE ROYALE</p>

        <div style="
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
          pointer-events: auto; z-index: 101;
        ">
          <div style="
            display: flex; align-items: center; gap: 1rem;
            background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 0.75rem 1.5rem;
          ">
            <label style="color: rgba(255,255,255,0.7); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em;">
              Arena Seed
            </label>
            <input type="number" id="lobby-seed" value="${this.seed}" style="
              width: 100px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
              border-radius: 6px; color: #fff; padding: 0.4rem 0.6rem; font-size: 1rem;
              text-align: center; outline: none; pointer-events: auto;
            "/>
          </div>

          <button id="lobby-start" style="
            pointer-events: auto;
            padding: 1rem 3rem; font-size: 1.2rem; font-weight: 700;
            background: linear-gradient(135deg, #00cc66, #0066ff);
            color: #fff; border: none; border-radius: 12px;
            cursor: pointer; text-transform: uppercase; letter-spacing: 0.15em;
            box-shadow: 0 4px 20px rgba(0,204,102,0.4);
            transition: transform 0.15s, box-shadow 0.15s;
          "
            onmouseenter="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 30px rgba(0,204,102,0.6)'"
            onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(0,204,102,0.4)'"
          >
            START MATCH
          </button>

          <p style="color: rgba(255,255,255,0.4); font-size: 0.75rem; margin-top: 0.5rem; pointer-events: none;">
            1 Human + 11 Bots · Battle Royale
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(this.uiOverlay);

    // Wire up START button
    const startBtn = document.getElementById("lobby-start");
    startBtn?.addEventListener("click", () => this._startMatch());

    // Wire up seed input to update preview
    const seedInput = document.getElementById("lobby-seed");
    seedInput?.addEventListener("change", (e) => {
      const newSeed = parseInt(e.target.value);
      if (!isNaN(newSeed)) {
        this.seed = newSeed;
        // Rebuild arena preview
        if (this._previewGroup) {
          this.threeScene.remove(this._previewGroup);
          this._previewGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
        this._createArenaPreview();
      }
    });
  }

  /**
   * Transition to the match scene.
   */
  async _startMatch() {
    const arenaConfig = createDefaultArenaConfig(this.seed);

    // Animate out UI
    if (this.uiOverlay) {
      this.uiOverlay.style.transition = "opacity 0.5s";
      this.uiOverlay.style.opacity = "0";
      await new Promise((r) => setTimeout(r, 500));
    }

    this.sceneManager.switchTo("match", {
      arenaConfig,
      humanPlayers: this.playerCount,
    });
  }

  /**
   * Update the lobby scene.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (this._disposed) return;

    // Slow orbit camera
    this._cameraAngle += dt * 0.1;
    const radius = 55;
    this.camera.position.x = Math.sin(this._cameraAngle) * radius;
    this.camera.position.z = Math.cos(this._cameraAngle) * radius;
    this.camera.position.y = 25 + Math.sin(this._cameraAngle * 0.5) * 5;
    this.camera.lookAt(0, 0, 0);

    // Gently bob spawn cubes
    if (this._previewGroup) {
      this._previewGroup.children.forEach((child, i) => {
        if (child.isMesh) {
          child.position.y += Math.sin(Date.now() * 0.002 + i) * 0.005;
          child.rotation.y += dt * 0.3;
        }
      });
    }

    // Float particles
    if (this._particles) {
      this._particles.rotation.y += dt * 0.02;
    }
  }

  /**
   * Handle window resize.
   * @param {number} w
   * @param {number} h
   */
  onResize(w, h) {
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Clean up the lobby scene.
   */
  dispose() {
    this._disposed = true;

    // Remove UI overlay
    if (this.uiOverlay) {
      this.uiOverlay.remove();
      this.uiOverlay = null;
    }

    // Dispose Three.js objects
    if (this.threeScene) {
      this.threeScene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}
