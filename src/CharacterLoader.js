// src/CharacterLoader.js  (Objective A)
// Loads a GLB character, builds an AnimationMixer with a named-clip state machine,
// and locates the weapon socket bone.  Error-tolerant: logs missing clips/sockets
// but always returns a usable character object.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();
let _manifest = null;

// ── Manifest ──────────────────────────────────────────────────────────────────

async function loadManifest() {
  if (_manifest) return _manifest;
  const res = await fetch('/characters/manifest.json');
  _manifest = await res.json();
  console.log(`[CharacterLoader] Manifest loaded — ${_manifest.characters.length} characters`);
  return _manifest;
}

// ── Clip resolver ─────────────────────────────────────────────────────────────

/**
 * Find an AnimationClip by trying every alias for a logical name.
 * Returns null (with a warning) if nothing matches.
 */
function resolveClip(clips, logicalName, aliases) {
  const candidates = aliases[logicalName] || [logicalName];
  for (const name of candidates) {
    const clip = THREE.AnimationClip.findByName(clips, name);
    if (clip) return clip;
  }
  // Fuzzy match: first clip whose name contains the logical name
  const fuzzy = clips.find(c => c.name.toLowerCase().includes(logicalName.toLowerCase()));
  if (fuzzy) {
    console.warn(
      `[CharacterLoader] Exact clip "${logicalName}" not found — using fuzzy match "${fuzzy.name}"`
    );
    return fuzzy;
  }
  console.warn(`[CharacterLoader] Clip "${logicalName}" not found — will be skipped`);
  return null;
}

// ── Weapon socket ─────────────────────────────────────────────────────────────

function findWeaponSocket(root, socketName) {
  let socket = null;
  root.traverse(obj => {
    if (obj.name === socketName) socket = obj;
  });
  if (!socket) {
    // Fallback: find by partial name
    root.traverse(obj => {
      if (!socket && obj.name.toLowerCase().includes('weapon')) socket = obj;
    });
    if (socket) {
      console.warn(
        `[CharacterLoader] weapon_socket "${socketName}" not found — using fallback "${socket.name}"`
      );
    } else {
      console.warn(
        `[CharacterLoader] No weapon socket found — weapons will attach to root`
      );
    }
  }
  return socket || root;
}

// ── AnimationStateMachine ─────────────────────────────────────────────────────

/**
 * Thin wrapper around THREE.AnimationMixer that lets callers play
 * logical animation names (idle, run, jump, …) with crossfading.
 */
export class AnimationStateMachine {
  /** @param {THREE.AnimationMixer} mixer */
  constructor(mixer, actions) {
    this._mixer   = mixer;
    this._actions = actions; // Map<string, THREE.AnimationAction>
    this._current = null;
  }

  /**
   * Transition to a logical animation.
   * @param {string} name          Logical name (idle, run, jump, …)
   * @param {number} [fadeDuration=0.2]
   */
  play(name, fadeDuration = 0.2) {
    const action = this._actions.get(name);
    if (!action) return; // clip not available on this model
    if (this._current === action) return;

    if (this._current) {
      this._current.crossFadeTo(action, fadeDuration, true);
    }
    action.reset().play();
    this._current = action;
  }

  /** Must be called every frame. @param {number} delta seconds */
  update(delta) {
    this._mixer.update(delta);
  }

  get currentName() {
    for (const [name, action] of this._actions) {
      if (action === this._current) return name;
    }
    return null;
  }

  has(name) {
    return this._actions.has(name);
  }
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load a character asset described by a manifest entry.
 *
 * @param {object}        entry       One item from manifest.characters
 * @param {THREE.Scene}   scene       The Three.js scene to add the mesh to
 * @returns {Promise<{
 *   root:         THREE.Group,
 *   mixer:        THREE.AnimationMixer,
 *   anim:         AnimationStateMachine,
 *   weaponSocket: THREE.Object3D,
 *   clips:        Map<string, THREE.AnimationClip>,
 * }>}
 */
export async function loadCharacter(entry, scene) {
  console.log(`[CharacterLoader] Loading "${entry.id}" from ${entry.glb}`);

  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      _loader.load(entry.glb, resolve, undefined, reject);
    });
  } catch (err) {
    console.warn(`[CharacterLoader] Failed to load GLB for "${entry.id}":`, err.message);
    // Return a coloured-box fallback
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b];
    const idx = parseInt(entry.id.replace(/\D/g, '')) % 4;
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: colors[idx] })
    );
    fallback.castShadow = true;
    const root = new THREE.Group();
    root.add(fallback);
    scene.add(root);
    return {
      root,
      mixer: new THREE.AnimationMixer(root),
      anim: new AnimationStateMachine(new THREE.AnimationMixer(root), new Map()),
      weaponSocket: root,
      clips: new Map(),
    };
  }

  const root = gltf.scene;
  root.traverse(child => {
    if (child.isMesh) {
      child.castShadow    = true;
      child.receiveShadow = true;
    }
  });
  scene.add(root);

  // ── Animation Mixer ────────────────────────────────────────────────────────
  const mixer = new THREE.AnimationMixer(root);
  const rawClips = gltf.animations || [];

  if (rawClips.length === 0) {
    console.warn(`[CharacterLoader] "${entry.id}" has no animation clips`);
  }

  const actions = new Map();
  for (const logicalName of entry.required_clips) {
    const clip = resolveClip(rawClips, logicalName, entry.clip_aliases || {});
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(
        ['idle', 'run', 'fall'].includes(logicalName) ? THREE.LoopRepeat : THREE.LoopOnce
      );
      if (logicalName === 'die') {
        action.clampWhenFinished = true;
      }
      actions.set(logicalName, action);
    }
  }

  const anim = new AnimationStateMachine(mixer, actions);

  // Start idle if available
  if (actions.has('idle')) anim.play('idle', 0);

  // ── Weapon Socket ──────────────────────────────────────────────────────────
  const weaponSocket = findWeaponSocket(root, entry.weapon_socket);

  // ── Clip map for external consumers ───────────────────────────────────────
  const clips = new Map(rawClips.map(c => [c.name, c]));

  console.log(
    `[CharacterLoader] "${entry.id}" ready — ` +
    `clips: [${[...actions.keys()].join(', ')}], ` +
    `socket: "${weaponSocket.name}"`
  );

  return { root, mixer, anim, weaponSocket, clips };
}

// ── Batch loader ──────────────────────────────────────────────────────────────

/**
 * Load all characters defined in the manifest.
 * @param {THREE.Scene} scene
 * @returns {Promise<Array<{entry, root, mixer, anim, weaponSocket, clips}>>}
 */
export async function loadAllCharacters(scene) {
  const manifest = await loadManifest();
  const results = await Promise.allSettled(
    manifest.characters.map(entry =>
      loadCharacter(entry, scene).then(data => ({ entry, ...data }))
    )
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

export { loadManifest };
