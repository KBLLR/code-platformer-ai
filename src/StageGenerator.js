// src/StageGenerator.js
// Dynamic 3D Stage Generation from JSON Configuration
import * as THREE from "three";
import { LoaderManager } from "./LoaderManager.js";
import { Level } from "./Level.js";

/**
 * StageGenerator - Generates Three.js scenes dynamically from JSON configs
 *
 * Usage:
 *   const config = { ... stage configuration ... };
 *   const stage = await StageGenerator.generate(scene, config);
 */
export class StageGenerator {
  /**
   * Generate a complete 3D stage from JSON configuration
   * @param {THREE.Scene} scene - The Three.js scene to add objects to
   * @param {Object} config - Stage configuration object
   * @returns {Promise<Level>} The generated Level object
   */
  static async generate(scene, config) {
    console.log(`[StageGenerator] Generating stage: ${config.name || 'Unnamed'}`);

    const loader = new LoaderManager();
    await loader.loadManifest();

    // Create level instance
    const levelData = this.configToLevelData(config);
    const level = new Level(levelData);
    level.setScene(scene);

    // Generate platforms
    await this.generatePlatforms(scene, config.platforms || [], loader, config.theme);

    // Generate background
    this.generateBackground(scene, config.background);

    // Generate lighting
    this.generateLighting(scene, config.lighting);

    // Optional: Generate decorations
    if (config.decorations) {
      await this.generateDecorations(scene, config.decorations, loader);
    }

    console.log(`[StageGenerator] Stage "${config.name}" generated successfully`);
    return level;
  }

  /**
   * Convert stage config to Tiled-style level data format
   */
  static configToLevelData(config) {
    const { dimensions = { width: 34, height: 20 } } = config;
    const { spawns = {} } = config;

    // Create empty layer data arrays
    const createEmptyData = () => new Array(dimensions.width * dimensions.height).fill(-1);

    // Build spawn layers
    const playerSpawnData = createEmptyData();
    const weaponSpawnData = createEmptyData();
    const moneySpawnData = createEmptyData();

    // Fill spawn data
    if (spawns.players) {
      spawns.players.forEach(pos => {
        const idx = pos.y * dimensions.width + pos.x;
        if (idx >= 0 && idx < playerSpawnData.length) playerSpawnData[idx] = 1;
      });
    }

    if (spawns.weapons) {
      spawns.weapons.forEach(pos => {
        const idx = pos.y * dimensions.width + pos.x;
        if (idx >= 0 && idx < weaponSpawnData.length) weaponSpawnData[idx] = 1;
      });
    }

    if (spawns.money) {
      spawns.money.forEach(pos => {
        const idx = pos.y * dimensions.width + pos.x;
        if (idx >= 0 && idx < moneySpawnData.length) moneySpawnData[idx] = 1;
      });
    }

    // Build platform layer from config.platforms
    const platformData = createEmptyData();
    if (config.platforms) {
      config.platforms.forEach(platform => {
        const { x, y, width, height, gid = 1 } = platform;
        for (let py = 0; py < height; py++) {
          for (let px = 0; px < width; px++) {
            const idx = (y + py) * dimensions.width + (x + px);
            if (idx >= 0 && idx < platformData.length) platformData[idx] = gid;
          }
        }
      });
    }

    return {
      name: config.name || "Generated Stage",
      canvas: {
        width: dimensions.width * 32,
        height: dimensions.height * 32
      },
      tilesets: [{
        name: "generated_tileset",
        tilewidth: 32,
        tileheight: 32
      }],
      layers: [
        { name: "platforms", type: "tilelayer", width: dimensions.width, height: dimensions.height, data: platformData, visible: true, opacity: 1 },
        { name: "player_sp", type: "tilelayer", width: dimensions.width, height: dimensions.height, data: playerSpawnData, visible: true, opacity: 1 },
        { name: "weapon_sp", type: "tilelayer", width: dimensions.width, height: dimensions.height, data: weaponSpawnData, visible: true, opacity: 1 },
        { name: "money_sp", type: "tilelayer", width: dimensions.width, height: dimensions.height, data: moneySpawnData, visible: true, opacity: 1 }
      ]
    };
  }

  /**
   * Generate platform meshes from configuration
   */
  static async generatePlatforms(scene, platforms, loader, theme = "code") {
    const textureMap = {
      code: "/assets/images/levels/wall_code.png",
      google: "/assets/images/levels/wall_google.png",
      ballpit: "/assets/images/levels/wall_ballpit.png",
      basement: "/assets/images/levels/wall_basement.png",
      generic: "/assets/images/levels/wall.png"
    };

    const texturePath = textureMap[theme] || textureMap.generic;
    let texture;

    try {
      const textureLoader = new THREE.TextureLoader();
      texture = await textureLoader.loadAsync(texturePath);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    } catch (error) {
      console.warn(`[StageGenerator] Failed to load texture: ${texturePath}`, error);
      texture = null;
    }

    platforms.forEach((platform, index) => {
      const { x, y, width = 1, height = 1, material = theme } = platform;

      const geometry = new THREE.BoxGeometry(width, height, 1);
      const mat = texture
        ? new THREE.MeshStandardMaterial({
            map: texture.clone(),
            roughness: 0.8,
            metalness: 0.1
          })
        : new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.8,
            metalness: 0.1
          });

      const mesh = new THREE.Mesh(geometry, mat);

      // Convert grid coordinates to world coordinates
      // Assuming 34x20 grid centered at origin
      const worldX = x - 17 + width / 2;  // Center horizontally
      const worldY = y - 10 + height / 2; // Center vertically

      mesh.position.set(worldX, worldY, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isPlatform = true;
      mesh.userData.platformIndex = index;

      scene.add(mesh);
    });

