// InputController.js

const controllerState = {}; // Stores gamepad states (similar to GameController.js internal state)
const keyboardState = {}; // Stores keyboard key states

// Define supported actions and default key bindings for up to 2 keyboards (expand if needed)
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

// You can customize the keys per player for keyboard input
const KEYBOARD_BINDINGS = [
  {
    // Player 1 - WASD/Space/F
    up: ["w", "W"],
    down: ["s", "S"],
    left: ["a", "A"],
    right: ["d", "D"],
    jump: [" "], // Spacebar
    attack: ["f", "F"],
    start: ["Enter"],
    select: ["Shift"], // Could be used for menu navigation or secondary action
  },
  {
    // Player 2 - Arrows/Enter/M
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    jump: ["Enter"],
    attack: ["m", "M"],
    start: ["/"], // Example start key for player 2
    select: ["."], // Example select key for player 2
  },
  // Add more keyboard bindings for Player 3, Player 4 if needed
];

// Default mapping for Gamepads (Standard mapping indices)
const GAMEPAD_MAPPING = {
  up: [12], // D-pad Up
  down: [13], // D-pad Down
  left: [14], // D-pad Left
  right: [15], // D-pad Right
  jump: [0, 1], // A/Cross or B/Circle
  attack: [2], // X/Square
  start: [9], // Start/Options
  select: [8], // Select/Share
};

// Event listeners for gamepad connection/disconnection
window.addEventListener("gamepadconnected", (e) => {
  // Initialize state for a new gamepad
  controllerState[e.gamepad.index] = createEmptyState();
});
window.addEventListener("gamepaddisconnected", (e) => {
  // Clean up state for a disconnected gamepad
  delete controllerState[e.gamepad.index];
});

/**
 * Creates an empty state object for a controller (keyboard or gamepad).
 * @returns {object} An object with game actions as keys and boolean values.
 */
function createEmptyState() {
  const state = {};
  for (const act of GAME_ACTIONS) state[act] = false;
  return state;
}

// Global keyboard listeners
window.addEventListener("keydown", (e) => {
  keyboardState[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keyboardState[e.key] = false;
});

/**
 * Polls all connected gamepads and updates their state in `controllerState`.
 * This should be called once per frame.
 */
function updateControllers() {
  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    const pad = gamepads[i];
    if (!pad || !pad.connected) continue;

    // Ensure state object exists for this gamepad index
    if (!controllerState[pad.index]) {
      controllerState[pad.index] = createEmptyState();
    } else {
      // Clear previous analog stick digital states before setting new ones
      // This is important because the default button check doesn't auto-clear
      // when sticks return to center.
      controllerState[pad.index].left = false;
      controllerState[pad.index].right = false;
      controllerState[pad.index].up = false;
      controllerState[pad.index].down = false;
    }

    // Update button states based on standard mapping
    GAME_ACTIONS.forEach((action) => {
      // Only update if the action is specifically bound to a button.
      // Analog stick states are handled separately below.
      if (GAMEPAD_MAPPING[action]) {
        controllerState[pad.index][action] = GAMEPAD_MAPPING[action].some(
          (btnIdx) => pad.buttons[btnIdx]?.pressed, // Check if any bound button is pressed
        );
      }
    });

    // --- FIX START ---
    // Optional: Map analog stick input to digital directional actions
    if (pad.axes.length > 1) {
      // X-axis (left/right)
      if (pad.axes[0] < -0.5) {
        controllerState[pad.index].left = true;
      } else if (pad.axes[0] > 0.5) {
        controllerState[pad.index].right = true;
      }

      // Y-axis (up/down)
      if (pad.axes[1] < -0.5) {
        // Negative Y for 'up' (standard gamepad Y-axis)
        controllerState[pad.index].up = true;
      } else if (pad.axes[1] > 0.5) {
        // Positive Y for 'down'
        controllerState[pad.index].down = true;
      }
    }
    // --- FIX END ---
  }
}

/**
 * Public API: checks if a specific game action is currently pressed for a given player index.
 * It prioritizes gamepad input if available, then falls back to keyboard.
 * @param {number} playerIdx - The 0-indexed player number (e.g., 0 for Player 1).
 * @param {string} action - The name of the game action (e.g., "jump", "attack").
 * @returns {boolean} True if the action is pressed, false otherwise.
 */
export function isActionPressed(playerIdx, action) {
  // 1. Prefer gamepad input if present and active for this player index
  if (controllerState[playerIdx] && controllerState[playerIdx][action]) {
    return true;
  }

  // 2. Fallback to keyboard input for this player index
  if (KEYBOARD_BINDINGS[playerIdx]) {
    return KEYBOARD_BINDINGS[playerIdx][action].some(
      (key) => keyboardState[key], // Check if any of the bound keys are pressed
    );
  }

  return false; // Action not pressed or no binding for this player
}

/**
 * Call this function once per game loop frame to poll all input devices.
 */
export function pollInput() {
  updateControllers();
}
