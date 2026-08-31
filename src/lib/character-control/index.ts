/**
 * Shared character-control contract.
 *
 * Consumed by Rigging Portal and Toybox Arena. The two products keep separate
 * repositories, so this directory is duplicated verbatim rather than published
 * as a package — see the architecture note in
 * `docs/2026-08-30-gamepad-character-control.md` for why, and for what would
 * have to be true before it becomes a real shared dependency.
 *
 * Layering, strictest first:
 *
 *   types            semantic frame contract, deadzone maths — no DOM, no three
 *   gamepad-profile  W3C positional mapping, face layouts, calibration profiles
 *   gamepad-source   navigator.getGamepads polling — DOM, no three
 *   keyboard-source  same frame contract from the keyboard — DOM, no three
 *   locomotion       blend weights and damping — pure
 *   action-layer     one-shot policy, buffering, interrupts — pure
 *   motion-semantics clip-name resolution — pure
 *   character-motion-controller   the only module that imports three
 */

export * from "./types";
export * from "./gamepad-profile";
export * from "./gamepad-source";
export * from "./keyboard-source";
export * from "./locomotion";
export * from "./action-layer";
export * from "./motion-config";
export * from "./motion-semantics";
export * from "./calibration";
export * from "./hud-model";
export * from "./character-motion-controller";
