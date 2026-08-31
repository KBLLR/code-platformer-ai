/**
 * Debug HUD model.
 *
 * Builds the overlay's contents as plain data so both products render the same
 * information without sharing a component. Development aid only — it is not
 * interface chrome and both products keep it behind a flag.
 */

import type { CalibrationState } from "./calibration";
import type { CharacterMotionState } from "./character-motion-controller";
import type { ControllerProfile } from "./gamepad-profile";
import { isProfileComplete } from "./gamepad-profile";
import type { GamepadSnapshot } from "./gamepad-source";
import { ONE_SHOT_ACTIONS, type SemanticMotion } from "./types";

export interface HudRow {
  readonly label: string;
  readonly value: string;
  /** `warn` marks something the operator probably needs to act on. */
  readonly tone: "normal" | "warn" | "good";
}

export interface HudModel {
  readonly rows: readonly HudRow[];
  readonly missingMotions: readonly SemanticMotion[];
  readonly calibrationPrompt: string | null;
  readonly needsCalibration: boolean;
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function buildHudModel(input: {
  snapshot: GamepadSnapshot;
  profile: ControllerProfile | null;
  motion: CharacterMotionState | null;
  calibration: CalibrationState;
  boundClips?: Record<string, string | null>;
}): HudModel {
  const { snapshot, profile, motion, calibration } = input;
  const rows: HudRow[] = [];

  rows.push({
    label: "controller",
    value: snapshot.connected ? snapshot.id || "(unnamed)" : "disconnected",
    tone: snapshot.connected ? "good" : "warn",
  });

  if (snapshot.connected) {
    rows.push({
      label: "mapping",
      value: snapshot.mapping || "(none — calibration required)",
      tone: snapshot.mapping === "standard" ? "good" : "warn",
    });
    rows.push({
      label: "buttons / axes",
      value: `${snapshot.buttonCount} / ${snapshot.axisCount}`,
      tone: "normal",
    });
    rows.push({
      label: "last button",
      value:
        snapshot.lastPressedIndex === null
          ? "—"
          : `#${snapshot.lastPressedIndex}`,
      tone: "normal",
    });
  }

  if (profile) {
    rows.push({ label: "profile", value: profile.label, tone: "normal" });
    for (const action of ONE_SHOT_ACTIONS) {
      const index = profile.actionButtons[action];
      rows.push({
        label: `  ${action}`,
        value: index >= 0 ? `button #${index}` : "unbound",
        tone: index >= 0 ? "normal" : "warn",
      });
    }
  }

  if (motion) {
    rows.push({ label: "speed", value: percent(motion.speed), tone: "normal" });
    rows.push({
      label: "locomotion",
      value: motion.locomotion,
      tone: "normal",
    });
    rows.push({
      label: "  idle / walk / run",
      value: `${percent(motion.weights.idle)} · ${percent(motion.weights.walk)} · ${percent(motion.weights.run)}`,
      tone: "normal",
    });
    rows.push({
      label: "action",
      value: motion.activeAction ?? "—",
      tone: "normal",
    });
    rows.push({
      label: "  weight",
      value: percent(motion.actionWeight),
      tone: "normal",
    });
    rows.push({
      label: "buffered",
      value: motion.bufferedAction ?? "—",
      tone: "normal",
    });
    rows.push({
      label: "heading",
      value:
        motion.heading === null
          ? "—"
          : `${Math.round((motion.heading * 180) / Math.PI)}°`,
      tone: "normal",
    });
  }

  if (input.boundClips) {
    for (const [motionName, clipName] of Object.entries(input.boundClips)) {
      rows.push({
        label: `clip ${motionName}`,
        value: clipName ?? "missing",
        tone: clipName ? "normal" : "warn",
      });
    }
  }

  const missing = motion?.missingMotions ?? [];
  const needsCalibration = Boolean(
    snapshot.connected && profile && !isProfileComplete(profile),
  );

  return {
    rows,
    missingMotions: missing,
    calibrationPrompt:
      calibration.active && calibration.awaiting
        ? `Press the button for ${calibration.awaiting.toUpperCase()}`
        : null,
    needsCalibration,
  };
}
