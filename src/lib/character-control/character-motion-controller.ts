/**
 * Character motion controller.
 *
 * Binds the pure state machine to a three.js `AnimationMixer`. This is the only
 * module in `character-control` that imports three, so the input layer, blend
 * tree and action policy stay testable without a renderer.
 *
 * Two layers:
 *
 *   locomotion   idle/walk/run/sprint held resident, weights driven by speed
 *                and an explicit sprint modifier
 *   action       jump/punch/kick/push, LoopOnce, fading over locomotion
 *
 * Jump is one logical action but up to three clips — jump → fall → land —
 * chained on the mixer's `finished` event. A character that ships only `jump`
 * plays only that stage; nothing is invented to fill the gap.
 *
 * Locomotion crossfades are done by writing effective weights rather than by
 * `crossFadeTo`. A blend tree needs every weight each frame, while three's
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
  JUMP_STAGES,
  LOCOMOTION_STATES,
  ONE_SHOT_ACTIONS,
  clamp01,
  type CharacterInputFrame,
  type JumpStage,
  type LocomotionState,
  type OneShotAction,
  type SemanticMotion,
} from "./types";

export interface CharacterMotionState {
  readonly locomotion: LocomotionState;
  readonly weights: LocomotionWeights;
  /** Smoothed speed actually driving the blend, 0..1. */
  readonly speed: number;
  /** Smoothed heading in radians, or null when the character has not moved. */
  readonly heading: number | null;
  readonly activeAction: OneShotAction | null;
  /** Which clip of a multi-stage action is playing, e.g. `fall` during a jump. */
  readonly activeStage: SemanticMotion | null;
  readonly bufferedAction: OneShotAction | null;
  readonly actionWeight: number;
  readonly missingMotions: readonly SemanticMotion[];
  /** Actions the control layer accepts but this character cannot animate. */
  readonly unavailableActions: readonly OneShotAction[];
}

export interface CharacterMotionControllerOptions {
  readonly mixer: AnimationMixer;
  readonly clips: readonly AnimationClip[];
  readonly config?: MotionConfig;
  readonly clipOverrides?: Partial<Record<SemanticMotion, string>>;
}

export class CharacterMotionController {
  private readonly mixer: AnimationMixer;
  private readonly config: MotionConfig;
  private readonly resolution: MotionResolution;
  private readonly actions = new Map<SemanticMotion, AnimationAction>();
  private readonly actionLayer: ActionLayer;

  private smoothedSpeed = 0;
  private sprintBlend = 0;
  private heading: number | null = null;
  private actionWeight = 0;
  private activeToken: number | null = null;
  /** Remaining clips of the running action, current stage first. */
  private stageQueue: SemanticMotion[] = [];
  private currentStage: SemanticMotion | null = null;
  private stageWeights = new Map<SemanticMotion, number>();
  private airborneElapsed = 0;
  private disposed = false;

  private readonly onFinished = (event: { action: AnimationAction }) => {
    if (this.activeToken === null || !this.currentStage) return;
    const expected = this.actions.get(this.currentStage);
    if (expected && expected !== event.action) return;
    this.advanceStage();
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
      // Cached once. Recreating clipActions per frame leaks mixer state and
      // silently resets weights.
      this.actions.set(motion, this.mixer.clipAction(clip));
    }

    this.prepareLocomotion();
    this.prepareActionClips();

    this.actionLayer = new ActionLayer({
      config: this.config,
      isAvailable: (action) => this.stagesFor(action).length > 0,
    });

