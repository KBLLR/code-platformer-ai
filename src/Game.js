import * as THREE from "three";

import { loadLevelAsync } from "./World.js";
import { loadPlayers, players } from "./Player.js"; // Import 'players' array directly
import { pollInput, isActionPressed } from "./InputController.js";
import { initPlayerUI, updatePlayerUI } from "./ui/player_ui.js";
import { UI } from "./ui/user_interface.js";
import { Level } from "./Level.js"; // Ensure Level is imported if its static property is used
import { game_config } from "./game_config.js";

let renderer, camera, scene, gameUI;
let lastTime = performance.now();

// --- Controller Status UI (for debugging input) ---
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
  const pads = navigator.getGamepads();
  let lines = [];
  for (let i = 0; i < 4; i++) {
    // Display status for up to 4 potential players
    let line = `Player ${i + 1}: `;
    const pad = pads[i];
    if (pad && pad.connected) {
      line += `🎮 ${pad.id.slice(0, 16)} (index ${pad.index})`;
    } else if (i === 0) {
      line += "⌨️ Keyboard (WASD/F)"; // Default keyboard player 1
    } else if (i === 1) {
      line += "⌨️ Keyboard (Arrows/M)"; // Default keyboard player 2
    } else {
      line += "—"; // No input connected
    }
    lines.push(line);
  }
  ui.innerHTML = lines.join("<br>");
}

// --- Game Initialization ---
// Accepts: canvas, { lvl (level index), character (number of players/characters to load) }
export async function initGame(canvas, { lvl = 0, character = 0 } = {}) {
  // Renderer setup with enhanced graphics
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    powerPreference: "high-performance",
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Scene setup with HDRI environment
  scene = new THREE.Scene();
  const bgColor = game_config.clear_color || 0x87ceeb;
  
  // Create simple gradient background
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 512;
  bgCanvas.height = 256;
  const ctx = bgCanvas.getContext('2d');
  
  // Create sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#87CEEB'); // Sky blue top
  gradient.addColorStop(0.5, '#B0E0E6'); // Powder blue middle
  gradient.addColorStop(1, '#F0F8FF'); // Alice blue bottom
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);
  
  // Create texture from canvas
  const bgTexture = new THREE.CanvasTexture(bgCanvas);
  bgTexture.mapping = THREE.EquirectangularReflectionMapping;
  bgTexture.colorSpace = THREE.SRGBColorSpace;
  
  // Set background
  scene.background = bgTexture;
  scene.environment = bgTexture;
  
  scene.fog = new THREE.Fog(bgColor, 50, 100); // Add atmospheric fog

  // Orthographic camera setup for 2D platformer view
  const frustumSize = 25; // Adjust this to zoom in/out
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  // Isometric camera position (30° elevation, 45° rotation)
  const distance = 25;
  const height = distance * Math.sin(Math.PI / 6); // 30° elevation
  const horizontalDistance = distance * Math.cos(Math.PI / 6);
  
  camera.position.set(
    horizontalDistance * Math.cos(Math.PI / 4), // 45° rotation around Y-axis
    height,
    horizontalDistance * Math.sin(Math.PI / 4)
  );
  camera.lookAt(0, 0, 0); // Look at center of the action

  // Enhanced lighting setup with environment-aware lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // Slightly higher ambient with environment
  
  // Main directional light (sun) - reduced intensity due to environment lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 15, 10);
  dirLight.castShadow = true;
  
  // High-quality shadow configuration
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -25;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  
  // Add subtle fill light
  const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight.position.set(-5, 8, -5);
  scene.add(fillLight);
  
  // --- Level Loading ---
  await loadLevelAsync(scene, lvl);

  // --- Character Loading ---
  // Pass character as the number of players. Default to 1 if 0 is passed.
  await loadPlayers(scene, character > 0 ? character : 1);



  // --- UI/HUD Initialization ---
  // Pass the global 'players' array directly to UI functions
  initPlayerUI(players);
  gameUI = new UI();

  // --- Event Listeners ---
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("gamepadconnected", updateControllerStatusUI);
  window.addEventListener("gamepaddisconnected", updateControllerStatusUI);

  // Start the animation loop
  animate();
}

// --- Event Handlers ---
function onWindowResize() {
  const frustumSize = 25;
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Maintain isometric camera position
  const distance = 25;
  const height = distance * Math.sin(Math.PI / 6); // 30° elevation
  const horizontalDistance = distance * Math.cos(Math.PI / 6);
  
  camera.position.set(
    horizontalDistance * Math.cos(Math.PI / 4), // 45° rotation around Y-axis
    height,
    horizontalDistance * Math.sin(Math.PI / 4)
  );
  camera.lookAt(0, 0, 0);
  
  // Adjust UI for mobile
  updateMobileUI();
}

function updateMobileUI() {
  const isMobile = window.innerWidth < 768;
  const playerHud = document.getElementById("player-hud");
  
  if (playerHud) {
    if (isMobile) {
      playerHud.style.fontSize = "12px";
      playerHud.style.padding = "8px";
    } else {
      playerHud.style.fontSize = "14px";
      playerHud.style.padding = "12px";
    }
  }
}

// --- Game Loop ---
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  // Calculate delta time. Cap at a max value to prevent "jumps" after long pauses
  const deltaTime = Math.min((now - lastTime) / 1000, 1 / 20); // delta in seconds, capped at 20 FPS minimum
  lastTime = now;

  // Poll input devices (gamepads, keyboard)
  pollInput();
  updateControllerStatusUI(); // Update debug UI

  // Update game UI
  if (gameUI) gameUI.Update();
  updatePlayerUI(players); // Pass the global 'players' array

  // Update players based on input
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p) continue; // Skip if player object is null

    // Player Movement (continuous input)
    if (isActionPressed(i, "left")) p.moveLeft();
    else if (isActionPressed(i, "right")) p.moveRight();
    else p.velocityX = 0; // Stop horizontal movement if no direction pressed

    // Player Actions (edge-triggered: only on the first press)
    const currentJumpPressed = isActionPressed(i, "jump");
    const currentAttackPressed = isActionPressed(i, "attack");

    if (currentJumpPressed && !p.lastJumpPressed) {
      p.jump();
    }
    if (currentAttackPressed && !p.lastAttackPressed) {
      // Need to pass the scene for projectiles
      p.attack(scene);
    }

    // Update last frame's input state for next frame's edge detection
    p.lastJumpPressed = currentJumpPressed;
    p.lastAttackPressed = currentAttackPressed;

    // Update player's physics and state
    p.update(deltaTime);
    
    // Update money carrying state
    if (p.hasMoney && !p.wasCarryingMoney) {
      p.wasCarryingMoney = true;
    } else if (!p.hasMoney) {
      p.wasCarryingMoney = false;
    }
  }

  // Update and clean up projectiles
  if (Level.ActiveLevel && Level.ActiveLevel.projectiles) {
    for (let i = Level.ActiveLevel.projectiles.length - 1; i >= 0; i--) {
      const projectile = Level.ActiveLevel.projectiles[i];
      projectile.update(deltaTime); // Update projectile's position/state

      if (projectile.lifespanExpired) {
        // Remove from scene and dispose resources
        Level.ActiveLevel.removeProjectile(projectile, scene);
      }
      // TODO: Add collision detection for projectiles here or in a Physics loop
    }
  }



  // Render the scene
  renderer.render(scene, camera);
}

export { scene, camera, renderer };
