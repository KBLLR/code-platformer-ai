/**
 * Controller profiles.
 *
 * The W3C Standard Gamepad defines button indexes by *physical position*, not
 * by the letters printed on the shell:
 *
 *   0 = bottom of right cluster    2 = left of right cluster
 *   1 = right of right cluster     3 = top of right cluster
 *
 * That matters here because the operator's pad uses the Nintendo face layout
 * (X top, A right, B bottom, Y left) while most defaults assume the Xbox layout
 * (Y top, B right, A bottom, X left). The two agree on positions and disagree
 * on labels, so binding "A = index 0" would put JUMP on the button printed B.
 *
 * We therefore never bind a label to an index directly. A layout says where
 * each label physically sits, and the index falls out of the position.
 *
 * Spec: https://w3c.github.io/gamepad/  ·  MDN: Using the Gamepad API
 */

import type { OneShotAction } from "./types";

/** Standard Gamepad face-button indexes, by physical position. */
export const FACE_POSITION_INDEX = Object.freeze({
  bottom: 0,
  right: 1,
  left: 2,
  top: 3,
});
export type FacePosition = keyof typeof FACE_POSITION_INDEX;

/** Standard Gamepad axes. */
export const STANDARD_AXES = Object.freeze({
  leftStickX: 0,
  leftStickY: 1,
  rightStickX: 2,
  rightStickY: 3,
});

/** Standard Gamepad shoulder/trigger indexes. */
export const STANDARD_SHOULDERS = Object.freeze({
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
});

export type FaceLabel = "A" | "B" | "X" | "Y";

/** Where each printed label physically sits on the face cluster. */
export type FaceLayout = Readonly<Record<FaceLabel, FacePosition>>;

export const NINTENDO_FACE_LAYOUT: FaceLayout = Object.freeze({
  X: "top",
  A: "right",
  B: "bottom",
  Y: "left",
});

export const XBOX_FACE_LAYOUT: FaceLayout = Object.freeze({
  Y: "top",
  B: "right",
  A: "bottom",
  X: "left",
});

/**
 * Operator-requested semantic layout, expressed in printed labels:
 * A = JUMP, X = PUNCH, B = KICK, Y = PUSH.
 */
export const DEFAULT_ACTION_LABELS: Readonly<Record<OneShotAction, FaceLabel>> =
  Object.freeze({
    jump: "A",
    punch: "X",
    kick: "B",
    push: "Y",
  });

export interface ControllerProfile {
  /** Stable identity used for persistence. */
  readonly profileId: string;
  readonly label: string;
  /** Button index per semantic action. */
  readonly actionButtons: Readonly<Record<OneShotAction, number>>;
  /** Held sprint modifier, or null when the profile binds none. */
  readonly sprintButton: number | null;
  readonly axes: typeof STANDARD_AXES;
  /** Radial deadzone, 0..1. */
  readonly deadzone: number;
  /** True when derived from a browser-reported "standard" mapping. */
  readonly fromStandardMapping: boolean;
  /** Set when the profile came from operator calibration. */
  readonly calibrated: boolean;
}

export const DEFAULT_DEADZONE = 0.15;

/** Resolve label bindings into button indexes through physical position. */
export function actionButtonsForLayout(
  layout: FaceLayout,
  labels: Readonly<Record<OneShotAction, FaceLabel>> = DEFAULT_ACTION_LABELS,
): Record<OneShotAction, number> {
  return {
    jump: FACE_POSITION_INDEX[layout[labels.jump]],
    punch: FACE_POSITION_INDEX[layout[labels.punch]],
    kick: FACE_POSITION_INDEX[layout[labels.kick]],
    push: FACE_POSITION_INDEX[layout[labels.push]],
  };
}

