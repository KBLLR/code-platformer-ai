import { createSemanticGamepad } from "./SemanticGamepad";
import {
  NINTENDO_FACE_LAYOUT,
  XBOX_FACE_LAYOUT,
  guessFaceLayout,
} from "../lib/character-control";

const KEY_BINDINGS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["Space", "KeyW", "ArrowUp"],
  attack: ["KeyJ", "KeyZ"],
  item: ["KeyK", "KeyX"],
  pause: ["Escape", "KeyP"],
};

function anyPressed(set, keys) {
  return keys.some((key) => set.has(key));
}

export class ActionMap {
  constructor(target = window) {
    this.target = target;
    this.heldKeys = new Set();
    this.pressedKeys = new Set();
    this.connectedGamepad = null;
    // Pad input runs through the shared profile layer so face buttons resolve
    // by physical position and unknown pads fall back to calibration.
    this.pad = createSemanticGamepad();
    this.padFrame = null;
    this._boundDown = (event) => {
      if (Object.values(KEY_BINDINGS).some((keys) => keys.includes(event.code))) {
        event.preventDefault();
      }
      this.heldKeys.add(event.code);
      this.pressedKeys.add(event.code);
    };
    this._boundUp = (event) => {
      if (Object.values(KEY_BINDINGS).some((keys) => keys.includes(event.code))) {
        event.preventDefault();
      }
      this.heldKeys.delete(event.code);
    };
    target.addEventListener("keydown", this._boundDown);
    target.addEventListener("keyup", this._boundUp);
  }

  dispose() {
    this.target.removeEventListener("keydown", this._boundDown);
    this.target.removeEventListener("keyup", this._boundUp);
    this.pad.dispose();
  }

  snapshot(nowMs = typeof performance !== "undefined" ? performance.now() : Date.now()) {
    const pad = this._pollGamepad();
    const padFrame = this.pad.read(nowMs);
    this.padFrame = padFrame;

    const moveXFromKeyboard = (anyPressed(this.heldKeys, KEY_BINDINGS.left) ? -1 : 0)
      + (anyPressed(this.heldKeys, KEY_BINDINGS.right) ? 1 : 0);
    // The pad is already deadzoned radially, so any nonzero value is intent.
    const moveX = padFrame.moveX !== 0 ? padFrame.moveX : moveXFromKeyboard;

    const snapshot = {
      moveX: Math.max(-1, Math.min(1, moveX)),
      moveSpeed: padFrame.speed !== 0 ? padFrame.speed : Math.abs(moveXFromKeyboard),
      jumpPressed: this._consume(KEY_BINDINGS.jump) || padFrame.jumpPressed,
      attackPressed: this._consume(KEY_BINDINGS.attack) || padFrame.attackPressed,
      itemPressed: this._consume(KEY_BINDINGS.item) || padFrame.itemPressed,
      // Start sits in the centre cluster, which no face layout affects.
      pausePressed: this._consume(KEY_BINDINGS.pause) || this._consumePadButton(pad, 9),
    };

    this.pressedKeys.clear();
    return snapshot;
  }

  /** Live controller identity, for the calibration/debug overlay. */
  gamepadSnapshot() {
    return this.pad.snapshot();
  }

  _consume(keys) {
    return keys.some((key) => this.pressedKeys.has(key));
  }

  _pollGamepad() {
    const pads = navigator.getGamepads?.() ?? [];
    const next = pads.find(Boolean) ?? null;
    if (!next) {
      this.connectedGamepad = null;
      return null;
    }

    if (!this.connectedGamepad || this.connectedGamepad.index !== next.index) {
      this.connectedGamepad = {
        index: next.index,
        pressedButtons: new Set(),
      };
    }

    return next;
  }

  _consumePadButton(pad, index) {
    if (!pad || !this.connectedGamepad) return false;
    const button = pad.buttons?.[index];
    if (!button) return false;

    const wasPressed = this.connectedGamepad.pressedButtons.has(index);
    if (button.pressed) {
      this.connectedGamepad.pressedButtons.add(index);
      return !wasPressed;
    }

    this.connectedGamepad.pressedButtons.delete(index);
    return false;
  }
}

/**
 * Binding summary for the operator.
 *
 * The gamepad labels depend on the connected pad: South/West/East are fixed
 * physical positions, but which letter is printed there is not. On a Nintendo
 * layout South is **B** and East is **A**, so showing Xbox letters would point
 * the operator at the wrong buttons. Pass the live `gamepad.id` to get labels
 * that match the hardware in their hands.
 */
export function getBindingSummary(gamepadId = "") {
  const layout = gamepadId ? guessFaceLayout(gamepadId) : XBOX_FACE_LAYOUT;
  // Bindings follow the printed letter, so the position shown alongside it
  // changes with the pad: A is bottom on an Xbox layout and right on a Nintendo one.
  const positionOf = (label) => layout[label] ?? "?";

  return {
    keyboard: {
      move: "A / D or Left / Right",
      jump: "Space / W / Up",
      attack: "J / Z",
      item: "K / X",
      pause: "Esc / P",
    },
    gamepad: {
      move: "Left Stick",
      jump: `A (${positionOf("A")})`,
      attack: `X (${positionOf("X")})`,
      item: `B (${positionOf("B")})`,
      pause: "Start",
      layout: layout === NINTENDO_FACE_LAYOUT ? "nintendo" : "xbox",
    },
  };
}
