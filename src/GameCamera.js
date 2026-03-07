// src/GameCamera.js  (Objective D — Third-Person + Spectate Camera)
// Modes:
//   THIRD_PERSON  — chase the human player from behind/above
//   SPECTATE      — after human dies, smoothly tracks the nearest surviving bot
//   ORBIT         — slow cinematic orbit (lobby / round-end)

import * as THREE from 'three';

const Mode = { THIRD_PERSON: 0, SPECTATE: 1, ORBIT: 2 };

// Tunable constants
const TP_DIST      = 8;    // horizontal follow distance
const TP_HEIGHT    = 5;    // vertical offset above target
const TP_LERP_POS  = 0.1;  // position smoothing (per-frame factor)
const TP_LERP_LOOK = 0.12; // look-target smoothing
const ORBIT_SPEED  = 0.004;
const ORBIT_RADIUS = 40;
const ORBIT_HEIGHT = 25;
const SPECTATE_TRANSITION = 1.5; // seconds for spectate cut

export class GameCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(camera) {
    this._cam    = camera;
    this._mode   = Mode.ORBIT;

    this._target      = null;  // current tracked Object3D / player
    this._lookAt      = new THREE.Vector3();
    this._orbitAngle  = 0;

    this._spectateTimer  = 0;
    this._spectateTarget = null;

    console.log('[GameCamera] Initialized');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Attach to the human player for third-person view. */
  followPlayer(playerData) {
    this._mode   = Mode.THIRD_PERSON;
    this._target = playerData;
    console.log('[GameCamera] → THIRD_PERSON');
  }

  /** Switch to spectating the given player (or auto-pick nearest survivor). */
  spectate(allPlayers, humanPlayerData) {
    this._mode  = Mode.SPECTATE;
    this._spectateTarget = this._pickSpectateTarget(allPlayers, humanPlayerData);
    this._spectateTimer  = 0;
    console.log('[GameCamera] → SPECTATE', this._spectateTarget);
  }

  /** Slow cinematic orbit around origin. */
  orbit() {
    this._mode   = Mode.ORBIT;
    this._target = null;
    console.log('[GameCamera] → ORBIT');
  }

  /**
   * @param {number}   delta
   * @param {object[]} allPlayers  Full players array (for spectate target refresh)
   */
  update(delta, allPlayers = []) {
    switch (this._mode) {
      case Mode.THIRD_PERSON: this._updateThirdPerson(delta); break;
      case Mode.SPECTATE:     this._updateSpectate(delta, allPlayers); break;
      case Mode.ORBIT:        this._updateOrbit(delta); break;
    }
  }

  // ── Third-Person ───────────────────────────────────────────────────────────

  _updateThirdPerson(delta) {
    const t = this._target;
    if (!t) return;

    const charPos = t.controller?.position ?? t.character?.position;
    if (!charPos) return;

    // Compute ideal camera position behind and above the character
    const facingAngle = t.controller?.facingAngle ?? 0;
    const behindX = charPos.x - Math.sin(facingAngle) * TP_DIST;
    const behindZ = charPos.z - Math.cos(facingAngle) * TP_DIST;
    const ideal   = new THREE.Vector3(behindX, charPos.y + TP_HEIGHT, behindZ);

    // Smooth follow
    this._cam.position.lerp(ideal, TP_LERP_POS);

    // Smooth look-at slightly above character
    const aimPoint = new THREE.Vector3(charPos.x, charPos.y + 1.5, charPos.z);
    this._lookAt.lerp(aimPoint, TP_LERP_LOOK);
    this._cam.lookAt(this._lookAt);
  }

  // ── Spectate ───────────────────────────────────────────────────────────────

  _updateSpectate(delta, allPlayers) {
    this._spectateTimer += delta;

    // Re-pick target if ours just died
    const t = this._spectateTarget;
    if (!t || t.dead || t.alive === false) {
      this._spectateTarget = this._pickSpectateTarget(allPlayers, null);
    }

    if (!this._spectateTarget) {
      // No survivors — orbit
      this._mode = Mode.ORBIT;
      return;
    }

    const charPos = this._spectateTarget.controller?.position
                 ?? this._spectateTarget.character?.position;
    if (!charPos) return;

    // Chase from slightly higher angle than third-person
    const angle = performance.now() * 0.0003;
    const ideal = new THREE.Vector3(
      charPos.x + Math.cos(angle) * (TP_DIST * 1.4),
      charPos.y + TP_HEIGHT * 1.3,
      charPos.z + Math.sin(angle) * (TP_DIST * 1.4)
    );

    const lerpSpeed = Math.min(1, this._spectateTimer / SPECTATE_TRANSITION);
    this._cam.position.lerp(ideal, TP_LERP_POS * (0.5 + lerpSpeed * 0.5));

    const aimPoint = new THREE.Vector3(charPos.x, charPos.y + 1.5, charPos.z);
    this._lookAt.lerp(aimPoint, TP_LERP_LOOK);
    this._cam.lookAt(this._lookAt);
  }

  _pickSpectateTarget(allPlayers, exclude) {
    const alive = allPlayers.filter(p => p !== exclude && !p.dead && p.alive !== false);
    if (!alive.length) return null;
    // Pick the one with the highest score (most interesting bot)
    alive.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return alive[0];
  }

  // ── Orbit ──────────────────────────────────────────────────────────────────

  _updateOrbit(delta) {
    this._orbitAngle += ORBIT_SPEED;
    this._cam.position.set(
      Math.cos(this._orbitAngle) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.sin(this._orbitAngle) * ORBIT_RADIUS
    );
    this._cam.lookAt(0, 1, 0);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get mode() {
    return Object.keys(Mode).find(k => Mode[k] === this._mode);
  }
}
