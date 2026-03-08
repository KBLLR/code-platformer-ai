// src/main.js
// Entry point — bootstraps SceneManager, then routes to Lobby → Match.
// Legacy 2D/VIVERSE paths preserved under ?mode=classic|viverse.

import './styles/index.css';
import { GetUrlParam }    from '@/util.js';
import { loadGameConfig } from '@/game_config.js';
import { Sounds }         from '@/sounds.js';
import { Onboarding }     from '@/onboarding.js';

// Scene-based architecture (new)
import { SceneManager }   from '@/SceneManager.js';
import { LobbyScene }     from '@/LobbyScene.js';
import { MatchScene }     from '@/MatchScene.js';
import { createArenaConfigFromWorldPack, loadWorldPack } from '@/world/WorldPackAdapter.js';

// Legacy modes
import { initGame }       from '@/Game.js';
import { initGameViverse } from '@/GameViverse.js';

console.log(`[main.js] Mode: ${import.meta.env.MODE}`);

const canvas  = document.getElementById('game-canvas');
const gameHud = document.getElementById('game-hud');

// ── Helpers ───────────────────────────────────────────────────────────────────

function hideAllMenus() {
  ['menu-wrap', 'lvl-select-wrap'].forEach(cls => {
    const el = document.getElementsByClassName(cls)[0];
    if (el) el.style.display = 'none';
  });
  const cs = document.getElementById('character-select');
  if (cs) { cs.style.display = 'none'; cs.classList.add('hidden'); }
}

function showCanvas() {
  if (!canvas) return;
  Object.assign(canvas.style, {
    display: 'block', position: 'fixed',
    top: '0', left: '0', width: '100%', height: '100%', zIndex: '1',
  });
  if (gameHud) { gameHud.classList.remove('hidden'); gameHud.style.display = 'block'; }
}

async function initAudio() {
  try {
    await Sounds.LoadSounds(() => {
      try { Sounds.Play('theme', { loop: true, volume: 0.12 }); } catch { /* ok */ }
    });
  } catch { /* audio is optional */ }
}

// ── Scene-based entry point (default) ─────────────────────────────────────────

async function startSceneMode(worldPackUrl = null) {
  await loadGameConfig();
  hideAllMenus();
  showCanvas();
  initAudio();

  const sm = new SceneManager(canvas);
  await sm.init();

  if (worldPackUrl) {
    try {
      const worldPack = await loadWorldPack(worldPackUrl);
      const arenaConfig = createArenaConfigFromWorldPack(worldPack);
      const match = new MatchScene(arenaConfig);
      await sm.switchTo(match);
      sm.start();
      console.log(`[main.js] SceneManager started from world pack ${worldPack.id}`);
      return;
    } catch (error) {
      console.error(`[main.js] Failed to start from world pack ${worldPackUrl}:`, error);
    }
  }

  const lobby = new LobbyScene({
    onStart: async (arenaConfig) => {
      const match = new MatchScene(arenaConfig);
      await sm.switchTo(match);
    },
  });

  await sm.switchTo(lobby);
  sm.start();

  console.log('[main.js] SceneManager started');
}

// ── Legacy entry points ────────────────────────────────────────────────────────

async function startLegacyGame(lvl = 0, characterCount = 1, humanPlayers = 1) {
  await loadGameConfig();
  hideAllMenus();
  showCanvas();
  await initAudio();

  const mode = GetUrlParam('mode') ?? 'viverse';
  if (mode === 'classic') {
    initGame(canvas, { lvl, character: characterCount, humanPlayers });
  } else {
    initGameViverse(canvas, { lvl, character: characterCount, humanPlayers });
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  const state = GetUrlParam('state');
  const mode  = GetUrlParam('mode');
  const worldPackUrl = GetUrlParam('worldpack');

  // Direct URL overrides
  if (state === 'game') { startLegacyGame(); return; }

  // Legacy explicit modes
  if (mode === 'classic' || mode === 'viverse') { startLegacyGame(); return; }

  // Default: full scene-based mode (new architecture)
  // Auth / onboarding guard
  if (!Onboarding.isLoggedIn()) {
    window.location.href = 'landing.html';
    return;
  }
  if (!Onboarding.hasCompletedOnboarding()) {
    const o = new Onboarding();
    window.onboarding = o;
    o.Show().then(() => {
      o.OnComplete((startMode) => {
        if (startMode === 'practice') startLegacyGame(0, 1, 1);
        else startSceneMode(worldPackUrl);
      });
    });
    return;
  }

  startSceneMode(worldPackUrl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
