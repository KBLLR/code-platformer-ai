/**
 * rosterProjection — assemble the one array the roster UI renders from.
 *
 * Everything the Core-X shell shows about fighters (the roster strip, the slot
 * table, the HUD counters, the pipeline funnel, the provenance layer) reads
 * this single projection. That is what makes the UI array-driven: raising the
 * fighter count is a content change, and the chrome does not care whether the
 * array holds 4 prototype fighters or 32 Rigging Palace characters.
 *
 * It composes existing contracts and adds no data of its own:
 *   catalog.json            → fighter definitions (the only fighter database)
 *   fighterDistribution.js  → which asset layer actually resolves
 *   riggingProjection.js    → whether a human approved the rig
 *   rosterState.js          → the derived, review-gated state
 */

import { resolveFighterDistributionLayers } from "./fighterDistribution.js";
import { loadRiggingProjection, reviewFor } from "./riggingProjection.js";
import { deriveRosterState, summariseRoster } from "./rosterState.js";

/**
 * Read the rigged runtime manifest for a fighter, when one is actually there.
 *
 * Absent or unparseable is reported as `null` — "unknown" — which `clipCoverage`
 * treats as not-complete rather than empty-but-fine.
 */
async function readRuntimeManifest(fighter, fetchImpl) {
  const url = fighter.runtimeRig?.manifestFile;
  if (!url) return null;
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * @param {object} content  validated output of `loadToyboxContent()`
 * @param {object} [options]
 * @param {object} [options.runtimeSettings] forwarded to the distribution resolver
 */
export async function buildRosterProjection(content, { runtimeSettings = {}, fetchImpl = fetch } = {}) {
  const fighters = content.fighters;
  const projection = await loadRiggingProjection(fighters, { fetchImpl });

  const entries = await Promise.all(
    fighters.map(async (fighter) => {
      const [layers, runtimeManifest] = await Promise.all([
        resolveFighterDistributionLayers(fighter, runtimeSettings).catch(() => []),
        readRuntimeManifest(fighter, fetchImpl),
      ]);
      const review = reviewFor(projection, fighter.id);
      const derived = deriveRosterState({ fighter, layers, review, runtimeManifest });
      return {
        ...derived,
        fighter,
        layers,
        // Which layer the renderer would actually load, by the resolver's own order.
        activeLayer: layers[0] ?? null,
        reviewEvidence: review.evidence,
        characterId: review.characterId,
      };
    }),
  );

  return {
    live: projection.live,
    projectionNote: projection.note ?? null,
    generatedAt: projection.generatedAt,
    entries,
    summary: summariseRoster(entries),
  };
}

/**
 * Project the roster onto match slots.
 *
 * The design's slot table, roster strip and HUD counters are written against
 * this array, not against four hard-coded rows: `capacity` is the chrome's
 * tested ceiling (32) while `filled` is whatever content supplies.
 *
 * Slot eligibility is the UNLOCK rule, not the rig state. Toybox has always
 * been playable from the mirrored source mesh with procedural clips — a rig is
 * an upgrade to how a fighter moves, never a precondition for playing them.
 * Gating slots on rig approval would make the game unplayable until Rigging
 * Palace catches up, which is a different product, not a truthful UI.
 *
 * Truthfulness lives in the annotation instead: every slot carries its derived
 * rig state and an explicit `motion` of "real" or "procedural", so the table can
 * say a fighter is playing on a fallback without ever implying the rig shipped.
 */
export function projectSlots(entries, { capacity = 32, mode = "tdm", humanSlots = 1, unlocked = null } = {}) {
  const eligible = unlocked ? entries.filter((entry) => unlocked.has(entry.fighterId)) : entries;

  const filled = eligible.slice(0, capacity).map((entry, index) => ({
    slot: index < humanSlots ? `p${index + 1}` : `b${index - humanSlots + 1}`,
    control: index < humanSlots ? "human" : "bot",
    team: mode === "tdm" ? (index % 2 === 0 ? "sun" : "moon") : "ffa",
    fighterId: entry.fighterId,
    name: entry.fighter.displayName,
    state: entry.state,
    // "real" requires a released rig with a complete clip set. Everything else
    // is procedural, and says so.
    motion: entry.state === "PLAYABLE_REAL_MOTION" ? "real" : "procedural",
  }));

  const realMotion = filled.filter((slot) => slot.motion === "real").length;
  return {
    capacity,
    filled,
    count: filled.length,
    realMotion,
    proceduralMotion: filled.length - realMotion,
    capacityLine: `slots ${filled.length} / ${capacity} · array-driven`,
    humanSlots: Math.min(humanSlots, filled.length),
    botSlots: Math.max(0, filled.length - humanSlots),
  };
}
