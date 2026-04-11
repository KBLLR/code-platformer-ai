const GRAVITY = -34;
const PLAYER_WIDTH = 1.1;
const PLAYER_HEIGHT = 2.2;
const RESPAWN_TIME = 2.25;
const ATTACK_COOLDOWN = 0.52;
const ATTACK_WINDOW = 0.14;
const PICKUP_RESPAWN = 6;
const MAX_FRAME_DELTA = 1 / 24;
const ITEM_TYPES = [
  "movement-boost",
  "temporary-shield",
  "bomb-throwable",
  "shell-projectile",
  "spring-trap",
];
const ONE_SHOT_STATES = new Set(["jump_start", "land", "attack", "stomp", "pickup", "throw", "ringout"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sign(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function rectsOverlap(a, b) {
  return (
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function fighterRoleWeight(fighter) {
  return fighter.movementProfile.weight * fighter.knockbackProfile.launchResistance;
}

function loopAnimationStateFor(player) {
  if (!player.alive) return "idle";
  if (!player.onGround) {
    return "fall";
  }
  return Math.abs(player.vx) > 1.15 ? "run" : "idle";
}

function buildRoster(mode, fighters, selectedFighterId) {
  const ordered = [...fighters];
  const humanFighter = ordered.find((fighter) => fighter.id === selectedFighterId) ?? ordered[0];
  const botPool = ordered.filter((fighter) => fighter.id !== humanFighter.id);
  while (botPool.length < 3) {
    botPool.push(ordered[botPool.length % ordered.length]);
  }

  const participants = [
    { fighter: humanFighter, isHuman: true, teamId: mode.id === "tdm" ? "sun" : humanFighter.id },
    { fighter: botPool[0], isHuman: false, teamId: mode.id === "tdm" ? "sun" : botPool[0].id },
    { fighter: botPool[1], isHuman: false, teamId: mode.id === "tdm" ? "moon" : botPool[1].id },
    { fighter: botPool[2], isHuman: false, teamId: mode.id === "tdm" ? "moon" : botPool[2].id },
  ];

  return participants.map((entry, index) => ({
    playerId: `fighter-${index + 1}`,
    fighterId: entry.fighter.id,
    fighter: entry.fighter,
    displayName: entry.fighter.displayName,
    isHuman: entry.isHuman,
    teamId: entry.teamId,
  }));
}

function createPlayer(slot, spawn, index, mode) {
  return {
    ...slot,
    x: spawn.x,
    y: spawn.y,
    z: (index - 1.5) * 0.45,
    vx: 0,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    onGround: false,
    jumpsRemaining: 1,
    facing: slot.isHuman ? 1 : -1,
    damage: 0,
    shieldTimer: 0,
    boostTimer: 0,
    invulnTimer: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTargets: new Set(),
    heldItem: null,
    respawnTimer: 0,
    alive: true,
    removed: false,
    lastHitBy: null,
    lastHitTimer: 0,
    score: 0,
    ringOuts: 0,
    deaths: 0,
    survivalLives: mode.id === "survival" ? 1 : null,
    botJumpLock: 0,
    animationState: "idle",
    loopAnimationState: "idle",
    animationNonce: 0,
    jumpStartTimer: 0,
    landTimer: 0,
    actionAnimTimer: 0,
    actionAnimState: null,
    ringoutTimer: 0,
  };
}

function randomItemType() {
  return ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
}

function createPickup(spawn, index) {
  return {
    pickupId: `pickup-${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    width: 0.8,
    height: 0.8,
    type: spawn.type ?? randomItemType(),
    available: true,
    respawnTimer: 0,
  };
}

export class ToyboxMatch {
  constructor({ mode, stage, fighters, config }) {
    this.mode = mode;
    this.stage = stage;
    this.config = config;
    this.players = [];
    this.projectiles = [];
    this.traps = [];
    this.pickups = stage.itemSpawns.map((spawn, index) => createPickup(spawn, index));
    this.elapsed = 0;
    this.paused = false;
    this.finished = false;
    this.result = null;
    this.hazardFloor = stage.hazardFloor;
    this.teamScores = { sun: 0, moon: 0 };
    this.spawnCursor = 0;

    const roster = buildRoster(mode, fighters, config.selectedFighterId);
    this.players = roster.map((slot, index) => createPlayer(slot, stage.spawnPoints[index], index, mode));
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
  }

  get human() {
    return this.players.find((player) => player.isHuman);
  }

  update(delta, input) {
    if (this.paused || this.finished) return;

    const dt = Math.min(delta, MAX_FRAME_DELTA);
    this.elapsed += dt;

    this._updateModeHazard(dt);
    this._updatePickups(dt);
    this._updateProjectiles(dt);
    this._updateTraps(dt);

    for (const player of this.players) {
      this._tickPlayerTimers(player, dt);

      if (player.removed) continue;
      if (!player.alive) {
        this._tickRespawn(player, dt);
        continue;
      }

      const controls = player.isHuman ? input : this._computeBotControls(player);
      this._handlePlayerActions(player, controls, dt);
      this._integratePlayer(player, dt);
      this._collectPickup(player);
      this._checkRingOut(player);
    }

    this._resolvePlayerCombat();
    this._resolveStomps();
    this._checkWinConditions();
  }

  _tickPlayerTimers(player, dt) {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    player.shieldTimer = Math.max(0, player.shieldTimer - dt);
    player.boostTimer = Math.max(0, player.boostTimer - dt);
    player.lastHitTimer = Math.max(0, player.lastHitTimer - dt);
    player.botJumpLock = Math.max(0, player.botJumpLock - dt);
    player.jumpStartTimer = Math.max(0, player.jumpStartTimer - dt);
    player.landTimer = Math.max(0, player.landTimer - dt);
    player.actionAnimTimer = Math.max(0, player.actionAnimTimer - dt);
    player.ringoutTimer = Math.max(0, player.ringoutTimer - dt);
    if (player.attackTimer === 0) {
      player.attackTargets.clear();
    }
    if (player.actionAnimTimer === 0) {
      player.actionAnimState = null;
    }
  }

  _tickRespawn(player, dt) {
    if (this.mode.id === "survival") return;
    player.respawnTimer = Math.max(0, player.respawnTimer - dt);
    if (player.respawnTimer > 0) return;

    const spawn = this.stage.spawnPoints[this.spawnCursor % this.stage.spawnPoints.length];
    this.spawnCursor += 1;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.damage = 0;
    player.heldItem = null;
    player.alive = true;
    player.invulnTimer = 1.15;
    player.jumpsRemaining = 1;
    player.onGround = false;
    player.animationState = "idle";
    player.loopAnimationState = "idle";
  }

  _updateModeHazard(dt) {
    const baseRise = this.stage.id === "hazard" ? 0.1 : 0.04;
    const riseRate = this.mode.id === "survival" ? baseRise * 2.8 : baseRise;
    this.hazardFloor += riseRate * dt;
  }

  _updatePickups(dt) {
    for (const pickup of this.pickups) {
      if (pickup.available) continue;
      pickup.respawnTimer = Math.max(0, pickup.respawnTimer - dt);
      if (pickup.respawnTimer === 0) {
        pickup.available = true;
        pickup.type = randomItemType();
      }
    }
  }

  _updateProjectiles(dt) {
    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (projectile.gravity) {
        projectile.vy += GRAVITY * 0.65 * dt;
      }

      const hitTarget = this.players.find((player) => (
        player.alive &&
        player.playerId !== projectile.ownerId &&
        !this._sameTeam(player, projectile.teamId) &&
        rectsOverlap(
          { x: projectile.x, y: projectile.y, width: projectile.radius * 2, height: projectile.radius * 2 },
          player,
        )
      ));

      if (hitTarget) {
        this._applyHit({
          attackerId: projectile.ownerId,
          teamId: projectile.teamId,
          target: hitTarget,
          horizontal: sign(projectile.vx) || 1,
          power: projectile.power,
          lift: projectile.lift,
        });
        return false;
      }

      if (projectile.type === "bomb-throwable" && projectile.life <= 0) {
        this._explodeBomb(projectile);
        return false;
      }

      if (projectile.x < this.stage.blastZone.left - 2 || projectile.x > this.stage.blastZone.right + 2) return false;
      if (projectile.y < this.stage.blastZone.bottom - 2 || projectile.y > this.stage.blastZone.top + 2) return false;
      if (projectile.life <= 0) return false;
      return true;
    });
  }

  _explodeBomb(projectile) {
    for (const player of this.players) {
      if (!player.alive || this._sameTeam(player, projectile.teamId)) continue;
      const dist = distance2D(projectile, player);
      if (dist > 2.8) continue;
      const horizontal = sign(player.x - projectile.x) || 1;
      this._applyHit({
        attackerId: projectile.ownerId,
        teamId: projectile.teamId,
        target: player,
        horizontal,
        power: 17 - dist * 2.2,
        lift: 15,
      });
    }
  }

  _updateTraps(dt) {
    this.traps = this.traps.filter((trap) => {
      trap.life -= dt;
      if (trap.life <= 0) return false;
      for (const player of this.players) {
        if (!player.alive || player.playerId === trap.ownerId || this._sameTeam(player, trap.teamId)) continue;
        const overlaps = rectsOverlap(
          { x: trap.x, y: trap.y, width: trap.width, height: trap.height },
          player,
        );
        if (!overlaps) continue;
        this._applyHit({
          attackerId: trap.ownerId,
          teamId: trap.teamId,
          target: player,
          horizontal: sign(player.x - trap.x) || 1,
          power: 14,
          lift: 18,
        });
        return false;
      }
      return true;
    });
  }

  _handlePlayerActions(player, controls, dt) {
    const profile = player.fighter.movementProfile;
    const speedBonus = player.boostTimer > 0 ? 1.25 : 1;
    const maxRun = profile.runSpeed * speedBonus;
    const accel = profile.acceleration * speedBonus;
    const airAccel = profile.airAcceleration * speedBonus;
    const desiredX = clamp(controls.moveX ?? 0, -1, 1);

    if (desiredX !== 0) {
      player.facing = sign(desiredX);
      const targetSpeed = maxRun * desiredX;
      const useAccel = player.onGround ? accel : airAccel;
      player.vx += clamp(targetSpeed - player.vx, -useAccel * dt, useAccel * dt);
    } else if (player.onGround) {
      player.vx *= 0.82;
      if (Math.abs(player.vx) < 0.12) player.vx = 0;
    } else {
      player.vx *= 0.992;
    }

    if (controls.jumpPressed) {
      if (player.onGround) {
        player.vy = profile.jumpVelocity;
        player.onGround = false;
        player.jumpsRemaining = 1;
        this._triggerAnimation(player, "jump_start", 0.2);
      } else if (player.jumpsRemaining > 0) {
        player.vy = profile.doubleJumpVelocity;
        player.jumpsRemaining -= 1;
        this._triggerAnimation(player, "jump_start", 0.2);
      }
    }

    if (controls.attackPressed && player.attackCooldown === 0) {
      player.attackTimer = ATTACK_WINDOW;
      player.attackCooldown = ATTACK_COOLDOWN;
      player.attackTargets.clear();
      this._triggerAnimation(player, "attack", 0.22);
    }

    if (controls.itemPressed && player.heldItem) {
      this._useItem(player);
    }

    player.vy += GRAVITY * dt;
  }

  _integratePlayer(player, dt) {
    const previous = { x: player.x, y: player.y };
    const wasGrounded = player.onGround;
    player.x += player.vx * dt;

    for (const platform of this.stage.platforms) {
      const halfWidth = platform.width / 2;
      const left = platform.x - halfWidth;
      const right = platform.x + halfWidth;
      const top = platform.y + platform.height / 2;
      const bottom = platform.y - platform.height / 2;
      const intersectsY = player.y < top && player.y + player.height > bottom;
      if (!intersectsY) continue;
      if (player.x + player.width / 2 > left && player.x - player.width / 2 < left && player.vx > 0) {
        player.x = left - player.width / 2;
        player.vx = 0;
      }
      if (player.x - player.width / 2 < right && player.x + player.width / 2 > right && player.vx < 0) {
        player.x = right + player.width / 2;
        player.vx = 0;
      }
    }

    player.y += player.vy * dt;
    player.onGround = false;

    for (const platform of this.stage.platforms) {
      const halfWidth = platform.width / 2;
      const left = platform.x - halfWidth;
      const right = platform.x + halfWidth;
      const top = platform.y + platform.height / 2;
      const bottom = platform.y - platform.height / 2;
      const horizontallyInside = player.x + player.width / 2 > left && player.x - player.width / 2 < right;
      if (!horizontallyInside) continue;

      const wasAbove = previous.y >= top;
      const isCrossingTop = player.y <= top && player.y + player.height > top && player.vy <= 0;
      if (wasAbove && isCrossingTop) {
        player.y = top;
        player.vy = 0;
        player.onGround = true;
        player.jumpsRemaining = 1;
        if (!wasGrounded) {
          this._triggerAnimation(player, "land", 0.16);
        }
        continue;
      }

      const wasBelow = previous.y + player.height <= bottom;
      const isCrossingBottom = player.y + player.height >= bottom && player.y < bottom && player.vy > 0;
      if (wasBelow && isCrossingBottom) {
        player.y = bottom - player.height;
        player.vy = 0;
      }
    }
  }

  _collectPickup(player) {
    if (!player.alive || player.heldItem) return;
    const pickup = this.pickups.find((entry) => (
      entry.available &&
      rectsOverlap(entry, player)
    ));
    if (!pickup) return;
    player.heldItem = pickup.type;
    pickup.available = false;
    pickup.respawnTimer = PICKUP_RESPAWN;
    this._triggerAnimation(player, "pickup", 0.2);
  }

  _checkRingOut(player) {
    if (
      player.x < this.stage.blastZone.left ||
      player.x > this.stage.blastZone.right ||
      player.y < this.stage.blastZone.bottom ||
      player.y > this.stage.blastZone.top ||
      player.y < this.hazardFloor
    ) {
      this._handleRingOut(player);
    }
  }

  _resolvePlayerCombat() {
    for (const attacker of this.players) {
      if (!attacker.alive || attacker.attackTimer <= 0) continue;
      for (const target of this.players) {
        if (!target.alive || target.playerId === attacker.playerId) continue;
        if (this._sameTeam(target, attacker.teamId)) continue;
        if (attacker.attackTargets.has(target.playerId)) continue;
        const dx = target.x - attacker.x;
        const dy = Math.abs((target.y + target.height * 0.5) - (attacker.y + attacker.height * 0.5));
        if (sign(dx) !== attacker.facing) continue;
        if (Math.abs(dx) > 1.9 || dy > 1.4) continue;
        attacker.attackTargets.add(target.playerId);
        this._applyHit({
          attackerId: attacker.playerId,
          teamId: attacker.teamId,
          target,
          horizontal: attacker.facing,
          power: attacker.fighter.knockbackProfile.baseAttack,
          lift: 9,
        });
      }
    }
  }

  _resolveStomps() {
    for (const stomper of this.players) {
      if (!stomper.alive || stomper.vy >= -6) continue;
      for (const target of this.players) {
        if (!target.alive || target.playerId === stomper.playerId) continue;
        if (this._sameTeam(target, stomper.teamId)) continue;
        const overlapX = Math.abs(stomper.x - target.x) <= 0.75;
        const isAbove = stomper.y > target.y + target.height * 0.55;
        if (!overlapX || !isAbove) continue;
        stomper.vy = Math.max(stomper.vy * -0.45, 8.5);
        this._triggerAnimation(stomper, "stomp", 0.18);
        this._applyHit({
          attackerId: stomper.playerId,
          teamId: stomper.teamId,
          target,
          horizontal: sign(target.x - stomper.x) || stomper.facing,
          power: stomper.fighter.knockbackProfile.stompAttack,
          lift: 14,
        });
      }
    }
  }

  _applyHit({ attackerId, teamId, target, horizontal, power, lift }) {
    if (target.invulnTimer > 0) return;
    const shieldFactor = target.shieldTimer > 0 ? 0.58 : 1;
    const launchScale = 1 + target.damage * 0.018;
    const resistance = fighterRoleWeight(target.fighter);
    target.damage = Math.min(220, target.damage + power * 0.8 * shieldFactor);
    target.vx += (horizontal || 1) * (power * launchScale * shieldFactor) / resistance;
    target.vy = Math.max(target.vy, (lift * launchScale * shieldFactor) / resistance);
    target.lastHitBy = attackerId;
    target.lastHitTimer = 4;
  }

  _handleRingOut(player) {
    if (!player.alive) return;
    player.alive = false;
    player.deaths += 1;
    player.heldItem = null;
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player.ringoutTimer = 0.72;
    this._triggerAnimation(player, "ringout", 0.72);

    const killer = player.lastHitTimer > 0
      ? this.players.find((entry) => entry.playerId === player.lastHitBy)
      : null;

    if (killer && killer.playerId !== player.playerId) {
      killer.ringOuts += 1;
      killer.score += 1;
      if (this.mode.id === "tdm") {
        this.teamScores[killer.teamId] = (this.teamScores[killer.teamId] ?? 0) + 1;
      }
    }

    if (this.mode.id === "survival") {
      player.removed = true;
      return;
    }

    player.respawnTimer = RESPAWN_TIME;
  }

  _useItem(player) {
    const type = player.heldItem;
    player.heldItem = null;
    this._triggerAnimation(player, "throw", 0.24);

    if (type === "movement-boost") {
      player.boostTimer = 5;
      return;
    }

    if (type === "temporary-shield") {
      player.shieldTimer = 5;
      return;
    }

    if (type === "bomb-throwable") {
      this.projectiles.push({
        ownerId: player.playerId,
        teamId: player.teamId,
        type,
        x: player.x + player.facing * 0.8,
        y: player.y + 1.4,
        vx: player.facing * 9,
        vy: 10,
        power: 16,
        lift: 12,
        radius: 0.65,
        gravity: true,
        life: 1.3,
      });
      return;
    }

    if (type === "shell-projectile") {
      this.projectiles.push({
        ownerId: player.playerId,
        teamId: player.teamId,
        type,
        x: player.x + player.facing * 1.1,
        y: player.y + 0.3,
        vx: player.facing * 15,
        vy: 0,
        power: 13,
        lift: 5,
        radius: 0.55,
        gravity: false,
        life: 2.6,
      });
      return;
    }

    if (type === "spring-trap") {
      this.traps.push({
        ownerId: player.playerId,
        teamId: player.teamId,
        x: player.x + player.facing * 1.1,
        y: player.y,
        width: 0.9,
        height: 0.6,
        life: 7,
      });
    }
  }

  _computeBotControls(player) {
    const enemies = this.players.filter((entry) => (
      entry.alive &&
      entry.playerId !== player.playerId &&
      !this._sameTeam(entry, player.teamId)
    ));
    const pickups = this.pickups.filter((pickup) => pickup.available);
    const sortedEnemies = [...enemies].sort((a, b) => distance2D(a, player) - distance2D(b, player));
    const sortedPickups = [...pickups].sort((a, b) => distance2D(a, player) - distance2D(b, player));
    const target = sortedEnemies[0] ?? null;
    const desiredPickup = sortedPickups[0] ?? null;
    const role = player.fighter.itemAffinity;
    const lowDamage = player.damage < 52;

    const controls = {
      moveX: 0,
      jumpPressed: false,
      attackPressed: false,
      itemPressed: false,
    };

    const recoveryThreshold = this.stage.blastZone.left + 3;
    const needRecover =
      player.x < recoveryThreshold ||
      player.x > this.stage.blastZone.right - 3 ||
      player.y < this.hazardFloor + 4;

    if (needRecover) {
      controls.moveX = sign(0 - player.x);
      if ((player.onGround || player.jumpsRemaining > 0) && player.botJumpLock === 0) {
        controls.jumpPressed = true;
        player.botJumpLock = role === "recovery" ? 0.22 : 0.35;
      }
      return controls;
    }

    if (
      !player.heldItem &&
      desiredPickup &&
      (distance2D(player, desiredPickup) < 8.5 || role === "trickster" || role === "hazard-control")
    ) {
      controls.moveX = sign(desiredPickup.x - player.x);
      if (desiredPickup.y > player.y + 1.5 && (player.onGround || player.jumpsRemaining > 0) && player.botJumpLock === 0) {
        controls.jumpPressed = true;
        player.botJumpLock = role === "recovery" ? 0.24 : 0.42;
      }
      return controls;
    }

    if (target) {
      controls.moveX = sign(target.x - player.x);
      const verticalGap = target.y - player.y;
      if (
        (verticalGap > 2 || (role === "recovery" && verticalGap > 1.2)) &&
        (player.onGround || player.jumpsRemaining > 0) &&
        player.botJumpLock === 0
      ) {
        controls.jumpPressed = true;
        player.botJumpLock = role === "recovery" ? 0.24 : 0.4;
      }

      const attackRange = role === "hazard-control" ? 2.2 : 1.8;
      if (Math.abs(target.x - player.x) < attackRange && Math.abs(target.y - player.y) < 1.8 && player.attackCooldown === 0) {
        controls.attackPressed = true;
      }

      if (player.heldItem && Math.abs(target.x - player.x) < 7 && Math.abs(target.y - player.y) < 4) {
        if (role === "trickster" || role === "hazard-control" || !lowDamage || Math.random() > 0.55) {
          controls.itemPressed = true;
        }
      }

      if (!player.heldItem && lowDamage && desiredPickup && Math.abs(desiredPickup.x - player.x) < 4.5) {
        controls.moveX = sign(desiredPickup.x - player.x);
      }
    }

    return controls;
  }

  _triggerAnimation(player, state, duration) {
    if (!ONE_SHOT_STATES.has(state)) return;
    if (state === "jump_start") {
      player.jumpStartTimer = Math.max(player.jumpStartTimer, duration);
    } else if (state === "land") {
      player.landTimer = Math.max(player.landTimer, duration);
    } else if (state === "ringout") {
      player.ringoutTimer = Math.max(player.ringoutTimer, duration);
    } else {
      player.actionAnimState = state;
      player.actionAnimTimer = Math.max(player.actionAnimTimer, duration);
    }
    player.animationNonce += 1;
  }

  _resolveAnimationState(player) {
    player.loopAnimationState = loopAnimationStateFor(player);
    if (player.ringoutTimer > 0) return "ringout";
    if (player.actionAnimTimer > 0 && player.actionAnimState) return player.actionAnimState;
    if (player.landTimer > 0) return "land";
    if (player.jumpStartTimer > 0) return "jump_start";
    return player.loopAnimationState;
  }

  _sameTeam(player, teamId) {
    return this.mode.id === "tdm" && player.teamId === teamId;
  }

  _checkWinConditions() {
    if (this.finished) return;

    if (this.mode.id === "tdm") {
      if (this.teamScores.sun >= this.mode.scoreLimit || this.teamScores.moon >= this.mode.scoreLimit) {
        const winner = this.teamScores.sun > this.teamScores.moon ? "Sun Team" : "Moon Team";
        this.finished = true;
        this.result = {
          winnerLabel: winner,
          summary: `${this.teamScores.sun} - ${this.teamScores.moon}`,
          humanRingOuts: this.human?.ringOuts ?? 0,
          completedSurvival: false,
        };
      }
      return;
    }

    if (this.mode.id === "ffa") {
      const leader = [...this.players].sort((a, b) => b.score - a.score)[0];
      if (leader && leader.score >= this.mode.scoreLimit) {
        this.finished = true;
        this.result = {
          winnerLabel: leader.displayName,
          summary: `${leader.score} ring-outs`,
          humanRingOuts: this.human?.ringOuts ?? 0,
          completedSurvival: false,
        };
      }
      return;
    }

    const survivors = this.players.filter((player) => player.alive && !player.removed);
    if (survivors.length <= 1) {
      const winner = survivors[0]?.displayName ?? "No One";
      this.finished = true;
      this.result = {
        winnerLabel: winner,
        summary: `${survivors.length === 1 ? "Last fighter standing" : "Hazard wipeout"}`,
        humanRingOuts: this.human?.ringOuts ?? 0,
        completedSurvival: true,
      };
    }
  }

  createSnapshot() {
    return {
      mode: this.mode,
      stage: this.stage,
      players: this.players.map((player) => ({
        playerId: player.playerId,
        fighterId: player.fighterId,
        displayName: player.displayName,
        isHuman: player.isHuman,
        teamId: player.teamId,
        x: player.x,
        y: player.y,
        z: player.z,
        vx: player.vx,
        vy: player.vy,
        width: player.width,
        height: player.height,
        alive: player.alive,
        removed: player.removed,
        onGround: player.onGround,
        facing: player.facing,
        damage: player.damage,
        heldItem: player.heldItem,
        boostTimer: player.boostTimer,
        shieldTimer: player.shieldTimer,
        respawnTimer: player.respawnTimer,
        score: player.score,
        ringOuts: player.ringOuts,
        fighter: player.fighter,
        animationState: this._resolveAnimationState(player),
        loopAnimationState: player.loopAnimationState,
        animationNonce: player.animationNonce,
      })),
      pickups: this.pickups.map((pickup) => ({ ...pickup })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      traps: this.traps.map((trap) => ({ ...trap })),
      hazardFloor: this.hazardFloor,
      elapsed: this.elapsed,
      paused: this.paused,
      finished: this.finished,
      result: this.result,
      teamScores: { ...this.teamScores },
      aliveCount: this.players.filter((player) => player.alive && !player.removed).length,
    };
  }
}
