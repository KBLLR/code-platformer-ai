import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  validateConsumerSnapshotIndex,
  validateFighterCatalog,
  validateProducerReleaseManifest,
  validateRiggedRuntimeManifest,
} from "../src/content/contracts.js";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const strictMode = process.argv.includes("--strict");

function publicUrlToFilePath(publicUrl) {
  return path.join(publicDir, publicUrl.replace(/^\//, ""));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sha256ForFile(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function assertExists(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} missing at ${filePath}`);
  }
}

async function assertChecksum(filePath, expectedChecksum, label) {
  const actualChecksum = await sha256ForFile(filePath);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`${label} checksum mismatch at ${filePath}: expected ${expectedChecksum}, got ${actualChecksum}`);
  }
}

async function validateFighterAssets(fighter) {
  const sourceModelPath = publicUrlToFilePath(fighter.mirroredSourceFile);
  const runtimeManifestPath = publicUrlToFilePath(fighter.runtimeRig.manifestFile);
  const runtimeGlbPath = publicUrlToFilePath(fighter.mirroredRuntimeFile);
  const snapshotRootPath = publicUrlToFilePath(fighter.distribution.snapshotRoot);
  const producerManifestPath = path.join(snapshotRootPath, "producer-release-manifest.json");
  const consumerIndexPath = path.join(snapshotRootPath, "consumer-index.json");

  await assertExists(sourceModelPath, `source model for "${fighter.id}"`);
  await assertExists(runtimeManifestPath, `runtime manifest for "${fighter.id}"`);
  await assertExists(producerManifestPath, `producer release manifest for "${fighter.id}"`);
  await assertExists(consumerIndexPath, `consumer snapshot index for "${fighter.id}"`);

  const runtimeManifest = validateRiggedRuntimeManifest(
    await readJson(runtimeManifestPath),
    fighter.id,
  );
  const producerManifest = validateProducerReleaseManifest(
    await readJson(producerManifestPath),
    fighter.id,
  );
  const consumerIndex = validateConsumerSnapshotIndex(
    await readJson(consumerIndexPath),
    fighter.id,
  );

  if (consumerIndex.releaseManifestItemId !== fighter.distribution.releaseManifestItemId) {
    throw new Error(`consumer snapshot index for "${fighter.id}" points to the wrong release manifest item`);
  }
  if (producerManifest.assetPackVersion !== fighter.distribution.assetPackVersion) {
    throw new Error(`producer release manifest for "${fighter.id}" has unexpected assetPackVersion`);
  }
  if (consumerIndex.assetPackVersion !== fighter.distribution.assetPackVersion) {
    throw new Error(`consumer snapshot index for "${fighter.id}" has unexpected assetPackVersion`);
  }

  await assertChecksum(
    sourceModelPath,
    producerManifest.assets.sourceModel.checksum,
    `source model for "${fighter.id}"`,
  );
  await assertChecksum(
    runtimeManifestPath,
    producerManifest.assets.runtimeManifest.checksum,
    `runtime manifest for "${fighter.id}"`,
  );

  const snapshotSourceModelPath = publicUrlToFilePath(consumerIndex.assets.sourceModel.localUrl);
  const snapshotRuntimeManifestPath = publicUrlToFilePath(consumerIndex.assets.runtimeManifest.localUrl);
  await assertExists(snapshotSourceModelPath, `snapshot source model for "${fighter.id}"`);
  await assertExists(snapshotRuntimeManifestPath, `snapshot runtime manifest for "${fighter.id}"`);
  await assertChecksum(
    snapshotSourceModelPath,
    consumerIndex.assets.sourceModel.checksum,
    `snapshot source model for "${fighter.id}"`,
  );
  await assertChecksum(
    snapshotRuntimeManifestPath,
    consumerIndex.assets.runtimeManifest.checksum,
    `snapshot runtime manifest for "${fighter.id}"`,
  );

  const readyFighter = runtimeManifest.exportStatus === "ready"
    || producerManifest.exportStatus === "ready"
    || consumerIndex.exportStatus === "ready";

  if (readyFighter) {
    await assertExists(runtimeGlbPath, `runtime GLB for "${fighter.id}"`);
    if (!producerManifest.assets.runtimeGlb || !consumerIndex.assets.runtimeGlb) {
      throw new Error(`ready fighter "${fighter.id}" is missing runtimeGlb metadata in distribution manifests`);
    }

    const snapshotRuntimeGlbPath = publicUrlToFilePath(consumerIndex.assets.runtimeGlb.localUrl);
    await assertExists(snapshotRuntimeGlbPath, `snapshot runtime GLB for "${fighter.id}"`);
    await assertChecksum(
      runtimeGlbPath,
      producerManifest.assets.runtimeGlb.checksum,
      `runtime GLB for "${fighter.id}"`,
    );
    await assertChecksum(
      snapshotRuntimeGlbPath,
      consumerIndex.assets.runtimeGlb.checksum,
      `snapshot runtime GLB for "${fighter.id}"`,
    );
  } else if (strictMode && fighter.runtimeRig.exportStatus === "ready") {
    throw new Error(`fighter "${fighter.id}" is marked ready in catalog but release metadata is not ready`);
  }

  return {
    fighterId: fighter.id,
    exportStatus: runtimeManifest.exportStatus,
    strict: strictMode,
  };
}

async function main() {
  const fighterCatalog = validateFighterCatalog(
    await readJson(path.join(publicDir, "fighters", "catalog.json")),
  );

  const results = [];
  for (const fighter of fighterCatalog) {
    results.push(await validateFighterAssets(fighter));
  }

  console.log(JSON.stringify({
    status: "ok",
    strict: strictMode,
    fighters: results,
  }, null, 2));
}

await main();
