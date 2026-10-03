/**
 * rosterState — the one place a fighter's production state is decided.
 *
 * The roster UI has to show production progress before Warehouse publication,
 * which is exactly the situation where a UI starts lying: a rigged GLB appears
 * in `public/fighters/rigged-v1/` during development, the roster sees a file,
 * and it renders "playable" for a rig no human has reviewed yet.
 *
 * So state is DERIVED, never stored. There is no second fighter database: the
 * inputs are the existing contracts — `runtimeRig.exportStatus` from
 * `public/fighters/catalog.json`, the distribution layers resolved by
 * `fighterDistribution.js`, `REQUIRED_RUNTIME_CLIPS` from `contracts.js`, and
 * the upstream review state projected from Rigging Palace receipts.
 *
 * The ladder is monotone and gated. Review authority comes FIRST: a rig that is
 * awaiting review can never derive a released or playable state, however many
 * artifacts exist on disk. `assertTruthful()` encodes that as an invariant so a
 * future edit to the rules cannot quietly reintroduce the lie.
 */

import { REQUIRED_RUNTIME_CLIPS } from "./contracts.js";

/** Ordered weakest → strongest. Index is the ladder rung; order is the contract. */
export const ROSTER_STATES = [
  "SOURCE_ONLY",
  "RIGGING",
  "AWAITING_REVIEW",
  "APPROVED",
  "WAREHOUSE_RELEASED",
  "PLAYABLE_WITH_FALLBACKS",
  "PLAYABLE_REAL_MOTION",
];

const RANK = new Map(ROSTER_STATES.map((state, index) => [state, index]));

/**
 * States that assert a human has signed the rig off. Reaching any of these
 * without `review.approved` is the misrepresentation this module exists to stop.
 */
export const REVIEW_GATED_STATES = new Set([
  "APPROVED",
  "WAREHOUSE_RELEASED",
  "PLAYABLE_WITH_FALLBACKS",
  "PLAYABLE_REAL_MOTION",
]);

/** States in which the player may actually drop into a match with this fighter. */
export const PLAYABLE_STATES = new Set(["PLAYABLE_WITH_FALLBACKS", "PLAYABLE_REAL_MOTION"]);

/** Upstream review verdicts, mirroring Rigging Palace receipt `review_status`. */
export const REVIEW_PHASES = new Set(["none", "rigging", "awaiting_review", "approved"]);

export function rosterStateRank(state) {
  const rank = RANK.get(state);
  if (rank === undefined) throw new Error(`Unknown roster state: ${state}`);
  return rank;
}

export function isPlayableState(state) {
  return PLAYABLE_STATES.has(state);
}

export function isReleasedState(state) {
  return rosterStateRank(state) >= rosterStateRank("WAREHOUSE_RELEASED");
}

/**
 * Count how many required clips a runtime manifest actually carries.
 *
 * `null`/absent means "unknown", which is deliberately NOT the same as zero:
 * an unknown clip set must not read as a complete one.
 */
export function clipCoverage(runtimeManifest) {
  const required = REQUIRED_RUNTIME_CLIPS;
  const clips = runtimeManifest?.clips;
  if (!clips) return { present: 0, required: required.length, known: false };

  const names = Array.isArray(clips)
    ? clips.map((clip) => (typeof clip === "string" ? clip : clip?.name)).filter(Boolean)
    : Object.keys(clips);
  const present = required.filter((clip) => names.includes(clip)).length;
  return { present, required: required.length, known: true };
}

/**
 * Does a consumed distribution layer actually hand us a rigged runtime GLB?
 *
 * `resolveFighterDistributionLayers` already nulls `runtimeGlbUrl` unless the
 * manifest says `ready`, so this reads the resolver's verdict rather than
 * re-deciding it from file existence.
 */
function hasRuntimeGlb(layers) {
  return layers.some((layer) => Boolean(layer?.runtimeGlbUrl));
}

function hasWarehouseRelease(layers) {
  return layers.some((layer) => layer?.source === "warehouse" && Boolean(layer?.releaseItemId ?? layer?.runtimeGlbUrl));
}

export const CHARACTER_RIG_REVIEW_SCHEMA = "corex.character-rig-review.v1";

/**
 * Identity of the rig artifact this consumer would actually load.
 *
 * Read from the runtime manifest first (the producer's own statement about what
 * it published) and from the resolved layer second. `null` means "unknown",
 * which is not the same as "matches" — an approval cannot be proven against an
 * artifact whose identity we cannot establish.
 */
