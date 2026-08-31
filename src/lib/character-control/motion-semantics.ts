/**
 * Semantic clip resolution.
 *
 * Characters arrive with whatever clip names their pipeline produced — `Idle`,
 * `Walking`, `mixamo.com`, `Armature|Run`. The state machine asks for semantic
 * motions instead, and this maps one to the other.
 *
 * Matching is token-exact against an explicit alias table. A clip is never
 * chosen because it merely contains a substring: "walk" must not match
 * "sidewalk_prop", and an unmatched motion is reported missing rather than
 * filled with something that happens to be nearby. Fabricating availability is
 * worse than reporting a gap, because the gap is visible and a wrong clip is not.
 */

import { SEMANTIC_MOTIONS, type SemanticMotion } from "./types";

/** Accepted names per semantic motion, compared token-exact after normalizing. */
export const MOTION_ALIASES: Readonly<Record<SemanticMotion, readonly string[]>> =
  Object.freeze({
    idle: ["idle", "idles", "idling", "breathingidle", "standing", "stand"],
    walk: ["walk", "walks", "walking", "walkforward", "walkfwd"],
    run: ["run", "runs", "running", "jog", "jogging", "sprint", "sprinting"],
    jump: ["jump", "jumps", "jumping", "jumpup", "leap"],
    punch: ["punch", "punches", "punching", "boxing", "jab", "hook"],
    kick: ["kick", "kicks", "kicking", "roundhouse", "roundhousekick"],
    push: ["push", "pushes", "pushing", "shove", "shoving"],
  });

/**
 * Split a clip name into comparable tokens.
 *
 * Handles the separators these pipelines actually emit: `Armature|Walk`,
 * `mixamo.com`, `walk_forward`, `WalkForward`, `walk-01`. Trailing take numbers
 * are dropped so `Walk_01` and `Walk` compare equal.
 */
export function clipTokens(name: string): string[] {
  const raw = String(name || "");
  const withBoundaries = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[|/\\._\-:]+/g, " ");
  return withBoundaries
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
}

/** A normalized whole-name form, so `WalkForward` can match `walkforward`. */
export function normalizedClipName(name: string): string {
  return clipTokens(name).join("");
}

export interface MotionMatch {
  readonly motion: SemanticMotion;
  readonly clipName: string;
  /** `exact` beat `alias` when both are present. */
  readonly quality: "exact" | "alias";
}

export type SemanticMotionMap = Readonly<Record<SemanticMotion, string | null>>;

export interface MotionResolution {
  readonly map: SemanticMotionMap;
  readonly matches: readonly MotionMatch[];
  readonly missing: readonly SemanticMotion[];
  /** Clip names that matched no semantic motion. Never auto-assigned. */
  readonly unmatchedClips: readonly string[];
}

function scoreClip(motion: SemanticMotion, clipName: string): MotionMatch | null {
  const aliases = MOTION_ALIASES[motion];
  const whole = normalizedClipName(clipName);
  if (whole === motion) return { motion, clipName, quality: "exact" };
  if (aliases.includes(whole)) return { motion, clipName, quality: "exact" };

  const tokens = clipTokens(clipName);
  for (const token of tokens) {
    if (token === motion || aliases.includes(token)) {
      return { motion, clipName, quality: "alias" };
    }
  }
  return null;
}

/**
 * Resolve available clip names to semantic motions.
 *
 * Deterministic: candidates are ranked by quality then by the order the clips
 * were supplied, so the same character always resolves the same way.
 */
export function resolveMotions(
  clipNames: readonly string[],
  overrides: Partial<Record<SemanticMotion, string>> = {},
): MotionResolution {
  const names = clipNames.filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );

  const map: Record<SemanticMotion, string | null> = {
    idle: null,
    walk: null,
    run: null,
    jump: null,
    punch: null,
    kick: null,
    push: null,
  };
  const matches: MotionMatch[] = [];
  const claimed = new Set<string>();

  for (const motion of SEMANTIC_MOTIONS) {
    // An explicit override is authoritative, but only if the clip really exists.
    const override = overrides[motion];
    if (override && names.includes(override)) {
      map[motion] = override;
      claimed.add(override);
      matches.push({ motion, clipName: override, quality: "exact" });
      continue;
    }

    const candidates: MotionMatch[] = [];
    for (const name of names) {
      const match = scoreClip(motion, name);
      if (match) candidates.push(match);
    }
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      if (a.quality !== b.quality) return a.quality === "exact" ? -1 : 1;
      return names.indexOf(a.clipName) - names.indexOf(b.clipName);
    });

    // Prefer a clip no other motion has taken; fall back to sharing rather than
    // dropping the motion, since one clip legitimately serving two is better
    // than reporting a gap that does not exist.
    const free = candidates.find((candidate) => !claimed.has(candidate.clipName));
    const chosen = free ?? candidates[0];
    map[motion] = chosen.clipName;
    claimed.add(chosen.clipName);
    matches.push(chosen);
  }

  const missing = SEMANTIC_MOTIONS.filter((motion) => map[motion] === null);
  const unmatchedClips = names.filter((name) => !claimed.has(name));

  return {
    map: Object.freeze(map),
    matches: Object.freeze(matches),
    missing: Object.freeze(missing),
    unmatchedClips: Object.freeze(unmatchedClips),
  };
}
