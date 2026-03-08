// src/AI.js  (Objective C — Advanced Bot AI)
// AIController per-bot + AIManager singleton.
// States: ROAM → CHASE → ATTACK → FLEE
// Safe-zone aware: if outside shrinking zone, overrides everything and runs to centre.

import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────

const State = {
  ROAM:   'ROAM',
  CHASE:  'CHASE',
  ATTACK: 'ATTACK',
  FLEE:   'FLEE',
  DEAD:   'DEAD',
  SAFE:   'SAFE',   // Flee to safe zone
};

const MOVE_SPEED    = 5.0;   // units/s while chasing
const ROAM_SPEED    = 2.5;   // units/s while roaming
const ATTACK_RANGE  = 8.0;   // units  — switch to ATTACK
const CHASE_RANGE   = 18.0;  // units  — switch to CHASE
const FLEE_HEALTH   = 20;    // HP threshold to flee
const DECISION_INTERVAL = 0.5; // seconds between full state evaluations

// ── AIController ──────────────────────────────────────────────────────────────

/**
 * Controls one bot character.
 *
 * Consumes:
 *   botData.controller  → CharacterController (position, velocity, jump, setInputDirection)
 *   botData.anim        → AnimationStateMachine (play())
 *   botData.health      → number
 *   botData.dead        → boolean
 */
export class AIController {
  /**
   * @param {object} botData   One entry from MatchScene.players (the bot)
   * @param {number} botIndex
   */
  constructor(botData, botIndex) {
    this._bot   = botData;
    this._index = botIndex;
    this._state = State.ROAM;

    this._decisionTimer = Math.random() * DECISION_INTERVAL; // stagger decisions
    this._waypointIndex = 0;
    this._stuckTimer    = 0;
    this._lastPos       = new THREE.Vector3();
    this._target        = null; // THREE.Vector3 current movement goal
    this._attackCooldown = 0;

    console.log(`[AI] Bot ${botIndex} initialised`);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * @param {number} delta      Seconds since last frame
   * @param {object[]} allPlayers  Full players array from MatchScene
   * @param {import('./ArenaConfig.js').ArenaConfig} arenaConfig
   */
  update(delta, allPlayers, arenaConfig) {
    const bot = this._bot;
    if (bot.dead || bot.alive === false) {
      this._transition(State.DEAD);
      return;
    }

    this._attackCooldown = Math.max(0, this._attackCooldown - delta);

    // ── Safe-zone priority ─────────────────────────────────────────────────
    const pos = bot.controller?.position ?? bot.character?.position ?? new THREE.Vector3();
    const inZone = arenaConfig?.isInsideSafeZone(pos.x, pos.z) ?? true;
    if (!inZone) {
      this._transition(State.SAFE);
    }

    // ── Periodic full decision ─────────────────────────────────────────────
    this._decisionTimer -= delta;
    if (this._decisionTimer <= 0) {
      this._decisionTimer = DECISION_INTERVAL;
      if (this._state !== State.SAFE) {
        this._decide(allPlayers, arenaConfig);
      }
    }

    // ── Execute current state ─────────────────────────────────────────────
    switch (this._state) {
      case State.SAFE:   this._execSafe(delta, arenaConfig); break;
      case State.ROAM:   this._execRoam(delta, arenaConfig); break;
      case State.CHASE:  this._execChase(delta); break;
      case State.ATTACK: this._execAttack(delta); break;
      case State.FLEE:   this._execFlee(delta, arenaConfig); break;
    }

    // ── Stuck detection ───────────────────────────────────────────────────
    this._checkStuck(delta, pos, arenaConfig);
  }

  // ── Decision Logic ─────────────────────────────────────────────────────────

  _decide(allPlayers, arenaConfig) {
    const bot = this._bot;
    const pos = bot.controller?.position ?? bot.character?.position;
    if (!pos) return;

    // Flee if low health
    if (bot.health < FLEE_HEALTH) {
      this._transition(State.FLEE);
      return;
    }

    // Find nearest live enemy
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of allPlayers) {
      if (p === bot) continue;
      if (p.dead || p.alive === false) continue;
      const pPos = p.controller?.position ?? p.character?.position;
      if (!pPos) continue;
      const d = pos.distanceTo(pPos);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }

    if (!nearest) { this._transition(State.ROAM); return; }

    if (nearestDist <= ATTACK_RANGE) {
      this._target = nearest.controller?.position ?? nearest.character?.position;
      this._transition(State.ATTACK);
    } else if (nearestDist <= CHASE_RANGE) {
      this._target = nearest.controller?.position ?? nearest.character?.position;
      this._transition(State.CHASE);
    } else {
      this._transition(State.ROAM);
    }
  }

  // ── State Executors ────────────────────────────────────────────────────────

  _execSafe(delta, arenaConfig) {
    const { centerX, centerZ } = arenaConfig.safeZone;
    this._moveToward(new THREE.Vector3(centerX, 0, centerZ), MOVE_SPEED * 1.2, delta);
    this._playAnim('run');

    // Return to normal once back inside
    const pos = this._bot.controller?.position ?? this._bot.character?.position;
    if (pos && arenaConfig.isInsideSafeZone(pos.x, pos.z)) {
      this._transition(State.ROAM);
    }
  }

