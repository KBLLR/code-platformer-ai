// src/GameViverse.js
// VIVERSE-powered 3D Battle Arena Game
import * as THREE from "three";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";
import { BvhPhysicsWorld } from "@pmndrs/viverse";

import { CharacterController } from "./CharacterController.js";
import { initPlayerUI, updatePlayerUI } from "./ui/player_ui.js";
import { UI } from "./ui/user_interface.js";
import { game_config } from "./game_config.js";
import { Trophy } from "./Trophy.js";
import { Bow } from "./weapons/bow.js";
import { Shotgun } from "./weapons/shotgun.js";
import { Level } from "./Level.js";
import { LoaderManager } from "./LoaderManager.js";

// Global game state
let renderer, camera, scene, gameUI;
let physicsWorld;
let players = [];
let trophy;
let lastTime = performance.now();
let isUsingWebGPU = false;

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  arrowUp: false,
  arrowLeft: false,
  arrowDown: false,
  arrowRight: false,
};

// Camera orbit state
let cameraAngle = 0;
let cameraRadius = 20;
let cameraHeight = 15;
const radiusNormal = 20;
const radiusZoom = 10;
const heightNormal = 15;
const heightZoom = 10;
let isZooming = false;
let zoomTimer = 0;
let zoomFocus = null;
let currentRadius = radiusNormal;
let currentHeight = heightNormal;

// Arena configuration
const ARENA_SIZE = 50;
const GROUND_HEIGHT = -0.5;

// --- Controller Status UI (for debugging) ---
function setupControllerStatusUI() {
  let ui = document.getElementById("controller-status-ui");
  if (!ui) {
    ui = document.createElement("div");
    ui.id = "controller-status-ui";
    ui.style.position = "fixed";
    ui.style.bottom = "16px";
    ui.style.left = "16px";
    ui.style.background = "rgba(0,0,0,0.8)";
    ui.style.padding = "12px 20px";
    ui.style.color = "#fff";
    ui.style.fontFamily = "monospace";
    ui.style.fontSize = "14px";
    ui.style.borderRadius = "12px";
    ui.style.zIndex = "2000";
    ui.style.pointerEvents = "none";
    document.body.appendChild(ui);
  }
  return ui;
}

function updateControllerStatusUI() {
  const ui = setupControllerStatusUI();
  const rendererType = isUsingWebGPU ? "🚀 WebGPU" : "🔧 WebGL";
  const lines = [
    `<strong>Renderer:</strong> ${rendererType}`,
    `<strong>Mode:</strong> VIVERSE 3D Arena`,
    "",
    `<strong>Controls:</strong>`,
    `Player 1: WASD (move) | Space (jump) | F (attack)`,
  ];
  ui.innerHTML = lines.join("<br>");
}

// --- Create 3D Arena ---
function createArena(scene, physicsWorld) {
  console.log("[GameViverse] Creating 3D battle arena...");

  // Ground plane
  const groundGeometry = new THREE.BoxGeometry(ARENA_SIZE, 1, ARENA_SIZE);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a7c3f,
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(0, GROUND_HEIGHT, 0);
  ground.receiveShadow = true;
  ground.userData.isTile = true;
  scene.add(ground);

  // Add ground to physics world
  physicsWorld.addBody(ground, false); // false = static body
  console.log("[GameViverse] Ground added to physics world");

  // Add some obstacles for cover
  const obstacleGeometry = new THREE.BoxGeometry(2, 2, 2);
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.7,
  });

  const obstaclePositions = [
    { x: -8, z: -8 },
    { x: 8, z: -8 },
    { x: -8, z: 8 },
    { x: 8, z: 8 },
    { x: 0, z: -10 },
    { x: 0, z: 10 },
  ];

  obstaclePositions.forEach((pos, index) => {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial.clone());
    obstacle.position.set(pos.x, 1, pos.z);
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    obstacle.userData.isObstacle = true;
    scene.add(obstacle);

    // Add to physics world
    physicsWorld.addBody(obstacle, false);
    console.log(`[GameViverse] Obstacle ${index + 1} added at (${pos.x}, ${pos.z})`);
  });

  // Add boundary walls
  const wallHeight = 3;
  const wallThickness = 1;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.9,
  });

  // North wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE + 2, wallHeight, wallThickness),
    wallMaterial
  );
  northWall.position.set(0, wallHeight / 2, -(ARENA_SIZE / 2 + wallThickness / 2));
  northWall.receiveShadow = true;
  scene.add(northWall);
  physicsWorld.addBody(northWall, false);

  // South wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE + 2, wallHeight, wallThickness),
    wallMaterial
  );
  southWall.position.set(0, wallHeight / 2, ARENA_SIZE / 2 + wallThickness / 2);
  southWall.receiveShadow = true;
  scene.add(southWall);
  physicsWorld.addBody(southWall, false);

  // East wall
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, ARENA_SIZE),
    wallMaterial
  );
  eastWall.position.set(ARENA_SIZE / 2 + wallThickness / 2, wallHeight / 2, 0);
  eastWall.receiveShadow = true;
  scene.add(eastWall);
  physicsWorld.addBody(eastWall, false);

  // West wall
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, ARENA_SIZE),
    wallMaterial
  );
  westWall.position.set(-(ARENA_SIZE / 2 + wallThickness / 2), wallHeight / 2, 0);
  westWall.receiveShadow = true;
  scene.add(westWall);
  physicsWorld.addBody(westWall, false);

  console.log("[GameViverse] Arena created with boundary walls");
}

