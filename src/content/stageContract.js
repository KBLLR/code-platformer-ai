/**
 * Contract for generated stages: `toybox-generated-stage-v1`.
 *
 * A generated stage is a superset of a catalog stage (it passes
 * `validateStageDefinition`, so ToyboxMatch can run it unchanged) plus:
 *
 *   schemaVersion  "toybox-generated-stage-v1"
 *   generator      { name, version, seed, attempt, brief }
 *   bounds         playable area {left,right,bottom,top}; must sit inside blastZone
 *   platforms[]    { id, x, y, width, height, kind }            (x/y = box centre)
 *   spawnPoints[]  { x, y, platformId }                         (y = fighter feet)
 *   itemSpawns[]   { x, y, type, platformId }                   (y = pickup bottom)
 *   hazards[]      { id, kind: "rising-floor", y, riseRate }
 *                  { id, kind: "bumper", x, y, width, height, power, lift } (y = bottom)
 *   hazardFloor / hazardRiseRate  runtime projection of the rising-floor hazard
 *   theme, palette  theme id from STAGE_THEMES and its render palette
 *
 * `analyzeGeneratedStage` returns every problem it finds (the generator uses it
 * to reject candidates); `validateGeneratedStage` throws on the first report
 * with errors, matching the other validators in contracts.js.
 */
import { validateStageDefinition } from "./contracts.js";
import { ITEM_TYPES, MATCH_PHYSICS } from "../game/ToyboxMatch.js";
import { STAGE_THEMES } from "../stage/stageThemes.js";
import {
  HAZARD_SPAWN_CLEARANCE,
  HEAD_CLEARANCE,
  MAX_ITEM_HOVER,
  MAX_SPAWN_DROP,
  MIN_ITEM_SEPARATION,
  MIN_SPAWN_SEPARATION,
  analyzeReachability,
  boxInside,
  boxesIntersect,
  deriveMovementEnvelope,
  distance,
  fighterBox,
  findSupport,
  footBox,
  jumpCapabilities,
  platformBottom,
  platformBox,
  platformLeft,
  platformRight,
  platformTop,
} from "../stage/stageRules.js";

export const GENERATED_STAGE_SCHEMA = "toybox-generated-stage-v1";
export const GENERATED_PLATFORM_KINDS = Object.freeze(["main", "ledge", "step", "crown"]);
export const GENERATED_HAZARD_KINDS = Object.freeze(["rising-floor", "bumper"]);
/** The match always fields four fighters (1 human + 3 bots). */
export const GENERATED_SPAWN_COUNT = 4;
/** Backdrop plane (42 wide) and hazard-floor mesh (40 wide) bound what renders cleanly. */
export const RENDER_SAFE_HALF_WIDTH = 20;
export const RENDER_SAFE_TOP = 26;
const BLAST_MARGIN = 2;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PALETTE_KEYS = ["skyTop", "skyBottom", "platform", "accent", "hazard"];

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isRect = (value) => value && ["left", "right", "bottom", "top"].every((key) => isFiniteNumber(value[key]));
const round = (value) => Math.round(value * 100) / 100;

