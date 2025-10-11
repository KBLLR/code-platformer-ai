// src/Player.js
import * as THREE from "three";
import { LoaderManager } from "./LoaderManager.js";
import { game_config } from "./game_config.js";
import { Bow } from "./weapons/bow.js";
import { Shotgun } from "./weapons/shotgun.js";
import { Vec3DUtils, clamp, lerp } from "./utils/MathUtils.js";
import { Level } from "./Level.js";

export const players = [];

export async function loadPlayers(scene, numPlayers = 4, loader = null) {
  console.log(`[Player.js] Loading ${numPlayers} players.`);
  loader = loader || new LoaderManager();
  await loader.loadManifest();
  console.log("[Player.js] Player LoaderManager manifest loaded.");

  const playerMetas = loader.manifest.models.filter((m) =>
    m.tags.includes("player"),
  );

  players.length = 0; // clear existing players

  for (let i = 0; i < numPlayers; i++) {
    let playerObj;
    // Distribute players along X-axis
    let spawnX = -5 + i * 3.5;
    let spawnY = 1;
    let mesh = null;

    try {
      const modelMeta = playerMetas[i];
      if (modelMeta) {
        console.log(
          `[Player.js] Attempting to load GLB for player ${i + 1}: ${modelMeta.file}`,
        );
        const gltfScene = await loader.loadGLB(modelMeta.file);
        mesh = gltfScene;
        mesh.position.set(spawnX, spawnY, 0);
        mesh.scale.set(1.4, 1.4, 1.4);
        mesh.traverse((child) => {
          if (child.isMesh) child.castShadow = true;
        });
        scene.add(mesh);
        console.log(`[Player.js] Player ${i + 1} GLB model added to scene.`);
      } else {
        throw new Error(`No GLB model found for player index ${i}`);
      }
    } catch (err) {
      console.warn(
        `[Player.js] Could not load player model for player ${i + 1}, using fallback cube. Error:`,
        err,
      );
      const colors = [0xff0000, 0x00aaff, 0x00ff55, 0xffe000];
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: colors[i % 4] }),
      );
      mesh.position.set(spawnX, spawnY, 0);
      mesh.castShadow = true;
      scene.add(mesh);
      console.log(`[Player.js] Player ${i + 1} fallback cube added to scene.`);
    }

    playerObj = makePlayer(mesh, i, scene);
    players.push(playerObj);
    console.log(
      `[Player.js] Player ${i + 1} object created and pushed to global array.`,
    );
  }
}

