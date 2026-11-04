/**
 * Gameplay geometry rules shared by the stage generator and the generated-stage
 * contract (spec skills: `bot-navigation-check`, `spawn-and-pickup-balancer`).
 *
 * Everything here is derived from the numbers the simulation actually uses
 * (`MATCH_PHYSICS` in ToyboxMatch.js) and from the weakest fighter on the
 * roster, so "reachable" means "reachable by every fighter", with a margin.
 *
 * Coordinate conventions (same as the runtime):
 * - platforms: `x`,`y` are the box centre.
 * - fighters, pickups, bumpers: `x` is the centre, `y` is the bottom edge.
 */
import { MATCH_PHYSICS } from "../game/ToyboxMatch.js";

/** Fraction of the theoretical double-jump apex a layout may ask for. */
export const REACH_SAFETY = 0.9;
/** Fraction of top run speed assumed while airborne (accel + course changes). */
export const HORIZONTAL_SAFETY = 0.6;
/** Vertical room required under any platform that overhangs another. */
export const HEAD_CLEARANCE = MATCH_PHYSICS.playerHeight + 0.5;
/** Spawns hover above their platform and drop onto it; cap the drop. */
export const MAX_SPAWN_DROP = 3;
/** Pickups must be low enough that a standing fighter's box touches them. */
export const MAX_ITEM_HOVER = MATCH_PHYSICS.playerHeight - MATCH_PHYSICS.pickupSize;
export const MIN_SPAWN_SEPARATION = 2.5;
export const MIN_ITEM_SEPARATION = 1.2;
export const HAZARD_SPAWN_CLEARANCE = 1;

/**
 * Fallback envelope when no fighter catalog is supplied. Mirrors the weakest
 * values in `public/fighters/catalog.json` (fighter "red"); the stage tests
 * assert this is never more permissive than the live catalog.
 */
export const DEFAULT_MOVEMENT_ENVELOPE = Object.freeze({
  jumpVelocity: 14.2,
  doubleJumpVelocity: 13.6,
  runSpeed: 7.3,
});

export function deriveMovementEnvelope(fighters) {
  if (!Array.isArray(fighters) || fighters.length === 0) {
    return { ...DEFAULT_MOVEMENT_ENVELOPE };
  }
  const profiles = fighters.map((fighter) => fighter.movementProfile);
  return {
    jumpVelocity: Math.min(...profiles.map((profile) => profile.jumpVelocity)),
    doubleJumpVelocity: Math.min(...profiles.map((profile) => profile.doubleJumpVelocity)),
    runSpeed: Math.min(...profiles.map((profile) => profile.runSpeed)),
  };
}

export function jumpCapabilities(envelope = DEFAULT_MOVEMENT_ENVELOPE, physics = MATCH_PHYSICS) {
  const g = Math.abs(physics.gravity);
  const { jumpVelocity: j, doubleJumpVelocity: d, runSpeed } = envelope;
  // Double jump fired at the apex of the first jump.
  const apexHeight = (j * j + d * d) / (2 * g);
  return {
    g,
    apexHeight,
    maxRise: apexHeight * REACH_SAFETY,
    ascentTime: (j + d) / g,
    runSpeed,
  };
}

/** Horizontal distance coverable while still at or above `rise`. */
export function horizontalReach(caps, rise) {
  const fallTime = Math.sqrt((2 * Math.max(0, caps.apexHeight - rise)) / caps.g);
  return caps.runSpeed * HORIZONTAL_SAFETY * (caps.ascentTime + fallTime);
}

/**
 * Euclidean distance via Math.sqrt (correctly rounded per spec) rather than
 * Math.hypot (engine-dependent rounding), so accept/reject decisions, and with
 * them generated stages, are identical in every JS engine.
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export const platformTop = (platform) => platform.y + platform.height / 2;
export const platformBottom = (platform) => platform.y - platform.height / 2;
export const platformLeft = (platform) => platform.x - platform.width / 2;
export const platformRight = (platform) => platform.x + platform.width / 2;

export function platformBox(platform) {
  return {
    minX: platformLeft(platform),
    maxX: platformRight(platform),
    minY: platformBottom(platform),
    maxY: platformTop(platform),
  };
}

/** Box for anything stored as centre-x / bottom-y (fighters, pickups, bumpers). */
export function footBox(x, y, width, height) {
  return { minX: x - width / 2, maxX: x + width / 2, minY: y, maxY: y + height };
}

export function fighterBox(point, physics = MATCH_PHYSICS) {
  return footBox(point.x, point.y, physics.playerWidth, physics.playerHeight);
}

