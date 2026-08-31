/**
 * Gamepad input source.
 *
 * `navigator.getGamepads()` returns snapshots rather than live objects, so the
 * pad must be re-queried every frame and `gamepad.index` is the only stable
 * key across frames. Indexes can also be reused after a disconnect, so identity
 * is re-checked against `id` before state is carried forward.
 */

import {
  DEFAULT_DEADZONE,
  isProfileUsable,
  resolveProfile,
  storageKeyFor,
  type ControllerProfile,
} from "./gamepad-profile";
import {
  ONE_SHOT_ACTIONS,
  applyRadialDeadzone,
  clamp,
  idleFrame,
  type CharacterInputFrame,
  type InputSource,
  type OneShotAction,
} from "./types";

export interface GamepadSnapshot {
  readonly connected: boolean;
  readonly id: string;
  readonly mapping: string;
  readonly index: number;
  readonly buttonCount: number;
  readonly axisCount: number;
  readonly axes: readonly number[];
  readonly buttonValues: readonly number[];
  readonly timestamp: number;
  /** Button that most recently went down, for calibration display. */
  readonly lastPressedIndex: number | null;
}

export interface ProfileStore {
  readonly load: (key: string) => ControllerProfile | null;
  readonly save: (key: string, profile: ControllerProfile) => void;
}

