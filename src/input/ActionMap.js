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
  }

  snapshot() {
    const pad = this._pollGamepad();
    const moveXFromKeyboard = (anyPressed(this.heldKeys, KEY_BINDINGS.left) ? -1 : 0)
      + (anyPressed(this.heldKeys, KEY_BINDINGS.right) ? 1 : 0);
    const moveXFromPad = pad?.axes?.[0] ?? 0;
    const moveX = Math.abs(moveXFromPad) > 0.22 ? moveXFromPad : moveXFromKeyboard;

    const snapshot = {
      moveX: Math.max(-1, Math.min(1, moveX)),
      jumpPressed: this._consume(KEY_BINDINGS.jump) || this._consumePadButton(pad, 0),
      attackPressed: this._consume(KEY_BINDINGS.attack) || this._consumePadButton(pad, 2),
      itemPressed: this._consume(KEY_BINDINGS.item) || this._consumePadButton(pad, 1) || this._consumePadButton(pad, 7),
      pausePressed: this._consume(KEY_BINDINGS.pause) || this._consumePadButton(pad, 9),
    };

    this.pressedKeys.clear();
    return snapshot;
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

export function getBindingSummary() {
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
      jump: "A / South",
      attack: "X / West",
      item: "B / East or Right Trigger",
      pause: "Start",
    },
  };
}
