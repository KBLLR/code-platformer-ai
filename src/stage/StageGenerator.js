/**
 * Deterministic, seedable stage generator for Toybox Arena.
 *
 *   generateStage({ seed, brief, fighters }) -> toybox-generated-stage-v1
 *
 * Same seed + same brief + same roster => byte-identical stage JSON.
 *
 * Generate-and-test: each attempt lays out a candidate from a seeded RNG, then
 * runs the full contract (`analyzeGeneratedStage`). Rejected candidates move to
 * the next attempt, whose RNG is derived from the same seed, so retries are
 * deterministic too. Spec skills covered here: `platform-layout-generator`,
 * `spawn-and-pickup-balancer`, `arena-theme-selector`, `stagegenerator-export`.
 */
import { ITEM_TYPES, MATCH_PHYSICS } from "../game/ToyboxMatch.js";
import { GENERATED_STAGE_SCHEMA, analyzeGeneratedStage } from "../content/stageContract.js";
import { briefKey, normalizeArenaBrief } from "./arenaBrief.js";
import { createRng, hashSeed, quantize as q } from "./seededRandom.js";
import { STAGE_THEMES, STAGE_THEME_IDS } from "./stageThemes.js";
import {
  HAZARD_SPAWN_CLEARANCE,
  MIN_ITEM_SEPARATION,
  MIN_SPAWN_SEPARATION,
  boxesIntersect,
  deriveMovementEnvelope,
  distance,
  fighterBox,
  footBox,
  freeStandingIntervals,
  jumpCapabilities,
  platformBottom,
  platformLeft,
  platformRight,
  platformTop,
} from "./stageRules.js";

export const STAGE_GENERATOR = Object.freeze({ name: "toybox-stage-generator", version: 1 });
export const MAX_GENERATION_ATTEMPTS = 32;

const MAIN_HEIGHT = 1.4;
const TIER_HEIGHT = 0.8;
const SPAWN_DROP = [0.8, 1.6];
const SPAWN_HEADROOM = SPAWN_DROP[1] + MATCH_PHYSICS.playerHeight + 0.2;
const ITEM_HEADROOM = MATCH_PHYSICS.playerHeight + 0.2;

const LAYOUT_PROFILES = {
  balanced: { mainWidth: [12, 14], ledgeGap: [0.9, 1.6], ledgeWidth: [3.2, 4.2], tierPattern: "pair", pairX: [3.4, 5.2], adjectives: ["Bubble", "Bumper", "Pocket"] },
  vertical: { mainWidth: [10, 12], ledgeGap: [0.8, 1.4], ledgeWidth: [3.0, 3.6], tierPattern: "offset", offsetX: [2.4, 3.6], adjectives: ["Tall", "Stacked", "Climbing"] },
  wide: { mainWidth: [14, 16], ledgeGap: [0.9, 1.5], ledgeWidth: [3.0, 3.8], tierPattern: "pair", pairX: [4.4, 6.4], adjectives: ["Broad", "Sprawling", "Open"] },
};
const HAZARD_LEVELS = [
  { riseRate: 0.03, bumper: null },
  { riseRate: 0.05, bumper: { power: 10, lift: 9 } },
  { riseRate: 0.09, bumper: { power: 15, lift: 12 } },
];

function makePlatform(platforms, kind, x, y, width, height) {
  const sameKind = platforms.filter((platform) => platform.kind === kind).length;
  const platform = { id: `${kind}-${sameKind + 1}`, x: q(x), y: q(y), width: q(width), height: q(height), kind };
  platforms.push(platform);
  return platform;
}

