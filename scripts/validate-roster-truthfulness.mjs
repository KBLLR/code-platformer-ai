/**
 * validate-roster-truthfulness — prove the roster cannot misrepresent a rig.
 *
 * The roster is allowed to show production progress before Warehouse
 * publication. That permission is exactly what makes a false "playable" badge
 * possible, so the gate is checked exhaustively rather than by example: every
 * combination of review phase, export status, resolved layers and clip coverage
 * is derived, and each result must satisfy the contract.
 *
 * Run: node scripts/validate-roster-truthfulness.mjs
 */

import process from "node:process";
import { REQUIRED_RUNTIME_CLIPS } from "../src/content/contracts.js";
import {
  PLAYABLE_STATES,
  REVIEW_GATED_STATES,
  REVIEW_PHASES,
  ROSTER_STATES,
  clipCoverage,
  deriveRosterState,
  isReleasedState,
  summariseRoster,
} from "../src/content/rosterState.js";
import { projectSlots } from "../src/content/rosterProjection.js";
import {
  fixtureProjection,
  assertNotReleasedByFixture,
  receiptStatusToPhase,
  validateRiggingProjection,
} from "../src/content/riggingProjection.js";

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function fighter(id, exportStatus) {
  return { id, runtimeRig: { exportStatus, manifestFile: `/fighters/rigged-v1/${id}/runtime-manifest.json` } };
}

const EXPORT_STATUSES = ["pending", "ready", "stale", "error"];

const LAYER_SHAPES = {
  none: [],
  "source-mirror only": [{ source: "source-mirror", sourceModelUrl: "/fighters/official-v1/x.glb", runtimeGlbUrl: null }],
  "snapshot, no runtime": [{ source: "snapshot", runtimeGlbUrl: null }],
  "snapshot with runtime": [{ source: "snapshot", runtimeGlbUrl: "/fighters/rigged-v1/x/x-runtime.glb" }],
  "warehouse released, no runtime": [{ source: "warehouse", releaseItemId: "c91fb0a6ed74b8e7", runtimeGlbUrl: null }],
  "warehouse released with runtime": [{ source: "warehouse", releaseItemId: "c91fb0a6ed74b8e7", runtimeGlbUrl: "wh://x-runtime.glb" }],
};

const CLIP_SHAPES = {
  unknown: null,
  empty: { clips: [] },
  partial: { clips: REQUIRED_RUNTIME_CLIPS.slice(0, 4) },
  complete: { clips: [...REQUIRED_RUNTIME_CLIPS] },
};

// ---------------------------------------------------------------------------
// 1. Exhaustive derivation over the whole input space.
// ---------------------------------------------------------------------------
let combos = 0;
const observed = new Set();

for (const phase of REVIEW_PHASES) {
  for (const exportStatus of EXPORT_STATUSES) {
    for (const [layerName, layers] of Object.entries(LAYER_SHAPES)) {
      for (const [clipName, runtimeManifest] of Object.entries(CLIP_SHAPES)) {
        combos += 1;
        const where = `phase=${phase} export=${exportStatus} layers="${layerName}" clips=${clipName}`;
        let result;
        try {
          result = deriveRosterState({ fighter: fighter("x", exportStatus), layers, review: { phase }, runtimeManifest });
        } catch (error) {
          failures.push(`derive threw for ${where}: ${error.message}`);
          continue;
        }
        observed.add(result.state);

        check(ROSTER_STATES.includes(result.state), `unknown state "${result.state}" for ${where}`);

        // The central invariant: sign-off claims require sign-off.
        if (REVIEW_GATED_STATES.has(result.state)) {
          check(phase === "approved", `MISREPRESENTATION: "${result.state}" without approval for ${where}`);
        }

        // Playability requires a runtime GLB the resolver actually handed us.
        if (PLAYABLE_STATES.has(result.state)) {
          const hasRuntime = layers.some((layer) => layer.runtimeGlbUrl);
          check(hasRuntime, `MISREPRESENTATION: playable without runtime glb for ${where}`);
          check(exportStatus === "ready", `MISREPRESENTATION: playable with exportStatus=${exportStatus} for ${where}`);
        }

        // "Real motion" requires a known, complete clip set.
        if (result.state === "PLAYABLE_REAL_MOTION") {
          check(clipName === "complete", `MISREPRESENTATION: real-motion with clips=${clipName} for ${where}`);
        }

        // An unknown clip set must never be flattered into completeness.
        if (clipName === "unknown" && PLAYABLE_STATES.has(result.state)) {
          check(
            result.state === "PLAYABLE_WITH_FALLBACKS",
            `unknown clip set promoted to "${result.state}" for ${where}`,
          );
        }

        // Released states must not appear for an unreviewed rig, even when a
        // warehouse layer resolves — the upstream verdict outranks the artifact.
        if (isReleasedState(result.state)) {
          check(phase === "approved", `MISREPRESENTATION: released state without approval for ${where}`);
        }

        check(typeof result.reason === "string" && result.reason.length > 0, `empty reason for ${where}`);
      }
    }
  }
}

