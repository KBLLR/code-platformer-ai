/**
 * Action layer.
 *
 * One-shot actions sit above the locomotion blend. Exactly one may be active;
 * it plays to completion and then hands control back to whatever locomotion the
 * stick is asking for *at that moment*, which is not necessarily the locomotion
 * that was active when the action started.
 *
 * The layer owns no clock and no three.js objects, so its whole policy —
 * buffering, interrupts, completion — is testable without a renderer.
 */

import type { MotionConfig } from "./motion-config";
import type { OneShotAction } from "./types";

export interface ActiveAction {
  readonly action: OneShotAction;
  /** Seconds elapsed since the action started. */
  readonly elapsed: number;
  /** Clip length in seconds, or null when unknown. */
  readonly duration: number | null;
  /** Monotonic id so late completion events cannot end a newer action. */
  readonly token: number;
}

export interface BufferedAction {
  readonly action: OneShotAction;
  readonly requestedAtMs: number;
}

export type ActionAvailability = (action: OneShotAction) => boolean;

export interface ActionLayerOptions {
  readonly config: MotionConfig;
  /** Reports whether a clip actually exists for an action. */
  readonly isAvailable: ActionAvailability;
}

export interface ActionStartEvent {
  readonly action: OneShotAction;
  readonly token: number;
  readonly interrupted: OneShotAction | null;
}

export class ActionLayer {
  private active: ActiveAction | null = null;
  private buffered: BufferedAction | null = null;
  private nextToken = 1;
  // Declared explicitly rather than as a constructor parameter property, which
  // is not erasable syntax and so is rejected under `erasableSyntaxOnly`.
  private readonly options: ActionLayerOptions;

  constructor(options: ActionLayerOptions) {
    this.options = options;
  }

  get current(): ActiveAction | null {
    return this.active;
  }

  get pending(): BufferedAction | null {
    return this.buffered;
  }

  get isBusy(): boolean {
    return this.active !== null;
  }

  /**
   * Ask for an action. Unavailable actions are refused outright rather than
   * substituted, so a missing clip can never silently play something else.
   */
  request(action: OneShotAction, nowMs: number): boolean {
    if (!this.options.isAvailable(action)) return false;
    this.buffered = { action, requestedAtMs: nowMs };
    return true;
  }

  /**
   * Advance the layer. Returns a start event when an action begins this frame.
   */
  update(nowMs: number, deltaSeconds: number): ActionStartEvent | null {
    if (this.active) {
      this.active = {
        ...this.active,
        elapsed: this.active.elapsed + Math.max(0, deltaSeconds),
      };
    }

    if (!this.buffered) return null;

    // Expire stale requests so a queued action cannot fire seconds later.
    if (nowMs - this.buffered.requestedAtMs > this.options.config.inputBufferMs) {
      this.buffered = null;
      return null;
    }

    if (!this.canStart(this.buffered.action)) return null;

    const request = this.buffered;
    this.buffered = null;
    const interrupted = this.active?.action ?? null;
    const token = this.nextToken++;
    this.active = { action: request.action, elapsed: 0, duration: null, token };
    return { action: request.action, token, interrupted };
  }

  /** Record the clip length once the mixer action is known. */
  setActiveDuration(token: number, duration: number | null): void {
    if (this.active && this.active.token === token) {
      this.active = { ...this.active, duration };
    }
  }

  /**
   * Authoritative completion, driven by the mixer's `finished` event. A stale
   * token is ignored so a finishing clip cannot cancel the action that replaced
   * it.
   */
  notifyFinished(token: number): boolean {
    if (!this.active || this.active.token !== token) return false;
    this.active = null;
    return true;
  }

  /** Drop all state, e.g. when the character is swapped out. */
  reset(): void {
    this.active = null;
    this.buffered = null;
  }

  /**
   * Interrupt policy.
   *
   * Nothing running: start. Otherwise the running action must be past its
   * commit window, and the newcomer must rank at least as high, so mashing
   * punch cannot restart it every frame and a jump can still cut a late punch.
   */
  private canStart(action: OneShotAction): boolean {
    if (!this.active) return true;

    const { config } = this.options;
    const duration = this.active.duration;
    // Unknown duration means we cannot prove we are past the commit window.
    if (duration === null || duration <= 0) return false;

    const progress = this.active.elapsed / duration;
    if (progress < config.actionInterruptAfter) return false;

    const incoming = config.interruptPriority[action] ?? 0;
    const running = config.interruptPriority[this.active.action] ?? 0;
    return incoming >= running;
  }
}
