/**
 * riggingProjection — Toybox's read-only view of upstream Rigging Palace state.
 *
 * Toybox is a CONSUMER. It never reads Rigging Palace's working tree, its job
 * directories or its database: that would couple a browser app to another
 * house's private layout and make the two houses deploy together. Instead a
 * projection file is synced into `public/fighters/rigging-projection.json` by
 * `scripts/sync-rigging-projection.mjs`, and this module validates and reads it.
 *
 * The projection carries review state ONLY — whether a human has signed a rig
 * off. It deliberately does not carry geometry, clip data or release URLs;
 * those stay with `fighterDistribution.js` and the Warehouse release contract,
 * so there is exactly one path to an asset and exactly one path to a verdict.
 *
 * Before any rig is approved upstream there is nothing truthful to show, so the
 * fallback is an explicit fixture with `live: false` and every fighter at the
 * review phase its own catalog entry implies. A fixture is never allowed to
 * claim approval — see `assertNotReleasedByFixture`.
 */

import { REVIEW_PHASES } from "./rosterState.js";

export const RIGGING_PROJECTION_SCHEMA = "toybox-rigging-projection-v1";
export const RIGGING_PROJECTION_URL = "/fighters/rigging-projection.json";

/** Rigging Palace receipt `review_status` → our review phase vocabulary. */
const RECEIPT_STATUS_TO_PHASE = new Map([
  ["pending", "awaiting_review"],
  ["awaiting_review", "awaiting_review"],
  ["approved", "approved"],
  ["rejected", "rigging"],
  ["in_progress", "rigging"],
  ["rigging", "rigging"],
]);

export function receiptStatusToPhase(status) {
  return RECEIPT_STATUS_TO_PHASE.get(String(status ?? "").toLowerCase()) ?? "none";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Validate a projection document.
 *
 * Mirrors the strictness of `contracts.js`: unknown phases and missing
 * provenance are errors, because a malformed projection that defaults to
 * "approved" is precisely the failure that would misrepresent a rig.
 */
export function validateRiggingProjection(document) {
  assert(document && typeof document === "object", "Rigging projection must be an object");
  assert(
    document.schema === RIGGING_PROJECTION_SCHEMA,
    `Rigging projection schema must be "${RIGGING_PROJECTION_SCHEMA}", received "${document.schema}"`,
  );
  assert(typeof document.live === "boolean", "Rigging projection must declare a boolean `live`");
  assert(typeof document.generatedAt === "string" && document.generatedAt, "Rigging projection must declare generatedAt");
  assert(Array.isArray(document.fighters), "Rigging projection must declare a fighters array");

  const seen = new Set();
  const fighters = document.fighters.map((entry) => {
    assert(entry && typeof entry === "object", "Each projection entry must be an object");
    assert(typeof entry.fighterId === "string" && entry.fighterId, "Each projection entry needs a fighterId");
    assert(!seen.has(entry.fighterId), `Duplicate projection entry for "${entry.fighterId}"`);
    seen.add(entry.fighterId);
    assert(
      REVIEW_PHASES.has(entry.phase),
      `Unknown review phase for "${entry.fighterId}": ${entry.phase}`,
    );
    // Evidence is mandatory for any claim of sign-off. An approval with no
    // receipt behind it is indistinguishable from a typo.
    if (entry.phase === "approved") {
      assert(
        typeof entry.evidence === "string" && entry.evidence,
        `Approved projection entry "${entry.fighterId}" must cite receipt evidence`,
      );
    }
    return {
      fighterId: entry.fighterId,
      phase: entry.phase,
      evidence: entry.evidence ?? null,
      characterId: entry.characterId ?? null,
      reviewedAt: entry.reviewedAt ?? null,
    };
  });

  return { ...document, fighters };
}

/**
 * A fixture is for UI development only, so it must never be the thing that
 * unlocks play. Approval has to come from a live projection.
 */
export function assertNotReleasedByFixture(projection) {
  if (projection.live) return projection;
  const approved = projection.fighters.filter((entry) => entry.phase === "approved");
  if (approved.length > 0) {
    throw new Error(
      `Non-live rigging projection claims approval for: ${approved.map((entry) => entry.fighterId).join(", ")}`,
    );
  }
  return projection;
}

/**
 * Build the development fixture from the fighter catalog itself.
 *
 * Derived rather than hand-written so it cannot drift from the catalog, and so
 * adding a fighter does not mean remembering to add a fixture row.
 */
export function fixtureProjection(fighters) {
  return validateRiggingProjection({
    schema: RIGGING_PROJECTION_SCHEMA,
    live: false,
    source: "fixture",
    note: "contract-faithful fixture · no upstream receipts read · nothing released",
    generatedAt: new Date(0).toISOString(),
    fighters: fighters.map((fighter) => ({
      fighterId: fighter.id,
      // `pending` upstream means the rig has not been produced yet, which is
      // "rigging has not started" from the consumer's side — not "awaiting review".
      phase: fighter.runtimeRig?.exportStatus === "pending" ? "none" : "rigging",
      evidence: null,
      characterId: null,
      reviewedAt: null,
    })),
  });
}

export async function loadRiggingProjection(fighters, { fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(RIGGING_PROJECTION_URL, { cache: "no-store" });
    if (!response.ok) return assertNotReleasedByFixture(fixtureProjection(fighters));
    const projection = assertNotReleasedByFixture(validateRiggingProjection(await response.json()));
    return projection;
  } catch (error) {
    // A missing or malformed projection must degrade to "nothing is approved",
    // never to "everything is fine".
    if (!(error instanceof TypeError)) {
      console.warn(
        `[ToyboxArena] rigging projection unusable, falling back to fixture: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return assertNotReleasedByFixture(fixtureProjection(fighters));
  }
}

export function reviewFor(projection, fighterId) {
  const entry = projection.fighters.find((candidate) => candidate.fighterId === fighterId);
  if (!entry) return { phase: "none", evidence: null, live: projection.live };
  return { ...entry, live: projection.live };
}
