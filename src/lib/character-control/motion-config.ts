/**
 * Tunable motion configuration.
 *
 * Every duration and threshold the character controller uses lives here so the
 * operator can tune feel in one place. These are starting values chosen to feel
 * responsive without popping — they are not canon, and they are expected to
 * change during live-controller tuning.
 */

import type { OneShotAction } from "./types";

export interface LocomotionThresholds {
  /** At or below this the character is fully idle. */
  readonly idleMax: number;
  /** Speed at which walk reaches full weight. */
  readonly walkFull: number;
  /** Speed at which run begins to take over. */
  readonly runStart: number;
  /** Speed at which run reaches full weight. */
  readonly runFull: number;
}

export interface TransitionDurations {
  readonly idleWalk: number;
  readonly walkRun: number;
  readonly intoAction: number;
  readonly outOfAction: number;
  readonly intoJump: number;
}

export interface MovementSmoothing {
  /** Seconds to approach a higher speed. */
  readonly accelerationTime: number;
  /** Seconds to approach a lower speed. */
  readonly decelerationTime: number;
  /** Seconds to turn toward a new heading. */
  readonly turnTime: number;
}

export interface MotionConfig {
  readonly thresholds: LocomotionThresholds;
  readonly transitions: TransitionDurations;
  readonly smoothing: MovementSmoothing;
  /** How long an action request stays valid while waiting its turn. */
  readonly inputBufferMs: number;
  /**
   * Fraction of an action clip after which another action may interrupt it.
   * Below this the action is committed, so mashing cannot cancel every frame.
   */
  readonly actionInterruptAfter: number;
  /** Actions that may cut short a running action once past the window. */
  readonly interruptPriority: Readonly<Record<OneShotAction, number>>;
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = Object.freeze({
  thresholds: Object.freeze({
    idleMax: 0.05,
    walkFull: 0.45,
    runStart: 0.6,
    runFull: 1.0,
  }),
  transitions: Object.freeze({
    idleWalk: 0.2,
    walkRun: 0.25,
    intoAction: 0.12,
    outOfAction: 0.2,
    intoJump: 0.1,
  }),
  smoothing: Object.freeze({
    accelerationTime: 0.18,
    decelerationTime: 0.12,
    turnTime: 0.12,
  }),
  inputBufferMs: 150,
  actionInterruptAfter: 0.7,
  interruptPriority: Object.freeze({
    jump: 3,
    kick: 2,
    punch: 1,
    push: 1,
  }),
});

export function mergeMotionConfig(
  overrides: Partial<MotionConfig> = {},
): MotionConfig {
  return Object.freeze({
    ...DEFAULT_MOTION_CONFIG,
    ...overrides,
    thresholds: Object.freeze({
      ...DEFAULT_MOTION_CONFIG.thresholds,
      ...(overrides.thresholds ?? {}),
    }),
    transitions: Object.freeze({
      ...DEFAULT_MOTION_CONFIG.transitions,
      ...(overrides.transitions ?? {}),
    }),
    smoothing: Object.freeze({
      ...DEFAULT_MOTION_CONFIG.smoothing,
      ...(overrides.smoothing ?? {}),
    }),
    interruptPriority: Object.freeze({
      ...DEFAULT_MOTION_CONFIG.interruptPriority,
      ...(overrides.interruptPriority ?? {}),
    }),
  });
}
