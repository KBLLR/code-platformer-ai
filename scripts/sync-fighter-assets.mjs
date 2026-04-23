import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { createWarehouseClient } from "@corex/warehouse-client";
import {
  CONSUMER_SNAPSHOT_INDEX_SCHEMA,
  PRODUCER_RELEASE_MANIFEST_SCHEMA,
  REQUIRED_RUNTIME_CLIPS,
  validateConsumerSnapshotIndex,
  validateFighterCatalog,
  validateProducerReleaseManifest,
  validateRiggedRuntimeManifest,
} from "../src/content/contracts.js";

const rootDir = process.cwd();
const repoRoot = path.resolve(rootDir, "../..");
const publicDir = path.join(rootDir, "public");
const houseId = "code-platformer-ai";
const warehouseBaseUrl = process.env.WAREHOUSE_URL ?? process.env.VITE_WAREHOUSE_URL ?? "http://127.0.0.1:5202";
const warehouse = createWarehouseClient({ baseUrl: warehouseBaseUrl });
const RIGGING_RECEIPT_SCHEMA = "rigging-portal-warehouse-publish-receipt-v1";

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

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateRiggingWarehouseReceipt(receipt, expectedCharacterId = null) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("Rigging Warehouse receipt must be an object");
  }
  assertString(receipt.schemaVersion, "rigging receipt schemaVersion");
  if (receipt.schemaVersion !== RIGGING_RECEIPT_SCHEMA) {
    throw new Error(`Unsupported rigging receipt schemaVersion: ${receipt.schemaVersion}`);
  }
  assertString(receipt.characterId, "rigging receipt characterId");
  if (expectedCharacterId && receipt.characterId !== expectedCharacterId) {
    throw new Error(`Rigging receipt characterId mismatch: expected "${expectedCharacterId}", got "${receipt.characterId}"`);
  }
  assertString(receipt.provider, `provider for "${receipt.characterId}"`);
  if (receipt.provider !== "warehouse") {
    throw new Error(`Rigging receipt for "${receipt.characterId}" must come from warehouse`);
  }
  if (receipt.release && typeof receipt.release === "object" && receipt.release.releaseManifestItemId != null) {
    assertString(receipt.release.releaseManifestItemId, `release.releaseManifestItemId for "${receipt.characterId}"`);
  }
  const contract = receipt.distributionContract ?? {};
  assertString(contract.publisherHouse, `distributionContract.publisherHouse for "${receipt.characterId}"`);
  assertString(contract.sourceId, `distributionContract.sourceId for "${receipt.characterId}"`);
  assertString(contract.category, `distributionContract.category for "${receipt.characterId}"`);
  return receipt;
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

function buildProducerAssetRefFromWarehouseItem(item, fallbackMimeType) {
  assertString(item.id, "Warehouse item id");
  assertString(item.path, `Warehouse item path for "${item.id}"`);
  assertString(item.filename, `Warehouse item filename for "${item.id}"`);
  assertString(item.checksum, `Warehouse item checksum for "${item.id}"`);
  return {
    itemId: item.id,
    path: item.path,
    filename: item.filename,
    checksum: item.checksum,
    mimeType: item.mime_type ?? fallbackMimeType ?? null,
  };
}

function buildSnapshotFiles(snapshotRootPath) {
  return {
    sourceModel: path.join(snapshotRootPath, "source-model.glb"),
    runtimeManifest: path.join(snapshotRootPath, "runtime-manifest.json"),
    runtimeGlb: path.join(snapshotRootPath, "runtime.glb"),
  };
}

async function publishReleaseManifest({
  fighter,
  producerReleaseManifestPath,
  producerReleaseManifest,
}) {
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
      producer_house: producerReleaseManifest.producerHouse,
      fighter_id: fighter.id,
      distribution_role: "producer-release-manifest",
    },
  });
}

async function writeConsumerSnapshot({
  fighter,
  snapshotRootPath,
  resolvedReleaseManifest,
}) {
  const snapshotFiles = buildSnapshotFiles(snapshotRootPath);

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

  await writeJson(path.join(snapshotRootPath, "consumer-index.json"), consumerIndex);
}

async function resolveReceiptRoot() {
  const configured = process.env.RIGGING_PUBLISH_RECEIPTS_ROOT;
  if (configured) {
    return path.resolve(configured);
  }

  const contractsPath = path.join(repoRoot, "core-x", "config", "house-runtime-contracts.json");
  if (!(await exists(contractsPath))) {
    return path.join(repoRoot, "houses", "rigging-portal", "exports", "publish-receipts");
  }

  const contracts = await readJson(contractsPath);
  const toybox = (contracts.houses ?? []).find((house) => house.house_id === houseId);
  const binding = (toybox?.warehouse_consumer_bindings ?? []).find(
    (candidate) => candidate.producer_house === "rigging-portal",
  );
  const receiptRoot = binding?.local_receipt_root;
  if (typeof receiptRoot === "string" && receiptRoot.length > 0) {
    return path.join(repoRoot, receiptRoot);
  }
  return path.join(repoRoot, "houses", "rigging-portal", "exports", "publish-receipts");
}