export function consumedArtifactIdentity(runtimeManifest, layers = []) {
  const layer = layers.find((entry) => entry?.runtimeGlbUrl) ?? null;
  const sha256 =
    runtimeManifest?.rigSha256 ??
    runtimeManifest?.rig_sha256 ??
    runtimeManifest?.sha256 ??
    layer?.rigSha256 ??
    null;
  const jobId = runtimeManifest?.jobId ?? runtimeManifest?.job_id ?? layer?.jobId ?? null;
  return { sha256, jobId, url: layer?.runtimeGlbUrl ?? null };
}

/**
 * Does a human approval authorize THIS artifact?
 *
 * Every clause is required, and each exists because of a way approval has been
 * faked or carried over in practice:
 *
 *   schema          a record of some other shape is not a rig review
 *   review_status   the verdict itself
 *   reviewer        trimmed, because "" and "   " are not a person
 *   promotion_allowed  the producer's own release gate
 *   artifact identity  the approved rig must be the consumed rig — this is what
 *                      stops an approval for job A authorizing job B's rig
 *
 * Character id is deliberately NOT sufficient and is not consulted here.
 * Returns every failed clause so the UI can say which one is missing.
 */
export function approvalAuthorizes(approval, consumed) {
  const reasons = [];
  if (!approval || typeof approval !== "object") return { authorized: false, reasons: ["no approval record"] };

  if (approval.schema !== CHARACTER_RIG_REVIEW_SCHEMA) {
    reasons.push(`wrong schema: "${approval.schema}" is not ${CHARACTER_RIG_REVIEW_SCHEMA}`);
  }
  if (approval.review_status !== "approved") {
    reasons.push(`review_status is "${approval.review_status}", not "approved"`);
  }
  if (typeof approval.reviewer !== "string" || approval.reviewer.trim() === "") {
    reasons.push("reviewer is not a named person");
  }
  if (approval.promotion_allowed !== true) {
    reasons.push("promotion_allowed is not true");
  }

  // Artifact identity binding. Unknown on either side fails closed.
  if (!approval.rig_sha256) {
    reasons.push("approval records no approved artifact digest");
  } else if (!consumed?.sha256) {
    reasons.push("consumed artifact digest is unknown — approval cannot be bound to it");
  } else if (approval.rig_sha256 !== consumed.sha256) {
    reasons.push(
      `approved artifact ${String(approval.rig_sha256).slice(0, 12)}… is not the consumed artifact ${String(consumed.sha256).slice(0, 12)}…`,
    );
  }
  // When both sides name a job, they must agree; a superseding job is caught here
  // even if two rigs somehow hashed alike.
  if (approval.job_id && consumed?.jobId && approval.job_id !== consumed.jobId) {
    reasons.push(`approved job "${approval.job_id}" is not the consumed job "${consumed.jobId}"`);
  }

  return { authorized: reasons.length === 0, reasons };
}

/**
 * Derive one fighter's roster state.
 *
 * @param {object} input
 * @param {object} input.fighter            validated catalog entry
 * @param {Array}  [input.layers]           distribution layers, strongest first
 * @param {object} [input.review]           { phase, receiptPath? } projected from Rigging Palace
 * @param {object} [input.runtimeManifest]  rigged runtime manifest, when one was read
 */
export function deriveRosterState({ fighter, layers = [], review = null, runtimeManifest = null }) {
  if (!fighter?.id) throw new Error("deriveRosterState requires a fighter with an id");

  const phase = review?.phase ?? "none";
  if (!REVIEW_PHASES.has(phase)) throw new Error(`Unknown review phase for "${fighter.id}": ${phase}`);

  const exportStatus = fighter.runtimeRig?.exportStatus ?? "pending";
  const coverage = clipCoverage(runtimeManifest);
  const runtimeReady = exportStatus === "ready" && hasRuntimeGlb(layers);
  const released = hasWarehouseRelease(layers);

  // An "approved" phase is a claim; it only holds if the approval record
  // authorizes the artifact this consumer would actually load. A stale approval
  // for a superseded job therefore degrades to AWAITING_REVIEW rather than
  // carrying forward onto the new rig.
  const consumed = consumedArtifactIdentity(runtimeManifest, layers);
  const authority = phase === "approved" ? approvalAuthorizes(review?.approval, consumed) : null;
  const effectivePhase = phase === "approved" && !authority.authorized ? "awaiting_review" : phase;

  const state = decide({ phase: effectivePhase, runtimeReady, released, coverage });
  const result = {
    fighterId: fighter.id,
    state,
    reviewPhase: effectivePhase,
    claimedPhase: phase,
    approvalAuthorized: authority ? authority.authorized : false,
    approvalFailures: authority ? authority.reasons : [],
    consumedArtifact: consumed,
    exportStatus,
    released,
    runtimeReady,
    coverage,
    // Why this rung and not the next one. The UI shows this instead of inventing copy.
    reason:
      authority && !authority.authorized
        ? `approval does not authorize the consumed rig — ${authority.reasons[0]}`
        : reasonFor({ state, phase: effectivePhase, exportStatus, released, runtimeReady, coverage }),
  };

  assertTruthful(result);
  return result;
}