// --- Setup Lighting ---
function setupLighting(scene) {
  // Ambient light for general illumination
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Directional light (sun)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(15, 20, 15);
  dirLight.castShadow = true;

  // Shadow configuration
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -30;
  dirLight.shadow.camera.right = 30;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -30;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight.position.set(-10, 10, -10);
  scene.add(fillLight);

  console.log("[GameViverse] Lighting setup complete");
}

// --- Camera Zoom Trigger ---
function startCameraZoom(focusPosition) {
  isZooming = true;
  zoomTimer = 2.0; // 2 seconds
  zoomFocus = focusPosition.clone();
  console.log("[GameViverse] Camera zoom triggered at", focusPosition);
}

// --- Damage System ---
function applyDamage(playerObj, amount) {
  if (playerObj.dead || playerObj.invulnerable) return;

  playerObj.health = Math.max(playerObj.health - amount, 0);
  console.log(
    `[GameViverse] Player ${playerObj.player_number + 1} took ${amount} damage. Health: ${playerObj.health}/${playerObj.maxHealth}`
  );

  if (playerObj.health <= 0) {
    handlePlayerDeath(playerObj);
  } else {
    // Add invulnerability frames
    playerObj.invulnerable = true;
    playerObj.invulTimer = 1.0; // 1 second
  }
}

// --- Player Death Handler ---
function handlePlayerDeath(playerObj) {
  console.log(`[GameViverse] Player ${playerObj.player_number + 1} eliminated!`);
  playerObj.dead = true;
  playerObj.justEliminated = true;

  // Drop trophy if holding it
  if (trophy && trophy.player === playerObj) {
    const dropPos = playerObj.character.position.clone();
    trophy.moveToLevel(Level.ActiveLevel, dropPos);
    playerObj.hasMoney = false;
  }

  // Hide character
  if (playerObj.character) {
    playerObj.character.visible = false;
  }

  // Trigger camera zoom on elimination
  startCameraZoom(playerObj.character.position);

  // Check win condition
  const alivePlayers = players.filter((p) => !p.dead);
  if (alivePlayers.length === 1) {
    console.log(`[GameViverse] Player ${alivePlayers[0].player_number + 1} wins!`);
    alivePlayers[0].justWon = true;
  }
}

