// GameController.js
// Supports USB/Bluetooth controllers using the Gamepad API

const controllerState = {}; // Stores the current state of buttons for each connected gamepad
const GAME_ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "jump",
  "attack",
  "start",
  "select",
];

// Default mapping for Xbox/PS controllers (Standard Gamepad mapping indices)
const DEFAULT_MAPPING = {
  up: [12], // D-pad up
  down: [13], // D-pad down
  left: [14], // D-pad left
  right: [15], // D-pad right
  jump: [0, 1], // A/Cross (0) or B/Circle (1)
  attack: [2], // X/Square (2)
  start: [9], // Start/Options
  select: [8], // Select/Share
};

window.addEventListener("gamepadconnected", (e) => {
  console.log(`Gamepad connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
  // Initialize state for the new gamepad
  controllerState[e.gamepad.index] = createEmptyState();
});
window.addEventListener("gamepaddisconnected", (e) => {
  console.log(`Gamepad disconnected: index ${e.gamepad.index}`);
  // Clean up state for the disconnected gamepad
  delete controllerState[e.gamepad.index];
});

/**
 * Creates an empty state object for a gamepad, initializing all actions to false.
 * @returns {object} An object with game actions as keys and boolean values.
 */
function createEmptyState() {
  const state = {};
  for (const act of GAME_ACTIONS) state[act] = false;
  return state;
}

/**
 * Polls all connected gamepads and updates their state in `controllerState`.
 */
function updateControllers() {
  // navigator.getGamepads() returns an array of Gamepad objects, or null for unconnected slots
  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    const pad = gamepads[i];
    if (!pad || !pad.connected) continue; // Skip if no gamepad or not connected

    // Ensure state object exists for this gamepad index
    if (!controllerState[pad.index]) {
      controllerState[pad.index] = createEmptyState();
    }

    // Update button states based on standard mapping
    GAME_ACTIONS.forEach((action) => {
      controllerState[pad.index][action] = DEFAULT_MAPPING[action].some(
        (btnIdx) => pad.buttons[btnIdx]?.pressed, // Check if any bound button is pressed
      );
    });

    // Example: Map analog stick input to digital directional actions
    // This is useful for older games that expect discrete D-pad input.
    if (pad.axes.length > 1) {
      // Left Stick X-axis (0)
      if (pad.axes[0] < -0.5) controllerState[pad.index].left = true;
      else if (pad.axes[0] > 0.5) controllerState[pad.index].right = true;

      // Left Stick Y-axis (1)
      if (pad.axes[1] < -0.5) controllerState[pad.index].up = true;
      else if (pad.axes[1] > 0.5) controllerState[pad.index].down = true;
    }
  }
}

/**
 * Public API to check if a specific game action is currently pressed for a given player/gamepad index.
 * @param {number} playerIndex - The index of the player/gamepad (e.g., 0 for player 1, 1 for player 2).
 * @param {string} action - The name of the game action (e.g., "jump", "attack").
 * @returns {boolean} True if the action is pressed, false otherwise.
 */
export function isActionPressed(playerIndex, action) {
  if (!controllerState[playerIndex]) return false;
  return controllerState[playerIndex][action];
}

/**
 * Call this function once per game loop frame to update all gamepad states.
 */
export function pollGamepads() {
  updateControllers();
}