async function loadLatestRiggingReceipts() {
  const receiptRoot = await resolveReceiptRoot();
  if (!(await exists(receiptRoot))) {
    return new Map();
  }

  const files = (await readdir(receiptRoot))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .reverse();
  const receipts = new Map();

  for (const fileName of files) {
    const receiptPath = path.join(receiptRoot, fileName);
    let receipt;
    try {
      receipt = validateRiggingWarehouseReceipt(await readJson(receiptPath));
    } catch {
      continue;
    }
    if (receipt.dryRun || !receipt.release?.releaseManifestItemId) {
      continue;
    }
    if (!receipts.has(receipt.characterId)) {
      receipts.set(receipt.characterId, {
        ...receipt,
        receiptPath,
      });
    }
  }

  return receipts;
}

async function resolveUpstreamReceiptAssets(fighter, receipt) {
  const upstreamReleaseManifest = await resolveWarehouseJson(receipt.release.releaseManifestItemId);
  const sourceItemId = upstreamReleaseManifest?.artifacts?.model?.itemId;
  const runtimeGlbItemId = upstreamReleaseManifest?.artifacts?.viewerRuntime?.itemId
    || upstreamReleaseManifest?.artifacts?.model?.itemId
    || null;

  if (!sourceItemId) {
    throw new Error(`Rigging receipt for "${fighter.id}" is missing a Warehouse source model item`);
  }

  const sourceItem = await warehouse.item(sourceItemId);
  const runtimeGlbItem = runtimeGlbItemId ? await warehouse.item(runtimeGlbItemId) : null;

  return {
    receipt,
    sourceModel: buildProducerAssetRefFromWarehouseItem(sourceItem, "model/gltf-binary"),
    runtimeGlb: runtimeGlbItem
      ? buildProducerAssetRefFromWarehouseItem(runtimeGlbItem, "model/gltf-binary")
      : null,
  };
}

function buildSyntheticRuntimeManifest(fighter, upstreamAssets) {
  const exportStatus = upstreamAssets.runtimeGlb ? "ready" : "pending";
  return validateRiggedRuntimeManifest(
    {
      fighterId: fighter.id,
      producerHouse: upstreamAssets.receipt.distributionContract.publisherHouse,
      sourceModel: fighter.mirroredSourceFile,
      runtimeGlb: fighter.mirroredRuntimeFile,
      exportStatus,
      animationSetVersion: upstreamAssets.receipt.release.id || `rigging-receipt-${upstreamAssets.receipt.publishedAt}`,
      requiredClips: REQUIRED_RUNTIME_CLIPS,
      availableClips: exportStatus === "ready" ? REQUIRED_RUNTIME_CLIPS : [],
    },
    fighter.id,
  );
}

async function syncFromLocalMirror(fighter) {
  const sourceModelPath = publicUrlToFilePath(fighter.mirroredSourceFile);
  const runtimeManifestPath = publicUrlToFilePath(fighter.runtimeRig.manifestFile);
  const runtimeGlbPath = publicUrlToFilePath(fighter.mirroredRuntimeFile);
  const snapshotRootPath = publicUrlToFilePath(fighter.distribution.snapshotRoot);
  const producerReleaseManifestPath = path.join(snapshotRootPath, "producer-release-manifest.json");

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

  await publishReleaseManifest({ fighter, producerReleaseManifestPath, producerReleaseManifest });

  const resolvedReleaseManifest = validateProducerReleaseManifest(
    await resolveWarehouseJson(fighter.distribution.releaseManifestItemId),
    fighter.id,
  );

  await writeConsumerSnapshot({
    fighter,
    snapshotRootPath,
    resolvedReleaseManifest,
  });

  return {
    fighterId: fighter.id,
    source: "local-mirror",
    releaseManifestItemId: fighter.distribution.releaseManifestItemId,
    exportStatus: resolvedReleaseManifest.exportStatus,
    snapshotRoot: fighter.distribution.snapshotRoot,
  };
}

