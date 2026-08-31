import { createWarehouseClient } from "@corex/warehouse-client";
import {
  validateConsumerSnapshotIndex,
  validateProducerReleaseManifest,
  validateRiggedRuntimeManifest,
} from "./contracts.js";

const DEFAULT_WAREHOUSE_URL = "http://127.0.0.1:5202";
const FIGHTER_ASSET_SOURCES = new Set(["auto", "warehouse", "snapshot", "source-mirror"]);

const warehouseClients = new Map();

export function normalizeFighterRuntimeSettings(settings = {}) {
  const fighterAssetSource = FIGHTER_ASSET_SOURCES.has(settings?.fighterAssetSource)
    ? settings.fighterAssetSource
    : "auto";
  const warehouseUrlOverride = typeof settings?.warehouseUrlOverride === "string"
    ? settings.warehouseUrlOverride.trim()
    : "";

  return {
    fighterAssetSource,
    warehouseUrlOverride,
  };
}

function warehouseBaseUrl(runtimeSettings) {
  if (runtimeSettings.warehouseUrlOverride) {
    return runtimeSettings.warehouseUrlOverride;
  }

  const configured = import.meta.env.VITE_WAREHOUSE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }
  return DEFAULT_WAREHOUSE_URL;
}

function getWarehouseClient(runtimeSettings) {
  const baseUrl = warehouseBaseUrl(runtimeSettings);
  if (!warehouseClients.has(baseUrl)) {
    warehouseClients.set(baseUrl, createWarehouseClient({ baseUrl }));
  }
  return warehouseClients.get(baseUrl);
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

async function resolveWarehouseDistribution(fighterDefinition, runtimeSettings) {
  const releaseManifestItemId = fighterDefinition.distribution?.releaseManifestItemId;
  if (!releaseManifestItemId) return null;

  const client = getWarehouseClient(runtimeSettings);
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

function applySourcePreference(layers, fighterAssetSource) {
  if (fighterAssetSource === "auto") return layers;

  const preferred = [];
  const fallback = [];
  for (const layer of layers) {
    if (layer.source === fighterAssetSource) {
      preferred.push(layer);
      continue;
    }
    fallback.push(layer);
  }
  return [...preferred, ...fallback];
}

/**
 * Classify why a layer failed.
 *
 * A CORS rejection and an unsynced snapshot both surfaced as "no character"
 * before, so a blocked warehouse fetch was indistinguishable from a missing
 * file — and once the procedural capsules rendered, both looked like a
 * successful load.
 */
function classifyLayerFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/cors|access-control|opaque|cross-origin/i.test(message)) {
    return { outcome: "cors", detail: "blocked by CORS policy" };
  }
  if (/404|not found|enoent|missing/i.test(message)) {
    return { outcome: "missing", detail: "not present" };
  }
  if (/schema|invalid|parse|json/i.test(message)) {
    return { outcome: "invalid", detail: "failed validation" };
  }
  return { outcome: "unavailable", detail: message.slice(0, 120) };
}

/**
 * Resolve layers and record why each one succeeded or failed.
 *
 * Additive: `resolveFighterDistributionLayers` keeps its existing contract and
 * the warehouse → snapshot → source-mirror ordering is unchanged.
 */
export async function resolveFighterDistributionLayersWithDiagnostics(
  fighterDefinition,
  runtimeSettings = {},
) {
  const normalizedSettings = normalizeFighterRuntimeSettings(runtimeSettings);
  const layers = [];
  const diagnostics = [];

  try {
    const warehouseDistribution = await resolveWarehouseDistribution(fighterDefinition, normalizedSettings);
    if (warehouseDistribution) {
      layers.push(warehouseDistribution);
      diagnostics.push({ layer: "warehouse", outcome: "success" });
    } else {
      diagnostics.push({ layer: "warehouse", outcome: "not-attempted", detail: "no release item" });
    }
  } catch (error) {
    diagnostics.push({ layer: "warehouse", ...classifyLayerFailure(error) });
    console.warn(
      `[ToyboxArena] Warehouse resolution failed for ${fighterDefinition.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const snapshotDistribution = await resolveSnapshotDistribution(fighterDefinition);
    if (snapshotDistribution) {
      layers.push(snapshotDistribution);
      diagnostics.push({ layer: "snapshot", outcome: "success" });
    } else {
      diagnostics.push({ layer: "snapshot", outcome: "not-attempted", detail: "no snapshotRoot" });
    }
  } catch (error) {
    diagnostics.push({ layer: "snapshot", ...classifyLayerFailure(error) });
    console.warn(
      `[ToyboxArena] Snapshot fallback failed for ${fighterDefinition.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    layers.push(await resolveSourceMirrorDistribution(fighterDefinition));
    diagnostics.push({ layer: "source-mirror", outcome: "success" });
  } catch (error) {
    diagnostics.push({ layer: "source-mirror", ...classifyLayerFailure(error) });
  }

  return {
    layers: applySourcePreference(layers, normalizedSettings.fighterAssetSource),
    diagnostics,
  };
}

export async function resolveFighterDistributionLayers(fighterDefinition, runtimeSettings = {}) {
  const { layers } = await resolveFighterDistributionLayersWithDiagnostics(
    fighterDefinition,
    runtimeSettings,
  );
  return layers;
}

export async function resolveFighterDistribution(fighterDefinition, runtimeSettings = {}) {
  const layers = await resolveFighterDistributionLayers(fighterDefinition, runtimeSettings);
  return layers[0];
}