function makePlayer(mesh, idx = 0, scene) {
  const player = {
    // Basic properties
    mesh: mesh,
    player_number: idx,
    health: game_config.player_hp || 100,
    maxHealth: game_config.player_hp || 100,
    score: 0,
    money: 0,
    
    // Physics properties
    velocity: new THREE.Vector3(0, 0, 0),
    isJumping: false,
    jumpVelocity: 0,
    velocityX: 0, // Keep for backwards compatibility
    velocityY: 0, // Keep for backwards compatibility
    grounded: true,
    wasGrounded: true,
    
    // Movement properties
    moveDir: new THREE.Vector3(1, 0, 0),
    facingDirection: 1, // 1 for right, -1 for left
    lastGroundedTime: 0,
    coyoteTime: 150, // ms of grace period for jumping after leaving ground
    jumpBufferTimer: 0,
    jumpBufferTime: 100,
    
    // Combat properties
    currentWeapon: null,
    invulnerable: false,
    invulnerabilityTime: 0,
    
    // Input handling
    lastJumpPressed: false,
    lastAttackPressed: false,
    
    // Game state
    dead: false,
    justGotMoney: false,
    justWon: false,
    justEliminated: false,
    hasMoney: false,
    wasCarryingMoney: false,
    
    // Visual effects
    hurtTimer: 0,
    originalMaterial: null,
    
    // Enhanced movement properties
    acceleration: 0.4,
    maxSpeed: game_config.player_move_vel || 8,
    friction: 0.85,
    airControl: 0.3, // Reduced control in air
    
    // Collision properties
    boundingBox: new THREE.Box3(),
    collisionRadius: 0.4,
    groundCheckDistance: 0.1,

    equipWeapon: function(weaponInstance) {
      if (this.currentWeapon && this.currentWeapon.mesh) {
        this.currentWeapon.mesh.removeFromParent();
        console.log(
          `[Player ${this.player_number + 1}] Unequipped old weapon.`,
        );
      }
      this.currentWeapon = weaponInstance;
      if (weaponInstance) {
        weaponInstance.player = this;
        if (weaponInstance.ensureMesh) {
          weaponInstance
            .ensureMesh(scene) // ensureMesh is async
            .then(() => {
              console.log(
                `[Player ${this.player_number + 1}] Equipped new weapon: ${weaponInstance.constructor.name}.`,
              );
            })
            .catch((err) =>
              console.error(
                `[Player ${this.player_number + 1}] Failed to equip weapon mesh:`,
                err,
              ),
            );
        } else {
          console.log(
            `[Player ${this.player_number + 1}] Equipped new weapon: ${weaponInstance.constructor.name}.`,
          );
        }
      }
    },

    // Enhanced movement methods
    moveLeft: function() {
      if (this.dead) return;
      
      const moveAccel = (game_config.player_move_vel || 8) * 0.4;
      const maxSpeed = game_config.player_move_vel || 8;
      
      this.velocity.x = Math.max(this.velocity.x - moveAccel, -maxSpeed);
      this.velocityX = this.velocity.x; // Keep for compatibility
      this.moveDir.set(-1, 0, 0);
      this.facingDirection = -1;
      
      // Rotate mesh to face left
      if (this.mesh.rotation) {
        this.mesh.rotation.y = Math.PI;
      }
    },

    moveRight: function() {
      if (this.dead) return;
      
      const moveAccel = (game_config.player_move_vel || 8) * 0.4;
      const maxSpeed = game_config.player_move_vel || 8;
      
      this.velocity.x = Math.min(this.velocity.x + moveAccel, maxSpeed);
      this.velocityX = this.velocity.x; // Keep for compatibility
      this.moveDir.set(1, 0, 0);
      this.facingDirection = 1;
      
      // Rotate mesh to face right
      if (this.mesh.rotation) {
        this.mesh.rotation.y = 0;
      }
    },

    jump: function() {
      const now = performance.now();
      const canCoyoteJump = (now - this.lastGroundedTime) < this.coyoteTime;
      
      if ((this.grounded || canCoyoteJump) && !this.dead) {
        this.jumpVelocity = (game_config.player_jump_height || 2.2) * 8;
        this.velocity.y = this.jumpVelocity;
        this.isJumping = true;
        this.grounded = false;
        this.jumpBufferTimer = 0; // Clear jump buffer
        
        console.log(`[Player ${this.player_number + 1}] Jump initiated.`);
        return true; // Successful jump
      } else {
        // Buffer the jump input
        this.jumpBufferTimer = now;
        return false;
      }
    },

    attack: async function(scene) {
      if (this.currentWeapon && !this.dead) {
        console.log(
          `[Player ${this.player_number + 1}] Attacking with ${this.currentWeapon.constructor.name}.`,
        );
        
        const aimDir = this.moveDir.clone().normalize();
        const recoil = await this.currentWeapon.fire(scene, aimDir);
        if (recoil && recoil.length() > 0) {
          // Apply recoil to velocity instead of direct position
          this.velocity.add(recoil.multiplyScalar(-0.1));
          console.log(
            `[Player ${this.player_number + 1}] Applied recoil to velocity:`,
            recoil,
          );
        }
        
        return true;
      } else {
        if (!this.dead) {
          console.log(
            `[Player ${this.player_number + 1}] has no weapon to attack with!`,
          );
        }
        return false;
      }
    },

    // Take damage with invulnerability frames
    takeDamage: function(amount, source = null) {
      if (this.dead || this.invulnerable) return false;
      
      this.health = Math.max(0, this.health - amount);
      console.log(`[Player ${this.player_number + 1}] took ${amount} damage. Health: ${this.health}/${this.maxHealth}`);
      
      // Add invulnerability frames
      this.invulnerable = true;
      this.invulnerabilityTime = 1000; // 1 second
      this.hurtTimer = 200; // Visual hurt effect
      
      // Visual hurt effect
      if (this.mesh.material && !this.originalMaterial) {
        this.originalMaterial = this.mesh.material.clone();
      }
      
      if (this.health <= 0) {
        this.die();
        return true; // Player died
      }
      
      return false; // Player survived
    },

    // Player death
    die: function() {
      if (this.dead) return;
      
      console.log(`[Player ${this.player_number + 1}] has been eliminated!`);
      this.dead = true;
      this.justEliminated = true;
      
      // Drop money if carrying
      if (this.hasMoney) {
        this.dropMoney();
      }
      
      // Visual death effect
      if (this.mesh.material) {
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = 0.3;
      }
      
      // Schedule respawn
      setTimeout(() => {
        this.respawn();
      }, game_config.respawn_time || 5000);
    },

    // Respawn player
    respawn: function() {
      this.health = this.maxHealth;
      this.dead = false;
      this.justEliminated = false;
      this.invulnerable = false;
      this.invulnerabilityTime = 0;
      
      // Reset position
      const spawnX = -5 + this.player_number * 3.5;
      this.mesh.position.set(spawnX, 1, 0);
      this.velocity.set(0, 0, 0);
      this.grounded = true;
      
      // Reset visual
      if (this.mesh.material) {
        if (this.originalMaterial) {
          this.mesh.material = this.originalMaterial.clone();
        }
        this.mesh.material.transparent = false;
        this.mesh.material.opacity = 1.0;
      }
      
      console.log(`[Player ${this.player_number + 1}] respawned!`);
    },

    // Money system
    getMoney: function() {
      this.hasMoney = true;
      this.justGotMoney = true;
      this.money += 1000; // Or whatever amount
      console.log(`[Player ${this.player_number + 1}] got money! Total: ${this.money}`);
      
      // Check win condition
      if (this.money >= (game_config.win || 10000)) {
        this.win();
      }
    },

    dropMoney: function() {
      if (this.hasMoney) {
        this.hasMoney = false;
        this.wasCarryingMoney = false;
        console.log(`[Player ${this.player_number + 1}] dropped money!`);
        // TODO: Create money pickup in world
      }
    },

    win: function() {
      this.justWon = true;
      console.log(`[Player ${this.player_number + 1}] WON THE GAME!`);
      // Could trigger win screen or effects here
    },

    // Ground collision with level tile detection
    checkGroundCollision: function() {
      if (!Level.ActiveLevel || !Level.ActiveLevel.scene) {
        // Fallback to simple ground level
        const groundLevel = 1;
        if (this.mesh.position.y <= groundLevel && this.velocity.y <= 0) {
          this.mesh.position.y = groundLevel;
          this.velocity.y = 0;
          this.jumpVelocity = 0;
          this.isJumping = false;
          this.grounded = true;
        }
        return;
      }
      
      const wasGrounded = this.grounded;
      const playerPos = this.mesh.position;
      
      // Cast multiple rays downward for better detection
      const rayOrigins = [
        new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z), // Center
        new THREE.Vector3(playerPos.x - 0.3, playerPos.y, playerPos.z), // Left
        new THREE.Vector3(playerPos.x + 0.3, playerPos.y, playerPos.z), // Right
      ];
      
      let groundFound = false;
      let highestGroundY = -Infinity;
      
      for (const rayOrigin of rayOrigins) {
        const rayDirection = new THREE.Vector3(0, -1, 0);
        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        raycaster.far = 5; // Limit ray distance
        
        // Get all tile objects in the scene
        const tileObjects = [];
        Level.ActiveLevel.scene.traverse((child) => {
          if (child.isMesh && child.userData.isTile) {
            tileObjects.push(child);
          }
        });
        
        // Check for intersections
        const intersections = raycaster.intersectObjects(tileObjects);
        
        if (intersections.length > 0) {
          const hit = intersections[0];
          const groundY = hit.point.y + 1; // Stand on top of tile
          
          if (groundY > highestGroundY) {
            highestGroundY = groundY;
            groundFound = true;
          }
        }
      }
      
      if (groundFound && this.velocity.y <= 0) {
        // Player should land on ground
        if (playerPos.y <= highestGroundY + 0.2) {
          this.mesh.position.y = highestGroundY;
          this.velocity.y = 0;
          this.jumpVelocity = 0;
          this.isJumping = false;
          
          if (!wasGrounded) {
            this.grounded = true;
            this.lastGroundedTime = performance.now();
            
            // Check for buffered jump
            const now = performance.now();
            if (this.jumpBufferTimer > 0 && (now - this.jumpBufferTimer) < this.jumpBufferTime) {
              this.jump();
            }
            
            console.log(`[Player ${this.player_number + 1}] landed on tile at y: ${highestGroundY}`);
          }
        }
      } else {
        // No ground detected below, but use fallback if too low
        if (playerPos.y < -5) {
          // Teleport back to spawn if player falls too far
          const spawnX = -5 + this.player_number * 3.5;
          this.mesh.position.set(spawnX, 10, 0); // Spawn higher
          this.velocity.set(0, 0, 0);
          this.grounded = false;
          console.log(`[Player ${this.player_number + 1}] respawned after falling`);
        } else if (this.grounded && playerPos.y > highestGroundY + 1) {
          // Player left ground
          this.grounded = false;
          this.lastGroundedTime = performance.now();
        }
      }
    },

    update: function(deltaTime) {
      if (this.dead) return;
      
      const deltaMs = deltaTime * 1000;
      const gravity = (game_config.gravity || 35) * 0.02;
      
      // Update timers
      if (this.invulnerabilityTime > 0) {
        this.invulnerabilityTime -= deltaMs;
        if (this.invulnerabilityTime <= 0) {
          this.invulnerable = false;
        }
      }
      
      if (this.hurtTimer > 0) {
        this.hurtTimer -= deltaMs;
        // Flash effect during hurt
        if (this.mesh.material && this.originalMaterial) {
          this.mesh.material.opacity = Math.sin(this.hurtTimer * 0.05) * 0.5 + 0.5;
        }
      } else if (this.originalMaterial && this.mesh.material.opacity !== 1) {
        this.mesh.material.opacity = 1;
      }
      
      // Apply gravity
      if (!this.grounded) {
        this.velocity.y -= gravity * deltaTime * 30; // Reduced gravity force
        this.jumpVelocity = this.velocity.y; // Keep for compatibility
      }
      
      // Apply friction
      const friction = this.grounded ? 0.85 : 0.98; // Adjusted friction
      this.velocity.x *= Math.pow(friction, deltaTime * 60);
      
      // Clamp velocities to prevent flying away
      this.velocity.x = clamp(this.velocity.x, -8, 8);
      this.velocity.y = clamp(this.velocity.y, -15, 15);
      
      // Update legacy velocity values
      this.velocityX = this.velocity.x;
      this.velocityY = this.velocity.y;
      
      // Apply velocity to position
      this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
      
      // Check ground collision
      this.checkGroundCollision();
      
      // Keep player within level bounds
      this.mesh.position.x = clamp(this.mesh.position.x, -25, 25);
      this.mesh.position.y = Math.max(this.mesh.position.y, 1);
      
      // Update weapon
      if (this.currentWeapon) {
        this.currentWeapon.update({ getViewDir: () => this.moveDir });
      }
      
      // Reset one-time flags at end of frame
      this.justGotMoney = false;
      this.justWon = false;
      this.justEliminated = false;
    }
  };

  // Initialize player's original material reference
  if (player.mesh.material) {
    player.originalMaterial = player.mesh.material.clone();
  }
  
  // Give players an initial weapon for testing
  const weaponPos = player.mesh.position.clone();
  console.log(`[Player.js] Creating weapon for player ${idx + 1} at position:`, weaponPos);
  
  if (idx % 2 === 0) {
    const bow = new Bow(weaponPos);
    player.equipWeapon(bow);
    console.log(`[Player ${idx + 1}] Equipped new weapon: Bow.`);
  } else {
    const shotgun = new Shotgun(weaponPos);
    player.equipWeapon(shotgun);
    console.log(`[Player ${idx + 1}] Equipped new weapon: Shotgun.`);
  }

  return player;
}