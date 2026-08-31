/**
 * Controller calibration.
 *
 * A generic Bluetooth pad can arrive with an empty `mapping`, in which case the
 * browser has not normalized it and no index can be assumed. Rather than guess,
 * the operator is walked through "press the button for JUMP", and the resulting
 * profile is persisted against the controller identity.
 *
 * Pure state machine: it is told which button went down and returns what to ask
 * next, so the flow is testable without hardware.
 */

import { ONE_SHOT_ACTIONS, type OneShotAction } from "./types";

export interface CalibrationState {
  readonly active: boolean;
  /** The action currently being captured, or null when finished. */
  readonly awaiting: OneShotAction | null;
  readonly captured: Readonly<Partial<Record<OneShotAction, number>>>;
  readonly completed: boolean;
}

export interface CalibrationStep {
  readonly state: CalibrationState;
  /** Set when this input completed a binding, for the caller to persist. */
  readonly assigned: { action: OneShotAction; buttonIndex: number } | null;
}

const IDLE: CalibrationState = Object.freeze({
  active: false,
  awaiting: null,
  captured: Object.freeze({}),
  completed: false,
});

export function idleCalibration(): CalibrationState {
  return IDLE;
}

export function beginCalibration(
  order: readonly OneShotAction[] = ONE_SHOT_ACTIONS,
): CalibrationState {
  const first = order[0] ?? null;
  return Object.freeze({
    active: first !== null,
    awaiting: first,
    captured: Object.freeze({}),
    completed: first === null,
  });
}

export function cancelCalibration(): CalibrationState {
  return IDLE;
}

/**
 * Record a pressed button against the action being awaited.
 *
 * A button already bound to an earlier action is refused, so one physical
 * button cannot silently serve two actions and leave a later one unreachable.
 */
export function captureButton(
  state: CalibrationState,
  buttonIndex: number,
  order: readonly OneShotAction[] = ONE_SHOT_ACTIONS,
): CalibrationStep {
  if (!state.active || state.awaiting === null) {
    return { state, assigned: null };
  }
  if (!Number.isInteger(buttonIndex) || buttonIndex < 0) {
    return { state, assigned: null };
  }
  const taken = Object.entries(state.captured).find(
    ([action, index]) => index === buttonIndex && action !== state.awaiting,
  );
  if (taken) return { state, assigned: null };

  const action = state.awaiting;
  const captured = Object.freeze({ ...state.captured, [action]: buttonIndex });
  const position = order.indexOf(action);
  const next = position >= 0 ? (order[position + 1] ?? null) : null;

  return {
    state: Object.freeze({
      active: next !== null,
      awaiting: next,
      captured,
      completed: next === null,
    }),
    assigned: { action, buttonIndex },
  };
}

export function calibrationPrompt(state: CalibrationState): string | null {
  if (!state.active || !state.awaiting) return null;
  return `Press the button for ${state.awaiting.toUpperCase()}`;
}
