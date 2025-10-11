// src/GameCamera.js
import * as THREE from "three";
import { game_config } from "./game_config.js";

export class GameCamera {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    
    // Camera state
    this.targetPosition = new THREE.Vector3(0, 5, 20);
    this.targetLookAt = new THREE.Vector3(0, 2, 0);
    this.currentLookAt = new THREE.Vector3(0, 2, 0);
    
    // Camera settings
    this.followSpeed = 0.05;
    this.zoomSpeed = 0.03;
    this.minDistance = 15;
    this.maxDistance = 35;
    this.defaultDistance = 20;
    this.baseHeight = 5;
    this.maxHeight = 12;
    
    // Player tracking
    this.players = [];
    this.followMode = "ALL_PLAYERS"; // ALL_PLAYERS, SPECIFIC_PLAYER, FIXED
    this.focusPlayer = null;
    
    // Special effects
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTime = 0;
    this.zoomEffect = 0;
    this.zoomDuration = 0;
    this.zoomTime = 0;
    
    // Screen bounds and responsive design
    this.levelBounds = { minX: -20, maxX: 20, minY: -10, maxY: 15 };
    this.aspectRatio = window.innerWidth / window.innerHeight;
    
    // Initialize
    this.updateAspectRatio();
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.updateAspectRatio());
  }

  updateAspectRatio() {
    this.aspectRatio = window.innerWidth / window.innerHeight;
    
    // Adjust camera settings based on screen size
    if (this.aspectRatio < 1) {
      // Portrait mode - zoom out more
      this.minDistance = 20;
      this.maxDistance = 40;
      this.defaultDistance = 25;
    } else if (this.aspectRatio < 1.5) {
      // Tablet/square - standard settings
      this.minDistance = 15;
      this.maxDistance = 35;
      this.defaultDistance = 20;
    } else {
      // Widescreen - can zoom in closer
      this.minDistance = 12;
      this.maxDistance = 30;
      this.defaultDistance = 18;
    }
  }

  setPlayers(players) {
    this.players = players.filter(p => p && p.mesh);
  }

  setLevelBounds(bounds) {
    this.levelBounds = bounds;
  }

  setFollowMode(mode, player = null) {
    this.followMode = mode;
    this.focusPlayer = player;
  }

  // Camera shake effect
  addShake(intensity = 1, duration = 500) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTime = 0;
  }

  // Zoom effect for special events
  addZoomEffect(zoomAmount = 0.5, duration = 1000) {
    this.zoomEffect = zoomAmount;
    this.zoomDuration = duration;
    this.zoomTime = 0;
  }

  // Special camera event when player gets money/trophy
  onPlayerGetsMoney(player) {
    console.log("[GameCamera] Player got money! Adding special camera effect.");
    
    // Quick zoom in on the player
    this.addZoomEffect(0.7, 800);
    
    // Brief camera shake
    this.addShake(0.3, 200);
    
    // Temporarily focus on this player
    const originalMode = this.followMode;
    this.setFollowMode("SPECIFIC_PLAYER", player);
    
    // Return to original mode after effect
    setTimeout(() => {
      this.setFollowMode(originalMode);
    }, 1000);
  }

  // Camera effect for combat/weapons
  onWeaponFired(player, weaponType) {
    const shakeIntensity = {
      'bow': 0.1,
      'gun': 0.2,
      'shotgun': 0.4,
      'minigun': 0.15
    };
    
    this.addShake(shakeIntensity[weaponType] || 0.2, 150);
  }

  // Calculate center point of all active players
  calculatePlayersCenter() {
    if (!this.players.length) return new THREE.Vector3(0, 2, 0);
    
    const activePlayers = this.players.filter(p => p.mesh && p.health > 0);
    if (!activePlayers.length) return new THREE.Vector3(0, 2, 0);
    
    const center = new THREE.Vector3();
    activePlayers.forEach(player => {
      center.add(player.mesh.position);
    });
    center.divideScalar(activePlayers.length);
    center.y += 2; // Look slightly above players
    
    return center;
  }

  // Calculate optimal camera distance based on player spread
  calculateOptimalDistance() {
    if (!this.players.length) return this.defaultDistance;
    
    const activePlayers = this.players.filter(p => p.mesh && p.health > 0);
    if (activePlayers.length <= 1) return this.defaultDistance;
    
    // Find the maximum distance between any two players
    let maxDistance = 0;
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const dist = activePlayers[i].mesh.position.distanceTo(activePlayers[j].mesh.position);
        maxDistance = Math.max(maxDistance, dist);
      }
    }
    
    // Scale camera distance based on player spread
    const scaleFactor = 1.5 + (maxDistance / 15); // Adjust as needed
    let optimalDistance = this.defaultDistance * scaleFactor;
    
    // Apply zoom effect
    if (this.zoomTime < this.zoomDuration) {
      const zoomProgress = this.zoomTime / this.zoomDuration;
      const easeOut = 1 - Math.pow(1 - zoomProgress, 3);
      const currentZoom = this.zoomEffect * (1 - easeOut);
      optimalDistance *= (1 - currentZoom);
    }
    
    // Clamp to min/max bounds
    return THREE.MathUtils.clamp(optimalDistance, this.minDistance, this.maxDistance);
  }

  // Update camera position and look-at target
  update(deltaTime) {
    if (!this.camera) return;
    
    // Update effect timers
    this.shakeTime += deltaTime * 1000;
    this.zoomTime += deltaTime * 1000;
    
    // Calculate target position
    let targetLookAt = new THREE.Vector3();
    
    switch (this.followMode) {
      case "SPECIFIC_PLAYER":
        if (this.focusPlayer && this.focusPlayer.mesh) {
          targetLookAt.copy(this.focusPlayer.mesh.position);
          targetLookAt.y += 2;
        } else {
          targetLookAt = this.calculatePlayersCenter();
        }
        break;
        
      case "ALL_PLAYERS":
        targetLookAt = this.calculatePlayersCenter();
        break;
        
      case "FIXED":
      default:
        targetLookAt.copy(this.targetLookAt);
        break;
    }
    
    // Apply level bounds constraints
    targetLookAt.x = THREE.MathUtils.clamp(targetLookAt.x, this.levelBounds.minX, this.levelBounds.maxX);
    targetLookAt.y = THREE.MathUtils.clamp(targetLookAt.y, this.levelBounds.minY, this.levelBounds.maxY);
    
    // Calculate optimal camera distance
    const optimalDistance = this.calculateOptimalDistance();
    
    // Calculate camera height based on distance
    const heightFactor = (optimalDistance - this.minDistance) / (this.maxDistance - this.minDistance);
    const targetHeight = this.baseHeight + (this.maxHeight - this.baseHeight) * heightFactor;
    
    // Set target camera position
    this.targetPosition.set(
      targetLookAt.x,
      targetHeight,
      targetLookAt.z + optimalDistance
    );
    
    // Apply camera shake
    let shakeOffset = new THREE.Vector3();
    if (this.shakeTime < this.shakeDuration) {
      const shakeAmount = this.shakeIntensity * (1 - this.shakeTime / this.shakeDuration);
      shakeOffset.set(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount * 0.5,
        (Math.random() - 0.5) * shakeAmount * 0.3
      );
    }
    
    // Smooth camera movement
    this.camera.position.lerp(this.targetPosition.clone().add(shakeOffset), this.followSpeed);
    this.currentLookAt.lerp(targetLookAt, this.followSpeed);
    this.camera.lookAt(this.currentLookAt);
    
    // Update camera matrix
    this.camera.updateMatrixWorld();
  }

  // Get camera shake for UI effects
  getShakeIntensity() {
    if (this.shakeTime < this.shakeDuration) {
      return this.shakeIntensity * (1 - this.shakeTime / this.shakeDuration);
    }
    return 0;
  }

  // Emergency reset camera
  resetCamera() {
    this.camera.position.set(0, 5, 20);
    this.camera.lookAt(0, 2, 0);
    this.targetPosition.set(0, 5, 20);
    this.targetLookAt.set(0, 2, 0);
    this.currentLookAt.set(0, 2, 0);
    this.shakeIntensity = 0;
    this.zoomEffect = 0;
  }

  // Get current camera info for debugging
  getDebugInfo() {
    return {
      position: this.camera.position.clone(),
      lookAt: this.currentLookAt.clone(),
      followMode: this.followMode,
      playersTracked: this.players.length,
      shakeActive: this.shakeTime < this.shakeDuration,
      zoomActive: this.zoomTime < this.zoomDuration,
      aspectRatio: this.aspectRatio
    };
  }
}