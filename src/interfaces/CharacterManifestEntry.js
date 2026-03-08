/**
 * CharacterManifestEntry — Character asset contract.
 *
 * Every runtime character must match this schema.
 * The manifest lives at public/characters/manifest.json.
 */

/**
 * @typedef {Object} CharacterManifestEntry
 * @property {string}   id              - Unique character identifier (e.g. "soldier-alpha")
 * @property {string}   file            - Path to .glb file relative to public/characters/
 * @property {string}   display_name    - Human-readable name
 * @property {string}   skeleton_id     - Rig identifier (e.g. "auto-rig-pro-humanoid")
 * @property {string[]} required_clips  - Animation clip names that must be present
 * @property {string}   weapon_socket   - Bone/socket name for weapon attachment
 * @property {string[]} tags            - Metadata tags (e.g. ["bot", "player", "heavy"])
 */

/** Required animation clips for every character */
export const REQUIRED_CLIPS = [
  "idle", "run", "jump", "fall", "land", "hit", "death", "equip", "fire"
];

/** Canonical weapon socket name */
export const WEAPON_SOCKET = "weapon_socket_r";

/**
 * Validate a character manifest entry.
 * @param {CharacterManifestEntry} entry
 * @throws {Error}
 */
export function validateCharacterEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Character entry must be a non-null object");
  }

  const required = ["id", "file", "display_name", "skeleton_id", "required_clips", "weapon_socket"];
  for (const field of required) {
    if (!entry[field]) {
      throw new Error(`Character entry "${entry.id || "unknown"}" missing required field: "${field}"`);
    }
  }

  if (!Array.isArray(entry.required_clips)) {
    throw new Error(`Character "${entry.id}": required_clips must be an array`);
  }

  const missing = REQUIRED_CLIPS.filter((clip) => !entry.required_clips.includes(clip));
  if (missing.length > 0) {
    throw new Error(`Character "${entry.id}" missing required clips: ${missing.join(", ")}`);
  }
}

/**
 * Validate an entire character manifest.
 * @param {CharacterManifestEntry[]} manifest
 * @throws {Error}
 */
export function validateCharacterManifest(manifest) {
  if (!Array.isArray(manifest)) {
    throw new Error("Character manifest must be an array");
  }

  if (manifest.length === 0) {
    throw new Error("Character manifest must contain at least one entry");
  }

  const ids = new Set();
  for (const entry of manifest) {
    validateCharacterEntry(entry);
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate character ID: "${entry.id}"`);
    }
    ids.add(entry.id);
  }
}