// --- Game Initialization ---
export async function initGameViverse(canvas, { lvl = 0, character = 0, humanPlayers = 1 } = {}) {
  console.log("[GameViverse] Initializing VIVERSE-powered 3D arena...");

  // --- Renderer Setup ---
  if (WebGPU.isAvailable()) {
    console.log("✨ Initializing WebGPU renderer...");
    renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    isUsingWebGPU = true;
    await renderer.init();
    console.log("✅ WebGPU renderer initialized");
  } else {
    console.log("⚠️ WebGPU not available, falling back to WebGL");
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    isUsingWebGPU = false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (!isUsingWebGPU) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // --- Scene Setup ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

  // --- Physics World ---
  physicsWorld = new BvhPhysicsWorld();
  console.log("[GameViverse] BvhPhysicsWorld initialized");

  // --- Create Arena ---
  createArena(scene, physicsWorld);

  // --- Setup Lighting ---
  setupLighting(scene);

  // --- Perspective Camera Setup ---
  const fov = 60;
  camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Initial camera position
  camera.position.set(cameraRadius, cameraHeight, 0);
  camera.lookAt(0, 0, 0);
  console.log("[GameViverse] PerspectiveCamera initialized");

  // --- Initialize Level (for compatibility with Trophy and projectiles) ---
  Level.ActiveLevel = {
    scene: scene,
    projectiles: [],
    addProjectile: function (proj) {
      this.projectiles.push(proj);
    },
    removeProjectile: function (proj, scene) {
      const index = this.projectiles.indexOf(proj);
      if (index > -1) {
        this.projectiles.splice(index, 1);
      }
      if (proj.mesh) {
        scene.remove(proj.mesh);
      }
    },
  };

  // --- Load Player Models and Create Characters ---
  const loader = new LoaderManager();
  await loader.loadManifest();
  console.log("[GameViverse] LoaderManager manifest loaded");

  const playerMetas = loader.manifest.models.filter((m) => m.tags.includes("player"));
  const numPlayers = character > 0 ? character : 1;
  players = [];

  const spawnPositions = [
    { x: -5, z: 0 },
    { x: 5, z: 0 },
    { x: 0, z: -5 },
    { x: 0, z: 5 },
  ];

  for (let i = 0; i < numPlayers; i++) {
    let modelUrl = null;

    // Try to load player model
    try {
      const modelMeta = playerMetas[i];
      if (modelMeta) {
        modelUrl = modelMeta.file;
        console.log(`[GameViverse] Player ${i + 1} model: ${modelUrl}`);
      }
    } catch (err) {
      console.warn(`[GameViverse] Could not find model for player ${i + 1}, using default`);
    }

    // Create SimpleCharacter
    // Note: SimpleCharacter constructor signature may vary
    // For now, we'll create a placeholder that we'll enhance
    const spawnPos = spawnPositions[i] || { x: i * 3, z: 0 };

    // Create a basic mesh for the character (we'll replace with SimpleCharacter)
    const characterMesh = new THREE.Group();
    characterMesh.position.set(spawnPos.x, 0, spawnPos.z);

    // Load the GLB model if available
    if (modelUrl) {
      try {
        const gltfScene = await loader.loadGLB(modelUrl);
        gltfScene.scale.set(1.4, 1.4, 1.4);
        gltfScene.traverse((child) => {
          if (child.isMesh) child.castShadow = true;
        });
        characterMesh.add(gltfScene);
        console.log(`[GameViverse] Player ${i + 1} GLB model loaded`);
      } catch (err) {
        console.warn(`[GameViverse] Failed to load GLB for player ${i + 1}:`, err);
        // Use fallback cube
        const fallbackMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 2, 1),
          new THREE.MeshStandardMaterial({ color: [0xff0000, 0x00aaff, 0x00ff55, 0xffe000][i % 4] })
        );
        fallbackMesh.castShadow = true;
        characterMesh.add(fallbackMesh);
      }
    } else {
      // Fallback cube
      const fallbackMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: [0xff0000, 0x00aaff, 0x00ff55, 0xffe000][i % 4] })
      );
      fallbackMesh.castShadow = true;
      characterMesh.add(fallbackMesh);
    }

    scene.add(characterMesh);

    // Create character controller
    const controller = new CharacterController(characterMesh, physicsWorld, i);

    // Create player object
    const playerObj = {
      character: characterMesh,
      mesh: characterMesh, // Alias for compatibility
      controller: controller,
      player_number: i,
      health: game_config.player_hp || 100,
      maxHealth: game_config.player_hp || 100,
      score: 0,
      currentWeapon: null,
      dead: false,
      invulnerable: false,
      invulTimer: 0,
      hasMoney: false,
      justWon: false,
      justEliminated: false,
      isAI: i >= humanPlayers,
      lastAttackPressed: false,
      lastJumpPressed: false,
    };

    // Equip weapon
    const weaponPos = characterMesh.position.clone();
    let weapon;
    if (i % 2 === 0) {
      weapon = new Bow(weaponPos);
    } else {
      weapon = new Shotgun(weaponPos);
    }
    weapon.player = playerObj;
    playerObj.currentWeapon = weapon;

    // Load weapon mesh if available
    if (weapon.ensureMesh) {
      try {
        await weapon.ensureMesh(scene);
        console.log(`[GameViverse] Player ${i + 1} weapon loaded`);
      } catch (err) {
        console.warn(`[GameViverse] Failed to load weapon mesh:`, err);
      }
    }

    players.push(playerObj);
    console.log(`[GameViverse] Player ${i + 1} created at (${spawnPos.x}, 0, ${spawnPos.z})`);
  }

  // --- Initialize Trophy ---
  trophy = new Trophy(Level.ActiveLevel);
  console.log("[GameViverse] Trophy initialized");

  // --- UI Initialization ---
  initPlayerUI(players);
  gameUI = new UI();
  updateControllerStatusUI();

  // --- Event Listeners ---
  window.addEventListener("resize", onWindowResize);

  // Input handling
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  console.log("[GameViverse] Initialization complete!");

  // Start animation loop
  if (isUsingWebGPU) {
    renderer.setAnimationLoop(animate);
  } else {
    animate();
  }
}