    console.log(`[StageGenerator] Generated ${platforms.length} platforms`);
  }

  /**
   * Generate background (skybox, gradient, etc.)
   */
  static generateBackground(scene, bgConfig = {}) {
    const { type = "gradient", colors = ["#87CEEB", "#F0F8FF"], image = null } = bgConfig;

    if (type === "gradient" && colors.length >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      colors.forEach((color, i) => {
        gradient.addColorStop(i / (colors.length - 1), color);
      });

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;

      scene.background = texture;
      scene.environment = texture;
    } else if (type === "color") {
      scene.background = new THREE.Color(colors[0] || "#87CEEB");
    } else if (type === "image" && image) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(image, (texture) => {
        scene.background = texture;
      });
    }

    console.log(`[StageGenerator] Generated ${type} background`);
  }

  /**
   * Generate lighting setup
   */
  static generateLighting(scene, lightConfig = {}) {
    const {
      ambient = { color: 0xffffff, intensity: 0.6 },
      directional = { color: 0xffffff, intensity: 0.8, position: [10, 15, 10], castShadow: true },
      fill = { color: 0x87ceeb, intensity: 0.3, position: [-5, 8, -5] }
    } = lightConfig;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
    scene.add(ambientLight);

    // Main directional light
    const dirLight = new THREE.DirectionalLight(directional.color, directional.intensity);
    dirLight.position.set(...directional.position);

    if (directional.castShadow) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 50;
      dirLight.shadow.camera.left = -25;
      dirLight.shadow.camera.right = 25;
      dirLight.shadow.camera.top = 25;
      dirLight.shadow.camera.bottom = -25;
      dirLight.shadow.bias = -0.0001;
    }

    scene.add(dirLight);

    // Fill light
    if (fill) {
      const fillLight = new THREE.DirectionalLight(fill.color, fill.intensity);
      fillLight.position.set(...fill.position);
      scene.add(fillLight);
    }

    console.log(`[StageGenerator] Generated lighting setup`);
  }

  /**
   * Generate decorative elements (props, particles, etc.)
   */
  static async generateDecorations(scene, decorations, loader) {
    console.log(`[StageGenerator] Generating ${decorations.length} decorations`);

    for (const deco of decorations) {
      const { type, position, scale = [1, 1, 1], rotation = [0, 0, 0], model = null, color = 0xffffff } = deco;

      let mesh;

      if (type === "box") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...scale),
          new THREE.MeshStandardMaterial({ color })
        );
      } else if (type === "sphere") {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(scale[0], 16, 16),
          new THREE.MeshStandardMaterial({ color })
        );
      } else if (type === "model" && model) {
        // Load GLB model (if provided)
        try {
          mesh = await loader.loadGLB(model);
          mesh.scale.set(...scale);
        } catch (error) {
          console.warn(`[StageGenerator] Failed to load decoration model: ${model}`, error);
          continue;
        }
      }

      if (mesh) {
        mesh.position.set(...position);
        mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  }

  /**
   * Generate a stage from a template name
   */
  static async generateFromTemplate(scene, templateName) {
    const templates = {
      simple: {
        name: "Simple Arena",
        dimensions: { width: 34, height: 20 },
        theme: "code",
        platforms: [
          { x: 0, y: 0, width: 34, height: 2 }, // Floor
          { x: 5, y: 8, width: 6, height: 1 },  // Left platform
          { x: 23, y: 8, width: 6, height: 1 }, // Right platform
          { x: 14, y: 12, width: 6, height: 1 } // Top platform
        ],
        spawns: {
          players: [{ x: 8, y: 14 }, { x: 25, y: 14 }],
          weapons: [{ x: 10, y: 10 }, { x: 23, y: 10 }, { x: 17, y: 14 }],
          money: [{ x: 5, y: 10 }, { x: 28, y: 10 }, { x: 17, y: 6 }]
        }
      },

      complex: {
        name: "Complex Arena",
        dimensions: { width: 34, height: 20 },
        theme: "google",
        platforms: [
          { x: 0, y: 0, width: 34, height: 1 },   // Floor
          { x: 2, y: 6, width: 5, height: 1 },    // Lower left
          { x: 27, y: 6, width: 5, height: 1 },   // Lower right
          { x: 8, y: 10, width: 4, height: 1 },   // Mid left
          { x: 22, y: 10, width: 4, height: 1 },  // Mid right
          { x: 14, y: 14, width: 6, height: 1 }   // Top center
        ],
        spawns: {
          players: [{ x: 4, y: 8 }, { x: 29, y: 8 }, { x: 10, y: 12 }, { x: 22, y: 12 }],
          weapons: [{ x: 10, y: 12 }, { x: 24, y: 12 }, { x: 17, y: 16 }],
          money: [{ x: 4, y: 8 }, { x: 29, y: 8 }, { x: 17, y: 4 }]
        }
      }
    };

    const config = templates[templateName] || templates.simple;
    return this.generate(scene, config);
  }
}

export default StageGenerator;