function layoutPlatforms(rng, profile, brief, caps) {
  const platforms = [];
  const mainWidth = rng.range(...profile.mainWidth);
  const main = makePlatform(platforms, "main", 0, 0, mainWidth, MAIN_HEIGHT);

  // Mirrored side ledges flank the main platform at roughly the same height.
  const ledgeWidth = rng.range(...profile.ledgeWidth);
  const ledgeGap = rng.range(...profile.ledgeGap);
  const ledgeTop = platformTop(main) + rng.range(0.2, 0.8);
  const ledgeX = platformRight(main) + ledgeGap + ledgeWidth / 2;
  makePlatform(platforms, "ledge", -ledgeX, ledgeTop - TIER_HEIGHT / 2, ledgeWidth, TIER_HEIGHT);
  makePlatform(platforms, "ledge", ledgeX, ledgeTop - TIER_HEIGHT / 2, ledgeWidth, TIER_HEIGHT);

  // Upper tiers: each rise stays below the weakest fighter's safe double-jump.
  // Tier 1 is measured from the ledges (the highest low platform) so it clears
  // them too; later tiers from the previous tier.
  const minRise = 3.6;
  const maxRise = Math.max(minRise, Math.min(4.6, caps.maxRise - 0.25) - (ledgeTop - platformTop(main)));
  let previousTop = ledgeTop;
  let side = rng.chance(0.5) ? 1 : -1;
  for (let tier = 1; tier <= brief.tiers; tier += 1) {
    const top = previousTop + rng.range(minRise, maxRise);
    const y = top - TIER_HEIGHT / 2;
    const isLast = tier === brief.tiers && brief.tiers > 1;
    // "pair" layouts alternate mirrored pairs (odd tiers) with one centred
    // platform (even tiers) so no platform sits straight above its twin.
    const centred = profile.tierPattern === "pair" ? tier % 2 === 0 : isLast;
    if (centred) {
      makePlatform(platforms, isLast ? "crown" : "step", rng.range(-1.2, 1.2), y, rng.range(4.4, 6), TIER_HEIGHT);
    } else if (profile.tierPattern === "pair") {
      const width = rng.range(3.6, 5);
      const x = rng.range(...profile.pairX);
      makePlatform(platforms, "step", -x, y, width, TIER_HEIGHT);
      makePlatform(platforms, "step", x, y, width, TIER_HEIGHT);
    } else {
      makePlatform(platforms, "step", side * rng.range(...profile.offsetX), y, rng.range(4, 5.2), TIER_HEIGHT);
      side *= -1;
    }
    previousTop = top;
  }
  return platforms;
}

/** Pick an x inside `intervals`; `preferSide` (-1/1) keeps it left/right of `pivot`. */
function sampleStandingX(rng, intervals, preferSide = 0, pivot = 0) {
  let pool = intervals;
  if (preferSide !== 0) {
    pool = intervals
      .map(([a, b]) => (preferSide < 0 ? [a, Math.min(b, pivot - 0.5)] : [Math.max(a, pivot + 0.5), b]))
      .filter(([a, b]) => b - a >= 0);
    if (pool.length === 0) pool = intervals;
  }
  if (pool.length === 0) return null;
  const [a, b] = rng.pick(pool);
  return q(rng.range(a, b));
}

function placeSpawns(rng, platforms) {
  const ledges = platforms.filter((platform) => platform.kind === "ledge").sort((a, b) => a.x - b.x);
  const main = platforms.find((platform) => platform.kind === "main");
  const upper = platforms
    .filter((platform) => platform.kind === "step" || platform.kind === "crown")
    .sort((a, b) => platformTop(a) - platformTop(b) || a.x - b.x);

  // Slot plan: two low spawns (left/right), two high spawns (left/right).
  const plan = [
    { platform: ledges[0] ?? main, side: ledges[0] ? 0 : -1 },
    { platform: ledges[1] ?? main, side: ledges[1] ? 0 : 1 },
  ];
  if (upper.length >= 2) {
    const [first, second] = [upper[0], upper[1]].sort((a, b) => a.x - b.x);
    plan.push({ platform: first, side: 0 }, { platform: second, side: 0 });
  } else if (upper.length === 1) {
    // One narrow step cannot hold two spread-out spawns; use the main deck.
    plan.push({ platform: upper[0], side: 0 }, { platform: main, side: 0 });
  } else {
    plan.push({ platform: main, side: -1 }, { platform: main, side: 1 });
  }

  const spawns = [];
  for (const slot of plan) {
    const intervals = freeStandingIntervals(slot.platform, platforms, SPAWN_HEADROOM);
    let placed = null;
    for (let tryIndex = 0; tryIndex < 8 && !placed; tryIndex += 1) {
      const x = sampleStandingX(rng, intervals, slot.side, slot.platform.x);
      if (x === null) break;
      const candidate = { x, y: q(platformTop(slot.platform) + rng.range(...SPAWN_DROP)), platformId: slot.platform.id };
      if (spawns.every((other) => distance(other, candidate) >= MIN_SPAWN_SEPARATION)) {
        placed = candidate;
      }
    }
    if (!placed) return null;
    spawns.push(placed);
  }
  return spawns;
}

