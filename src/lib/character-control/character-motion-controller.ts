/**
 * Character motion controller.
 *
 * Binds the pure state machine to a three.js `AnimationMixer`. This is the only
 * module in `character-control` that imports three, so the input layer, blend
 * tree and action policy stay testable without a renderer.
 *
 * Two layers, per the agreed architecture:
 *
 *   locomotion   idle/walk/run held resident, weights driven by speed
 *   action       jump/punch/kick/push, LoopOnce, fades over locomotion
 *
 * Locomotion crossfades are done by writing effective weights rather than by
 * `crossFadeTo`. A blend tree needs all three weights every frame, and three's
 * crossfade bookkeeping assumes a pairwise handover — driving weights directly
 * keeps the tree continuous and keeps the action fade independent of it.
 */

import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
} from "three";

import { ActionLayer } from "./action-layer";
import {
  dampAngle,
  damp,
  dominantLocomotion,
  locomotionWeights,
  type LocomotionWeights,
} from "./locomotion";
import { DEFAULT_MOTION_CONFIG, type MotionConfig } from "./motion-config";
import { resolveMotions, type MotionResolution } from "./motion-semantics";
import {
  ONE_SHOT_ACTIONS,
  clamp01,
  isOneShotAction,
  type CharacterInputFrame,
  type LocomotionState,
  type OneShotAction,
  type SemanticMotion,
} from "./types";

export interface CharacterMotionState {
  readonly locomotion: LocomotionState;
  readonly weights: LocomotionWeights;
  /** Smoothed speed actually driving the blend, 0..1. */
  readonly speed: number;
  /** Smoothed heading in radians, or null when the character is not moving. */
  readonly heading: number | null;
  readonly activeAction: OneShotAction | null;
  readonly bufferedAction: OneShotAction | null;
  readonly actionWeight: number;
  readonly missingMotions: readonly SemanticMotion[];
}

export interface CharacterMotionControllerOptions {
  readonly mixer: AnimationMixer;
  readonly clips: readonly AnimationClip[];
  readonly config?: MotionConfig;
  /** Force a specific clip for a semantic motion. */
  readonly clipOverrides?: Partial<Record<SemanticMotion, string>>;
}

export class CharacterMotionController {
  private readonly mixer: AnimationMixer;
  private readonly config: MotionConfig;
  private readonly resolution: MotionResolution;
  private readonly actions = new Map<SemanticMotion, AnimationAction>();
  private readonly actionLayer: ActionLayer;

  private smoothedSpeed = 0;
  private heading: number | null = null;
  private actionWeight = 0;
  private activeToken: number | null = null;
  private disposed = false;

  private readonly onFinished = (event: { action: AnimationAction }) => {
    if (this.activeToken === null) return;
    const finished = event.action;
    const active = this.actionLayer.current;
    if (!active) return;
    const expected = this.actions.get(active.action);
    if (expected && expected !== finished) return;
    if (this.actionLayer.notifyFinished(this.activeToken)) {
      this.activeToken = null;
    }
  };

  constructor(options: CharacterMotionControllerOptions) {
    this.mixer = options.mixer;
    this.config = options.config ?? DEFAULT_MOTION_CONFIG;
    this.resolution = resolveMotions(
      options.clips.map((clip) => clip.name),
      options.clipOverrides,
    );

    const byName = new Map(options.clips.map((clip) => [clip.name, clip]));
    for (const [motion, clipName] of Object.entries(this.resolution.map) as [
      SemanticMotion,
      string | null,
    ][]) {
      if (!clipName) continue;
      const clip = byName.get(clipName);
      if (!clip) continue;
      // Cache once. Recreating clipActions per frame leaks mixer state and
      // silently resets weights.
      const action = this.mixer.clipAction(clip);
      this.actions.set(motion, action);
    }

    this.prepareLocomotion();
    this.prepareActions();

    this.actionLayer = new ActionLayer({
      config: this.config,
      isAvailable: (action) => this.actions.has(action),
    });

    this.mixer.addEventListener("finished", this.onFinished as never);
  }

  /** Semantic motions this character cannot perform. */
  get missingMotions(): readonly SemanticMotion[] {
    return this.resolution.missing;
  }

  get motionMap() {
    return this.resolution.map;
  }

  private prepareLocomotion(): void {
    let reference: AnimationAction | null = null;
    for (const motion of ["idle", "walk", "run"] as const) {
      const action = this.actions.get(motion);
      if (!action) continue;
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(motion === "idle" ? 1 : 0);
      action.play();
      // Share a phase so feet do not pop when walk hands over to run.
      if (reference && motion !== "idle") action.syncWith(reference);
      if (motion === "walk") reference = action;
    }
  }

