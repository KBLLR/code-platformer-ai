/**
 * ArenaConfig — Typed arena configuration schema + validation.
 *
 * An ArenaConfig fully describes a battle royale arena layout.
 * The StageGenerator compiles an ArenaConfig into a playable Three.js scene.
 */

/**
 * @typedef {Object} SafeZonePhase
 * @property {number} delay     - Seconds before this phase begins
 * @property {number} duration  - Seconds for the zone to shrink
 * @property {number} radius    - Target radius at end of phase
 * @property {{ x: number, z: number }} center - Zone center
 * @property {number} damage    - DPS outside the zone during this phase
 */

/**
 * @typedef {Object} SpawnPoint
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} [rotation] - Y-axis rotation in radians
 */

/**
 * @typedef {Object} CoverCluster
 * @property {{ x: number, z: number }} center
 * @property {number} radius
 * @property {number} density   - Number of cover objects in cluster
 * @property {string} [type]    - "crate" | "wall" | "barrel" | "rock"
 */

/**
 * @typedef {Object} ArenaConfig
 * @property {number}           seed           - Deterministic RNG seed
 * @property {string}           theme          - Visual theme ("code" | "google" | "ballpit" | "neon" | "scifi")
 * @property {{ width: number, depth: number, height: number }} bounds - Arena dimensions
 * @property {Array<{ elevation: number, width: number, material?: string }>} terrainBands - Terrain height bands
 * @property {CoverCluster[]}   coverClusters  - Cover object clusters
 * @property {SpawnPoint[]}     spawnPoints    - Player/bot spawn locations (minimum 12)
 * @property {SpawnPoint[]}     lootPoints     - Weapon/item spawn locations
 * @property {SpawnPoint[]}     botWaypoints   - Navigation waypoints for AI bots
 * @property {SafeZonePhase[]}  safeZonePhases - Safe zone shrink schedule
 * @property {{ ambient: string, directional: string, intensity: number }} lighting
 * @property {{ type: string, color?: string, gradient?: string[] }}       sky
 */

const REQUIRED_FIELDS = [
  "seed", "theme", "bounds", "spawnPoints", "safeZonePhases"
];

const VALID_THEMES = ["code", "google", "ballpit", "neon", "scifi", "basement", "vr"];

/**
 * Validate an ArenaConfig object. Throws on malformed input.
 * @param {ArenaConfig} config
 * @throws {Error}
 */
export function validateArenaConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("ArenaConfig must be a non-null object");
  }

  for (const field of REQUIRED_FIELDS) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(`ArenaConfig missing required field: "${field}"`);
    }
  }

  if (typeof config.seed !== "number" || !Number.isFinite(config.seed)) {
    throw new Error("ArenaConfig.seed must be a finite number");
  }

  if (!VALID_THEMES.includes(config.theme)) {
    throw new Error(`ArenaConfig.theme "${config.theme}" is not valid. Must be one of: ${VALID_THEMES.join(", ")}`);
  }

  const { bounds } = config;
  if (!bounds || typeof bounds.width !== "number" || typeof bounds.depth !== "number") {
    throw new Error("ArenaConfig.bounds must have numeric width and depth");
  }

  if (!Array.isArray(config.spawnPoints) || config.spawnPoints.length < 12) {
    throw new Error("ArenaConfig.spawnPoints must contain at least 12 entries (1 human + 11 bots)");
  }

  if (!Array.isArray(config.safeZonePhases) || config.safeZonePhases.length === 0) {
    throw new Error("ArenaConfig.safeZonePhases must contain at least one phase");
  }

  for (const [i, phase] of config.safeZonePhases.entries()) {
    if (typeof phase.delay !== "number" || typeof phase.duration !== "number" || typeof phase.radius !== "number") {
      throw new Error(`ArenaConfig.safeZonePhases[${i}] must have numeric delay, duration, and radius`);
    }
  }
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 * @param {number} seed
 * @returns {() => number} PRNG function returning [0, 1)
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a deterministic default ArenaConfig for a given seed.
 * @param {number} seed
 * @returns {ArenaConfig}
 */
export function createDefaultArenaConfig(seed = 42) {
  const rng = mulberry32(seed);
  const arenaSize = 80;
  const halfSize = arenaSize / 2;

  // Generate 12 spawn points around the perimeter
  const spawnPoints = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const radius = halfSize * 0.8;
    spawnPoints.push({
      x: Math.cos(angle) * radius,
      y: 0.5,
      z: Math.sin(angle) * radius,
      rotation: angle + Math.PI, // Face center
    });
  }

  // Generate loot points scattered across arena
  const lootPoints = [];
  for (let i = 0; i < 20; i++) {
    lootPoints.push({
      x: (rng() - 0.5) * arenaSize * 0.7,
      y: 0.5,
      z: (rng() - 0.5) * arenaSize * 0.7,
    });
  }

  // Generate bot waypoints in a grid pattern
  const botWaypoints = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      botWaypoints.push({
        x: gx * (arenaSize / 5) + (rng() - 0.5) * 5,
        y: 0.5,
        z: gz * (arenaSize / 5) + (rng() - 0.5) * 5,
      });
    }
  }

  // Generate cover clusters
  const coverClusters = [];
  const coverTypes = ["crate", "wall", "barrel", "rock"];
  for (let i = 0; i < 8; i++) {
    coverClusters.push({
      center: {
        x: (rng() - 0.5) * arenaSize * 0.6,
        z: (rng() - 0.5) * arenaSize * 0.6,
      },
      radius: 3 + rng() * 5,
      density: 3 + Math.floor(rng() * 5),
      type: coverTypes[Math.floor(rng() * coverTypes.length)],
    });
  }

  return {
    seed,
    theme: "code",
    bounds: { width: arenaSize, depth: arenaSize, height: 30 },
    terrainBands: [
      { elevation: 0, width: arenaSize, material: "concrete" },
      { elevation: 2, width: arenaSize * 0.6, material: "metal" },
      { elevation: 5, width: arenaSize * 0.3, material: "glow" },
    ],
    coverClusters,
    spawnPoints,
    lootPoints,
    botWaypoints,
    safeZonePhases: [
      { delay: 60, duration: 30, radius: halfSize * 0.7, center: { x: 0, z: 0 }, damage: 2 },
      { delay: 30, duration: 25, radius: halfSize * 0.45, center: { x: 0, z: 0 }, damage: 5 },
      { delay: 25, duration: 20, radius: halfSize * 0.2, center: { x: 0, z: 0 }, damage: 10 },
      { delay: 20, duration: 15, radius: 5, center: { x: 0, z: 0 }, damage: 20 },
    ],
    lighting: {
      ambient: "#334466",
      directional: "#ffffff",
      intensity: 1.2,
    },
    sky: {
      type: "gradient",
      gradient: ["#0a0a2e", "#1a1a4e", "#2a1a3e"],
    },
  };
}
