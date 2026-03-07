// src/LobbyScene.js
// 3-D lobby: shows a real-time arena preview based on the current seed.
// Clicking "START MATCH" fires the callback with the ArenaConfig.

import * as THREE from 'three';
import { ArenaConfig } from './ArenaConfig.js';
import { StageGenerator } from './StageGenerator.js';

export class LobbyScene {
  constructor({ onStart } = {}) {
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x0a0a14);
    this.threeScene.fog = new THREE.FogExp2(0x0a0a14, 0.008);

    this._onStart     = onStart ?? (() => {});
    this._arenaConfig = null;
    this._arenaGroup  = null;
    this._safeRing    = null;
    this._seed        = Math.floor(Math.random() * 99999) + 1;
    this._orbitAngle  = 0;

    this._ui = null;
    this._abortLLM = null;
  }

  name = 'LobbyScene';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async enter(sm) {
    this._sm = sm;
    this._buildPreview();
    this._buildUI();
    console.log('[LobbyScene] Entered');
  }

  exit() {
    if (this._ui) { this._ui.remove(); this._ui = null; }
    if (this._abortLLM) { this._abortLLM(); this._abortLLM = null; }
    console.log('[LobbyScene] Exited');
  }

  update(delta, sm) {
    // Orbit camera slowly around the preview arena
    this._orbitAngle += 0.003;
    const r = (this._arenaConfig?.size ?? 40) * 1.0;
    sm.camera.position.set(
      Math.cos(this._orbitAngle) * r,
      r * 0.5,
      Math.sin(this._orbitAngle) * r
    );
    sm.camera.lookAt(0, 2, 0);

    // Animate safe-zone ring
    if (this._safeRing && this._arenaConfig) {
      StageGenerator.updateSafeZone(this._safeRing, this._arenaConfig);
    }

    // Pulse spawn markers
    const t = performance.now() * 0.001;
    if (this._spawnMarkers) {
      this._spawnMarkers.forEach((m, i) => {
        m.material.opacity = 0.2 + Math.sin(t * 2 + i) * 0.15;
      });
    }
  }

  // ── Arena preview ──────────────────────────────────────────────────────────

  _buildPreview(seed) {
    if (seed !== undefined) this._seed = seed;

    // Clear old arena
    if (this._arenaGroup) {
      this.threeScene.remove(this._arenaGroup);
      this._arenaGroup = null;
    }

    this._arenaConfig = new ArenaConfig({ seed: this._seed, size: 40, numPlayers: 12 });

    const { group, safeZoneRing, spawnMarkers } = StageGenerator.generate(
      this._arenaConfig, this.threeScene
    );
    this._arenaGroup  = group;
    this._safeRing    = safeZoneRing;
    this._spawnMarkers = spawnMarkers;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  _buildUI() {
    const ui = document.createElement('div');
    ui.id = 'lobby-ui';
    ui.innerHTML = `
      <style>
        #lobby-ui {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          padding-bottom: 6vh;
          pointer-events: none;
          font-family: system-ui, sans-serif;
          z-index: 100;
        }
        #lobby-ui .card {
          pointer-events: auto;
          background: rgba(10,10,20,0.85);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 32px 48px;
          text-align: center;
          backdrop-filter: blur(12px);
          max-width: 480px;
          width: 90%;
        }
        #lobby-ui h1  { color:#fff; font-size:2rem; margin:0 0 4px; font-weight:700; letter-spacing:.04em; }
        #lobby-ui sub { color:rgba(255,255,255,.5); font-size:.8rem; display:block; margin-bottom:24px; }
        #lobby-ui .row { display:flex; gap:12px; align-items:center; justify-content:center; margin-bottom:20px; }
        #lobby-ui input[type=number] {
          background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.2);
          color:#fff; border-radius:10px; padding:8px 14px; font-size:1rem; width:110px;
          text-align:center; outline:none;
        }
        #lobby-ui label { color:rgba(255,255,255,.7); font-size:.9rem; }
        #lobby-ui .btn-start {
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          color:#fff; border:none; border-radius:14px;
          padding:14px 40px; font-size:1.1rem; font-weight:600;
          cursor:pointer; width:100%; letter-spacing:.05em;
          transition: opacity .2s, transform .15s;
        }
        #lobby-ui .btn-start:hover  { opacity:.9; transform:scale(1.02); }
        #lobby-ui .btn-start:active { transform:scale(.98); }
        #lobby-ui .btn-seed {
          background:rgba(255,255,255,.1); color:#fff; border:1px solid rgba(255,255,255,.2);
          border-radius:10px; padding:8px 18px; cursor:pointer; font-size:.85rem;
          transition:background .2s;
        }
        #lobby-ui .btn-seed:hover { background:rgba(255,255,255,.18); }
        #lobby-ui .seed-label { color:rgba(255,255,255,.45); font-size:.75rem; margin-top:14px; }
      </style>
      <div class="card">
        <h1>BATTLE ARENA</h1>
        <sub>12 Players · 1 Human · 11 Bots · VIVERSE Powered</sub>
        <div class="row">
          <label for="seed-input">Seed</label>
          <input id="seed-input" type="number" value="${this._seed}" min="1" max="99999" />
          <button class="btn-seed" id="btn-randomise">🎲 Random</button>
        </div>
        <button class="btn-start" id="btn-start-match">START MATCH</button>
        <div class="seed-label">Seed determines the arena layout deterministically.</div>
      </div>
    `;

    document.body.appendChild(ui);
    this._ui = ui;

    // Events
    const seedInput = ui.querySelector('#seed-input');
    seedInput.addEventListener('change', () => {
      this._seed = parseInt(seedInput.value) || 1;
      this._buildPreview();
    });

    ui.querySelector('#btn-randomise').addEventListener('click', () => {
      this._seed = Math.floor(Math.random() * 99999) + 1;
      seedInput.value = this._seed;
      this._buildPreview();
    });

    ui.querySelector('#btn-start-match').addEventListener('click', () => {
      this._seed = parseInt(seedInput.value) || this._seed;
      const cfg  = new ArenaConfig({ seed: this._seed, size: 80, numPlayers: 12 });
      console.log('[LobbyScene] Starting match with config:', cfg.toJSON());
      this._onStart(cfg);
    });
  }
}