function placeItems(rng, platforms, spawns) {
  const types = rng.shuffle(ITEM_TYPES);
  const order = rng.shuffle(platforms);
  const spawnBoxes = spawns.map((spawn) => fighterBox(spawn));
  const items = [];
  for (let index = 0; index < types.length; index += 1) {
    let placed = null;
    for (let tryIndex = 0; tryIndex < 10 && !placed; tryIndex += 1) {
      const platform = order[(index + tryIndex) % order.length];
      const x = sampleStandingX(rng, freeStandingIntervals(platform, platforms, ITEM_HEADROOM));
      if (x === null) continue;
      const candidate = { x, y: q(platformTop(platform) + rng.range(0.3, 0.6)), type: types[index], platformId: platform.id };
      const box = footBox(candidate.x, candidate.y, MATCH_PHYSICS.pickupSize, MATCH_PHYSICS.pickupSize);
      const clearOfSpawns = spawnBoxes.every((spawnBox) => !boxesIntersect(box, spawnBox, 0.2));
      const clearOfItems = items.every((other) => distance(other, candidate) >= MIN_ITEM_SEPARATION);
      if (clearOfSpawns && clearOfItems) placed = candidate;
    }
    if (!placed) return null;
    items.push(placed);
  }
  return items;
}

function placeHazards(rng, platforms, level, floorY) {
  const settings = HAZARD_LEVELS[level];
  const hazards = [{ id: "rising-floor", kind: "rising-floor", y: floorY, riseRate: q(settings.riseRate + rng.range(0, 0.01), 0.005) }];
  if (settings.bumper) {
    // Mirrored bumpers just past the outer ledges punish running off the edge.
    const ledges = platforms.filter((platform) => platform.kind === "ledge");
    const outer = Math.max(...ledges.map((ledge) => platformRight(ledge)));
    const width = q(rng.range(0.9, 1.3));
    const height = q(rng.range(1.6, 2.2));
    const x = q(outer + rng.range(0.7, 1.2) + width / 2);
    const y = q(Math.min(...ledges.map((ledge) => platformTop(ledge))) - rng.range(0.6, 1.2));
    [-1, 1].forEach((direction, index) => {
      hazards.push({ id: `bumper-${index + 1}`, kind: "bumper", x: q(direction * x), y, width, height, ...settings.bumper });
    });
  }
  return hazards;
}

function computeBounds(rng, platforms, hazards, floorY) {
  const bumperBoxes = hazards.filter((hazard) => hazard.kind === "bumper")
    .map((hazard) => footBox(hazard.x, hazard.y, hazard.width, hazard.height));
  const left = Math.min(...platforms.map(platformLeft), ...bumperBoxes.map((box) => box.minX));
  const right = Math.max(...platforms.map(platformRight), ...bumperBoxes.map((box) => box.maxX));
  const top = Math.max(...platforms.map(platformTop)) + MATCH_PHYSICS.playerHeight + 2;
  const bounds = { left: q(left - 1.5), right: q(right + 1.5), bottom: floorY, top: q(top) };
  const sideMargin = rng.range(2.5, 3.2);
  const blastZone = {
    left: q(bounds.left - sideMargin),
    right: q(bounds.right + sideMargin),
    bottom: q(bounds.bottom - rng.range(2.2, 3)),
    top: q(bounds.top + rng.range(2.5, 3.5)),
  };
  return { bounds, blastZone };
}