async function syncFromRiggingReceipt(fighter, receipt) {
  const sourceModelPath = publicUrlToFilePath(fighter.mirroredSourceFile);
  const runtimeManifestPath = publicUrlToFilePath(fighter.runtimeRig.manifestFile);
  const runtimeGlbPath = publicUrlToFilePath(fighter.mirroredRuntimeFile);
  const snapshotRootPath = publicUrlToFilePath(fighter.distribution.snapshotRoot);
  const producerReleaseManifestPath = path.join(snapshotRootPath, "producer-release-manifest.json");

  const upstreamAssets = await resolveUpstreamReceiptAssets(fighter, receipt);
  await downloadWarehouseItem(
    upstreamAssets.sourceModel.itemId,
    sourceModelPath,
    upstreamAssets.sourceModel.checksum,
  );
  if (upstreamAssets.runtimeGlb) {
    await downloadWarehouseItem(
      upstreamAssets.runtimeGlb.itemId,
      runtimeGlbPath,
      upstreamAssets.runtimeGlb.checksum,
    );
  }

  const runtimeManifest = buildSyntheticRuntimeManifest(fighter, upstreamAssets);
  await writeJson(runtimeManifestPath, runtimeManifest);
  const runtimeManifestChecksum = await sha256ForFile(runtimeManifestPath);

  await publishLocalFile({
    id: computeStableId(publicUrlToLogicalPath(fighter.runtimeRig.manifestFile)),
    kind: "doc",
    source: "generated",
    logicalPath: publicUrlToLogicalPath(fighter.runtimeRig.manifestFile),
    filePath: runtimeManifestPath,
    displayName: `${fighter.displayName} runtime manifest`,
    mimeType: "application/json; charset=utf-8",
    tags: ["toybox-arena", "fighter", fighter.id, "runtime-manifest", "upstream-rigging-receipt"],
    provenance: {
      produced_by_house: houseId,
      upstream_producer_house: upstreamAssets.receipt.distributionContract.publisherHouse,
      consumer_house: houseId,
      fighter_id: fighter.id,
      distribution_role: "runtime-manifest",
      upstream_receipt_path: path.relative(repoRoot, upstreamAssets.receipt.receiptPath),
      upstream_release_manifest_item_id: upstreamAssets.receipt.release.releaseManifestItemId,
    },
  });

  const producerReleaseManifest = validateProducerReleaseManifest({
    schemaVersion: PRODUCER_RELEASE_MANIFEST_SCHEMA,
    fighterId: fighter.id,
    consumerHouse: houseId,
    assetPackVersion: fighter.distribution.assetPackVersion,
    producerHouse: upstreamAssets.receipt.distributionContract.publisherHouse,
    exportStatus: runtimeManifest.exportStatus,
    requiredClips: runtimeManifest.requiredClips,
    availableClips: runtimeManifest.availableClips,
    upstreamRiggingReceipt: {
      receiptPath: path.relative(repoRoot, upstreamAssets.receipt.receiptPath),
      characterId: upstreamAssets.receipt.characterId,
      releaseManifestItemId: upstreamAssets.receipt.release.releaseManifestItemId,
      sourceId: upstreamAssets.receipt.distributionContract.sourceId,
      category: upstreamAssets.receipt.distributionContract.category,
    },
    assets: {
      sourceModel: upstreamAssets.sourceModel,
      runtimeManifest: buildProducerAssetRef(
        fighter.runtimeRig.manifestFile,
        runtimeManifestChecksum,
        "application/json; charset=utf-8",
      ),
      runtimeGlb: upstreamAssets.runtimeGlb,
      textures: [],
      motionClips: {},
    },
  }, fighter.id);

  await writeJson(producerReleaseManifestPath, producerReleaseManifest);
  await publishReleaseManifest({ fighter, producerReleaseManifestPath, producerReleaseManifest });

  const resolvedReleaseManifest = validateProducerReleaseManifest(
    await resolveWarehouseJson(fighter.distribution.releaseManifestItemId),
    fighter.id,
  );

  await writeConsumerSnapshot({
    fighter,
    snapshotRootPath,
    resolvedReleaseManifest,
  });

  return {
    fighterId: fighter.id,
    source: "rigging-receipt",
    upstreamCharacterId: upstreamAssets.receipt.characterId,
    upstreamReceiptPath: path.relative(repoRoot, upstreamAssets.receipt.receiptPath),
    releaseManifestItemId: fighter.distribution.releaseManifestItemId,
    exportStatus: resolvedReleaseManifest.exportStatus,
    snapshotRoot: fighter.distribution.snapshotRoot,
  };
}

async function syncFighter(fighter, riggingReceipts) {
  const upstreamReceipt = riggingReceipts.get(fighter.id) || null;
  if (upstreamReceipt) {
    return syncFromRiggingReceipt(fighter, upstreamReceipt);
  }
  return syncFromLocalMirror(fighter);
}

async function main() {
  const fighterCatalog = validateFighterCatalog(
    await readJson(path.join(publicDir, "fighters", "catalog.json")),
  );
  const riggingReceipts = await loadLatestRiggingReceipts();

  const results = [];
  for (const fighter of fighterCatalog) {
    results.push(await syncFighter(fighter, riggingReceipts));
  }

  console.log(JSON.stringify({
    status: "ok",
    warehouse: warehouseBaseUrl,
    riggingReceiptRoot: await resolveReceiptRoot(),
    fighters: results,
  }, null, 2));
}

await main();