    this.mixer.addEventListener("finished", this.onFinished as never);
  }

  get missingMotions(): readonly SemanticMotion[] {
    return this.resolution.missing;
  }

  get motionMap() {
    return this.resolution.map;
  }

  /** Control actions with no clip on this character. */
  get unavailableActions(): readonly OneShotAction[] {
    return ONE_SHOT_ACTIONS.filter((action) => this.stagesFor(action).length === 0);
  }

  /** Clips that will actually play for an action, in order. */
  private stagesFor(action: OneShotAction): SemanticMotion[] {
    const candidates: readonly SemanticMotion[] =
      action === "jump" ? JUMP_STAGES : [action];
    return candidates.filter((stage) => this.actions.has(stage));
  }

  private prepareLocomotion(): void {
    let reference: AnimationAction | null = null;
    for (const motion of LOCOMOTION_STATES) {
      const action = this.actions.get(motion);
      if (!action) continue;
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(motion === "idle" ? 1 : 0);
      action.play();
      // Share a phase so feet do not pop when one gait hands over to the next.
      if (reference && motion !== "idle") action.syncWith(reference);
      if (motion === "walk") reference = action;
    }
  }

  private prepareActionClips(): void {
    const oneShots: SemanticMotion[] = [...JUMP_STAGES, "punch", "kick", "push"];
    for (const motion of oneShots) {
      const action = this.actions.get(motion);
      if (!action) continue;
      action.setLoop(LoopOnce, 1);
      // Hold the final pose so the next stage, or the fade back to locomotion,
      // has something to blend from instead of snapping to the rest pose.
      action.clampWhenFinished = true;
      action.enabled = true;
      action.setEffectiveWeight(0);
    }
  }

  /**
   * Advance one frame. `delta` is seconds since the last frame.
   *
   * The caller still owns `mixer.update(delta)`, so this controller never
   * competes with the product's render loop for mixer ownership.
   */
  update(
    frame: CharacterInputFrame,
    delta: number,
    nowMs: number,
  ): CharacterMotionState {
    if (this.disposed) return this.state();

    const step = Number.isFinite(delta) && delta > 0 ? delta : 0;

    for (const action of ONE_SHOT_ACTIONS) {
      // Requests for actions this character cannot animate are refused by the
      // layer, so the state machine stays stable and nothing else plays.
      if (frame.actions[action]) this.actionLayer.request(action, nowMs);
    }

    const started = this.actionLayer.update(nowMs, step);
    if (started) this.startAction(started.action, started.token);

    // The airborne stage loops, so nothing else would ever end it.
    if (this.currentStage === "fall") {
      this.airborneElapsed += step;
      if (this.airborneElapsed >= this.config.jumpAirborneSeconds) {
        this.advanceStage();
      }
    }

    const requested = clamp01(frame.speed);
    const rising = requested > this.smoothedSpeed;
    this.smoothedSpeed = clamp01(
      damp(
        this.smoothedSpeed,
        requested,
        rising
          ? this.config.smoothing.accelerationTime
          : this.config.smoothing.decelerationTime,
        step,
      ),
    );

    // Sprint eases in and out rather than snapping the moment the trigger moves.
    this.sprintBlend = clamp01(
      damp(
        this.sprintBlend,
        frame.sprint ? 1 : 0,
        this.config.transitions.walkRun,
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

    const weights = locomotionWeights(
      this.smoothedSpeed,
      this.config.thresholds,
      this.sprintBlend,
    );

    const busy = this.actionLayer.isBusy;
    const fade = busy
      ? this.config.transitions.intoAction
      : this.config.transitions.outOfAction;
    this.actionWeight = clamp01(damp(this.actionWeight, busy ? 1 : 0, fade, step));
    // Exponential decay never reaches zero, and locomotion is scaled by
    // (1 - actionWeight), so a residual would dilute the pose for the rest of
    // the session. Settle it once it stops being visible.
    if (!busy && this.actionWeight < 1e-3) {
      this.actionWeight = 0;
      this.stageWeights.clear();
    }

    this.advanceStageWeights(step);
    this.applyWeights(weights);
    return this.state(weights);
  }

  private startAction(action: OneShotAction, token: number): void {
    const stages = this.stagesFor(action);
    if (stages.length === 0) return;

    for (const motion of [...JUMP_STAGES, "punch", "kick", "push"] as const) {
      if (!stages.includes(motion)) this.actions.get(motion)?.stop();
    }

    this.activeToken = token;
    this.stageQueue = [...stages];
    this.currentStage = null;
    this.playNextStage();

    // Duration of the whole sequence, so the interrupt window covers the jump
    // rather than only its first stage. The airborne stage contributes its hold
    // time, not its clip length, which is a long looping fall.
    const total = stages.reduce((sum, stage) => {
      if (this.isHoldStage(stage)) return sum + this.config.jumpAirborneSeconds;
      const duration = this.actions.get(stage)?.getClip()?.duration ?? 0;
      return sum + (duration > 0 ? duration : 0);
    }, 0);
    this.actionLayer.setActiveDuration(token, total > 0 ? total : null);
  }

  /**
   * True for the airborne stage of a jump — the one that holds until the
   * character lands rather than playing to completion.
   */
  private isHoldStage(stage: SemanticMotion): boolean {
    return stage === "fall";
  }

  private playNextStage(): void {
    const next = this.stageQueue.shift() ?? null;
    this.currentStage = next;
    this.airborneElapsed = 0;
    if (!next) return;
    const action = this.actions.get(next);
    if (!action) {
      this.advanceStage();
      return;
    }
    action.reset();
    const hold = this.isHoldStage(next);
    // The airborne stage loops; the rest are one-shots that clamp on their
    // final frame so the next stage has a pose to blend from.
    action.setLoop(hold ? LoopRepeat : LoopOnce, hold ? Infinity : 1);
    action.clampWhenFinished = !hold;
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.play();
  }

  /**
   * Tell the controller the character has landed.
   *
   * The product owns world movement, so it owns when a jump ends. Without this
   * the airborne stage exits on `jumpAirborneSeconds` instead.
   */
  notifyGrounded(): void {
    if (this.currentStage === "fall") this.advanceStage();
  }

  private advanceStage(): void {
    if (this.stageQueue.length > 0) {
      this.playNextStage();
      return;
    }
    const token = this.activeToken;
    this.currentStage = null;
    this.activeToken = null;
    if (token !== null) this.actionLayer.notifyFinished(token);
  }

  /** Ease between stages so jump → fall → land does not cut. */
  private advanceStageWeights(step: number): void {
    const stages: SemanticMotion[] = [...JUMP_STAGES, "punch", "kick", "push"];
    for (const stage of stages) {
      if (!this.actions.has(stage)) continue;
      const target = this.currentStage === stage ? 1 : 0;
      const current = this.stageWeights.get(stage) ?? 0;
      if (current === target) continue;
      this.stageWeights.set(
        stage,
        clamp01(damp(current, target, this.config.transitions.intoAction, step)),
      );
    }
  }

  private applyWeights(weights: LocomotionWeights): void {
    const locomotionScale = 1 - this.actionWeight;
    for (const state of LOCOMOTION_STATES) {
      this.actions.get(state)?.setEffectiveWeight(weights[state] * locomotionScale);
    }

    // Normalize across stages so the action layer contributes exactly
    // `actionWeight` no matter where a stage crossfade has got to.
    let total = 0;
    for (const value of this.stageWeights.values()) total += value;
    const scale = total > 0 ? this.actionWeight / total : 0;

    for (const stage of [...JUMP_STAGES, "punch", "kick", "push"] as const) {
      const action = this.actions.get(stage);
      if (!action) continue;
      action.setEffectiveWeight((this.stageWeights.get(stage) ?? 0) * scale);
    }
  }

  private state(
    weights: LocomotionWeights = locomotionWeights(
      this.smoothedSpeed,
      this.config.thresholds,
      this.sprintBlend,
    ),
  ): CharacterMotionState {
    return {
      locomotion: dominantLocomotion(weights),
      weights,
      speed: this.smoothedSpeed,
      heading: this.heading,
      activeAction: this.actionLayer.current?.action ?? null,
      activeStage: this.currentStage,
      bufferedAction: this.actionLayer.pending?.action ?? null,
      actionWeight: this.actionWeight,
      missingMotions: this.resolution.missing,
      unavailableActions: this.unavailableActions,
    };
  }

  /** Clip names currently bound, for the debug overlay. */
  boundClips(): Record<string, string | null> {
    return { ...this.resolution.map };
  }

  /** Jump stages this character actually has, in play order. */
  jumpStages(): readonly JumpStage[] {
    return JUMP_STAGES.filter((stage) => this.actions.has(stage));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener("finished", this.onFinished as never);
    for (const action of this.actions.values()) action.stop();
    this.actions.clear();
    this.actionLayer.reset();
    this.stageWeights.clear();
  }
}
