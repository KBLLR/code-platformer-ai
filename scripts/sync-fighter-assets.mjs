import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { createWarehouseClient } from "@corex/warehouse-client";
import {
  CONSUMER_SNAPSHOT_INDEX_SCHEMA,
  PRODUCER_RELEASE_MANIFEST_SCHEMA,
  validateConsumerSnapshotIndex,
  validateFighterCatalog,
  validateProducerReleaseManifest,
  validateRiggedRuntimeManifest,
} from "../src/content/contracts.js";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const houseId = "code-platformer-ai";
const warehouseBaseUrl = process.env.WAREHOUSE_URL ?? process.env.VITE_WAREHOUSE_URL ?? "http://127.0.0.1:5202";
const warehouse = createWarehouseClient({ baseUrl: warehouseBaseUrl });

function publicUrlToFilePath(publicUrl) {
  return path.join(publicDir, publicUrl.replace(/^\//, ""));
}

function publicUrlToLogicalPath(publicUrl) {
  return path.posix.join("houses/code-platformer-AI/public", publicUrl.replace(/^\//, ""));
}

function computeStableId(logicalPath) {
  return createHash("sha256").update(logicalPath).digest("hex").slice(0, 16);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function sha256ForFile(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function publishLocalFile({
  id,
  kind,
  source,
  logicalPath,
  filePath,
  displayName,
  mimeType,
  tags,
  provenance,
}) {
  const fileStats = await stat(filePath);
  return warehouse.publish({
    id,
    kind,
    source,
    house: houseId,
    path: logicalPath,
    filename: path.basename(filePath),
    display_name: displayName,
    mime_type: mimeType,
    size_bytes: fileStats.size,
    file_url: pathToFileURL(filePath).href,
    actor: "toybox-fighter-sync",
    surface: houseId,
    enrich: false,
    tags,
    provenance,
  });
}

async function resolveWarehouseJson(itemId) {
  const resolution = await warehouse.resolve(itemId);
  const response = await fetch(resolution.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch resolved Warehouse item ${itemId}: ${response.status}`);
  }
  return response.json();
}

async function downloadWarehouseItem(itemId, destinationPath, expectedChecksum) {
  const resolution = await warehouse.resolve(itemId);
  const response = await fetch(resolution.url);
  if (!response.ok) {
    throw new Error(`Failed to download Warehouse item ${itemId}: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, bytes);
  const checksum = await sha256ForFile(destinationPath);
  if (expectedChecksum && checksum !== expectedChecksum) {
    throw new Error(`Checksum mismatch for ${destinationPath}: expected ${expectedChecksum}, got ${checksum}`);
  }
}

function buildProducerAssetRef(publicUrl, checksum, mimeType) {
  const logicalPath = publicUrlToLogicalPath(publicUrl);
  return {
    itemId: computeStableId(logicalPath),
    path: logicalPath,
    filename: path.basename(publicUrl),
    checksum,
    mimeType,
  };
}

async function syncFighter(fighter) {
  const sourceModelPath = publicUrlToFilePath(fighter.mirroredSourceFile);
  const runtimeManifestPath = publicUrlToFilePath(fighter.runtimeRig.manifestFile);
  const runtimeGlbPath = publicUrlToFilePath(fighter.mirroredRuntimeFile);
  const snapshotRootPath = publicUrlToFilePath(fighter.distribution.snapshotRoot);
  const producerReleaseManifestPath = path.join(snapshotRootPath, "producer-release-manifest.json");
  const consumerIndexPath = path.join(snapshotRootPath, "consumer-index.json");

  const runtimeManifest = validateRiggedRuntimeManifest(
    await readJson(runtimeManifestPath),
    fighter.id,
  );

  const sourceChecksum = await sha256ForFile(sourceModelPath);
  const runtimeManifestChecksum = await sha256ForFile(runtimeManifestPath);
  const runtimeGlbAvailable = runtimeManifest.exportStatus === "ready" && await exists(runtimeGlbPath);
  if (runtimeManifest.exportStatus === "ready" && !runtimeGlbAvailable) {
    throw new Error(`Fighter "${fighter.id}" is marked ready but ${runtimeGlbPath} is missing`);
  }

  const producerReleaseManifest = validateProducerReleaseManifest({
    schemaVersion: PRODUCER_RELEASE_MANIFEST_SCHEMA,
    fighterId: fighter.id,
    consumerHouse: houseId,
    assetPackVersion: fighter.distribution.assetPackVersion,
    producerHouse: fighter.runtimeRig.producerHouse,
    exportStatus: runtimeManifest.exportStatus,
    requiredClips: runtimeManifest.requiredClips,
    availableClips: runtimeManifest.availableClips,
    assets: {
      sourceModel: buildProducerAssetRef(fighter.mirroredSourceFile, sourceChecksum, "model/gltf-binary"),
      runtimeManifest: buildProducerAssetRef(
        fighter.runtimeRig.manifestFile,
        runtimeManifestChecksum,
        "application/json; charset=utf-8",
      ),
      runtimeGlb: runtimeGlbAvailable
        ? buildProducerAssetRef(
          fighter.mirroredRuntimeFile,
          await sha256ForFile(runtimeGlbPath),
          "model/gltf-binary",
        )
        : null,
      textures: [],
      motionClips: {},
    },
  }, fighter.id);

  await writeJson(producerReleaseManifestPath, producerReleaseManifest);

  await publishLocalFile({
    id: producerReleaseManifest.assets.sourceModel.itemId,
    kind: "3d",
    source: "house-public",
    logicalPath: producerReleaseManifest.assets.sourceModel.path,
    filePath: sourceModelPath,
    displayName: `${fighter.displayName} source model`,
    mimeType: producerReleaseManifest.assets.sourceModel.mimeType,
    tags: ["toybox-arena", "fighter", fighter.id, "source-model"],
    provenance: {
      produced_by_house: houseId,
      consumer_house: houseId,
      producer_house: fighter.runtimeRig.producerHouse,
      fighter_id: fighter.id,
      distribution_role: "source-model",
    },
  });

  await publishLocalFile({
    id: producerReleaseManifest.assets.runtimeManifest.itemId,
    kind: "doc",
    source: "house-public",
    logicalPath: producerReleaseManifest.assets.runtimeManifest.path,
    filePath: runtimeManifestPath,
    displayName: `${fighter.displayName} runtime manifest`,
    mimeType: producerReleaseManifest.assets.runtimeManifest.mimeType,
    tags: ["toybox-arena", "fighter", fighter.id, "runtime-manifest"],
    provenance: {
      produced_by_house: fighter.runtimeRig.producerHouse,
      consumer_house: houseId,
      fighter_id: fighter.id,
      distribution_role: "runtime-manifest",
    },
  });

  if (producerReleaseManifest.assets.runtimeGlb) {
    await publishLocalFile({
      id: producerReleaseManifest.assets.runtimeGlb.itemId,
      kind: "3d",
      source: "house-public",
      logicalPath: producerReleaseManifest.assets.runtimeGlb.path,
      filePath: runtimeGlbPath,
      displayName: `${fighter.displayName} runtime GLB`,
      mimeType: producerReleaseManifest.assets.runtimeGlb.mimeType,
      tags: ["toybox-arena", "fighter", fighter.id, "runtime-glb"],
      provenance: {
        produced_by_house: fighter.runtimeRig.producerHouse,
        consumer_house: houseId,
        fighter_id: fighter.id,
        distribution_role: "runtime-glb",
      },
    });
  }

  await publishLocalFile({
    id: fighter.distribution.releaseManifestItemId,
    kind: "doc",
    source: "generated",
    logicalPath: publicUrlToLogicalPath(`${fighter.distribution.snapshotRoot}/producer-release-manifest.json`),
    filePath: producerReleaseManifestPath,
    displayName: `${fighter.displayName} producer release manifest`,
    mimeType: "application/json; charset=utf-8",
    tags: ["toybox-arena", "fighter", fighter.id, "release-manifest"],
    provenance: {
      produced_by_house: houseId,
      consumer_house: houseId,
      producer_house: fighter.runtimeRig.producerHouse,
      fighter_id: fighter.id,
      distribution_role: "producer-release-manifest",
    },
  });

  const resolvedReleaseManifest = validateProducerReleaseManifest(
    await resolveWarehouseJson(fighter.distribution.releaseManifestItemId),
    fighter.id,
  );

  const snapshotFiles = {
    sourceModel: path.join(snapshotRootPath, "source-model.glb"),
    runtimeManifest: path.join(snapshotRootPath, "runtime-manifest.json"),
    runtimeGlb: path.join(snapshotRootPath, "runtime.glb"),
  };

  await downloadWarehouseItem(
    resolvedReleaseManifest.assets.sourceModel.itemId,
    snapshotFiles.sourceModel,
    resolvedReleaseManifest.assets.sourceModel.checksum,
  );
  await downloadWarehouseItem(
    resolvedReleaseManifest.assets.runtimeManifest.itemId,
    snapshotFiles.runtimeManifest,
    resolvedReleaseManifest.assets.runtimeManifest.checksum,
  );
  if (resolvedReleaseManifest.assets.runtimeGlb) {
    await downloadWarehouseItem(
      resolvedReleaseManifest.assets.runtimeGlb.itemId,
      snapshotFiles.runtimeGlb,
      resolvedReleaseManifest.assets.runtimeGlb.checksum,
    );
  }

  const consumerIndex = validateConsumerSnapshotIndex({
    schemaVersion: CONSUMER_SNAPSHOT_INDEX_SCHEMA,
    fighterId: fighter.id,
    releaseManifestItemId: fighter.distribution.releaseManifestItemId,
    assetPackVersion: fighter.distribution.assetPackVersion,
    snapshotRoot: fighter.distribution.snapshotRoot,
    generatedAt: new Date().toISOString(),
    exportStatus: resolvedReleaseManifest.exportStatus,
    requiredClips: resolvedReleaseManifest.requiredClips,
    availableClips: resolvedReleaseManifest.availableClips,
    assets: {
      sourceModel: {
        itemId: resolvedReleaseManifest.assets.sourceModel.itemId,
        checksum: resolvedReleaseManifest.assets.sourceModel.checksum,
        localUrl: `${fighter.distribution.snapshotRoot}/source-model.glb`,
        filename: "source-model.glb",
        warehousePath: resolvedReleaseManifest.assets.sourceModel.path,
      },
      runtimeManifest: {
        itemId: resolvedReleaseManifest.assets.runtimeManifest.itemId,
        checksum: resolvedReleaseManifest.assets.runtimeManifest.checksum,
        localUrl: `${fighter.distribution.snapshotRoot}/runtime-manifest.json`,
        filename: "runtime-manifest.json",
        warehousePath: resolvedReleaseManifest.assets.runtimeManifest.path,
      },
      runtimeGlb: resolvedReleaseManifest.assets.runtimeGlb
        ? {
          itemId: resolvedReleaseManifest.assets.runtimeGlb.itemId,
          checksum: resolvedReleaseManifest.assets.runtimeGlb.checksum,
          localUrl: `${fighter.distribution.snapshotRoot}/runtime.glb`,
          filename: "runtime.glb",
          warehousePath: resolvedReleaseManifest.assets.runtimeGlb.path,
        }
        : null,
      textures: [],
      motionClips: {},
    },
  }, fighter.id);

  await writeJson(consumerIndexPath, consumerIndex);

  return {
    fighterId: fighter.id,
    releaseManifestItemId: fighter.distribution.releaseManifestItemId,
    exportStatus: resolvedReleaseManifest.exportStatus,
    snapshotRoot: fighter.distribution.snapshotRoot,
  };
}

async function main() {
  const fighterCatalog = validateFighterCatalog(
    await readJson(path.join(publicDir, "fighters", "catalog.json")),
  );

  const results = [];
  for (const fighter of fighterCatalog) {
    results.push(await syncFighter(fighter));
  }

  console.log(JSON.stringify({
    status: "ok",
    warehouse: warehouseBaseUrl,
    fighters: results,
  }, null, 2));
}

await main();