// --- Event Handlers ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  // Update key state
  if (key === "w") keys.w = true;
  if (key === "a") keys.a = true;
  if (key === "s") keys.s = true;
  if (key === "d") keys.d = true;
  if (key === " ") keys.space = true;
  if (key === "arrowup") keys.arrowUp = true;
  if (key === "arrowleft") keys.arrowLeft = true;
  if (key === "arrowdown") keys.arrowDown = true;
  if (key === "arrowright") keys.arrowRight = true;

  // Player 1: F key for attack
  if (key === "f" && players.length > 0) {
    const player = players[0];
    if (player && !player.dead && player.currentWeapon && !player.lastAttackPressed) {
      const dir = new THREE.Vector3();
      player.controller.getWorldDirection(dir);
      player.currentWeapon.fire(scene, dir);
      player.lastAttackPressed = true;
      console.log(`[GameViverse] Player 1 fired ${player.currentWeapon.constructor.name}`);
    }
  }

  // Player 2: M key for attack
  if (key === "m" && players.length > 1) {
    const player = players[1];
    if (player && !player.dead && player.currentWeapon && !player.lastAttackPressed) {
      const dir = new THREE.Vector3();
      player.controller.getWorldDirection(dir);
      player.currentWeapon.fire(scene, dir);
      player.lastAttackPressed = true;
      console.log(`[GameViverse] Player 2 fired ${player.currentWeapon.constructor.name}`);
    }
  }

  // Prevent default for space (stops page scroll)
  if (key === " ") {
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();

  // Update key state
  if (key === "w") keys.w = false;
  if (key === "a") keys.a = false;
  if (key === "s") keys.s = false;
  if (key === "d") keys.d = false;
  if (key === " ") keys.space = false;
  if (key === "arrowup") keys.arrowUp = false;
  if (key === "arrowleft") keys.arrowLeft = false;
  if (key === "arrowdown") keys.arrowDown = false;
  if (key === "arrowright") keys.arrowRight = false;

  // Reset attack press state
  if (key === "f" && players.length > 0) {
    players[0].lastAttackPressed = false;
  }
  if (key === "m" && players.length > 1) {
    players[1].lastAttackPressed = false;
  }
}

