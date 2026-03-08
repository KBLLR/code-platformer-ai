/**
 * MatchScene — Battle royale match runtime.
 *
 * Replaces the GameViverse.initGameViverse() bootstrap.
 * Owns: arena compilation, player/bot spawning, match director lifecycle,
 * A2A event broadcasting, chase camera, and spectate-on-death.
 */
import * as THREE from "three";
import { validateArenaConfig, createDefaultArenaConfig } from "../interfaces/ArenaConfig.js";
import { createMatchStatusEvent, matchStatusToA2A } from "../interfaces/MatchStatusEvent.js";
import { A2AClient } from "../core-x/A2AClient.js";

// ─── Match Constants ───────────────────────────────────────────────
const BOT_COUNT = 11;
const PLAYER_COLORS = [
  0x00ff88, 0xff4466, 0x4488ff, 0xffaa00, 0xff00ff, 0x00ffff,
  0xff8800, 0x88ff00, 0xff0088, 0x0088ff, 0xaaff00, 0xff00aa,
];

export class MatchScene {
  constructor() {
    this.threeScene = null;
    this.camera = null;
    this.sceneManager = null;
    this.renderer = null;

    // Match state
    this.matchId = null;
    this.arenaConfig = null;
    this.players = [];
    this.humanPlayer = null;
    this.projectiles = [];
    this.phase = "warmup"; // warmup | active | final_zone | ended
    this.phaseTime = 0;
    this.matchTime = 0;
    this.safeZoneIndex = 0;
    this.currentSafeZone = null;
    this.winner = null;

    // Camera
    this._cameraOffset = new THREE.Vector3(0, 12, 18);
    this._cameraTarget = new THREE.Vector3();
    this._spectateTarget = null;

    // A2A
    this.a2a = null;

    // Input state
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };

    // HUD
    this.hudOverlay = null;

