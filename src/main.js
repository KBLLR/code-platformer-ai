/**
 * main.js — Entry point for Code Platformer AI.
 *
 * Scene-based architecture: registers LobbyScene and MatchScene,
 * then transitions to lobby on load. Legacy Game.js/GameViverse.js
 * paths are preserved behind ?mode=legacy URL param.
 */
import "./styles/index.css";
import { SceneManager } from "@/scenes/SceneManager.js";
import { LobbyScene } from "@/scenes/LobbyScene.js";
import { MatchScene } from "@/scenes/MatchScene.js";
import { GetUrlParam } from "@/util.js";

console.log(`[main.js] Started game in '${import.meta.env.MODE}' mode`);

// ─── Legacy Mode Gate ────────────────────────────────────────────
const mode = GetUrlParam("mode");
if (mode === "legacy") {
  // Preserve the old menu → GameViverse / Game.js flow
  import("@/Game.js").then(({ initGame }) => {
    import("@/GameViverse.js").then(({ initGameViverse }) => {
      import("@/menus.js").then(({ Mainmenu, LvlSelect, CharSelect }) => {
        import("@/game_config.js").then(({ loadGameConfig }) => {
          document.addEventListener("DOMContentLoaded", async () => {
            console.log("[main.js] Legacy mode — using classic menu flow.");
            await loadGameConfig();
            const mainmenu = new Mainmenu();
            await mainmenu.Show();
            mainmenu.OnButton("start", async () => {
              const lvlSelect = new LvlSelect();
              await lvlSelect.Show();
              lvlSelect.OnLvlSelect(async (lvl) => {
                const charSelect = new CharSelect();
                await charSelect.Show();
                charSelect.OnStartGame((humanPlayerCount) => {
                  const canvas = document.getElementById("game-canvas");
                  const useViverse = GetUrlParam("viverse") !== "false";
                  if (useViverse) {
                    initGameViverse(canvas, { lvl, character: humanPlayerCount, humanPlayers: humanPlayerCount });
                  } else {
                    initGame(canvas, { lvl, character: humanPlayerCount, humanPlayers: humanPlayerCount });
                  }
                });
              });
            });
          });
        });
      });
    });
  });
} else {
  // ─── Scene-Based Mode (Default) ─────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("[main.js] Scene-based mode — initializing SceneManager.");

    const canvas = document.getElementById("game-canvas");
    if (!canvas) {
      console.error("[main.js] No #game-canvas found.");
      return;
    }

    // Hide legacy menu DOM elements
    const menuWrap = document.querySelector(".menu-wrap");
    const lvlSelectWrap = document.querySelector(".lvl-select-wrap");
    const charSelect = document.getElementById("character-select");
    if (menuWrap) menuWrap.style.display = "none";
    if (lvlSelectWrap) lvlSelectWrap.style.display = "none";
    if (charSelect) charSelect.style.display = "none";

    // Ensure canvas is visible
    canvas.style.display = "block";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "1";

    // Initialize SceneManager
    const sceneManager = new SceneManager(canvas);

    // Register scenes
    sceneManager.register("lobby", () => new LobbyScene());
    sceneManager.register("match", () => new MatchScene());

    // Short-circuit: jump straight into match if ?state=game
    const state = GetUrlParam("state");
    if (state === "game") {
      const seed = parseInt(GetUrlParam("seed")) || 42;
      const { createDefaultArenaConfig } = await import("@/interfaces/ArenaConfig.js");
      sceneManager.switchTo("match", {
        arenaConfig: createDefaultArenaConfig(seed),
        humanPlayers: 1,
      });
    } else {
      // Default: start at lobby
      sceneManager.switchTo("lobby");
    }
  });
}