export function createStandardProfile(options: {
  profileId: string;
  label: string;
  layout: FaceLayout;
  deadzone?: number;
  sprintButton?: number | null;
}): ControllerProfile {
  return Object.freeze({
    profileId: options.profileId,
    label: options.label,
    actionButtons: Object.freeze(actionButtonsForLayout(options.layout)),
    sprintButton:
      options.sprintButton === undefined
        ? STANDARD_SHOULDERS.leftTrigger
        : options.sprintButton,
    axes: STANDARD_AXES,
    deadzone: options.deadzone ?? DEFAULT_DEADZONE,
    fromStandardMapping: true,
    calibrated: false,
  });
}

export const NINTENDO_STANDARD_PROFILE = createStandardProfile({
  profileId: "standard:nintendo-face",
  label: "Standard mapping · Nintendo face layout",
  layout: NINTENDO_FACE_LAYOUT,
});

export const XBOX_STANDARD_PROFILE = createStandardProfile({
  profileId: "standard:xbox-face",
  label: "Standard mapping · Xbox face layout",
  layout: XBOX_FACE_LAYOUT,
});

/**
 * Heuristic only, and only ever used to pick which *labels* sit where — never
 * to bypass calibration. If the id gives us nothing we assume the Nintendo
 * layout, because that is the operator's current pad; a wrong guess here is
 * still correctable in one calibration pass.
 */
export function guessFaceLayout(gamepadId: string): FaceLayout {
  const id = String(gamepadId || "").toLowerCase();
  if (/xbox|xinput|x-input|microsoft/.test(id)) return XBOX_FACE_LAYOUT;
  if (/nintendo|switch|joy-?con|pro controller/.test(id)) {
    return NINTENDO_FACE_LAYOUT;
  }
  if (/playstation|dualshock|dualsense|sony/.test(id)) {
    // PlayStation shapes sit in the same positions as the Xbox letters for
    // our purposes: cross bottom, circle right, square left, triangle top.
    return XBOX_FACE_LAYOUT;
  }
  return NINTENDO_FACE_LAYOUT;
}

/**
 * A profile for a pad whose mapping the browser could not normalize. Nothing is
 * bound: the caller must calibrate. We fail into calibration rather than
 * guessing indexes on an unknown layout.
 */
export function createUnmappedProfile(gamepadId: string): ControllerProfile {
  return Object.freeze({
    profileId: `unmapped:${storageKeyFor(gamepadId, "")}`,
    label: "Unrecognized mapping · calibration required",
    actionButtons: Object.freeze({ jump: -1, punch: -1, kick: -1, push: -1 }),
    sprintButton: null,
    axes: STANDARD_AXES,
    deadzone: DEFAULT_DEADZONE,
    fromStandardMapping: false,
    calibrated: false,
  });
}

/** True when every action resolves to a real button index. */
export function isProfileComplete(profile: ControllerProfile): boolean {
  return Object.values(profile.actionButtons).every(
    (index) => Number.isInteger(index) && index >= 0,
  );
}

/**
 * True when a profile is worth keeping.
 *
 * Calibration binds one action at a time, so a half-finished profile is real
 * operator intent and must survive a reload — otherwise the operator would have
 * to complete all four bindings in a single sitting or lose the lot.
 */
export function isProfileUsable(profile: ControllerProfile): boolean {
  return profile.calibrated || isProfileComplete(profile);
}

export function storageKeyFor(gamepadId: string, mapping: string): string {
  const id = String(gamepadId || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${id}:${mapping || "none"}`;
}

/**
 * Choose a profile for a freshly seen pad. A saved calibration always wins;
 * otherwise a "standard" mapping gets positional defaults and anything else
 * falls through to calibration.
 */
export function resolveProfile(
  gamepadId: string,
  mapping: string,
  saved: ControllerProfile | null,
): ControllerProfile {
  if (saved && isProfileUsable(saved)) return saved;
  if (mapping === "standard") {
    const layout = guessFaceLayout(gamepadId);
    return createStandardProfile({
      profileId: `standard:${storageKeyFor(gamepadId, mapping)}`,
      label:
        layout === XBOX_FACE_LAYOUT
          ? "Standard mapping · Xbox face layout"
          : "Standard mapping · Nintendo face layout",
      layout,
    });
  }
  return createUnmappedProfile(gamepadId);
}
