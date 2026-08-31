/**
 * Keyboard input source.
 *
 * Produces the identical `CharacterInputFrame` the gamepad produces, so the
 * state machine cannot tell them apart. Useful as a development fallback and
 * as a way to drive the character when no pad is paired.
 */

import {
  ONE_SHOT_ACTIONS,
  applyRadialDeadzone,
  clamp,
  idleFrame,
  type CharacterInputFrame,
  type InputSource,
  type OneShotAction,
} from "./types";

export interface KeyboardBindings {
  readonly forward: readonly string[];
  readonly back: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly sprint: readonly string[];
  readonly actions: Readonly<Record<OneShotAction, readonly string[]>>;
}

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = Object.freeze({
  forward: ["keyw", "arrowup"],
  back: ["keys", "arrowdown"],
  left: ["keya", "arrowleft"],
  right: ["keyd", "arrowright"],
  sprint: ["shiftleft", "shiftright"],
  actions: Object.freeze({
    jump: ["space"],
    punch: ["keyj"],
    kick: ["keyk"],
    push: ["keyl"],
  }),
});

function normalize(event: KeyboardEvent): string {
  return String(event.code || event.key || "").toLowerCase();
}

export interface KeyboardSourceOptions {
  readonly target?: EventTarget;
  readonly bindings?: KeyboardBindings;
  /** Keyboard input is binary; a nonzero deadzone would only mask it. */
  readonly deadzone?: number;
}

export function createKeyboardInputSource(
  options: KeyboardSourceOptions = {},
): InputSource {
  const target =
    options.target ?? (typeof window === "undefined" ? null : window);
  const bindings = options.bindings ?? DEFAULT_KEYBOARD_BINDINGS;
  const deadzone = options.deadzone ?? 0;

  const heldKeys = new Set<string>();
  const pendingActions = new Set<OneShotAction>();

  const onKeyDown = (event: Event) => {
    const key = normalize(event as KeyboardEvent);
    // Rising edge only: auto-repeat must not retrigger an action.
    if (!(event as KeyboardEvent).repeat) {
      for (const action of ONE_SHOT_ACTIONS) {
        if (bindings.actions[action].includes(key)) pendingActions.add(action);
      }
    }
    heldKeys.add(key);
  };
  const onKeyUp = (event: Event) => {
    heldKeys.delete(normalize(event as KeyboardEvent));
  };
  const onBlur = () => {
    heldKeys.clear();
    pendingActions.clear();
  };

  target?.addEventListener("keydown", onKeyDown);
  target?.addEventListener("keyup", onKeyUp);
  target?.addEventListener("blur", onBlur);

  const anyHeld = (keys: readonly string[]) => keys.some((k) => heldKeys.has(k));

  return {
    sample(): CharacterInputFrame {
      if (!target) return idleFrame("keyboard", false);

      const rawX = (anyHeld(bindings.right) ? 1 : 0) - (anyHeld(bindings.left) ? 1 : 0);
      const rawY = (anyHeld(bindings.forward) ? 1 : 0) - (anyHeld(bindings.back) ? 1 : 0);
      const sprint = anyHeld(bindings.sprint);
      // Diagonals would otherwise read 1.41; normalize so speed stays 0..1.
      const move = applyRadialDeadzone(rawX, rawY, deadzone);
      const magnitude = move.magnitude === 0 ? 0 : sprint ? 1 : 0.45;

      const actions: Record<OneShotAction, boolean> = {
        jump: false,
        punch: false,
        kick: false,
        push: false,
      };
      for (const action of pendingActions) actions[action] = true;
      pendingActions.clear();

      return {
        moveX: clamp(move.x, -1, 1),
        moveY: clamp(move.y, -1, 1),
        speed: magnitude,
        lookX: 0,
        lookY: 0,
        sprint,
        actions,
        connected: true,
        sourceId: "keyboard",
      };
    },
    dispose() {
      target?.removeEventListener("keydown", onKeyDown);
      target?.removeEventListener("keyup", onKeyUp);
      target?.removeEventListener("blur", onBlur);
      heldKeys.clear();
      pendingActions.clear();
    },
  };
}
