// src/World.js
import * as THREE from "three";
import { Level } from "@/Level.js";
import { LoaderManager } from "@/LoaderManager.js";

const LEVEL_NAMES = ["lvl_code", "lvl_ballpit", "lvl_basement", "lvl_google"];

const TILE_ASSET_INDICES = {
  // Proper wall texture mappings for solid cubes
  1: 6, // GID 1 -> wall_code.png (index 6)
  2: 6, // GID 2 -> wall_code.png (index 6)
  3: 4, // GID 3 -> wall_ballpit.png (index 4)
  4: 5, // GID 4 -> wall_basement.png (index 5)
  5: 7, // GID 5 -> wall_google.png (index 7)
  6: 8, // GID 6 -> wall.png (index 8) - generic wall
  7: 8, // GID 7 -> wall.png (index 8) - generic wall
  8: 8, // GID 8 -> wall.png (index 8) - generic wall
  9: 8, // GID 9 -> wall.png (index 8) - generic wall
};

export async function loadLevelAsync(scene, lvlIndex = 0) {
  console.log(
    `[World.js] Loading level: ${LEVEL_NAMES[lvlIndex] || LEVEL_NAMES[0]}`,
  );
  const loader = new LoaderManager();
  await loader.loadManifest();
  console.log("[World.js] LoaderManager manifest loaded.");

  const levelName = LEVEL_NAMES[lvlIndex] || LEVEL_NAMES[0];
  const res = await fetch(`/data/level/${levelName}.json`);
  if (!res.ok) {
    console.error(
      `[World.js] Failed to fetch level data for ${levelName}: HTTP ${res.status}`,
    );
    throw new Error(`Could not load level data: ${levelName}`);
  }
  const json = await res.json();
  console.log(`[World.js] Level JSON data loaded for ${levelName}.`);

  Level.ActiveLevel = new Level(json);
  Level.ActiveLevel.setScene(scene); // Set the scene reference
  console.log("[World.js] Level.ActiveLevel set and scene assigned.");

  const { layers, tilesets, canvas } = json;
  const worldLayer = layers.find((l) => l.name === "world");
  if (!worldLayer || !worldLayer.data) {
    console.warn(
      `[World.js] Level "${levelName}" has no 'world' layer or no data.`,
    );
    return;
  }

  const tileW = tilesets[0]?.tilewidth || 32;
  const tileH = tilesets[0]?.tileheight || 32;
  const mapWidth = Math.floor(canvas.width / tileW);
  const mapHeight = Math.floor(canvas.height / tileH);
  console.log(`[World.js] Map dimensions: ${mapWidth}x${mapHeight} tiles.`);

  const textureCache = {};
  const textureLoadPromises = [];
  for (const tileGid in TILE_ASSET_INDICES) {
    const assetIndex = TILE_ASSET_INDICES[tileGid];
    textureLoadPromises.push(
      loader
        .loadTexture("levels", null, assetIndex)
        .then((tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1, 1);
          textureCache[tileGid] = tex;
          console.log(`[World.js] Loaded texture for GID ${tileGid}.`);
        })
        .catch((error) => {
          console.error(
            `[World.js] Failed to load texture for tile GID ${tileGid} (asset index ${assetIndex}):`,
            error,
          );
          textureCache[tileGid] = null;
        }),
    );
  }
  await Promise.all(textureLoadPromises);
  console.log("[World.js] All required level textures loaded/attempted.");

  let tilesAdded = 0;
  worldLayer.data.forEach((tileIdx, i) => {
    if (tileIdx <= 0) return;

    const tx = i % mapWidth;
    const ty = Math.floor(i / mapWidth);

    const tex = textureCache[tileIdx];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    
    // Create material with proper texture settings
    const mat = tex
      ? new THREE.MeshStandardMaterial({ 
          map: tex,
          roughness: 0.8,
          metalness: 0.1
        })
      : new THREE.MeshStandardMaterial({ 
          color: 0x666666,
          roughness: 0.9,
          metalness: 0.0
        });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      tx - mapWidth / 2 + 0.5,
      mapHeight - ty - 1 - mapHeight / 2 + 0.5,
      0,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isTile = true; // Mark as level tile for collision detection
    scene.add(mesh);
    tilesAdded++;
  });
  console.log(`[World.js] Added ${tilesAdded} level tiles to the scene.`);
}
