// src/Player.js  (Objective D — Battle-Royale Human Player)
// Die is permanent (no respawn). Wires keyboard/mouse input to AnimationMixer.
// Exports the global `players` array used by MatchScene and legacy systems.

import * as THREE from 'three';
import { game_config } from './game_config.js';
import { CharacterController } from './CharacterController.js';

export const players = [];

// ── Input state ───────────────────────────────────────────────────────────────

const _keys = {
  w: false, a: false, s: false, d: false,
  space: false,
  f: false,
  arrowup: false, arrowleft: false, arrowdown: false, arrowright: false,
};

let _inputAttached = false;

function _attachInput() {
  if (_inputAttached) return;
  _inputAttached = true;

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in _keys) { _keys[k] = true; if (k === ' ') e.preventDefault(); }
    // edge: space stored under 'space'
    if (k === ' ') _keys.space = true;
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in _keys) _keys[k] = false;
    if (k === ' ') _keys.space = false;
  });
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create the human player object from a loaded character.
 * @param {object} charData  Returned by CharacterLoader.loadCharacter()
 * @param {object} [opts]
 * @param {number} [opts.spawnX=0]
 * @param {number} [opts.spawnZ=0]
 * @param {THREE.Scene} scene
 * @returns {object} playerData
 */
export function createHumanPlayer(charData, { spawnX = 0, spawnZ = 0 } = {}, scene) {
  _attachInput();

  const { root, mixer, anim, weaponSocket } = charData;
  root.position.set(spawnX, 0, spawnZ);

  const controller = new CharacterController(root, null, 0);
  controller.moveSpeed = game_config.player_move_vel ?? 6;
  controller.jumpForce = (game_config.player_jump_height ?? 2.2) * 4;

  const playerData = {
    // Identity
    player_number: 0,
    isAI:    false,
    isHuman: true,

    // Three.js refs
    character: root,
    mesh:      root,
    controller,
    mixer,
    anim,
    weaponSocket,

    // Combat
    health:        game_config.player_hp ?? 100,
    maxHealth:     game_config.player_hp ?? 100,
    currentWeapon: null,
    invulnerable:  false,
    invulTimer:    0,

    // State
    alive:         true,
    dead:          false,
    hasMoney:      false,
    score:         0,

    // Input edge detection
    _prevJump:   false,
    _prevAttack: false,
  };

  players[0] = playerData;
  console.log(`[Player] Human player created at (${spawnX}, ${spawnZ})`);
  return playerData;
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the human player each frame.
 * @param {object} p     playerData
 * @param {number} delta seconds
 * @param {THREE.Scene} scene
 */
export function updateHumanPlayer(p, delta, scene) {
  if (!p || p.dead) return;

  // ── Timers ────────────────────────────────────────────────────────────────
  if (p.invulnerable) {
    p.invulTimer -= delta;
    if (p.invulTimer <= 0) p.invulnerable = false;
  }

  // ── Movement input ────────────────────────────────────────────────────────
  let ix = 0, iz = 0;
  if (_keys.w || _keys.arrowup)    iz -= 1;
  if (_keys.s || _keys.arrowdown)  iz += 1;
  if (_keys.a || _keys.arrowleft)  ix -= 1;
  if (_keys.d || _keys.arrowright) ix += 1;
  p.controller.setInputDirection(ix, iz);

  // ── Jump (edge trigger) ───────────────────────────────────────────────────
  if (_keys.space && !p._prevJump) p.controller.jump();
  p._prevJump = _keys.space;

  // ── Attack (edge trigger) ─────────────────────────────────────────────────
  if (_keys.f && !p._prevAttack && p.currentWeapon) {
    const dir = new THREE.Vector3();
    p.controller.getWorldDirection(dir);
    p.currentWeapon.fire?.(scene, dir);
  }
  p._prevAttack = _keys.f;

  // ── Physics ───────────────────────────────────────────────────────────────
  p.controller.update(delta);

  // ── Animation ─────────────────────────────────────────────────────────────
  const vel = p.controller.velocity;
  const moving = Math.abs(vel.x) + Math.abs(vel.z) > 0.3;
  const grounded = p.controller.isGrounded;

  if (!grounded) {
    p.anim?.play(vel.y > 0 ? 'jump' : 'fall');
  } else if (moving) {
    p.anim?.play('run');
  } else {
    p.anim?.play('idle');
  }

  p.anim?.update(delta);
}

// ── Damage / Death ────────────────────────────────────────────────────────────

/**
 * Apply damage to any player entry (human or bot).
 * @param {object} p
 * @param {number} amount
 * @param {function} [onDie]  callback(p)
 */
export function applyDamage(p, amount, onDie) {
  if (!p || p.dead || p.invulnerable) return;

  p.health = Math.max(0, p.health - amount);
  console.log(
    `[Player] P${p.player_number} took ${amount} dmg → ${p.health}/${p.maxHealth}`
  );

  if (p.health <= 0) {
    killPlayer(p, onDie);
  } else {
    p.invulnerable = true;
    p.invulTimer   = 1.0;
  }
}

/**
 * Permanently kill a player (no respawn in battle royale).
 */
export function killPlayer(p, onDie) {
  if (p.dead) return;

  p.dead    = true;
  p.alive   = false;
  p.health  = 0;

  // Die animation then hide
  if (p.anim?.has('die')) {
    p.anim.play('die');
    setTimeout(() => { if (p.character) p.character.visible = false; }, 2000);
  } else {
    if (p.character) p.character.visible = false;
  }

  console.log(`[Player] P${p.player_number} eliminated`);
  onDie?.(p);
}

// ── Legacy shim for Game.js / GameViverse.js ───────────────────────────────────
// The old 2D/VIVERSE entry points call loadPlayers(scene, n). Keep them working.

import { LoaderManager } from './LoaderManager.js';
import { Bow }     from './weapons/bow.js';
import { Shotgun } from './weapons/shotgun.js';

export async function loadPlayers(scene, numPlayers = 1) {
  console.log(`[Player] (legacy) loadPlayers called for ${numPlayers} players`);
  const loader = new LoaderManager();
  await loader.loadManifest();
  const metas = loader.manifest.models.filter(m => m.tags?.includes('player'));

  players.length = 0;

  for (let i = 0; i < numPlayers; i++) {
    const spawnX = -5 + i * 3.5;
    let mesh;
    try {
      const meta = metas[i];
      if (!meta) throw new Error('no meta');
      const gltfScene = await loader.loadGLB(meta.file);
      gltfScene.position.set(spawnX, 1, 0);
      gltfScene.scale.setScalar(1.4);
      gltfScene.traverse(c => { if (c.isMesh) c.castShadow = true; });
      scene.add(gltfScene);
      mesh = gltfScene;
    } catch {
      const colors = [0xff0000, 0x00aaff, 0x00ff55, 0xffe000];
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: colors[i % 4] })
      );
      mesh.position.set(spawnX, 1, 0);
      mesh.castShadow = true;
      scene.add(mesh);
    }

    const ctrl = new CharacterController(mesh, null, i);
    const p = {
      mesh, character: mesh, controller: ctrl,
      player_number: i,
      health: game_config.player_hp || 100, maxHealth: game_config.player_hp || 100,
      score: 0, currentWeapon: null,
      dead: false, invulnerable: false, invulTimer: 0,
      hasMoney: false, isAI: i > 0,
      velocity: new THREE.Vector3(), grounded: true, isJumping: false,
      velocityX: 0, velocityY: 0,
      lastJumpPressed: false, lastAttackPressed: false,
      justWon: false, justEliminated: false,
      moveLeft()  { this.controller.setInputDirection(-1, 0); },
      moveRight() { this.controller.setInputDirection(1, 0); },
      jump()      { this.controller.jump(); },
      attack(sc)  {
        if (!this.currentWeapon) return;
        const dir = new THREE.Vector3();
        this.controller.getWorldDirection(dir);
        this.currentWeapon.fire(sc, dir);
      },
      takeDamage(amt) { applyDamage(this, amt); },
      update(dt)  {
        this.controller.update(dt);
        this.velocity.copy(this.controller.velocity);
        this.grounded  = this.controller.isGrounded;
        this.velocityX = this.velocity.x;
        this.velocityY = this.velocity.y;
        if (this.currentWeapon?.update) {
          this.currentWeapon.update({ getViewDir: () => new THREE.Vector3(1, 0, 0) });
        }
        this.justWon = false;
        this.justEliminated = false;
      },
    };

    const wpos = mesh.position.clone();
    if (i % 2 === 0) {
      const bow = new Bow(wpos); bow.player = p; p.currentWeapon = bow;
    } else {
      const sg  = new Shotgun(wpos); sg.player = p; p.currentWeapon = sg;
    }

    players.push(p);
  }
}
