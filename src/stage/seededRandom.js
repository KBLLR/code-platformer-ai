/**
 * Deterministic, seedable randomness for stage generation.
 *
 * - `hashSeed` folds any string/number into a 32-bit integer (FNV-1a).
 * - `createRng` returns a mulberry32 stream with small helpers.
 *
 * Only integer ops and +,-,*,/ are used, so the same seed yields bit-identical
 * output in every JS engine (no Math.random, no trig).
 */

export function hashSeed(input) {
  const text = String(input);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRng(seedInput) {
  let state = typeof seedInput === "number" ? seedInput >>> 0 : hashSeed(seedInput);

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, maxInclusive) {
      return min + Math.floor(next() * (maxInclusive - min + 1));
    },
    chance(probability) {
      return next() < probability;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    shuffle(list) {
      const copy = [...list];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    },
  };
}

/** Quantize to 0.1 so generated JSON stays short and stable. */
export function quantize(value, step = 0.1) {
  const scaled = Math.round(value / step) * step;
  return Math.round(scaled * 1000) / 1000;
}
