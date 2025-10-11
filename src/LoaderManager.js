// src/LoaderManager.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export class LoaderManager {
  constructor(manifestUrl = "/assets/assets.json", baseUrl = "/assets/") {
    this.baseUrl = baseUrl;
    this.manifestUrl = manifestUrl;
    this.manifest = null;
    this.textures = {}; // Cache for THREE.Texture objects
    this.models = {}; // Cache for GLTF scene objects (THREE.Group)
    this.sounds = {}; // Cache for HTMLAudioElement objects
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Loads the assets manifest JSON file.
   * @returns {Promise<object>} The parsed manifest object.
   * @throws {Error} If the manifest cannot be loaded.
   */
  async loadManifest() {
    if (this.manifest) return this.manifest;
    try {
      const res = await fetch(this.manifestUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      this.manifest = await res.json();
      return this.manifest;
    } catch (error) {
      console.error("LoaderManager: Could not load assets manifest!", error); // Added console.error
      throw error;
    }
  }

  /**
   * Loads a texture from the 'images' section of the manifest.
   * Handles both array-based categories (e.g., 'arrow', 'levels') and nested objects
   * (e.g., 'player' with 'player1' subkeys).
   * @param {string} category - The top-level category key in 'images' (e.g., 'arrow', 'player', 'levels').
   * @param {string | null} subkey - The sub-category key, if applicable (e.g., 'player1' for 'player' category). Defaults to null.
   * @param {number} idx - The index of the image path within the category/subcategory array. Defaults to 0.
   * @returns {Promise<THREE.Texture>} A promise that resolves with the loaded THREE.Texture.
   * @throws {Error} If the texture path is not found or invalid.
   */
  async loadTexture(category, subkey = null, idx = 0) {
    if (!this.manifest) await this.loadManifest();

    let path;
    const categoryData = this.manifest.images[category];

    if (!categoryData) {
      throw new Error(
        `LoaderManager: Image category "${category}" not found in manifest.images.`,
      );
    }

    if (subkey) {
      // Handle nested objects like "player": {"player1": [...]}
      const subkeyData = categoryData[subkey];
      if (!Array.isArray(subkeyData) || idx < 0 || idx >= subkeyData.length) {
        throw new Error(
          `LoaderManager: Subkey "${subkey}" or index ${idx} not found or out of bounds for category "${category}".`,
        );
      }
      path = subkeyData[idx];
    } else if (Array.isArray(categoryData)) {
      // Handle direct arrays like "arrow": [...]
      if (idx < 0 || idx >= categoryData.length) {
        throw new Error(
          `LoaderManager: Index ${idx} out of bounds for category "${category}".`,
        );
      }
      path = categoryData[idx];
    } else {
      // This branch is unlikely to be hit with the current assets.json structure
      // but serves as a fallback for unexpected manifest formats under 'images'.
      throw new Error(
        `LoaderManager: Unsupported image structure for category "${category}".`,
      );
    }

    if (this.textures[path]) {
      return this.textures[path]; // Return cached texture
    }

    const tex = await this._loadTexture(this.baseUrl + path);
    this.textures[path] = tex; // Cache the loaded texture
    return tex;
  }

  /**
   * Private helper to load a single texture from a URL using Three.js TextureLoader.
   * @param {string} url - The full URL to the texture image.
   * @returns {Promise<THREE.Texture>} A promise that resolves with the loaded THREE.Texture.
   */
  _loadTexture(url) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(url, resolve, undefined, reject);
    });
  }

  /**
   * Loads a texture from the top-level 'mainmenu' section of the manifest.
   * @param {number} idx - The index of the image path within the 'mainmenu' array.
   * @returns {Promise<THREE.Texture>} A promise that resolves with the loaded THREE.Texture.
   * @throws {Error} If the image index is out of bounds.
   */
  async loadMainMenuImage(idx) {
    if (!this.manifest) await this.loadManifest();

    const menuImages = this.manifest.mainmenu;
    if (!Array.isArray(menuImages) || idx < 0 || idx >= menuImages.length) {
      throw new Error(
        `LoaderManager: Main menu image at index ${idx} not found or out of bounds.`,
      );
    }
    const path = menuImages[idx];

    if (this.textures[path]) {
      return this.textures[path]; // Return cached texture
    }

    const tex = await this._loadTexture(this.baseUrl + path);
    this.textures[path] = tex; // Cache the loaded texture
    return tex;
  }

  /**
   * Loads a 3D model (GLB) from the 'models' section of the manifest.
   * @param {number | string} query - The index of the model, its filename (e.g., 'models/player_001-v1.glb'),
   *                                  its displayName (e.g., 'Player 1'), or a tag (e.g., 'player', 'weapon').
   * @returns {Promise<THREE.Group>} A promise that resolves with the loaded GLTF scene (a THREE.Group).
   * @throws {Error} If the model is not found for the given query.
   */
  async loadGLB(query) {
    if (!this.manifest) await this.loadManifest();

    let entry;
    if (typeof query === "number") {
      entry = this.manifest.models[query];
    } else if (typeof query === "string") {
      const lowerCaseQuery = query.toLowerCase();
      entry = this.manifest.models.find(
        (m) =>
          m.file === query || // Direct filename match
          (m.displayName && m.displayName.toLowerCase() === lowerCaseQuery) || // Display name match
          (Array.isArray(m.tags) && m.tags.includes(lowerCaseQuery)), // Tag match (assuming tags are lowercase in manifest)
      );
    }

    if (!entry) {
      throw new Error(`LoaderManager: Model not found for query: "${query}"`);
    }

    if (this.models[entry.file]) {
      return this.models[entry.file]; // Return cached model scene
    }

    // _loadGLB returns the full GLTF object, we typically want the .scene for Three.js
    const gltf = await this._loadGLB(this.baseUrl + entry.file);
    this.models[entry.file] = gltf.scene; // Cache the loaded model's scene
    return gltf.scene; // Return the scene property of the GLTF object
  }

  /**
   * Private helper to load a single GLB model from a URL using GLTFLoader.
   * @param {string} url - The full URL to the GLB file.
   * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>} A promise that resolves with the loaded GLTF object.
   */
  _loadGLB(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => resolve(gltf), undefined, reject);
    });
  }

  /**
   * Loads an audio asset from the 'sounds' section of the manifest.
   * @param {number | string} query - The index of the sound, its filename (e.g., 'sounds/bow.wav'),
   *                                  its label (e.g., 'Bow'), or its type (e.g., 'sfx', 'music').
   * @returns {Promise<HTMLAudioElement>} A promise that resolves with the loaded HTMLAudioElement.
   * @throws {Error} If the sound is not found for the given query.
   */
  async loadSound(query) {
    if (!this.manifest) await this.loadManifest();

    let entry;
    if (typeof query === "number") {
      entry = this.manifest.sounds[query];
    } else if (typeof query === "string") {
      const lowerCaseQuery = query.toLowerCase();
      entry = this.manifest.sounds.find(
        (s) =>
          s.file === query || // Direct filename match
          (s.label && s.label.toLowerCase() === lowerCaseQuery) || // Label match
          (s.type && s.type.toLowerCase() === lowerCaseQuery), // Type match
      );
    }

    if (!entry) {
      throw new Error(`LoaderManager: Sound not found for query: "${query}"`);
    }

    // --- FIX START ---
    // Only return from cache if entry is found AND it's already in cache
    if (this.sounds[entry.file]) {
      return this.sounds[entry.file]; // Return cached audio element
    }
    // --- FIX END ---

    const audio = new Audio(this.baseUrl + entry.file);
    // Note: For precise playback control (e.g., overlapping SFX), consider using
    // Web Audio API (AudioContext, AudioBufferSourceNode) instead of HTMLAudioElement.
    this.sounds[entry.file] = audio; // Cache the audio element
    return audio;
  }
}