// --- Game Loop ---
function animate() {
  if (!isUsingWebGPU) {
    requestAnimationFrame(animate);
  }

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  // Update UI
  updateControllerStatusUI();
  if (gameUI) gameUI.Update();
  updatePlayerUI(players);

  // Update players
  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    if (!player.dead) {
      // Update invulnerability timer
      if (player.invulnerable) {
        player.invulTimer -= delta;
        if (player.invulTimer <= 0) {
          player.invulnerable = false;
        }
      }

      // Handle input
      if (!player.isAI) {
        // Human player controls
        let inputX = 0;
        let inputZ = 0;

        if (i === 0) {
          // Player 1: WASD
          if (keys.w) inputZ -= 1;
          if (keys.s) inputZ += 1;
          if (keys.a) inputX -= 1;
          if (keys.d) inputX += 1;

          // Jump
          if (keys.space && !player.lastJumpPressed) {
            player.controller.jump();
            player.lastJumpPressed = true;
          }
          if (!keys.space) {
            player.lastJumpPressed = false;
          }
        } else if (i === 1) {
          // Player 2: Arrow keys
          if (keys.arrowUp) inputZ -= 1;
          if (keys.arrowDown) inputZ += 1;
          if (keys.arrowLeft) inputX -= 1;
          if (keys.arrowRight) inputX += 1;
        }

        player.controller.setInputDirection(inputX, inputZ);
      } else {
        // AI: move toward trophy if available
        if (trophy && !trophy.isPickedUp) {
          const dirToTrophy = new THREE.Vector2()
            .subVectors(
              new THREE.Vector2(trophy.mesh.position.x, trophy.mesh.position.z),
              new THREE.Vector2(player.character.position.x, player.character.position.z)
            )
            .normalize();
          player.controller.setInputDirection(dirToTrophy.x, dirToTrophy.y);
        } else {
          player.controller.setInputDirection(0, 0);
        }
      }

      // Update character controller
      player.controller.update(delta);
    }
  }

  // Update trophy
  if (trophy) {
    trophy.Update(delta);

    // Check trophy pickup
    if (!trophy.isPickedUp) {
      for (const player of players) {
        if (!player.dead) {
          const dist = player.character.position.distanceTo(trophy.mesh.position);
          if (dist < 1.5) {
            trophy.moveToPlayer(player);
            player.hasMoney = true;
            startCameraZoom(player.character.position);
            console.log(`[GameViverse] Player ${player.player_number + 1} picked up trophy!`);
            break;
          }
        }
      }
    }
  }

  // Update projectiles
  if (Level.ActiveLevel && Level.ActiveLevel.projectiles) {
    for (let i = Level.ActiveLevel.projectiles.length - 1; i >= 0; i--) {
      const proj = Level.ActiveLevel.projectiles[i];
      proj.update(delta);

      // Remove if expired
      if (proj.lifespanExpired) {
        Level.ActiveLevel.removeProjectile(proj, scene);
        continue;
      }

      // Check collisions with players
      for (const player of players) {
        if (!player.dead && !player.invulnerable) {
          const dist = player.character.position.distanceTo(proj.mesh.position);
          if (dist < 1.0) {
            const damage = proj.name === "Arrow" ? 25 : 15;
            applyDamage(player, damage);
            Level.ActiveLevel.removeProjectile(proj, scene);
            break;
          }
        }
      }
    }
  }

  // Update camera orbit and zoom
  if (isZooming) {
    // Slow rotation during zoom
    cameraAngle += 0.002;
    currentRadius = THREE.MathUtils.lerp(currentRadius, radiusZoom, 0.1);
    currentHeight = THREE.MathUtils.lerp(currentHeight, heightZoom, 0.1);

    camera.position.x = currentRadius * Math.cos(cameraAngle);
    camera.position.z = currentRadius * Math.sin(cameraAngle);
    camera.position.y = currentHeight;

    if (zoomFocus) {
      camera.lookAt(zoomFocus.x, zoomFocus.y, zoomFocus.z);
    } else {
      camera.lookAt(0, 0, 0);
    }

    zoomTimer -= delta;
    if (zoomTimer <= 0) {
      isZooming = false;
      zoomFocus = null;
    }
  } else {
    // Normal orbit
    cameraAngle += 0.005;
    currentRadius = THREE.MathUtils.lerp(currentRadius, radiusNormal, 0.05);
    currentHeight = THREE.MathUtils.lerp(currentHeight, heightNormal, 0.05);

    camera.position.x = currentRadius * Math.cos(cameraAngle);
    camera.position.z = currentRadius * Math.sin(cameraAngle);
    camera.position.y = currentHeight;
    camera.lookAt(0, 0, 0);
  }

  // Render
  renderer.render(scene, camera);
}

// --- Exports ---
export { scene, camera, renderer, players, physicsWorld };

export function getRendererInfo() {
  return {
    type: isUsingWebGPU ? "WebGPU" : "WebGL",
    isWebGPU: isUsingWebGPU,
    mode: "VIVERSE 3D Arena",
  };
}