export function boxesIntersect(a, b, pad = 0) {
  return a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minY < b.maxY + pad && a.maxY > b.minY - pad;
}

export function boxInside(inner, bounds) {
  return inner.minX >= bounds.left && inner.maxX <= bounds.right && inner.minY >= bounds.bottom && inner.maxY <= bounds.top;
}

function horizontalGap(a, b) {
  return Math.max(0, platformLeft(b) - platformRight(a), platformLeft(a) - platformRight(b));
}

/**
 * Can a fighter standing on `from` get onto `to`?
 *
 * Conservative model: one jump + one double jump, no wall tricks. Platforms are
 * solid from below in the runtime, so a higher platform directly overhead is
 * only enterable if `from` leaves at least one fighter width of take-off room
 * beside it.
 */
export function canTraverse(from, to, caps, physics = MATCH_PHYSICS) {
  const rise = platformTop(to) - platformTop(from);
  if (rise > caps.maxRise) return false;
  const gap = horizontalGap(from, to);
  if (gap > horizontalReach(caps, rise)) return false;
  if (rise > 0 && gap === 0) {
    const roomLeft = platformLeft(to) - platformLeft(from);
    const roomRight = platformRight(from) - platformRight(to);
    if (Math.max(roomLeft, roomRight) < physics.playerWidth) return false;
  }
  return true;
}

function search(startIndex, neighbours) {
  const seen = new Set([startIndex]);
  const queue = [startIndex];
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighbours[current]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/**
 * Directed traversal graph over platforms. `connected` holds the indices that
 * can be reached from the main platform AND can get back to it, so no fighter
 * (or bot) can be stranded on a dead-end perch.
 */
export function analyzeReachability(platforms, caps, physics = MATCH_PHYSICS) {
  const mainIndex = platforms.findIndex((platform) => platform.kind === "main");
  const forward = platforms.map(() => []);
  const backward = platforms.map(() => []);
  let maxRiseUsed = 0;
  platforms.forEach((from, i) => {
    platforms.forEach((to, j) => {
      if (i === j || !canTraverse(from, to, caps, physics)) return;
      forward[i].push(j);
      backward[j].push(i);
    });
  });
  if (mainIndex < 0) {
    return { mainIndex, connected: new Set(), forward, maxRiseUsed };
  }
  const reachable = search(mainIndex, forward);
  const returnable = search(mainIndex, backward);
  const connected = new Set([...reachable].filter((index) => returnable.has(index)));
  for (const index of connected) {
    if (index === mainIndex) continue;
    const bestRise = Math.min(
      ...backward[index].filter((source) => connected.has(source))
        .map((source) => platformTop(platforms[index]) - platformTop(platforms[source])),
    );
    maxRiseUsed = Math.max(maxRiseUsed, bestRise);
  }
  return { mainIndex, connected, forward, maxRiseUsed };
}

/**
 * Highest platform fully under a fighter-width footprint at `x`, whose top is
 * at or below `y`. Returns the platform index or -1.
 */
export function findSupport(x, y, platforms, footprintWidth) {
  let best = -1;
  platforms.forEach((platform, index) => {
    const top = platformTop(platform);
    if (top > y + 1e-6) return;
    if (x - footprintWidth / 2 < platformLeft(platform) - 1e-6) return;
    if (x + footprintWidth / 2 > platformRight(platform) + 1e-6) return;
    if (best < 0 || top > platformTop(platforms[best])) best = index;
  });
  return best;
}

/**
 * Horizontal intervals on a platform's top where a fighter can stand with
 * `headroom` units of free space above (no overhanging platform).
 */
export function freeStandingIntervals(platform, platforms, headroom, physics = MATCH_PHYSICS) {
  const half = physics.playerWidth / 2;
  const top = platformTop(platform);
  let intervals = [[platformLeft(platform) + half + 0.3, platformRight(platform) - half - 0.3]];
  for (const other of platforms) {
    if (other === platform) continue;
    if (platformTop(other) <= top || platformBottom(other) >= top + headroom) continue;
    const blockLeft = platformLeft(other) - half - 0.2;
    const blockRight = platformRight(other) + half + 0.2;
    intervals = intervals.flatMap(([a, b]) => {
      if (blockRight <= a || blockLeft >= b) return [[a, b]];
      const pieces = [];
      if (blockLeft > a) pieces.push([a, blockLeft]);
      if (blockRight < b) pieces.push([blockRight, b]);
      return pieces;
    });
  }
  return intervals.filter(([a, b]) => b - a >= 0);
}
