#!/usr/bin/env node
/**
 * Bounded development proof: stage the real rigged character locally.
 *
 * `drive_char_002` is the only fully-rigged character the Rigging Portal
 * pipeline has produced. This copies its viewer runtime into a local, ignored
 * directory so the gamepad and animation state machine can be proven against a
 * real rigged skeleton instead of the procedural capsules.
 *
 * This is NOT a distribution path. It publishes nothing, mutates no Warehouse
 * state, and changes no Rigging Portal custody or publication contract. The
 * asset stays untracked; only this script and the catalog entry are committed.
 * Canonical publication remains a separate mission.
 *
 * Usage:
 *   node scripts/link-dev-proof-character.mjs [--source <rigging-portal-root>]
 */

import { existsSync, mkdirSync, copyFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");

const CHARACTER_ID = "drive_char_002";
const PROOF_ID = "drive-char-002-proof";
const PROOF_DIR = join(REPO, "public", "fighters", "dev-proof-v1", PROOF_ID);

/** Sibling-layout default: <root>/houses/{rigging-portal,code-platformer-AI}. */
function defaultRiggingRoot() {
  return resolve(REPO, "..", "rigging-portal");
}

function parseArgs(argv) {
  const index = argv.indexOf("--source");
  return index >= 0 && argv[index + 1]
    ? { source: resolve(argv[index + 1]) }
    : { source: defaultRiggingRoot() };
}

function main() {
  const { source } = parseArgs(process.argv.slice(2));
  const exportDir = join(source, "exports", "rigged", CHARACTER_ID);
  const viewerRuntime = join(exportDir, "viewer-runtime.glb");
  const motionManifest = join(exportDir, "runtime-motion.manifest.json");

  if (!existsSync(viewerRuntime)) {
    console.error(
      `[toybox] Rigged character not found at ${viewerRuntime}\n` +
        `        Pass --source <rigging-portal-root> if the house is elsewhere.`,
    );
    process.exit(1);
  }

  mkdirSync(PROOF_DIR, { recursive: true });

  const target = join(PROOF_DIR, "viewer-runtime.glb");
  const bytes = statSync(viewerRuntime).size;
  copyFileSync(viewerRuntime, target);

  // Record where this came from, so a stale local copy is identifiable later.
  const provenance = {
    schemaVersion: "toybox-dev-proof-provenance-v1",
    proofId: PROOF_ID,
    characterId: CHARACTER_ID,
    sourceRepository: "rigging-portal",
    sourceArtifact: `exports/rigged/${CHARACTER_ID}/viewer-runtime.glb`,
    sourceAbsolutePath: viewerRuntime,
    byteSize: bytes,
    stagedAt: new Date().toISOString(),
    distributionMode: "bounded-local-snapshot",
    canonicalPublication: "PENDING SEPARATE MISSION",
    warehouseMutation: "NONE",
    riggingPublicationMutation: "NONE",
  };
  writeFileSync(
    join(PROOF_DIR, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );

  if (existsSync(motionManifest)) {
    copyFileSync(motionManifest, join(PROOF_DIR, "runtime-motion.manifest.json"));
  }

  console.log(
    `[toybox] Staged ${CHARACTER_ID} (${(bytes / 1024 / 1024).toFixed(1)} MB) at ` +
      `public/fighters/dev-proof-v1/${PROOF_ID}/viewer-runtime.glb`,
  );
  console.log("[toybox] Development proof only — not a distribution path.");
}

main();
