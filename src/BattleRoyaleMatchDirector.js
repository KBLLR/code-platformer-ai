/**
 * BattleRoyaleMatchDirector — Standalone match lifecycle controller.
 *
 * Owns match phases, safe-zone shrink, elimination tracking,
 * loot distribution, bot roster, spectate flow, and winner declaration.
 * Emits MatchStatusEvents via a callback.
 *
 * Used by MatchScene but decoupled from Three.js rendering.
 */
import { createMatchStatusEvent, matchStatusToA2A } from "./interfaces/MatchStatusEvent.js";

/** @typedef {"warmup"|"active"|"final_zone"|"ended"} MatchPhase */

export class BattleRoyaleMatchDirector {
  /**
   * @param {object} opts
   * @param {import('./interfaces/ArenaConfig.js').ArenaConfig} opts.arenaConfig
   * @param {number} opts.warmupDuration - Seconds of warmup (default 5)
   * @param {(event: object) => void} [opts.onStatusChange] - Callback
   */
  constructor({ arenaConfig, warmupDuration = 5, onStatusChange = null }) {
    this.arenaConfig = arenaConfig;
    this.matchId = crypto.randomUUID();

    /** @type {MatchPhase} */
    this.phase = "warmup";
    this.warmupDuration = warmupDuration;
    this.matchTime = 0;
    this.phaseTime = 0;

    // Safe zone
    this.safeZoneIndex = 0;
    this.safeZone = {
      centerX: 0,
      centerZ: 0,
      radius: arenaConfig.bounds.width / 2,
      targetRadius: arenaConfig.safeZonePhases[0]?.radius ?? 20,
      damage: arenaConfig.safeZonePhases[0]?.damage ?? 2,
      shrinking: false,
    };

    // Players
    /** @type {Array<{ id: string, alive: boolean, isHuman: boolean, health: number }>} */
    this.roster = [];
    this.winner = null;

    this.onStatusChange = onStatusChange;
  }

  /**
   * Register a player in the match.
   * @param {{ id: string, isHuman: boolean }} player
   */
  addPlayer(player) {
    this.roster.push({
      id: player.id,
      alive: true,
      isHuman: player.isHuman,
      health: 100,
    });
  }

  /**
   * Tick the match director forward.
   * @param {number} dt - Delta time in seconds
   * @returns {{ eliminations: string[], phaseChanged: boolean, zoneUpdate: object|null }}
   */
  update(dt) {
    if (this.phase === "ended") return { eliminations: [], phaseChanged: false, zoneUpdate: null };

    this.matchTime += dt;
    const result = { eliminations: [], phaseChanged: false, zoneUpdate: null };

    // Warmup → active
    if (this.phase === "warmup" && this.matchTime >= this.warmupDuration) {
      this._setPhase("active");
      result.phaseChanged = true;
    }

    // Safe zone logic
    if (this.phase !== "warmup") {
      const zoneResult = this._tickSafeZone(dt);
      if (zoneResult) {
        result.zoneUpdate = zoneResult;
        if (zoneResult.phaseChanged) result.phaseChanged = true;
      }
    }

    // Win check
    const alive = this.roster.filter((p) => p.alive);
    if (alive.length <= 1 && this.phase !== "ended") {
      this.winner = alive[0] || null;
      this._setPhase("ended");
      result.phaseChanged = true;
    }

    return result;
  }

  /**
   * Eliminate a player.
   * @param {string} playerId
   * @param {string} cause
   */
  eliminate(playerId, cause = "combat") {
    const entry = this.roster.find((p) => p.id === playerId);
    if (!entry || !entry.alive) return;
    entry.alive = false;

    const alive = this.roster.filter((p) => p.alive);
    if (alive.length <= 1 && this.phase !== "ended") {
      this.winner = alive[0] || null;
      this._setPhase("ended");
    }
  }

  /**
   * Apply zone damage and check eliminations.
   * @param {string} playerId
   * @param {number} distFromCenter
   * @param {number} dt
   * @returns {number} damage dealt
   */
  applyZoneDamage(playerId, distFromCenter, dt) {
    if (distFromCenter <= this.safeZone.radius) return 0;
    const entry = this.roster.find((p) => p.id === playerId);
    if (!entry || !entry.alive) return 0;

    const dmg = this.safeZone.damage * dt;
    entry.health -= dmg;
    if (entry.health <= 0) {
      this.eliminate(playerId, "zone");
    }
    return dmg;
  }

  /** @returns {{ centerX: number, centerZ: number, radius: number, damage: number }} */
  getSafeZone() {
    return { ...this.safeZone };
  }

  /** @returns {number} */
  getAliveCount() {
    return this.roster.filter((p) => p.alive).length;
  }

  /** @returns {boolean} */
  isHumanAlive() {
    return this.roster.some((p) => p.isHuman && p.alive);
  }

  // ─── Internal ──────────────────────────────────────────────────

  _tickSafeZone(dt) {
    const phases = this.arenaConfig.safeZonePhases;
    if (this.safeZoneIndex >= phases.length) return null;

    const phase = phases[this.safeZoneIndex];
    const zone = this.safeZone;

    if (!zone.shrinking) {
      this.phaseTime += dt;
      if (this.phaseTime >= phase.delay) {
        zone.shrinking = true;
        zone.targetRadius = phase.radius;
        zone.damage = phase.damage;
        this.phaseTime = 0;
      }
      return null;
    }

    this.phaseTime += dt;
    const progress = Math.min(this.phaseTime / phase.duration, 1);
    const startRadius = this.safeZoneIndex === 0
      ? this.arenaConfig.bounds.width / 2
      : phases[this.safeZoneIndex - 1].radius;
    zone.radius = startRadius + (zone.targetRadius - startRadius) * progress;

    let phaseChanged = false;
    if (progress >= 1) {
      zone.shrinking = false;
      this.phaseTime = 0;
      this.safeZoneIndex++;

      if (this.safeZoneIndex >= phases.length) {
        this._setPhase("final_zone");
        phaseChanged = true;
      }
    }

    return { radius: zone.radius, phaseChanged };
  }

  /** @param {MatchPhase} newPhase */
  _setPhase(newPhase) {
    if (this.phase === newPhase) return;
    this.phase = newPhase;

    if (this.onStatusChange) {
      const event = createMatchStatusEvent({
        match_id: this.matchId,
        arena_id: `seed-${this.arenaConfig.seed}`,
        phase: this.phase,
        alive_count: this.getAliveCount(),
        human_alive: this.isHumanAlive(),
        winner_id: this.winner?.id || null,
      });
      this.onStatusChange(matchStatusToA2A(event));
    }
  }
}
