import { createWarehouseClient } from "@corex/warehouse-client";
import {
  validateConsumerSnapshotIndex,
  validateProducerReleaseManifest,
  validateRiggedRuntimeManifest,
} from "./contracts.js";

const DEFAULT_WAREHOUSE_URL = "http://127.0.0.1:5202";

let warehouseClient = null;

function warehouseBaseUrl() {
  const configured = import.meta.env.VITE_WAREHOUSE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }
  return DEFAULT_WAREHOUSE_URL;
}

function getWarehouseClient() {
  if (!warehouseClient) {
    warehouseClient = createWarehouseClient({
      baseUrl: warehouseBaseUrl(),
    });
  }
  return warehouseClient;
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

function buildFallbackRuntimeManifest(fighterDefinition) {
  return validateRiggedRuntimeManifest(
    {
      fighterId: fighterDefinition.id,
      producerHouse: fighterDefinition.runtimeRig.producerHouse,
      sourceModel: fighterDefinition.mirroredSourceFile,
      runtimeGlb: fighterDefinition.mirroredRuntimeFile,
      exportStatus: fighterDefinition.runtimeRig.exportStatus,
      animationSetVersion: fighterDefinition.animationSetVersion,
      requiredClips: fighterDefinition.runtimeRig.requiredClips,
      availableClips: [],
    },
    fighterDefinition.id,
  );
}

async function resolveWarehouseDistribution(fighterDefinition) {
  const releaseManifestItemId = fighterDefinition.distribution?.releaseManifestItemId;
  if (!releaseManifestItemId) return null;

  const client = getWarehouseClient();
  const releaseManifestUrl = await client.resolveUrl(releaseManifestItemId);
  const releaseManifest = validateProducerReleaseManifest(
    await loadJson(releaseManifestUrl),
    fighterDefinition.id,
  );

  const runtimeManifestUrl = await client.resolveUrl(releaseManifest.assets.runtimeManifest.itemId);
  const runtimeManifest = validateRiggedRuntimeManifest(
    await loadJson(runtimeManifestUrl),
    fighterDefinition.id,
  );

  const sourceModelUrl = await client.resolveUrl(releaseManifest.assets.sourceModel.itemId);
  const runtimeGlbUrl = releaseManifest.assets.runtimeGlb?.itemId && runtimeManifest.exportStatus === "ready"
    ? await client.resolveUrl(releaseManifest.assets.runtimeGlb.itemId)
    : null;

  return {
    source: "warehouse",
    releaseManifest,
    runtimeManifest,
    sourceModelUrl,
    runtimeGlbUrl,
  };
}

async function resolveSnapshotDistribution(fighterDefinition) {
  const snapshotRoot = fighterDefinition.distribution?.snapshotRoot;
  if (!snapshotRoot) return null;

  const snapshotIndex = validateConsumerSnapshotIndex(
    await loadJson(`${snapshotRoot}/consumer-index.json`),
    fighterDefinition.id,
  );

  const runtimeManifest = validateRiggedRuntimeManifest(
    await loadJson(snapshotIndex.assets.runtimeManifest.localUrl),
    fighterDefinition.id,
  );

  return {
    source: "snapshot",
    snapshotIndex,
    runtimeManifest,
    sourceModelUrl: snapshotIndex.assets.sourceModel.localUrl,
    runtimeGlbUrl: snapshotIndex.assets.runtimeGlb?.localUrl ?? null,
  };
}

async function resolveSourceMirrorDistribution(fighterDefinition) {
  let runtimeManifest = buildFallbackRuntimeManifest(fighterDefinition);

  try {
    runtimeManifest = validateRiggedRuntimeManifest(
      await loadJson(fighterDefinition.runtimeRig.manifestFile),
      fighterDefinition.id,
    );
  } catch {
    runtimeManifest = buildFallbackRuntimeManifest(fighterDefinition);
  }

  return {
    source: "source-mirror",
    runtimeManifest,
    sourceModelUrl: fighterDefinition.mirroredSourceFile,
    runtimeGlbUrl: runtimeManifest.exportStatus === "ready" ? runtimeManifest.runtimeGlb : null,
  };
}

export async function resolveFighterDistributionLayers(fighterDefinition) {
  const layers = [];

  try {
    const warehouseDistribution = await resolveWarehouseDistribution(fighterDefinition);
    if (warehouseDistribution) {
      layers.push(warehouseDistribution);
    }
  } catch (error) {
    console.warn(
      `[ToyboxArena] Warehouse resolution failed for ${fighterDefinition.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const snapshotDistribution = await resolveSnapshotDistribution(fighterDefinition);
    if (snapshotDistribution) {
      layers.push(snapshotDistribution);
    }
  } catch (error) {
    console.warn(
      `[ToyboxArena] Snapshot fallback failed for ${fighterDefinition.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  layers.push(await resolveSourceMirrorDistribution(fighterDefinition));
  return layers;
}

export async function resolveFighterDistribution(fighterDefinition) {
  const layers = await resolveFighterDistributionLayers(fighterDefinition);
  return layers[0];
}
