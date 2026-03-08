// src/SceneManager.js
// Central render-loop and scene lifecycle coordinator.
// Owns the renderer, camera, and active scene. Scenes implement { enter, exit, update }.

import * as THREE from 'three';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';

export class SceneManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas  = canvas;
    this._scene   = new SceneManager._EmptyScene();
    this._running = false;
    this._lastTime = performance.now();
    this._renderer = null;
    this._camera   = null;
    this.isWebGPU  = false;

    console.log('[SceneManager] Created');
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async init() {
    if (WebGPU.isAvailable()) {
      this._renderer = new WebGPURenderer({
        canvas: this._canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.isWebGPU = true;
      await this._renderer.init();
      console.log('[SceneManager] WebGPU renderer ready');
    } else {
      this._renderer = new THREE.WebGLRenderer({
        canvas: this._canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.isWebGPU = false;
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
      console.log('[SceneManager] WebGL renderer ready');
    }

    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping      = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.2;

    this._camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 2000
    );

    window.addEventListener('resize', () => this._onResize());
    return this;
  }

  // ── Scene switching ────────────────────────────────────────────────────────

  /**
   * Transition to a new scene.
   * @param {object} nextScene  Must implement { enter(sm), exit(), update(delta) }
   */
  async switchTo(nextScene) {
    console.log(`[SceneManager] Switching to ${nextScene.name ?? nextScene.constructor.name}`);

    if (this._scene?.exit) {
      this._scene.exit();
    }

    this._scene = nextScene;

    if (nextScene.enter) {
      await nextScene.enter(this);
    }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;

    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);

      const now   = performance.now();
      const delta = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;

      if (this._scene?.update) {
        this._scene.update(delta, this);
      }

      if (this._scene?.threeScene && this._camera) {
        this._renderer.render(this._scene.threeScene, this._camera);
      }
    };

    requestAnimationFrame(loop);
    console.log('[SceneManager] Loop started');
  }

  stop() {
    this._running = false;
  }

  // ── Convenience getters ────────────────────────────────────────────────────

  get renderer() { return this._renderer; }
  get camera()   { return this._camera;   }

  // ── Resize ────────────────────────────────────────────────────────────────

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._renderer.setSize(w, h);
    if (this._camera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
  }

  // ── Placeholder scene ─────────────────────────────────────────────────────

  static _EmptyScene = class {
    get threeScene() { return null; }
    update() {}
    exit()   {}
  };
}