// Every awaiting-review input, regardless of artifacts, must report AWAITING_REVIEW.
for (const [layerName, layers] of Object.entries(LAYER_SHAPES)) {
  const result = deriveRosterState({
    fighter: fighter("x", "ready"),
    layers,
    review: { phase: "awaiting_review" },
    runtimeManifest: CLIP_SHAPES.complete,
  });
  check(
    result.state === "AWAITING_REVIEW",
    `awaiting-review rig with layers "${layerName}" and a complete clip set derived "${result.state}"`,
  );
}

// ---------------------------------------------------------------------------
// 2. Clip coverage semantics.
// ---------------------------------------------------------------------------
check(clipCoverage(null).known === false, "absent manifest must report unknown coverage");
check(clipCoverage({ clips: [] }).present === 0, "empty clip list must report zero present");
check(
  clipCoverage({ clips: REQUIRED_RUNTIME_CLIPS }).present === REQUIRED_RUNTIME_CLIPS.length,
  "complete clip list must report full coverage",
);
check(
  clipCoverage({ clips: REQUIRED_RUNTIME_CLIPS.map((name) => ({ name })) }).present === REQUIRED_RUNTIME_CLIPS.length,
  "object-shaped clips must be counted",
);
check(
  clipCoverage({ clips: ["idle", "run", "not_a_required_clip"] }).present === 2,
  "unrelated clip names must not inflate coverage",
);

// ---------------------------------------------------------------------------
// 3. Receipt mapping and fixture safety.
// ---------------------------------------------------------------------------
check(receiptStatusToPhase("pending") === "awaiting_review", "receipt 'pending' maps to awaiting_review");
check(receiptStatusToPhase("approved") === "approved", "receipt 'approved' maps to approved");
check(receiptStatusToPhase("nonsense") === "none", "unknown receipt status degrades to 'none'");
check(receiptStatusToPhase(undefined) === "none", "missing receipt status degrades to 'none'");

const catalogLike = [fighter("blue", "pending"), fighter("red", "ready")];
const fixture = fixtureProjection(catalogLike);
check(fixture.live === false, "fixture must declare live=false");
check(
  fixture.fighters.every((entry) => entry.phase !== "approved"),
  "fixture must not claim approval for any fighter",
);

let fixtureApprovalRejected = false;
try {
  assertNotReleasedByFixture({ ...fixture, fighters: [{ fighterId: "blue", phase: "approved", evidence: "x" }] });
} catch {
  fixtureApprovalRejected = true;
}
check(fixtureApprovalRejected, "a non-live projection claiming approval must be rejected");

let approvalWithoutEvidenceRejected = false;
try {
  validateRiggingProjection({
    schema: "toybox-rigging-projection-v1",
    live: true,
    generatedAt: new Date().toISOString(),
    fighters: [{ fighterId: "blue", phase: "approved" }],
  });
} catch {
  approvalWithoutEvidenceRejected = true;
}
check(approvalWithoutEvidenceRejected, "an approval with no receipt evidence must be rejected");

let badSchemaRejected = false;
try {
  validateRiggingProjection({ schema: "something-else", live: true, generatedAt: "x", fighters: [] });
} catch {
  badSchemaRejected = true;
}
check(badSchemaRejected, "a wrong schema must be rejected");