function decide({ phase, runtimeReady, released, coverage }) {
  // Review authority first: nothing downstream can promote an unreviewed rig.
  if (phase !== "approved") {
    if (phase === "awaiting_review") return "AWAITING_REVIEW";
    if (phase === "rigging") return "RIGGING";
    return "SOURCE_ONLY";
  }

  if (runtimeReady) {
    // A complete clip set is the only thing that earns "real motion". An unknown
    // clip set falls back to the honest rung, not the flattering one.
    return coverage.known && coverage.present === coverage.required
      ? "PLAYABLE_REAL_MOTION"
      : "PLAYABLE_WITH_FALLBACKS";
  }
  if (released) return "WAREHOUSE_RELEASED";
  return "APPROVED";
}

function reasonFor({ state, phase, exportStatus, released, runtimeReady, coverage }) {
  switch (state) {
    case "SOURCE_ONLY":
      return "source mesh only · no rig requested";
    case "RIGGING":
      return "rig in flight at rigging-portal";
    case "AWAITING_REVIEW":
      return released || runtimeReady
        ? "rig awaiting human review · artifacts withheld from play"
        : "rig awaiting human review";
    case "APPROVED":
      return `approved · warehouse release pending (export ${exportStatus})`;
    case "WAREHOUSE_RELEASED":
      return "warehouse release resolved · runtime glb not consumed yet";
    case "PLAYABLE_WITH_FALLBACKS":
      return coverage.known
        ? `real rig · ${coverage.present} / ${coverage.required} clips · procedural fallback for the rest`
        : "real rig · clip set unknown · procedural fallback active";
    case "PLAYABLE_REAL_MOTION":
      return `real rig · ${coverage.present} / ${coverage.required} clips`;
    default:
      return phase;
  }
}

/**
 * The invariant the roster must never break.
 *
 * Kept as a runtime assertion rather than a test-only helper so that a bad
 * derivation fails where it is produced, not three screens later in the UI.
 */
export function assertTruthful(result) {
  if (REVIEW_GATED_STATES.has(result.state) && !result.approvalAuthorized) {
    throw new Error(
      `Roster state "${result.state}" for "${result.fighterId}" claims approval that does not authorize the consumed artifact: ${result.approvalFailures.join("; ")}`,
    );
  }
  if (REVIEW_GATED_STATES.has(result.state) && result.reviewPhase !== "approved") {
    throw new Error(
      `Roster state "${result.state}" for "${result.fighterId}" claims review sign-off, but review phase is "${result.reviewPhase}"`,
    );
  }
  if (isPlayableState(result.state) && !result.runtimeReady) {
    throw new Error(
      `Roster state "${result.state}" for "${result.fighterId}" claims playability without a resolved runtime glb`,
    );
  }
  if (result.state === "PLAYABLE_REAL_MOTION" && !(result.coverage.known && result.coverage.present === result.coverage.required)) {
    throw new Error(
      `Roster state "PLAYABLE_REAL_MOTION" for "${result.fighterId}" claims a complete clip set it does not have`,
    );
  }
  return result;
}

/**
 * Roster-wide counters. The HUD and lobby read these instead of literals like
 * "4 mirrored · 0 rigged", so the numbers cannot drift from the contracts.
 */
export function summariseRoster(entries) {
  const byState = new Map(ROSTER_STATES.map((state) => [state, 0]));
  for (const entry of entries) byState.set(entry.state, (byState.get(entry.state) ?? 0) + 1);

  const total = entries.length;
  const released = entries.filter((entry) => isReleasedState(entry.state)).length;
  const playable = entries.filter((entry) => isPlayableState(entry.state)).length;
  const realMotion = byState.get("PLAYABLE_REAL_MOTION") ?? 0;
  return {
    total,
    byState,
    released,
    playable,
    realMotion,
    awaitingReview: byState.get("AWAITING_REVIEW") ?? 0,
    rigging: byState.get("RIGGING") ?? 0,
    sourceOnly: byState.get("SOURCE_ONLY") ?? 0,
    fallbackPlayable: byState.get("PLAYABLE_WITH_FALLBACKS") ?? 0,
  };
}