    this._disposed = false;
  }

  /**
   * Initialize the match scene.
   */
  async init(params) {
    this.sceneManager = params.sceneManager;
    this.renderer = params.renderer;
    this.arenaConfig = params.arenaConfig || createDefaultArenaConfig(42);
    this.matchId = crypto.randomUUID();

    // Validate config
    try {
      validateArenaConfig(this.arenaConfig);
    } catch (err) {
      console.warn("[MatchScene] Invalid ArenaConfig, using defaults:", err.message);
      this.arenaConfig = createDefaultArenaConfig(42);
    }

    // ─── Three.js Setup ──────────────────────────────────────
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x0a0a2e);
    this.threeScene.fog = new THREE.FogExp2(0x0a0a2e, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);

    // ─── Build Arena ─────────────────────────────────────────
    this._buildArena();

    // ─── Spawn Players ───────────────────────────────────────
    this._spawnPlayers();

    // ─── Safe Zone Visualization ─────────────────────────────
    this._initSafeZone();

    // ─── Input ───────────────────────────────────────────────
    this._bindInput();

    // ─── HUD ─────────────────────────────────────────────────
    this._createHUD();

    // ─── A2A Events ──────────────────────────────────────────
    this._initA2A();

    // ─── Start warmup ────────────────────────────────────────
    this.phase = "warmup";
    this.phaseTime = 0;
    this.matchTime = 0;

    console.log(`[MatchScene] Match ${this.matchId} initialized. ${this.players.length} players.`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Arena Construction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _buildArena() {
    const { bounds, terrainBands, coverClusters, lootPoints, lighting, sky } = this.arenaConfig;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(bounds.width, bounds.depth);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a3e,
      roughness: 0.85,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "arena-ground";
    this.threeScene.add(ground);

    // Terrain bands (elevated platforms)
    if (terrainBands) {
      for (const band of terrainBands) {
        const geo = new THREE.BoxGeometry(band.width, 0.5, band.width);
        const mat = new THREE.MeshStandardMaterial({
          color: band.material === "glow" ? 0x2244aa : band.material === "metal" ? 0x556677 : 0x333355,
          roughness: 0.6,
          metalness: band.material === "metal" ? 0.8 : 0.2,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = band.elevation;
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.threeScene.add(mesh);
      }
    }

    // Cover clusters
    if (coverClusters) {
      const coverGeos = {
        crate: new THREE.BoxGeometry(2, 2, 2),
        wall: new THREE.BoxGeometry(4, 3, 0.5),
        barrel: new THREE.CylinderGeometry(0.8, 0.8, 2, 8),
        rock: new THREE.DodecahedronGeometry(1.2, 0),
      };

      for (const cluster of coverClusters) {
        const geo = coverGeos[cluster.type] || coverGeos.crate;
        for (let i = 0; i < cluster.density; i++) {
          const angle = (i / cluster.density) * Math.PI * 2;
          const r = Math.random() * cluster.radius;
          const mat = new THREE.MeshStandardMaterial({
            color: 0x445566,
            roughness: 0.7,
            metalness: 0.3,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(
            cluster.center.x + Math.cos(angle) * r,
            1,
            cluster.center.z + Math.sin(angle) * r
          );
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.threeScene.add(mesh);
        }
      }
    }

    // Loot indicators
    if (lootPoints) {
      const lootGeo = new THREE.OctahedronGeometry(0.4, 0);
      const lootMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff8800,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8,
      });
      for (const lp of lootPoints) {
        const mesh = new THREE.Mesh(lootGeo, lootMat);
        mesh.position.set(lp.x, 1.5, lp.z);
        mesh.name = "loot-point";
        this.threeScene.add(mesh);
      }
    }

    // Lighting
    const ambient = new THREE.AmbientLight(
      new THREE.Color(lighting?.ambient || "#334466"),
      0.6
    );
    this.threeScene.add(ambient);

    const directional = new THREE.DirectionalLight(
      new THREE.Color(lighting?.directional || "#ffffff"),
      lighting?.intensity || 1.2
    );
    directional.position.set(30, 50, 30);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    directional.shadow.camera.left = -50;
    directional.shadow.camera.right = 50;
    directional.shadow.camera.top = 50;
    directional.shadow.camera.bottom = -50;
    this.threeScene.add(directional);

    // Arena boundary walls (visual)
    const wallHeight = 6;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x112244,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const hw = bounds.width / 2;
    const hd = bounds.depth / 2;
    const walls = [
      { pos: [0, wallHeight / 2, -hd], size: [bounds.width, wallHeight, 0.2] },
      { pos: [0, wallHeight / 2, hd], size: [bounds.width, wallHeight, 0.2] },
      { pos: [-hw, wallHeight / 2, 0], size: [0.2, wallHeight, bounds.depth] },
      { pos: [hw, wallHeight / 2, 0], size: [0.2, wallHeight, bounds.depth] },
    ];
    for (const w of walls) {
      const geo = new THREE.BoxGeometry(...w.size);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...w.pos);
      this.threeScene.add(mesh);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Player / Bot Spawning
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _spawnPlayers() {
    this.players = [];

    const spawns = this.arenaConfig.spawnPoints;
    const totalPlayers = 1 + BOT_COUNT;

    for (let i = 0; i < totalPlayers && i < spawns.length; i++) {
      const isHuman = i === 0;
      const sp = spawns[i];
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];

      // Player mesh — procedural cube (future: load from manifest GLBs)
      const bodyGeo = new THREE.BoxGeometry(1.2, 2, 1.2);
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.6,
        emissive: new THREE.Color(color).multiplyScalar(0.2),
      });
      const mesh = new THREE.Mesh(bodyGeo, bodyMat);
      mesh.position.set(sp.x, sp.y + 1, sp.z);
      mesh.castShadow = true;
      if (sp.rotation) mesh.rotation.y = sp.rotation;

      // Eye indicators
      const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.25, 0.5, -0.6);
      mesh.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.25, 0.5, -0.6);
      mesh.add(rightEye);

      this.threeScene.add(mesh);

      const player = {
        id: isHuman ? "human" : `bot-${i}`,
        index: i,
        isHuman,
        isAI: !isHuman,
        alive: true,
        health: 100,
        maxHealth: 100,
        mesh,
        velocity: new THREE.Vector3(),
        speed: isHuman ? 10 : 7 + Math.random() * 3,
        jumpForce: 8,
        grounded: true,
        spawn: { x: sp.x, y: sp.y, z: sp.z },
        // AI state
        aiTarget: null,
        aiDecisionTimer: 0,
        aiState: "roam", // roam | chase | flee | zone
      };

      this.players.push(player);
      if (isHuman) this.humanPlayer = player;
    }

    console.log(`[MatchScene] Spawned ${this.players.length} players (1 human + ${BOT_COUNT} bots).`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Safe Zone
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _initSafeZone() {
    const phases = this.arenaConfig.safeZonePhases;
    const firstPhase = phases[0];
    const maxRadius = this.arenaConfig.bounds.width / 2;

    this.currentSafeZone = {
      center: new THREE.Vector2(0, 0),
      radius: maxRadius,
      targetRadius: firstPhase.radius,
      damage: firstPhase.damage,
      shrinking: false,
    };

    // Visual ring
    this._safeZoneRing = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(maxRadius - 0.3, maxRadius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    this._safeZoneRing.add(ring);
    this.threeScene.add(this._safeZoneRing);

    this._zoneRingMesh = ring;
    this._zoneRingGeo = ringGeo;
    this._zoneRingMat = ringMat;
  }

  _updateSafeZone(dt) {
    const phases = this.arenaConfig.safeZonePhases;
    if (this.safeZoneIndex >= phases.length) return;

    const phase = phases[this.safeZoneIndex];
    const zone = this.currentSafeZone;

    if (!zone.shrinking) {
      // Waiting for delay
      this.phaseTime += dt;
      if (this.phaseTime >= phase.delay) {
        zone.shrinking = true;
        zone.targetRadius = phase.radius;
        zone.damage = phase.damage;
        this.phaseTime = 0;
      }
    } else {
      // Shrinking
      this.phaseTime += dt;
      const progress = Math.min(this.phaseTime / phase.duration, 1);
      const startRadius = this.safeZoneIndex === 0
        ? this.arenaConfig.bounds.width / 2
        : phases[this.safeZoneIndex - 1].radius;
      zone.radius = startRadius + (zone.targetRadius - startRadius) * progress;

      // Update visual
      if (this._zoneRingMesh) {
        this._zoneRingMesh.geometry.dispose();
        this._zoneRingMesh.geometry = new THREE.RingGeometry(
          Math.max(zone.radius - 0.3, 0.1), zone.radius, 64
        );
      }

      if (progress >= 1) {
        zone.shrinking = false;
        this.phaseTime = 0;
        this.safeZoneIndex++;

        if (this.safeZoneIndex >= phases.length) {
          this._setPhase("final_zone");
        }
      }
    }

    // Damage players outside zone
    for (const p of this.players) {
      if (!p.alive) continue;
      const dist = new THREE.Vector2(p.mesh.position.x, p.mesh.position.z)
        .distanceTo(zone.center);
      if (dist > zone.radius) {
        p.health -= zone.damage * dt;
        if (p.health <= 0) {
          this._eliminatePlayer(p, "zone");
        }
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Match Director
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _setPhase(newPhase) {
    if (this.phase === newPhase) return;
    this.phase = newPhase;
    console.log(`[MatchScene] Phase → ${newPhase}`);

    this._emitMatchStatus();
  }

  _eliminatePlayer(player, cause = "combat") {
    if (!player.alive) return;
    player.alive = false;
    player.mesh.visible = false;

    const alive = this.players.filter((p) => p.alive);
    console.log(`[MatchScene] ${player.id} eliminated (${cause}). ${alive.length} remain.`);

    // If human dies, switch to spectate
    if (player.isHuman) {
      const nearestBot = alive.find((p) => p.isAI);
      if (nearestBot) {
        this._spectateTarget = nearestBot;
      }
    }

    // Check win condition
    if (alive.length <= 1) {
      this.winner = alive[0] || null;
      this._setPhase("ended");
      this._showWinScreen();
    }
  }

  _checkWinCondition() {
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 && this.phase !== "ended") {
      this.winner = alive[0] || null;
      this._setPhase("ended");
      this._showWinScreen();
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI / Bot Logic
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _updateBots(dt) {
    for (const bot of this.players) {
      if (!bot.isAI || !bot.alive) continue;

      bot.aiDecisionTimer -= dt;
      if (bot.aiDecisionTimer <= 0) {
        bot.aiDecisionTimer = 0.5 + Math.random() * 1.0;
        this._makeBotDecision(bot);
      }

      this._executeBotMovement(bot, dt);
    }
  }

  _makeBotDecision(bot) {
    const zone = this.currentSafeZone;
    const botPos2D = new THREE.Vector2(bot.mesh.position.x, bot.mesh.position.z);
    const distToCenter = botPos2D.distanceTo(zone.center);

    // Priority 1: Get inside safe zone
    if (distToCenter > zone.radius * 0.8) {
      bot.aiState = "zone";
      bot.aiTarget = new THREE.Vector3(zone.center.x, bot.mesh.position.y, zone.center.y);
      return;
    }

    // Priority 2: Chase nearest enemy
    const alivePlayers = this.players.filter((p) => p.alive && p !== bot);
    if (alivePlayers.length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const p of alivePlayers) {
        const d = bot.mesh.position.distanceTo(p.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = p;
        }
      }

      if (nearest && nearestDist < 25) {
        bot.aiState = "chase";
        bot.aiTarget = nearest.mesh.position.clone();

        // Attack if close enough
        if (nearestDist < 5) {
          nearest.health -= 8 + Math.random() * 5;
          if (nearest.health <= 0) {
            this._eliminatePlayer(nearest, "combat");
          }
        }
        return;
      }
    }

    // Priority 3: Roam toward a random waypoint
    bot.aiState = "roam";
    const waypoints = this.arenaConfig.botWaypoints;
    if (waypoints && waypoints.length > 0) {
      const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
      bot.aiTarget = new THREE.Vector3(wp.x, bot.mesh.position.y, wp.z);
    }
  }

  _executeBotMovement(bot, dt) {
    if (!bot.aiTarget) return;

    const dir = new THREE.Vector3()
      .subVectors(bot.aiTarget, bot.mesh.position)
      .setY(0);

    if (dir.length() < 1) return; // Close enough

    dir.normalize();
    bot.mesh.position.addScaledVector(dir, bot.speed * dt);
    bot.mesh.lookAt(
      bot.mesh.position.x + dir.x,
      bot.mesh.position.y,
      bot.mesh.position.z + dir.z
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Human Input
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _bindInput() {
    this._onKeyDown = (e) => { this.keys[e.code] = true; };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    this._onMouseMove = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    this._onMouseDown = () => { this.mouse.down = true; };
    this._onMouseUp = () => { this.mouse.down = false; };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  _updateHumanPlayer(dt) {
    const p = this.humanPlayer;
    if (!p || !p.alive) return;

    const moveDir = new THREE.Vector3();
    const sprint = this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    const speed = p.speed * (sprint ? 1.5 : 1);

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) moveDir.z -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) moveDir.z += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) moveDir.x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) moveDir.x += 1;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      // Rotate movement relative to camera
      const camAngle = Math.atan2(
        this.camera.position.x - p.mesh.position.x,
        this.camera.position.z - p.mesh.position.z
      );
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
      p.mesh.position.addScaledVector(moveDir, speed * dt);

      // Face movement direction
      p.mesh.lookAt(
        p.mesh.position.x + moveDir.x,
        p.mesh.position.y,
        p.mesh.position.z + moveDir.z
      );
    }

    // Simple gravity
    if (p.mesh.position.y > 1) {
      p.velocity.y -= 20 * dt;
      p.mesh.position.y += p.velocity.y * dt;
      if (p.mesh.position.y <= 1) {
        p.mesh.position.y = 1;
        p.velocity.y = 0;
        p.grounded = true;
      }
    }

    // Jump
    if (this.keys["Space"] && p.grounded) {
      p.velocity.y = p.jumpForce;
      p.grounded = false;
    }

    // Attack (left click)
    if (this.mouse.down) {
      this._humanAttack(p);
    }

    // Clamp to arena bounds
    const hw = this.arenaConfig.bounds.width / 2;
    const hd = this.arenaConfig.bounds.depth / 2;
    p.mesh.position.x = Math.max(-hw, Math.min(hw, p.mesh.position.x));
    p.mesh.position.z = Math.max(-hd, Math.min(hd, p.mesh.position.z));
  }

  _humanAttack(player) {
    // Simple AoE attack — damage nearest enemy within range
    for (const enemy of this.players) {
      if (enemy === player || !enemy.alive) continue;
      const dist = player.mesh.position.distanceTo(enemy.mesh.position);
      if (dist < 5) {
        enemy.health -= 15;
        if (enemy.health <= 0) {
          this._eliminatePlayer(enemy, "combat");
        }
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Camera
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _updateCamera(dt) {
    const target = this._spectateTarget || this.humanPlayer;
    if (!target || !target.mesh) return;

    const targetPos = target.mesh.position;
    this._cameraTarget.lerp(targetPos, 5 * dt);

    this.camera.position.set(
      this._cameraTarget.x + this._cameraOffset.x,
      this._cameraTarget.y + this._cameraOffset.y,
      this._cameraTarget.z + this._cameraOffset.z
    );
    this.camera.lookAt(this._cameraTarget);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HUD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _createHUD() {
    this.hudOverlay = document.createElement("div");
    this.hudOverlay.id = "match-hud";
    this.hudOverlay.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0;
        z-index: 100; pointer-events: none;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        padding: 1rem 1.5rem;
        display: flex; justify-content: space-between; align-items: flex-start;
      ">
        <!-- Left: Player health -->
        <div id="hud-health" style="
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 0.6rem 1rem; min-width: 180px;
        ">
          <div style="color: rgba(255,255,255,0.5); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.3rem;">HEALTH</div>
          <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 8px; overflow: hidden;">
            <div id="hud-health-bar" style="height: 100%; background: linear-gradient(90deg, #00ff88, #00cc66); width: 100%; transition: width 0.3s;"></div>
          </div>
        </div>

        <!-- Center: Match info -->
        <div style="
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 0.6rem 1.5rem; text-align: center;
        ">
          <div id="hud-alive" style="color: #fff; font-size: 1.5rem; font-weight: 800;">12</div>
          <div style="color: rgba(255,255,255,0.4); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em;">ALIVE</div>
        </div>

        <!-- Right: Phase & time -->
        <div style="
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 0.6rem 1rem; text-align: right; min-width: 120px;
        ">
          <div id="hud-phase" style="color: #00aaff; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em;">WARMUP</div>
          <div id="hud-time" style="color: rgba(255,255,255,0.6); font-size: 0.85rem; margin-top: 0.2rem;">0:00</div>
        </div>
      </div>

      <!-- Spectating indicator -->
      <div id="hud-spectate" style="
        display: none; position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
        z-index: 100; pointer-events: none;
        background: rgba(0,0,0,0.7); border: 1px solid rgba(255,0,0,0.3);
        border-radius: 10px; padding: 0.5rem 1.5rem;
        color: rgba(255,255,255,0.6); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;
        font-family: 'Inter', 'Segoe UI', sans-serif;
      ">SPECTATING</div>
    `;
    document.body.appendChild(this.hudOverlay);
  }

  _updateHUD() {
    const alive = this.players.filter((p) => p.alive).length;

    const aliveEl = document.getElementById("hud-alive");
    if (aliveEl) aliveEl.textContent = alive;

    const phaseEl = document.getElementById("hud-phase");
    if (phaseEl) phaseEl.textContent = this.phase.toUpperCase().replace("_", " ");

    const timeEl = document.getElementById("hud-time");
    if (timeEl) {
      const mins = Math.floor(this.matchTime / 60);
      const secs = Math.floor(this.matchTime % 60);
      timeEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    if (this.humanPlayer) {
      const healthBar = document.getElementById("hud-health-bar");
      if (healthBar) {
        const pct = Math.max(0, (this.humanPlayer.health / this.humanPlayer.maxHealth) * 100);
        healthBar.style.width = `${pct}%`;
        if (pct < 30) healthBar.style.background = "linear-gradient(90deg, #ff4444, #ff2222)";
        else if (pct < 60) healthBar.style.background = "linear-gradient(90deg, #ffaa00, #ff8800)";
      }
    }

    const spectateEl = document.getElementById("hud-spectate");
    if (spectateEl) {
      spectateEl.style.display = (this._spectateTarget && !this.humanPlayer?.alive) ? "block" : "none";
    }
  }

  _showWinScreen() {
    const overlay = document.createElement("div");
    overlay.id = "win-screen";
    overlay.innerHTML = `
      <div style="
        position: fixed; inset: 0; z-index: 200;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.8);
        font-family: 'Inter', 'Segoe UI', sans-serif;
        animation: fade-in 0.5s ease-out;
      ">
        <h1 style="
          font-size: 3rem; font-weight: 900; margin-bottom: 0.5rem;
          color: ${this.winner?.isHuman ? "#00ff88" : "#ff4466"};
          text-shadow: 0 0 30px ${this.winner?.isHuman ? "rgba(0,255,136,0.5)" : "rgba(255,68,102,0.5)"};
        ">
          ${this.winner?.isHuman ? "VICTORY ROYALE!" : "DEFEATED"}
        </h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 1rem; margin-bottom: 2rem;">
          Winner: ${this.winner?.id || "none"}
        </p>
        <button id="btn-back-lobby" style="
          padding: 0.8rem 2.5rem; font-size: 1rem; font-weight: 600;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
          color: #fff; border-radius: 10px; cursor: pointer; pointer-events: auto;
          transition: background 0.2s;
        "
          onmouseenter="this.style.background='rgba(255,255,255,0.2)'"
          onmouseleave="this.style.background='rgba(255,255,255,0.1)'"
        >
          BACK TO LOBBY
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btn-back-lobby")?.addEventListener("click", () => {
      overlay.remove();
      this.sceneManager.switchTo("lobby");
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // A2A Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async _initA2A() {
    this.a2a = new A2AClient({ capabilities: ["gaming", "battle-royale"] });
    try {
      await this.a2a.connect();
      this.a2a.subscribe(["task.request", "council.directive", "health.ping"]);

      // Health ping handler
      this.a2a.on("health.ping", () => {
        this.a2a.send({ type: "health.pong", payload: { phase: this.phase } });
      });

      // Emit match started
      this._emitMatchStatus();

      // Emit arena generated
      this.a2a.send({
        type: "code-platformer-ai.arena.generated",
        payload: { match_id: this.matchId, seed: this.arenaConfig.seed, theme: this.arenaConfig.theme },
      });
    } catch (err) {
      console.warn("[MatchScene] A2A init failed (non-fatal):", err.message);
    }
  }

  _emitMatchStatus() {
    if (!this.a2a) return;
    const alive = this.players.filter((p) => p.alive);
    const event = createMatchStatusEvent({
      match_id: this.matchId,
      arena_id: `seed-${this.arenaConfig.seed}`,
      phase: this.phase,
      alive_count: alive.length,
      human_alive: this.humanPlayer?.alive ?? false,
      winner_id: this.winner?.id || null,
    });
    const a2aMsg = matchStatusToA2A(event);
    this.a2a.send(a2aMsg).catch(() => {});
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Main Update Loop
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  update(dt) {
    if (this._disposed || this.phase === "ended") return;

    this.matchTime += dt;

    // Warmup → active after 5 seconds
    if (this.phase === "warmup" && this.matchTime >= 5) {
      this._setPhase("active");
    }

    // Core updates
    if (this.phase !== "warmup") {
      this._updateSafeZone(dt);
    }

    this._updateHumanPlayer(dt);
    this._updateBots(dt);
    this._updateCamera(dt);
    this._checkWinCondition();
    this._updateHUD();

    // Rotate loot pickups
    this.threeScene.traverse((child) => {
      if (child.name === "loot-point") {
        child.rotation.y += dt * 2;
        child.position.y = 1.5 + Math.sin(Date.now() * 0.003) * 0.3;
      }
    });
  }

  onResize(w, h) {
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    this._disposed = true;

    // Remove input listeners
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);

    // Remove HUD
    this.hudOverlay?.remove();
    document.getElementById("win-screen")?.remove();

    // Disconnect A2A
    this.a2a?.disconnect();

    // Dispose Three.js
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
