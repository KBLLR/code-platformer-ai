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

/** Which distribution layer the loaded character actually came from. */
export type CharacterSource =
  | "warehouse"
  | "snapshot"
  | "source-mirror"
  | "procedural-fallback";

export type LayerOutcome =
  | "success"
  | "missing"
  | "cors"
  | "unavailable"
  | "invalid"
  | "not-attempted";

/**
 * Why each distribution layer succeeded or failed.
 *
 * Recorded because a CORS or sync failure previously looked identical to a
 * successful load: the capsules rendered and nothing said the real character
 * had never arrived.
 */
export interface DistributionDiagnostics {
  readonly source: CharacterSource;
  readonly layers: ReadonlyArray<{
    readonly layer: "warehouse" | "snapshot" | "source-mirror";
    readonly outcome: LayerOutcome;
    readonly detail?: string;
  }>;
  readonly fallbackUsed: boolean;
  readonly fallbackReason?: string;
}

export interface HudModel {
  readonly rows: readonly HudRow[];
  readonly missingMotions: readonly SemanticMotion[];
  readonly unavailableActions: readonly string[];
  readonly calibrationPrompt: string | null;
  readonly needsCalibration: boolean;
  readonly characterSource: CharacterSource | null;
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
  distribution?: DistributionDiagnostics;
  characterId?: string;
}): HudModel {
  const { snapshot, profile, motion, calibration, distribution } = input;
  const rows: HudRow[] = [];

  if (input.characterId) {
    rows.push({ label: "character", value: input.characterId, tone: "normal" });
  }

  if (distribution) {
    // A procedural fallback is a failure state, not a successful load.
    rows.push({
      label: "character source",
      value: distribution.source,
      tone: distribution.source === "procedural-fallback" ? "warn" : "good",
    });
    if (distribution.fallbackUsed && distribution.fallbackReason) {
      rows.push({
        label: "  fallback reason",
        value: distribution.fallbackReason,
        tone: "warn",
      });
    }
    for (const layer of distribution.layers) {
      rows.push({
        label: `  ${layer.layer}`,
        value: layer.detail ? `${layer.outcome} · ${layer.detail}` : layer.outcome,
        tone:
          layer.outcome === "success"
            ? "good"
            : layer.outcome === "not-attempted"
              ? "normal"
              : "warn",
      });
    }
  }

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
      label: "  idle/walk/run/sprint",
      value: [
        percent(motion.weights.idle),
        percent(motion.weights.walk),
        percent(motion.weights.run),
        percent(motion.weights.sprint),
      ].join(" · "),
      tone: "normal",
    });
    rows.push({
      label: "action",
      value: motion.activeAction
        ? motion.activeStage && motion.activeStage !== motion.activeAction
          ? `${motion.activeAction} · ${motion.activeStage}`
          : motion.activeAction
        : "—",
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
  const unavailable = motion?.unavailableActions ?? [];

  // Actions the pad will recognize but the character cannot animate. Stated
  // explicitly so a dead button reads as a known gap rather than a broken input.
  for (const action of unavailable) {
    rows.push({
      label: `${action.toUpperCase()}`,
      value: "CLIP UNAVAILABLE",
      tone: "warn",
    });
  }

  const needsCalibration = Boolean(
    snapshot.connected && profile && !isProfileComplete(profile),
  );

  return {
    rows,
    missingMotions: missing,
    unavailableActions: unavailable,
    calibrationPrompt:
      calibration.active && calibration.awaiting
        ? `Press the button for ${calibration.awaiting.toUpperCase()}`
        : null,
    needsCalibration,
    characterSource: distribution?.source ?? null,
  };
}
