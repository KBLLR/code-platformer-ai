/**
 * Locomotion blend tree.
 *
 * Idle, walk and run are not three states with edges between them — they are
 * three weights over one continuous speed parameter. All three actions stay
 * resident on the mixer and only their effective weights change, so pushing the
 * stick further never cuts one clip and starts another.
 *
 * The weights always sum to 1, so the character is never partially posed.
 */

import type { LocomotionThresholds } from "./motion-config";
import { clamp01, type LocomotionState } from "./types";

export interface LocomotionWeights {
  readonly idle: number;
  readonly walk: number;
  readonly run: number;
}

/** Hermite smoothstep: zero derivative at both ends, so blends ease in and out. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = edge1 - edge0;
  if (span <= 0) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / span);
  return t * t * (3 - 2 * t);
}

/**
 * Weights for a given speed.
 *
 * Below `idleMax` the character is fully idle. Between `idleMax` and
 * `walkFull` idle hands over to walk; between `runStart` and `runFull` walk
 * hands over to run. The plateau between `walkFull` and `runStart` is a stable
 * walk, which keeps a lightly-held stick from shimmering between clips.
 */
export function locomotionWeights(
  speed: number,
  thresholds: LocomotionThresholds,
): LocomotionWeights {
  const value = clamp01(Number.isFinite(speed) ? speed : 0);

  const moving = smoothstep(thresholds.idleMax, thresholds.walkFull, value);
  const running = smoothstep(thresholds.runStart, thresholds.runFull, value);

  const idle = 1 - moving;
  const walk = moving * (1 - running);
  const run = moving * running;

  return { idle: clamp01(idle), walk: clamp01(walk), run: clamp01(run) };
}

/** The dominant state, for display and for deciding what to return to. */
export function dominantLocomotion(weights: LocomotionWeights): LocomotionState {
  if (weights.run >= weights.walk && weights.run >= weights.idle) return "run";
  if (weights.walk >= weights.idle) return "walk";
  return "idle";
}

/**
 * Frame-rate independent damping.
 *
 * `1 - exp(-dt/tau)` reaches the same fraction of the remaining distance per
 * unit of real time regardless of frame rate, unlike a fixed lerp factor which
 * moves faster when frames are quick.
 */
export function damp(
  current: number,
  target: number,
  timeConstant: number,
  delta: number,
): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  if (timeConstant <= 0 || delta <= 0) return target;
  const alpha = 1 - Math.exp(-delta / timeConstant);
  return current + (target - current) * alpha;
}

/** Shortest signed angular difference in radians, wrapped to (-PI, PI]. */
export function shortestAngleDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta <= -Math.PI) delta += twoPi;
  return delta;
}

/** Damp a heading the short way around the circle. */
export function dampAngle(
  current: number,
  target: number,
  timeConstant: number,
  delta: number,
): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  const difference = shortestAngleDelta(current, target);
  if (timeConstant <= 0 || delta <= 0) return target;
  const alpha = 1 - Math.exp(-delta / timeConstant);
  return current + difference * alpha;
}