/** Persists calibration per controller identity. Degrades to memory-only. */
export function createLocalProfileStore(
  namespace = "corex.character-control.profile",
): ProfileStore {
  const memory = new Map<string, ControllerProfile>();
  const storage = (): Storage | null => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      // Private windows and blocked site data throw on access, not on use.
      return null;
    }
  };
  return {
    load(key) {
      if (memory.has(key)) return memory.get(key) ?? null;
      const store = storage();
      if (!store) return null;
      try {
        const raw = store.getItem(`${namespace}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ControllerProfile;
        return isProfileUsable(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(key, profile) {
      memory.set(key, profile);
      const store = storage();
      if (!store) return;
      try {
        store.setItem(`${namespace}:${key}`, JSON.stringify(profile));
      } catch {
        // Quota or blocked storage: the in-memory copy still serves this session.
      }
    },
  };
}

export interface GamepadSourceOptions {
  readonly deadzone?: number;
  readonly lookSensitivity?: number;
  readonly profileStore?: ProfileStore;
  /** Test seam; defaults to navigator.getGamepads. */
  readonly getGamepads?: () => ReadonlyArray<Gamepad | null>;
}

export interface GamepadInputSource extends InputSource {
  readonly snapshot: () => GamepadSnapshot;
  readonly profile: () => ControllerProfile | null;
  /** Bind one action to a raw button index and persist the result. */
  readonly assignAction: (action: OneShotAction, buttonIndex: number) => void;
  readonly setDeadzone: (deadzone: number) => void;
}

const DISCONNECTED: GamepadSnapshot = Object.freeze({
  connected: false,
  id: "",
  mapping: "",
  index: -1,
  buttonCount: 0,
  axisCount: 0,
  axes: Object.freeze([]),
  buttonValues: Object.freeze([]),
  timestamp: 0,
  lastPressedIndex: null,
});

function pressed(button: GamepadButton | undefined): boolean {
  return Boolean(button && (button.pressed || button.value > 0.5));
}

export function createGamepadInputSource(
  options: GamepadSourceOptions = {},
): GamepadInputSource {
  const store = options.profileStore ?? createLocalProfileStore();
  const lookSensitivity = options.lookSensitivity ?? 0.08;
  let deadzoneOverride = options.deadzone ?? null;

  const read =
    options.getGamepads ??
    (() =>
      typeof navigator !== "undefined" && typeof navigator.getGamepads === "function"
        ? Array.from(navigator.getGamepads() ?? [])
        : []);

  let profile: ControllerProfile | null = null;
  let identity = "";
  let held = new Map<number, boolean>();
  let snapshot: GamepadSnapshot = DISCONNECTED;
  let lastPressedIndex: number | null = null;

  const onConnected = () => {
    /* Presence is detected by polling; the listener keeps Firefox exposing pads. */
  };
  const onDisconnected = () => {
    reset();
  };

  function reset(): void {
    held = new Map();
    profile = null;
    identity = "";
    lastPressedIndex = null;
    snapshot = DISCONNECTED;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
  }

  function activeProfile(pad: Gamepad): ControllerProfile {
    const key = storageKeyFor(pad.id, pad.mapping);
    if (identity !== key || !profile) {
      identity = key;
      profile = resolveProfile(pad.id, pad.mapping, store.load(key));
      held = new Map();
    }
    return profile;
  }

  function sample(): CharacterInputFrame {
    const pad = read().find(Boolean) ?? null;
    if (!pad) {
      if (snapshot.connected) reset();
      return idleFrame("gamepad", false);
    }

    const current = activeProfile(pad);
    const deadzone = deadzoneOverride ?? current.deadzone ?? DEFAULT_DEADZONE;

    const rawX = pad.axes[current.axes.leftStickX] ?? 0;
    // Gamepad Y is negative-up; character forward is positive.
    const rawY = -(pad.axes[current.axes.leftStickY] ?? 0);
    const move = applyRadialDeadzone(rawX, rawY, deadzone);

    const look = applyRadialDeadzone(
      pad.axes[current.axes.rightStickX] ?? 0,
      pad.axes[current.axes.rightStickY] ?? 0,
      deadzone,
    );

    const actions: Record<OneShotAction, boolean> = {
      jump: false,
      punch: false,
      kick: false,
      push: false,
    };

    // Rising edge per bound button: held buttons must never retrigger.
    const seen = new Map<number, boolean>();
    for (const action of ONE_SHOT_ACTIONS) {
      const index = current.actionButtons[action];
      if (!Number.isInteger(index) || index < 0) continue;
      const down = pressed(pad.buttons[index]);
      seen.set(index, down);
      if (down && !held.get(index)) actions[action] = true;
    }

    // Track every button so calibration can name one the profile does not bind.
    let newestPress: number | null = null;
    for (let index = 0; index < pad.buttons.length; index += 1) {
      const down = seen.get(index) ?? pressed(pad.buttons[index]);
      if (down && !held.get(index)) newestPress = index;
      seen.set(index, down);
    }
    if (newestPress !== null) lastPressedIndex = newestPress;
    held = seen;

    const sprint =
      current.sprintButton === null
        ? false
        : pressed(pad.buttons[current.sprintButton]);

    snapshot = Object.freeze({
      connected: true,
      id: pad.id,
      mapping: pad.mapping,
      index: pad.index,
      buttonCount: pad.buttons.length,
      axisCount: pad.axes.length,
      axes: Object.freeze(pad.axes.map((value) => value)),
      buttonValues: Object.freeze(pad.buttons.map((button) => button?.value ?? 0)),
      timestamp: pad.timestamp ?? 0,
      lastPressedIndex,
    });

    return {
      moveX: clamp(move.x, -1, 1),
      moveY: clamp(move.y, -1, 1),
      speed: move.magnitude,
      lookX: look.x * lookSensitivity,
      lookY: look.y * lookSensitivity,
      sprint,
      actions,
      connected: true,
      sourceId: "gamepad",
    };
  }

  return {
    sample,
    snapshot: () => snapshot,
    profile: () => profile,
    assignAction(action, buttonIndex) {
      if (!profile || !Number.isInteger(buttonIndex) || buttonIndex < 0) return;
      const next: ControllerProfile = Object.freeze({
        ...profile,
        actionButtons: Object.freeze({
          ...profile.actionButtons,
          [action]: buttonIndex,
        }),
        calibrated: true,
        label: `${profile.label} · calibrated`,
      });
      profile = next;
      if (identity) store.save(identity, next);
    },
    setDeadzone(value) {
      deadzoneOverride = clamp(value, 0, 0.95);
    },
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener("gamepadconnected", onConnected);
        window.removeEventListener("gamepaddisconnected", onDisconnected);
      }
      reset();
    },
  };
}