// ---------------------------------------------------------------------------
// 4. Roster summary counters (what replaces the hard-coded HUD strings).
// ---------------------------------------------------------------------------
const summary = summariseRoster([
  { state: "SOURCE_ONLY" },
  { state: "AWAITING_REVIEW" },
  { state: "PLAYABLE_WITH_FALLBACKS" },
  { state: "PLAYABLE_REAL_MOTION" },
]);
check(summary.total === 4, "summary counts every entry");
check(summary.playable === 2, "summary counts playable entries");
check(summary.realMotion === 1, "summary counts real-motion entries");
check(summary.released === 2, "summary counts released-or-better entries");
check(summary.awaitingReview === 1, "summary counts awaiting-review entries");

// ---------------------------------------------------------------------------
// 5. Slot projection: array-driven, and honest about motion.
// ---------------------------------------------------------------------------
function entryFor(id, state) {
  return { fighterId: id, state, fighter: { displayName: id.toUpperCase() } };
}

// The chrome is claimed to be tested to 32 slots, so project a 32-fighter
// roster and assert the array actually carries them with distinct slot ids.
const big = Array.from({ length: 40 }, (_, i) => entryFor(`f${i}`, "PLAYABLE_REAL_MOTION"));
const projected = projectSlots(big, { capacity: 32 });
check(projected.count === 32, `32-slot projection filled ${projected.count}, expected 32`);
check(projected.capacity === 32, "projection reports its capacity");
check(new Set(projected.filled.map((s) => s.slot)).size === 32, "every projected slot id is distinct");
check(projected.capacityLine === "slots 32 / 32 · array-driven", `capacity line reads "${projected.capacityLine}"`);
check(projected.filled[0].control === "human", "first slot is the human slot");
check(projected.filled[1].control === "bot", "subsequent slots are bots");
check(projected.realMotion === 32, "real-motion slots counted");

// Scaling down is a content change, not a UI change: same code, 4 rows.
const small = projectSlots(big.slice(0, 4), { capacity: 32 });
check(small.count === 4 && small.capacity === 32, "a 4-fighter roster still projects against a 32 capacity");
check(small.capacityLine === "slots 4 / 32 · array-driven", `small capacity line reads "${small.capacityLine}"`);

// Eligibility follows the unlock rule, so the game stays playable while rigs
// are upstream — but the motion annotation must never claim "real".
const unreviewed = [entryFor("blue", "AWAITING_REVIEW"), entryFor("red", "AWAITING_REVIEW")];
const unlockedOnly = projectSlots(unreviewed, { capacity: 32, unlocked: new Set(["blue"]) });
check(unlockedOnly.count === 1, "only unlocked fighters occupy slots");
check(unlockedOnly.filled[0].fighterId === "blue", "the unlocked fighter is the one projected");
check(
  unlockedOnly.filled.every((slot) => slot.motion === "procedural"),
  "an unreviewed rig must be annotated as procedural motion",
);
check(unlockedOnly.realMotion === 0, "an unreviewed rig contributes no real motion");
check(unlockedOnly.proceduralMotion === 1, "procedural slots are counted");

// Only a complete, released rig earns "real".
for (const state of ["SOURCE_ONLY", "RIGGING", "AWAITING_REVIEW", "APPROVED", "WAREHOUSE_RELEASED", "PLAYABLE_WITH_FALLBACKS"]) {
  const one = projectSlots([entryFor("x", state)], { capacity: 32 });
  check(one.filled[0].motion === "procedural", `state ${state} must annotate procedural motion`);
}
check(
  projectSlots([entryFor("x", "PLAYABLE_REAL_MOTION")], { capacity: 32 }).filled[0].motion === "real",
  "PLAYABLE_REAL_MOTION annotates real motion",
);

// ---------------------------------------------------------------------------

console.log(`[roster-truthfulness] ${combos} derivations · ${checks} assertions`);
console.log(`[roster-truthfulness] states reachable: ${[...observed].sort().join(", ")}`);
if (failures.length > 0) {
  console.error(`\n[roster-truthfulness] ${failures.length} FAILURE(S):`);
  for (const failure of failures.slice(0, 25)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("[roster-truthfulness] OK — no derivation can claim review sign-off, release or playability it has not earned");
