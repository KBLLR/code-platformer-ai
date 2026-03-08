// src/MatchScene.js
// Core 12-player Battle Royale loop.
// Orchestrates: arena, characters, human player, AI bots, camera, safe-zone, HUD, A2A.

import * as THREE from 'three';
import { StageGenerator }        from './StageGenerator.js';
import { loadManifest, loadCharacter } from './CharacterLoader.js';
import { CharacterController }   from './CharacterController.js';
import { createHumanPlayer, updateHumanPlayer, applyDamage, killPlayer } from './Player.js';
import { AIManager }             from './AI.js';
import { GameCamera }            from './GameCamera.js';
import { ModernGameHUD }         from './ui/ModernGameHUD.js';
import { A2AClient }             from './A2AClient.js';
import { MatchStatusEvent }      from './MatchStatusEvent.js';

const NUM_PLAYERS = 12;   // 1 human + 11 bots
const PROJECTILE_DAMAGE_ARROW  = 25;
const PROJECTILE_DAMAGE_BULLET = 15;
const SAFE_ZONE_TICK = 0.5; // seconds between out-of-zone damage ticks

export class MatchScene {
  /**
   * @param {import('./ArenaConfig.js').ArenaConfig} arenaConfig
   */
  constructor(arenaConfig) {
    this.name       = 'MatchScene';
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x87ceeb);
    this.threeScene.fog        = new THREE.FogExp2(0x87ceeb, 0.003);

    this._config   = arenaConfig;
    this._players  = [];  // all player data objects
    this._human    = null;
    this._aiMgr    = new AIManager();
    this._gameCamera = null;
    this._hud      = null;
    this._a2a      = new A2AClient();

    this._safeRing = null;
    this._matchTime = 0;
    this._zoneTickTimer = 0;
    this._matchEnded = false;

    this._projectiles = []; // { mesh, velocity, shooter }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async enter(sm) {
    this._sm = sm;
    console.log('[MatchScene] Entering…');

    // Arena geometry
    const { safeZoneRing, spawnMarkers } = await StageGenerator.generate(
      this._config, this.threeScene
    );
    this._safeRing    = safeZoneRing;
    this._spawnMarkers = spawnMarkers;

    // Dim spawn markers after 3 s
    setTimeout(() => spawnMarkers.forEach(m => { m.visible = false; }), 3000);

    // Load characters
    await this._spawnPlayers(sm.renderer);

    // Camera
    this._gameCamera = new GameCamera(sm.camera);
    this._gameCamera.followPlayer(this._human);

    // HUD
    this._hud = new ModernGameHUD('game-hud');
    this._hud.initialize(this._players);

    // AI
    this._aiMgr.registerBots(this._players);

    // Publish A2A start event
    this._a2a.publish(MatchStatusEvent.started(this._config));