function checkSchema(stage, errors) {
  try {
    validateStageDefinition(stage);
  } catch (error) {
    errors.push(error.message);
    return false;
  }
  if (stage.schemaVersion !== GENERATED_STAGE_SCHEMA) {
    errors.push(`schemaVersion must be "${GENERATED_STAGE_SCHEMA}"`);
  }
  if (!/^gen-[0-9a-f]{8}$/.test(stage.id)) errors.push(`id "${stage.id}" must look like gen-xxxxxxxx`);
  if (!STAGE_THEMES[stage.theme]) errors.push(`unknown theme "${stage.theme}"`);
  if (!stage.palette || PALETTE_KEYS.some((key) => !HEX_COLOR.test(stage.palette[key] ?? ""))) {
    errors.push("palette must define hex colours for " + PALETTE_KEYS.join(", "));
  }
  const generator = stage.generator;
  if (!generator || typeof generator.name !== "string" || !isFiniteNumber(generator.version)
    || typeof generator.seed !== "string" || !generator.brief || typeof generator.brief !== "object") {
    errors.push("generator must carry name, version, seed (string) and brief");
  }
  if (!isRect(stage.bounds)) {
    errors.push("bounds must define finite left/right/bottom/top");
    return false;
  }

  const platformIds = new Set();
  let schemaOk = true;
  stage.platforms.forEach((platform, index) => {
    const label = `platforms[${index}]`;
    if (typeof platform.id !== "string" || !platform.id) {
      errors.push(`${label}.id must be a non-empty string`);
      schemaOk = false;
    } else if (platformIds.has(platform.id)) {
      errors.push(`duplicate platform id "${platform.id}"`);
    } else {
      platformIds.add(platform.id);
    }
    if (!["x", "y", "width", "height"].every((key) => isFiniteNumber(platform[key]))
      || platform.width <= 0 || platform.height <= 0) {
      errors.push(`${label} needs finite x/y and positive width/height`);
      schemaOk = false;
    }
    if (!GENERATED_PLATFORM_KINDS.includes(platform.kind)) errors.push(`${label}.kind "${platform.kind}" is not supported`);
  });
  const mains = stage.platforms.filter((platform) => platform.kind === "main");
  if (mains.length !== 1) errors.push(`expected exactly one main platform, found ${mains.length}`);

  if (stage.spawnPoints.length !== GENERATED_SPAWN_COUNT) {
    errors.push(`expected ${GENERATED_SPAWN_COUNT} spawn points, found ${stage.spawnPoints.length}`);
  }
  stage.spawnPoints.forEach((spawn, index) => {
    if (!isFiniteNumber(spawn.x) || !isFiniteNumber(spawn.y)) { errors.push(`spawnPoints[${index}] needs finite x/y`); schemaOk = false; }
    if (!platformIds.has(spawn.platformId)) errors.push(`spawnPoints[${index}].platformId "${spawn.platformId}" is unknown`);
  });
  stage.itemSpawns.forEach((item, index) => {
    if (!isFiniteNumber(item.x) || !isFiniteNumber(item.y)) { errors.push(`itemSpawns[${index}] needs finite x/y`); schemaOk = false; }
    if (!ITEM_TYPES.includes(item.type)) errors.push(`itemSpawns[${index}].type "${item.type}" is not a runtime item`);
    if (!platformIds.has(item.platformId)) errors.push(`itemSpawns[${index}].platformId "${item.platformId}" is unknown`);
  });

  if (!Array.isArray(stage.hazards)) {
    errors.push("hazards must be an array");
    return false;
  }
  const floors = stage.hazards.filter((hazard) => hazard.kind === "rising-floor");
  if (floors.length !== 1) errors.push(`expected exactly one rising-floor hazard, found ${floors.length}`);
  stage.hazards.forEach((hazard, index) => {
    const label = `hazards[${index}]`;
    if (!GENERATED_HAZARD_KINDS.includes(hazard.kind)) errors.push(`${label}.kind "${hazard.kind}" is not supported`);
    if (hazard.kind === "rising-floor") {
      if (!isFiniteNumber(hazard.y) || !isFiniteNumber(hazard.riseRate) || hazard.riseRate <= 0 || hazard.riseRate > 0.2) {
        errors.push(`${label} rising-floor needs finite y and 0 < riseRate <= 0.2`);
        schemaOk = false;
      } else {
        if (stage.hazardFloor !== hazard.y) errors.push("hazardFloor must equal the rising-floor hazard y");
        if (stage.hazardRiseRate !== hazard.riseRate) errors.push("hazardRiseRate must equal the rising-floor hazard riseRate");
      }
    }
    if (hazard.kind === "bumper") {
      const fieldsOk = ["x", "y", "width", "height", "power", "lift"].every((key) => isFiniteNumber(hazard[key]));
      if (!fieldsOk || hazard.width <= 0 || hazard.height <= 0 || hazard.power <= 0 || hazard.power > 30 || hazard.lift <= 0 || hazard.lift > 30) {
        errors.push(`${label} bumper needs finite geometry, 0 < power <= 30 and 0 < lift <= 30`);
        schemaOk = false;
      }
    }
  });
  return schemaOk;
}

