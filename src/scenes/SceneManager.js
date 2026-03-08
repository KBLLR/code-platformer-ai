/**
 * SceneManager — Scene lifecycle controller.
 *
 * Manages scene registration, transitions, and the render loop.
 * Each scene implements: init(params), update(dt), dispose().
 *
 * Replaces the ad-hoc menu→game flow in main.js with a
 * clean scene-based architecture.
 */
import * as THREE from "three";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";

export class SceneManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    /** @type {Map<string, { create: () => object }>} */
    this.registry = new Map();
    /** @type {{ name: string, instance: object }|null} */
    this.active = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this._animFrameId = null;

    this._initRenderer();
    this._bindResize();
  }

  /**
   * Initialize WebGPU renderer with WebGL fallback.
   */
  _initRenderer() {
    try {
      if (WebGPU.isAvailable()) {
        this.renderer = new WebGPURenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: false,
        });
        this.isWebGPU = true;
        console.log("[SceneManager] Using WebGPU renderer.");
      } else {
        throw new Error("WebGPU not available");
      }
    } catch {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
      });
      this.isWebGPU = false;
      console.log("[SceneManager] Falling back to WebGL renderer.");
    }

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
  }

  _bindResize() {
    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.active?.instance?.onResize) {
        this.active.instance.onResize(window.innerWidth, window.innerHeight);
      }
    });
  }

  /**
   * Register a scene factory.
   * @param {string} name
   * @param {() => object} factory - Returns scene instance with init/update/dispose
   */
  register(name, factory) {
    this.registry.set(name, { create: factory });
    console.log(`[SceneManager] Registered scene: "${name}"`);
  }

  /**
   * Switch to a named scene with optional params.
   * @param {string} name
   * @param {object} params
   */
  async switchTo(name, params = {}) {
    const entry = this.registry.get(name);
    if (!entry) {
      throw new Error(`Scene "${name}" not registered`);
    }

    // Dispose current scene
    if (this.active?.instance) {
      console.log(`[SceneManager] Disposing scene: "${this.active.name}"`);
      if (this.active.instance.dispose) {
        this.active.instance.dispose();
      }
    }

    // Stop current loop
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    // Create and init new scene
    const instance = entry.create();
    this.active = { name, instance };

    console.log(`[SceneManager] Initializing scene: "${name}"`);
    if (instance.init) {
      await instance.init({
        renderer: this.renderer,
        canvas: this.canvas,
        sceneManager: this,
        ...params,
      });
    }

    // Start render loop
    this.clock.start();
    this._loop();

    console.log(`[SceneManager] Scene "${name}" is now active.`);
  }

  /**
   * Main render loop — delegates to active scene.
   */
  _loop() {
    this._animFrameId = requestAnimationFrame(() => this._loop());

    const dt = this.clock.getDelta();
    const scene = this.active?.instance;

    if (scene?.update) {
      scene.update(dt);
    }

    if (scene?.threeScene && scene?.camera) {
      this.renderer.render(scene.threeScene, scene.camera);
    }
  }

  /**
   * Get the currently active scene name.
   * @returns {string|null}
   */
  current() {
    return this.active?.name || null;
  }

  /**
   * Dispose the entire manager.
   */
  dispose() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
    }
    if (this.active?.instance?.dispose) {
      this.active.instance.dispose();
    }
    this.renderer.dispose();
  }
}
