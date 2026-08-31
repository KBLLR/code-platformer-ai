/**
 * Shared character-control contract.
 *
 * Every input device produces the same `CharacterInputFrame`, and the animation
 * layer consumes only that. Nothing below the input sources knows about button
 * indexes, key codes, or which brand of controller is plugged in.
 *
 * This module is deliberately free of three.js and of any product's scene code
 * so both Toybox Arena (vanilla three) and Rigging Portal (react-three-fiber)
 * can consume an identical contract.
 */

/** One-shot actions the character can perform. */
export const ONE_SHOT_ACTIONS = ["jump", "punch", "kick", "push"] as const;
export type OneShotAction = (typeof ONE_SHOT_ACTIONS)[number];

/** Continuous locomotion states blended by movement magnitude. */
export const LOCOMOTION_STATES = ["idle", "walk", "run"] as const;
export type LocomotionState = (typeof LOCOMOTION_STATES)[number];

/** Every clip the state machine can ask a character for. */
export const SEMANTIC_MOTIONS = [
  ...LOCOMOTION_STATES,
  ...ONE_SHOT_ACTIONS,
] as const;
export type SemanticMotion = (typeof SEMANTIC_MOTIONS)[number];

export function isOneShotAction(value: string): value is OneShotAction {
  return (ONE_SHOT_ACTIONS as readonly string[]).includes(value);
}

/**
 * One frame of semantic intent.
 *
 * `move`/`look` are already deadzoned and normalized. Action fields are
 * rising-edge only: they are true for exactly the frame the button went down,
 * so holding a button never retriggers an action.
 */
export interface CharacterInputFrame {
  /** Strafe axis, -1 (left) .. 1 (right). */
  readonly moveX: number;
  /** Forward axis, -1 (back) .. 1 (forward). */
  readonly moveY: number;
  /** Movement magnitude 0..1 after radial deadzone. Drives the blend tree. */
  readonly speed: number;
  /** Camera/look delta for this frame. */
  readonly lookX: number;
  readonly lookY: number;
  /** Held sprint modifier, if the profile binds one. */
  readonly sprint: boolean;
  /** Rising-edge action requests for this frame. */
  readonly actions: Readonly<Record<OneShotAction, boolean>>;
  readonly connected: boolean;
  readonly sourceId: string;
}

export interface InputSource {
  /** Sample the device and advance edge detection. Called once per frame. */
  readonly sample: (nowMs: number) => CharacterInputFrame;
  readonly dispose: () => void;
}

const NO_ACTIONS: Readonly<Record<OneShotAction, boolean>> = Object.freeze({
  jump: false,
  punch: false,
  kick: false,
  push: false,
});

export function emptyActions(): Readonly<Record<OneShotAction, boolean>> {
  return NO_ACTIONS;
}

export function idleFrame(sourceId: string, connected = false): CharacterInputFrame {
  return {
    moveX: 0,
    moveY: 0,
    speed: 0,
    lookX: 0,
    lookY: 0,
    sprint: false,
    actions: NO_ACTIONS,
    connected,
    sourceId,
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Radial deadzone.
 *
 * Applied to the stick vector rather than to each axis independently: a
 * per-axis deadzone leaves a square dead area, so a stick resting diagonally
 * can still report movement on both axes and creep the character forward.
 * Beyond the threshold the magnitude is rescaled to 0..1 so the first
 * responsive position is a true zero rather than a step up to `deadzone`.
 */
export function applyRadialDeadzone(
  x: number,
  y: number,
  deadzone: number,
): { x: number; y: number; magnitude: number } {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const raw = Math.hypot(safeX, safeY);
  const limit = clamp01(deadzone);
  if (raw <= limit || raw === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const scaled = clamp01((raw - limit) / (1 - limit || 1));
  const scale = scaled / raw;
  return { x: safeX * scale, y: safeY * scale, magnitude: scaled };
}
