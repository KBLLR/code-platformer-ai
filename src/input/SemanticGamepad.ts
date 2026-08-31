/**
 * Toybox Arena adapter for the shared character-control input layer.
 *
 * `ActionMap` previously read pad buttons by hard-coded index — 0 for jump,
 * 2 for attack, 1/7 for item, 9 for pause. Those indexes are the W3C Standard
 * Gamepad *positions*, not letters, so on the operator's Nintendo-layout pad
 * index 0 is the button printed **B** and index 1 is **A**. Jump therefore sat
 * on the wrong button.
 *
 * This adapter resolves the same intents through the shared profile layer,
 * which derives indexes from physical position and falls back to calibration on
 * a pad the browser could not normalize. Keyboard handling stays in
 * `ActionMap`; only the pad path changes.
 */

import {
  createGamepadInputSource,
  type GamepadInputSource,
  type GamepadSnapshot,
} from "../lib/character-control";

export interface ToyboxPadFrame {
  /** Strafe axis after radial deadzone, -1..1. */
  readonly moveX: number;
  /** Movement magnitude 0..1, so a light stick can walk rather than run. */
  readonly speed: number;
  /** Rising-edge only; a held button never repeats. */
  readonly jumpPressed: boolean;
  readonly attackPressed: boolean;
  readonly itemPressed: boolean;
  readonly connected: boolean;
}

export interface SemanticGamepad {
  readonly read: (nowMs: number) => ToyboxPadFrame;
  readonly snapshot: () => GamepadSnapshot;
  readonly source: GamepadInputSource;
  readonly dispose: () => void;
}

const IDLE: ToyboxPadFrame = Object.freeze({
  moveX: 0,
  speed: 0,
  jumpPressed: false,
  attackPressed: false,
  itemPressed: false,
  connected: false,
});

export function createSemanticGamepad(
  options: { deadzone?: number } = {},
): SemanticGamepad {
  const source = createGamepadInputSource({ deadzone: options.deadzone });

  return {
    read(nowMs: number): ToyboxPadFrame {
      const frame = source.sample(nowMs);
      if (!frame.connected) return IDLE;
      return {
        moveX: frame.moveX,
        speed: frame.speed,
        // Arena intents map onto the shared semantic actions: the button
        // printed A jumps, X attacks, B is the secondary/item action.
        jumpPressed: frame.actions.jump,
        attackPressed: frame.actions.punch,
        itemPressed: frame.actions.kick,
        connected: true,
      };
    },
    snapshot: () => source.snapshot(),
    source,
    dispose: () => source.dispose(),
  };
}