    console.log('[MatchScene] Ready — match started');
  }

  exit() {
    this._a2a.close();
    if (this._hud) this._hud.hide();
    console.log('[MatchScene] Exited');
  }

  // ── Spawn ──────────────────────────────────────────────────────────────────

  async _spawnPlayers(renderer) {
    const manifest = await loadManifest();
    const chars    = manifest.characters;

    for (let i = 0; i < NUM_PLAYERS; i++) {
      const spawn  = this._config.spawnPoints[i] ?? { x: 0, z: 0, rotation: 0 };
      const entry  = chars[i % chars.length];
      const isHuman = i === 0;

      let charData;
      try {
        charData = await loadCharacter(entry, this.threeScene);
      } catch (e) {
        charData = this._makeFallback(i, this.threeScene);
      }

      charData.root.position.set(spawn.x, 0, spawn.z);
      charData.root.rotation.y = spawn.rotation ?? 0;

      if (isHuman) {
        const p = createHumanPlayer(charData, { spawnX: spawn.x, spawnZ: spawn.z }, this.threeScene);
        p.player_number = 0;
        this._human = p;
        this._players.push(p);
      } else {
        const ctrl = new CharacterController(charData.root, null, i);
        ctrl.moveSpeed = 4.5;
        const p = {
          player_number: i,
          isAI:    true,
          isHuman: false,
          character:   charData.root,
          mesh:        charData.root,
          controller:  ctrl,
          mixer:       charData.mixer,
          anim:        charData.anim,
          weaponSocket: charData.weaponSocket,
          health:     100,
          maxHealth:  100,
          currentWeapon: null,
          invulnerable: false,
          invulTimer:   0,
          alive: true,
          dead:  false,
          hasMoney: false,
          score: 0,
        };
        this._players.push(p);
      }
    }

    console.log(`[MatchScene] Spawned ${NUM_PLAYERS} players`);
  }

  _makeFallback(index, scene) {
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0xa855f7, 0xec4899,
                    0x14b8a6, 0xf97316, 0x84cc16, 0x6366f1, 0xeab308, 0x06b6d4];
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: colors[index % colors.length] })
    );
    mesh.castShadow = true;
    const root = new THREE.Group();
    root.add(mesh);
    scene.add(root);
    return { root, mixer: new THREE.AnimationMixer(root), anim: null, weaponSocket: root, clips: new Map() };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(delta, sm) {
    if (this._matchEnded) return;
    this._matchTime += delta;

    // Human player
    if (this._human && !this._human.dead) {
      updateHumanPlayer(this._human, delta, this.threeScene);
    } else if (this._human?.dead && this._gameCamera?.mode !== 'SPECTATE') {
      this._gameCamera.spectate(this._players, this._human);
      this._a2a.publish(MatchStatusEvent.playerDied(0, true, null));
    }

    // Bot animation mixers
    for (const p of this._players) {
      if (p.isAI && !p.dead && p.mixer) {
        const vel = p.controller?.velocity;
        const moving = vel && (Math.abs(vel.x) + Math.abs(vel.z) > 0.3);
        p.anim?.play(moving ? 'run' : 'idle');
        p.mixer.update(delta);
        p.controller?.update(delta);
      }
    }

    // AI
    this._aiMgr.update(delta, this._players, this._config);

    // Safe zone
    this._tickSafeZone(delta);

    // Camera
    this._gameCamera?.update(delta, this._players);

    // Projectiles
    this._updateProjectiles(delta);

    // HUD
    this._hud?.update(this._players);

    // Safe-zone ring visual
    if (this._safeRing) {
      StageGenerator.updateSafeZone(this._safeRing, this._config);
    }

    // Win check
    this._checkWin();
  }

  // ── Safe Zone ──────────────────────────────────────────────────────────────

  _tickSafeZone(delta) {
    const sz   = this._config.safeZone;
    const phase = this._config.safeZonePhases[sz.phaseIndex];
    if (!phase) return;

    sz.phaseTimer += delta;

    if (sz.phaseTimer >= phase.durationSeconds && !sz.shrinking) {
      sz.shrinking = true;
      console.log(`[MatchScene] Safe zone phase ${sz.phaseIndex + 1} shrinking`);
      this._a2a.publish(MatchStatusEvent.phaseChanged(sz.phaseIndex + 1, sz.currentRadius));
    }

    if (sz.shrinking) {
      const nextPhase = this._config.safeZonePhases[sz.phaseIndex + 1];
      const targetR   = nextPhase?.radius ?? 0;
      sz.currentRadius = THREE.MathUtils.lerp(sz.currentRadius, targetR, delta * 0.02);

      if (sz.currentRadius - targetR < 0.5) {
        sz.currentRadius = targetR;
        sz.shrinking     = false;
        sz.phaseTimer    = 0;
        sz.phaseIndex    = Math.min(sz.phaseIndex + 1, this._config.safeZonePhases.length - 1);
        if (nextPhase) {
          sz.centerX = nextPhase.centerX;
          sz.centerZ = nextPhase.centerZ;
        }
      }
    }

    // Out-of-zone damage tick
    this._zoneTickTimer += delta;
    if (this._zoneTickTimer >= SAFE_ZONE_TICK) {
      this._zoneTickTimer = 0;
      for (const p of this._players) {
        if (p.dead) continue;
        const pos = p.controller?.position ?? p.character?.position;
        if (pos && !this._config.isInsideSafeZone(pos.x, pos.z)) {
          applyDamage(p, phase.damagePerSecond * SAFE_ZONE_TICK, (dead) => this._onPlayerDied(dead));
        }
      }
    }
  }

  // ── Projectiles ────────────────────────────────────────────────────────────

  _updateProjectiles(delta) {
    const gravity = new THREE.Vector3(0, -18, 0);

    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];

      proj.mesh.position.addScaledVector(proj.velocity, delta);
      proj.velocity.addScaledVector(gravity, delta * 0.3);
      proj.life -= delta;

      if (proj.life <= 0 || this._outOfBounds(proj.mesh.position)) {
        this.threeScene.remove(proj.mesh);
        this._projectiles.splice(i, 1);
        continue;
      }

      // Hit detection
      for (const p of this._players) {
        if (p === proj.shooter || p.dead || p.invulnerable) continue;
        const pPos = p.controller?.position ?? p.character?.position;
        if (!pPos) continue;
        if (proj.mesh.position.distanceTo(pPos) < 0.9) {
          applyDamage(p, proj.damage, (dead) => this._onPlayerDied(dead));
          this.threeScene.remove(proj.mesh);
          this._projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _outOfBounds(pos) {
    const s = this._config.size * 1.5;
    return Math.abs(pos.x) > s || Math.abs(pos.z) > s || pos.y < -10;
  }

  // ── Player death ───────────────────────────────────────────────────────────

  _onPlayerDied(p) {
    this._a2a.publish(
      MatchStatusEvent.playerDied(p.player_number, p.isHuman, null)
    );
    const alive = this._players.filter(x => !x.dead);
    this._a2a.publish(MatchStatusEvent.aliveCount(alive.length, NUM_PLAYERS));
    console.log(`[MatchScene] Player ${p.player_number} died. Alive: ${alive.length}`);
  }

  // ── Win condition ──────────────────────────────────────────────────────────

  _checkWin() {
    const alive = this._players.filter(p => !p.dead);
    if (alive.length <= 1) {
      const winner = alive[0] ?? null;
      this._matchEnded = true;

      this._a2a.publish(MatchStatusEvent.completed(
        winner?.player_number ?? -1,
        this._players.map(p => p.score ?? 0),
        Math.round(this._matchTime)
      ));

      if (winner) {
        this._a2a.publish(MatchStatusEvent.playerWon(winner.player_number, winner.isHuman, winner.score));
      }

      this._hud?.showWinner(winner?.player_number ?? -1);
      console.log(`[MatchScene] Match ended. Winner: P${winner?.player_number ?? 'none'}`);
    }
  }
}