  _execRoam(delta, arenaConfig) {
    if (!this._target || this._arrivedAt(this._target, 2.5)) {
      this._pickNextWaypoint(arenaConfig);
    }
    if (this._target) {
      this._moveToward(this._target, ROAM_SPEED, delta);
      this._playAnim('run');
    } else {
      this._stop();
      this._playAnim('idle');
    }
  }

  _execChase(delta) {
    if (!this._target) { this._transition(State.ROAM); return; }
    this._moveToward(this._target, MOVE_SPEED, delta);
    this._playAnim('run');
  }

  _execAttack(delta) {
    if (!this._target) { this._transition(State.ROAM); return; }

    // Stop moving and face target
    this._stop();
    this._faceTarget(this._target);
    this._playAnim('attack');

    // Fire weapon
    if (this._attackCooldown <= 0 && this._bot.currentWeapon) {
      const dir = new THREE.Vector3();
      const pos  = this._bot.controller?.position ?? this._bot.character?.position ?? new THREE.Vector3();
      dir.subVectors(this._target, pos).setY(0).normalize();
      this._bot.currentWeapon.fire?.(null, dir); // scene not needed for bots
      this._attackCooldown = 0.8; // seconds between shots
    }
  }

  _execFlee(delta, arenaConfig) {
    const pos = this._bot.controller?.position ?? this._bot.character?.position;
    if (!pos) return;

    // Run toward safe-zone center
    const { centerX, centerZ } = arenaConfig?.safeZone ?? { centerX: 0, centerZ: 0 };
    this._moveToward(new THREE.Vector3(centerX, 0, centerZ), MOVE_SPEED, delta);
    this._playAnim('run');

    // Recover once health is reasonable (e.g. invulnerability wore off)
    if (this._bot.health > FLEE_HEALTH + 15) {
      this._transition(State.ROAM);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _transition(newState) {
    if (this._state === newState) return;
    console.log(`[AI] Bot ${this._index}: ${this._state} → ${newState}`);
    this._state = newState;
  }

  _moveToward(target, speed, delta) {
    const ctrl = this._bot.controller;
    if (!ctrl) return;

    const pos = ctrl.position;
    const dir = new THREE.Vector2(target.x - pos.x, target.z - pos.z);
    if (dir.length() < 0.1) return;
    dir.normalize();
    ctrl.setInputDirection(dir.x * speed / MOVE_SPEED, dir.y * speed / MOVE_SPEED);
  }

  _stop() {
    this._bot.controller?.setInputDirection(0, 0);
  }

  _faceTarget(target) {
    const ctrl = this._bot.controller;
    if (!ctrl) return;
    const pos = ctrl.position;
    const dx  = target.x - pos.x;
    const dz  = target.z - pos.z;
    ctrl.facingAngle = Math.atan2(dx, dz);
    if (this._bot.character) {
      this._bot.character.rotation.y = ctrl.facingAngle;
    }
  }

  _arrivedAt(target, threshold = 2) {
    const pos = this._bot.controller?.position ?? this._bot.character?.position;
    if (!pos || !target) return true;
    return pos.distanceTo(target) < threshold;
  }

  _pickNextWaypoint(arenaConfig) {
    if (!arenaConfig?.botWaypoints?.length) {
      this._target = null;
      return;
    }
    this._waypointIndex = (this._waypointIndex + 1) % arenaConfig.botWaypoints.length;
    const wp = arenaConfig.botWaypoints[this._waypointIndex];
    this._target = new THREE.Vector3(wp.x, 0, wp.z);
  }

  _checkStuck(delta, currentPos, arenaConfig) {
    if (!this._lastPos) { this._lastPos = currentPos.clone(); return; }
    const moved = currentPos.distanceTo(this._lastPos);
    if (moved < 0.05) {
      this._stuckTimer += delta;
      if (this._stuckTimer > 2) {
        // Jump to unstick
        this._bot.controller?.jump?.();
        // Pick a new waypoint
        this._pickNextWaypoint(arenaConfig);
        this._stuckTimer = 0;
      }
    } else {
      this._stuckTimer = 0;
    }
    this._lastPos.copy(currentPos);
  }

  _playAnim(name) {
    this._bot.anim?.play?.(name);
  }

  get state() { return this._state; }
}

// ── AIManager ─────────────────────────────────────────────────────────────────

export class AIManager {
  constructor() {
    this._controllers = [];
    console.log('[AIManager] Initialized');
  }

  /**
   * Register all bots from the players array.
   * @param {object[]} players  All player entries (human + bots)
   */
  registerBots(players) {
    this._controllers = [];
    for (let i = 0; i < players.length; i++) {
      if (players[i].isAI) {
        this._controllers.push(new AIController(players[i], i));
      }
    }
    console.log(`[AIManager] Registered ${this._controllers.length} bots`);
  }

  /**
   * Update all bots.
   * @param {number}   delta
   * @param {object[]} allPlayers
   * @param {import('./ArenaConfig.js').ArenaConfig} arenaConfig
   */
  update(delta, allPlayers, arenaConfig) {
    for (const ctrl of this._controllers) {
      ctrl.update(delta, allPlayers, arenaConfig);
    }
  }

  reset() {
    this._controllers = [];
  }
}
