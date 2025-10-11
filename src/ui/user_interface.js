// src/ui/user_interface.js // Corrected file header

import { updatePlayerUI, initPlayerUI } from "./player_ui.js";
import { Level } from "../Level.js";
import { GetUrlParam } from "../util.js";
import { players } from "../Player.js"; // <--- NEW: Import the global 'players' array from Player.js

class UI {
  constructor() {
    this.visible = GetUrlParam("state") !== "lvl_view";
    this.playerHud = document.getElementById("player-hud");
    if (!this.visible) this.playerHud.style.display = "none";

    // Initialize the UI with the *current* state of players,
    // which might be empty if the game hasn't loaded them yet.
    // The _setLevel method will re-initialize when a level (and players) are ready.
    this._current_level = null; // Track current level to detect changes

    // Initial setup of player UI. This uses the globally imported 'players' array.
    // It's robust to 'players' being empty at this stage.
    initPlayerUI(players);
  }

  Update() {
    // Check if the active level has changed.
    // This is useful if levels can be changed dynamically during gameplay.
    // (Note: In your current setup, Level.ActiveLevel is set once in World.js)
    if (this._current_level !== Level.ActiveLevel) {
      this._setLevel(Level.ActiveLevel);
    }

    // Always update player UI with the current global 'players' array.
    // 'updatePlayerUI' should be designed to handle cases where 'players' is empty.
    updatePlayerUI(players);
  }

  /**
   * Sets the current level context for the UI.
   * This method is primarily used to react to Level.ActiveLevel changes,
   * but the player UI initialization always relies on the global `players` array.
   * @param {Level | null} lvl - The new active Level instance, or null.
   */
  _setLevel(lvl) {
    this._current_level = lvl; // Update the internal tracking

    // The player UI initialization logic now solely depends on the global 'players' array
    // imported from Player.js, not on any non-existent '_players' property on the Level object.
    // This ensures consistency and correctness across the application.
    initPlayerUI(players); // Always pass the global players array
  }
}

export { UI };