  private prepareActions(): void {
    for (const action of ONE_SHOT_ACTIONS) {
      const clipAction = this.actions.get(action);
      if (!clipAction) continue;
      clipAction.setLoop(LoopOnce, 1);
      // Hold the final pose so the fade back to locomotion has something to
      // blend from instead of snapping to the rest pose.
      clipAction.clampWhenFinished = true;
      clipAction.enabled = true;
      clipAction.setEffectiveWeight(0);
    }
  }

  /**
   * Advance one frame.
   *
   * `delta` is seconds since the last frame. The caller still owns
   * `mixer.update(delta)` so this controller never competes with the product's
   * existing render loop for mixer ownership.
   */
  update(
    frame: CharacterInputFrame,
    delta: number,
    nowMs: number,
  ): CharacterMotionState {
    if (this.disposed) return this.state(0);

    const step = Number.isFinite(delta) && delta > 0 ? delta : 0;

    for (const action of ONE_SHOT_ACTIONS) {
      if (frame.actions[action]) this.actionLayer.request(action, nowMs);
    }

    const started = this.actionLayer.update(nowMs, step);
    if (started) this.startAction(started.action, started.token);

    // Sprint only lifts a stick already past walking; it must not make a
    // resting stick move the character.
    const requested = clamp01(frame.speed);
    const target =
      frame.sprint && requested > this.config.thresholds.idleMax ? 1 : requested;

    const rising = target > this.smoothedSpeed;
    this.smoothedSpeed = clamp01(
      damp(
        this.smoothedSpeed,
        target,
        rising
          ? this.config.smoothing.accelerationTime
          : this.config.smoothing.decelerationTime,
        step,
      ),
    );

    if (requested > this.config.thresholds.idleMax) {
      const desired = Math.atan2(frame.moveX, frame.moveY);
      this.heading =
        this.heading === null
          ? desired
          : dampAngle(this.heading, desired, this.config.smoothing.turnTime, step);
    }

    const weights = locomotionWeights(this.smoothedSpeed, this.config.thresholds);

    const busy = this.actionLayer.isBusy;
    const fade = busy
      ? this.config.transitions.intoAction
      : this.config.transitions.outOfAction;
    this.actionWeight = clamp01(damp(this.actionWeight, busy ? 1 : 0, fade, step));
    // Exponential decay never reaches zero, and locomotion is scaled by
    // (1 - actionWeight), so a residual would dilute the character's pose for
    // the rest of the session. Settle it once it stops being visible.
    if (!busy && this.actionWeight < 1e-3) this.actionWeight = 0;

    this.applyWeights(weights);
    return this.state(this.smoothedSpeed, weights);
  }

  private startAction(action: OneShotAction, token: number): void {
    const clipAction = this.actions.get(action);
    if (!clipAction) return;

    for (const other of ONE_SHOT_ACTIONS) {
      if (other === action) continue;
      this.actions.get(other)?.stop();
    }

    clipAction.reset();
    clipAction.setLoop(LoopOnce, 1);
    clipAction.clampWhenFinished = true;
    clipAction.enabled = true;
    clipAction.setEffectiveTimeScale(1);
    clipAction.play();

    this.activeToken = token;
    const duration = clipAction.getClip()?.duration ?? null;
    this.actionLayer.setActiveDuration(
      token,
      typeof duration === "number" && duration > 0 ? duration : null,
    );
  }

  private applyWeights(weights: LocomotionWeights): void {
    const locomotionScale = 1 - this.actionWeight;
    this.actions.get("idle")?.setEffectiveWeight(weights.idle * locomotionScale);
    this.actions.get("walk")?.setEffectiveWeight(weights.walk * locomotionScale);
    this.actions.get("run")?.setEffectiveWeight(weights.run * locomotionScale);

    const active = this.actionLayer.current;
    for (const action of ONE_SHOT_ACTIONS) {
      const clipAction = this.actions.get(action);
      if (!clipAction) continue;
      const isActive = active?.action === action;
      clipAction.setEffectiveWeight(isActive ? this.actionWeight : 0);
    }
  }

  private state(
    speed: number,
    weights: LocomotionWeights = locomotionWeights(speed, this.config.thresholds),
  ): CharacterMotionState {
    const active = this.actionLayer.current?.action ?? null;
    const buffered = this.actionLayer.pending?.action ?? null;
    return {
      locomotion: dominantLocomotion(weights),
      weights,
      speed,
      heading: this.heading,
      activeAction: active && isOneShotAction(active) ? active : null,
      bufferedAction: buffered,
      actionWeight: this.actionWeight,
      missingMotions: this.resolution.missing,
    };
  }

  /** Clip names currently bound, for the debug overlay. */
  boundClips(): Record<string, string | null> {
    return { ...this.resolution.map };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener("finished", this.onFinished as never);
    for (const action of this.actions.values()) action.stop();
    this.actions.clear();
    this.actionLayer.reset();
  }
}