function buildCandidate({ rng, seedText, brief, caps, attempt, stageId }) {
  const profile = LAYOUT_PROFILES[brief.layout];
  const theme = brief.theme ?? rng.pick(STAGE_THEME_IDS);
  const themeDef = STAGE_THEMES[theme];

  const platforms = layoutPlatforms(rng, profile, brief, caps);
  const lowestBottom = Math.min(...platforms.map(platformBottom));
  const floorY = q(lowestBottom - rng.range(6.5, 7.6));
  const hazards = placeHazards(rng, platforms, brief.hazardLevel, floorY);
  const bumperBoxes = hazards.filter((hazard) => hazard.kind === "bumper")
    .map((hazard) => footBox(hazard.x, hazard.y, hazard.width, hazard.height));

  const spawnPoints = placeSpawns(rng, platforms);
  if (!spawnPoints) return null;
  if (spawnPoints.some((spawn) => bumperBoxes.some((box) => boxesIntersect(fighterBox(spawn), box, HAZARD_SPAWN_CLEARANCE)))) return null;
  const itemSpawns = placeItems(rng, platforms, spawnPoints);
  if (!itemSpawns) return null;

  const { bounds, blastZone } = computeBounds(rng, platforms, hazards, floorY);
  const floor = hazards[0];
  const bumperCount = hazards.length - 1;
  const displayName = `${rng.pick(profile.adjectives)} ${rng.pick(themeDef.nouns)}`;

  return {
    schemaVersion: GENERATED_STAGE_SCHEMA,
    id: stageId,
    displayName,
    theme,
    description: `Generated ${brief.layout} arena in the ${themeDef.label} theme: ${platforms.length} platforms, `
      + `${bumperCount} bumper${bumperCount === 1 ? "" : "s"}, rising floor at ${floor.riseRate}/s. Seed "${seedText}".`,
    generator: { ...STAGE_GENERATOR, seed: seedText, attempt, brief: { ...brief } },
    bounds,
    blastZone,
    platforms,
    spawnPoints,
    itemSpawns,
    hazards,
    hazardFloor: floor.y,
    hazardRiseRate: floor.riseRate,
    palette: { ...themeDef.palette },
  };
}

/**
 * @param {object} options
 * @param {string|number} options.seed required; any string or number.
 * @param {string|object} [options.brief] free text or partial arena brief.
 * @param {Array} [options.fighters] validated fighter catalog; reachability is
 *   checked against the weakest fighter. Defaults to the catalog's current minimum.
 * @param {Function} [options.onReject] called with `(attempt, reason)` for each
 *   rejected candidate; for tooling and tests, never needed at runtime.
 */
export function generateStage({ seed, brief = null, fighters = null, onReject = null } = {}) {
  if (seed === undefined || seed === null || String(seed).trim() === "") {
    throw new Error("generateStage requires a non-empty seed");
  }
  const seedText = String(seed).trim();
  const normalizedBrief = normalizeArenaBrief(brief);
  const caps = jumpCapabilities(deriveMovementEnvelope(fighters));
  const key = `${seedText}|${briefKey(normalizedBrief)}`;
  const stageId = `gen-${hashSeed(key).toString(16).padStart(8, "0")}`;
  const rejections = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const rng = createRng(`${key}|attempt-${attempt}`);
    const candidate = buildCandidate({ rng, seedText, brief: normalizedBrief, caps, attempt, stageId });
    if (!candidate) {
      rejections.push(`attempt ${attempt}: could not place spawns/items`);
      onReject?.(attempt, "could not place spawns/items");
      continue;
    }
    const analysis = analyzeGeneratedStage(candidate, { fighters });
    if (analysis.ok) return candidate;
    rejections.push(`attempt ${attempt}: ${analysis.errors[0]}`);
    onReject?.(attempt, analysis.errors[0]);
  }
  throw new Error(`No valid stage for seed "${seedText}" (${briefKey(normalizedBrief)}) after ${MAX_GENERATION_ATTEMPTS} attempts:\n- ${rejections.join("\n- ")}`);
}