function checkGeometry(stage, caps, physics, errors, report) {
  const { platforms, spawnPoints, itemSpawns, hazards, bounds, blastZone } = stage;
  const idIndex = new Map(platforms.map((platform, index) => [platform.id, index]));

  // Bounds sit inside the blast zone, which stays inside what renders cleanly.
  if (bounds.left >= bounds.right || bounds.bottom >= bounds.top) errors.push("bounds are inverted");
  if (bounds.left - blastZone.left < BLAST_MARGIN || blastZone.right - bounds.right < BLAST_MARGIN
    || bounds.bottom - blastZone.bottom < BLAST_MARGIN || blastZone.top - bounds.top < BLAST_MARGIN) {
    errors.push(`blastZone must enclose bounds with at least ${BLAST_MARGIN} units on every side`);
  }
  if (blastZone.left < -RENDER_SAFE_HALF_WIDTH || blastZone.right > RENDER_SAFE_HALF_WIDTH || blastZone.top > RENDER_SAFE_TOP) {
    errors.push(`blastZone exceeds the render-safe area (|x| <= ${RENDER_SAFE_HALF_WIDTH}, top <= ${RENDER_SAFE_TOP})`);
  }

  const main = platforms.find((platform) => platform.kind === "main");
  if (main && !(platformLeft(main) < 0 && platformRight(main) > 0)) {
    errors.push("main platform must span x = 0 (bot recovery steers toward the origin)");
  }

  // Platforms: inside bounds, no overlap, head room under overhangs.
  platforms.forEach((platform, i) => {
    if (!boxInside(platformBox(platform), bounds)) errors.push(`platform "${platform.id}" leaves bounds`);
    for (let j = i + 1; j < platforms.length; j += 1) {
      const other = platforms[j];
      if (boxesIntersect(platformBox(platform), platformBox(other))) {
        errors.push(`platforms "${platform.id}" and "${other.id}" overlap`);
        continue;
      }
      // Only true overhangs need head room; side-by-side platforms are walls/steps.
      const overlapX = platformLeft(platform) < platformRight(other) && platformRight(platform) > platformLeft(other);
      if (!overlapX) continue;
      const [lower, upper] = platformTop(platform) <= platformTop(other) ? [platform, other] : [other, platform];
      const clearance = platformBottom(upper) - platformTop(lower);
      if (clearance < HEAD_CLEARANCE) {
        errors.push(`platform "${upper.id}" leaves only ${round(clearance)} head room over "${lower.id}" (needs ${round(HEAD_CLEARANCE)})`);
      }
    }
  });

  // Reachability: every platform is reachable from main and can return to it.
  const reach = analyzeReachability(platforms, caps, physics);
  const stranded = platforms.filter((_, index) => !reach.connected.has(index)).map((platform) => platform.id);
  if (stranded.length) errors.push(`platforms not mutually reachable with main: ${stranded.join(", ")}`);
  report.connectedPlatforms = reach.connected.size;
  report.maxRiseUsed = round(reach.maxRiseUsed);

  // Spawns: clear of geometry, land on their declared platform, reachable, spread out.
  const spawnBoxes = spawnPoints.map((spawn) => fighterBox(spawn, physics));
  spawnPoints.forEach((spawn, index) => {
    const label = `spawnPoints[${index}]`;
    const box = spawnBoxes[index];
    if (!boxInside(box, bounds)) errors.push(`${label} leaves bounds`);
    const support = findSupport(spawn.x, spawn.y, platforms, physics.playerWidth);
    if (support < 0) {
      errors.push(`${label} has no platform fully under it`);
      return;
    }
    if (support !== idIndex.get(spawn.platformId)) {
      errors.push(`${label} lands on "${platforms[support].id}", not declared "${spawn.platformId}"`);
    }
    const drop = spawn.y - platformTop(platforms[support]);
    if (drop > MAX_SPAWN_DROP) errors.push(`${label} drops ${round(drop)} (max ${MAX_SPAWN_DROP})`);
    // The whole fall column, from feet-on-platform up to head-at-spawn, must be clear.
    const column = { ...box, minY: platformTop(platforms[support]) };
    platforms.forEach((platform, pIndex) => {
      if (pIndex !== support && boxesIntersect(column, platformBox(platform))) {
        errors.push(`${label} overlaps or falls through platform "${platform.id}"`);
      }
    });
    if (!reach.connected.has(support)) errors.push(`${label} sits on an unreachable platform`);
    for (let other = index + 1; other < spawnPoints.length; other += 1) {
      const gap = distance(spawn, spawnPoints[other]);
      if (gap < MIN_SPAWN_SEPARATION) {
        errors.push(`${label} is ${round(gap)} from spawnPoints[${other}] (min ${MIN_SPAWN_SEPARATION})`);
      }
    }
  });

  // Items: floating just above a reachable platform, clear of geometry and spawns.
  const itemBoxes = itemSpawns.map((item) => footBox(item.x, item.y, physics.pickupSize, physics.pickupSize));
  itemSpawns.forEach((item, index) => {
    const label = `itemSpawns[${index}]`;
    const box = itemBoxes[index];
    if (!boxInside(box, bounds)) errors.push(`${label} leaves bounds`);
    platforms.forEach((platform) => {
      if (boxesIntersect(box, platformBox(platform))) errors.push(`${label} overlaps platform "${platform.id}"`);
    });
    const support = findSupport(item.x, item.y, platforms, 0);
    if (support < 0) {
      errors.push(`${label} has no platform under it`);
      return;
    }
    if (support !== idIndex.get(item.platformId)) {
      errors.push(`${label} hovers over "${platforms[support].id}", not declared "${item.platformId}"`);
    }
    const hover = item.y - platformTop(platforms[support]);
    if (hover > MAX_ITEM_HOVER) errors.push(`${label} hovers ${round(hover)} (max ${round(MAX_ITEM_HOVER)}) and cannot be collected`);
    if (!reach.connected.has(support)) errors.push(`${label} sits on an unreachable platform`);
    spawnBoxes.forEach((spawnBox, spawnIndex) => {
      if (boxesIntersect(box, spawnBox)) errors.push(`${label} overlaps spawnPoints[${spawnIndex}]`);
    });
    for (let other = index + 1; other < itemSpawns.length; other += 1) {
      const gap = distance(item, itemSpawns[other]);
      if (gap < MIN_ITEM_SEPARATION) errors.push(`${label} is ${round(gap)} from itemSpawns[${other}]`);
    }
  });

  // Hazards: bumpers never touch platforms, spawns or items; the floor starts well below play.
  const lowestBottom = Math.min(...platforms.map(platformBottom));
  hazards.forEach((hazard, index) => {
    const label = `hazards[${index}] (${hazard.kind})`;
    if (hazard.kind === "rising-floor") {
      if (hazard.y > lowestBottom - 3) errors.push(`${label} starts within 3 units of the lowest platform`);
      if (hazard.y <= blastZone.bottom) errors.push(`${label} starts below the blast zone`);
      return;
    }
    if (hazard.kind !== "bumper") return;
    const box = footBox(hazard.x, hazard.y, hazard.width, hazard.height);
    if (!boxInside(box, bounds)) errors.push(`${label} leaves bounds`);
    platforms.forEach((platform) => {
      if (boxesIntersect(box, platformBox(platform), 0.3)) errors.push(`${label} overlaps platform "${platform.id}"`);
    });
    spawnBoxes.forEach((spawnBox, spawnIndex) => {
      if (boxesIntersect(box, spawnBox, HAZARD_SPAWN_CLEARANCE)) errors.push(`${label} is too close to spawnPoints[${spawnIndex}]`);
    });
    itemBoxes.forEach((itemBox, itemIndex) => {
      if (boxesIntersect(box, itemBox, 0.5)) errors.push(`${label} overlaps itemSpawns[${itemIndex}]`);
    });
    hazards.slice(index + 1).forEach((other) => {
      if (other.kind === "bumper" && boxesIntersect(box, footBox(other.x, other.y, other.width, other.height))) {
        errors.push(`${label} overlaps another bumper`);
      }
    });
  });
}

export function analyzeGeneratedStage(stage, { fighters = null, physics = MATCH_PHYSICS } = {}) {
  const errors = [];
  const envelope = deriveMovementEnvelope(fighters);
  const caps = jumpCapabilities(envelope, physics);
  const report = {
    platformCount: stage?.platforms?.length ?? 0,
    connectedPlatforms: 0,
    maxRiseUsed: 0,
    maxRiseAllowed: round(caps.maxRise),
    envelope,
  };
  if (checkSchema(stage, errors)) {
    checkGeometry(stage, caps, physics, errors, report);
  }
  return { ok: errors.length === 0, errors, report };
}

export function validateGeneratedStage(stage, options = {}) {
  const { ok, errors } = analyzeGeneratedStage(stage, options);
  if (!ok) {
    throw new Error(`Generated stage "${stage?.id ?? "?"}" failed validation:\n- ${errors.join("\n- ")}`);
  }
  return stage;
}
