import { ArenaConfig } from '../ArenaConfig.js'

const DEFAULT_PLAYERS = 12
const SAFE_ZONE_SCALE = [0.56, 0.38, 0.24, 0.12, 0.04]

function hashString(input) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) || 1
}

function isAbsoluteAssetPath(value) {
  return /^(?:https?:)?\/\//i.test(value) || value.startsWith('/')
}

function resolveAssetPath(worldPackUrl, assetPath) {
  if (!assetPath) return undefined
  if (isAbsoluteAssetPath(assetPath)) return assetPath
  const baseUrl = new URL(worldPackUrl, window.location.origin)
  return new URL(assetPath, baseUrl).toString()
}

function average(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeArenaSize(markers) {
  const maxRadius = markers.reduce((currentMax, marker) => {
    const [x, , z] = marker.position
    return Math.max(currentMax, Math.hypot(x, z))
  }, 0)

  return Math.max(40, Math.ceil(maxRadius + 16))
}

function computeCenter(spawnMarkers) {
  if (spawnMarkers.length === 0) return { x: 0, z: 0 }

  return {
    x: average(spawnMarkers.map((marker) => marker.position[0])),
    z: average(spawnMarkers.map((marker) => marker.position[2])),
  }
}

function markerToSpawn(marker, center) {
  const [x, , z] = marker.position
  const dx = center.x - x
  const dz = center.z - z

  return {
    x,
    y: 0,
    z,
    rotation: Math.atan2(dx, dz),
  }
}

function synthesizeSpawns(count, radius, center, seed) {
  const spawns = []
  const offset = (seed % 360) * (Math.PI / 180)

  for (let index = 0; index < count; index += 1) {
    const angle = offset + (Math.PI * 2 * index) / count
    const x = center.x + Math.sin(angle) * radius
    const z = center.z + Math.cos(angle) * radius
    spawns.push({
      x,
      y: 0,
      z,
      rotation: Math.atan2(center.x - x, center.z - z),
    })
  }

  return spawns
}

function buildSpawnPoints(worldPack, size, center, numPlayers) {
  const spawnMarkers = (worldPack.geometry.markers ?? []).filter((marker) => marker.type === 'spawn')
  const explicitSpawns = spawnMarkers.map((marker) => markerToSpawn(marker, center))

  if (explicitSpawns.length >= numPlayers) {
    return explicitSpawns.slice(0, numPlayers)
  }

  const synthesized = synthesizeSpawns(
    numPlayers - explicitSpawns.length,
    Math.max(size * 0.62, 24),
    center,
    worldPack.seed ?? hashString(worldPack.id),
  )

  return [...explicitSpawns, ...synthesized].slice(0, numPlayers)
}

function buildBotWaypoints(worldPack, size, center) {
  const poiMarkers = (worldPack.geometry.markers ?? []).filter(
    (marker) => marker.type === 'poi' || marker.type === 'camera',
  )
  const waypoints = poiMarkers.map((marker) => ({
    x: marker.position[0],
    y: 0,
    z: marker.position[2],
  }))

  const ring = synthesizeSpawns(10, Math.max(size * 0.38, 14), center, hashString(`${worldPack.id}:waypoints`)).map(
    ({ x, z }) => ({ x, y: 0, z }),
  )

  return [...waypoints, ...ring]
}

function buildCoverClusters(worldPack, size, center) {
  const poiMarkers = (worldPack.geometry.markers ?? []).filter((marker) => marker.type === 'poi')
  if (poiMarkers.length > 0) {
    return poiMarkers.map((marker, index) => ({
      cx: marker.position[0] + Math.sin(index) * 2.6,
      cz: marker.position[2] + Math.cos(index) * 2.6,
      pieces: [
        { offsetX: 0, offsetZ: 0, width: 2.4, height: 1.8, depth: 1.1, rotation: index * 0.4 },
        { offsetX: 1.2, offsetZ: -0.8, width: 1.8, height: 1.3, depth: 0.9, rotation: index * 0.35 },
      ],
    }))
  }

  return synthesizeSpawns(8, Math.max(size * 0.32, 12), center, hashString(`${worldPack.id}:cover`)).map(
    (spawn, index) => ({
      cx: spawn.x,
      cz: spawn.z,
      pieces: [
        { offsetX: 0, offsetZ: 0, width: 2.2, height: 1.7, depth: 1.0, rotation: index * 0.3 },
      ],
    }),
  )
}

function buildTerrainBands(size) {
  return [
    { innerR: size * 0.12, outerR: size * 0.3, elevationDelta: 0.7 },
    { innerR: size * 0.3, outerR: size * 0.52, elevationDelta: 0.25 },
    { innerR: size * 0.52, outerR: size * 0.86, elevationDelta: -0.15 },
  ]
}

function buildSafeZonePhases(size, center) {
  return SAFE_ZONE_SCALE.map((scale, index) => ({
    phase: index + 1,
    radius: Math.max(2, Math.round(size * scale)),
    durationSeconds: [60, 45, 30, 20, 10][index],
    damagePerSecond: [2, 5, 10, 20, 50][index],
    centerX: center.x,
    centerZ: center.z,
  }))
}

export async function loadWorldPack(worldPackUrl) {
  const response = await fetch(worldPackUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load world pack (${response.status}) from ${worldPackUrl}`)
  }

  const worldPack = await response.json()
  if (!worldPack?.id || !worldPack?.geometry) {
    throw new Error(`Invalid world pack payload from ${worldPackUrl}`)
  }

  return {
    ...worldPack,
    geometry: {
      ...worldPack.geometry,
      renderAsset: resolveAssetPath(worldPackUrl, worldPack.geometry.renderAsset),
      collisionAsset: resolveAssetPath(worldPackUrl, worldPack.geometry.collisionAsset),
    },
  }
}

export function createArenaConfigFromWorldPack(worldPack, { numPlayers = DEFAULT_PLAYERS } = {}) {
  if (worldPack.kind !== 'arena' && worldPack.kind !== 'backdrop') {
    throw new Error(`Unsupported world kind for Code Platformer AI: ${worldPack.kind}`)
  }

  const markers = worldPack.geometry.markers ?? []
  const spawnMarkers = markers.filter((marker) => marker.type === 'spawn')
  const center = computeCenter(spawnMarkers)
  const size = computeArenaSize(markers)
  const seed = worldPack.seed ?? hashString(worldPack.id)

  const arenaConfig = new ArenaConfig({ seed, size, numPlayers })
  arenaConfig.size = size
  arenaConfig.bounds = { min: -size, max: size }
  arenaConfig.spawnPoints = buildSpawnPoints(worldPack, size, center, numPlayers)
  arenaConfig.botWaypoints = buildBotWaypoints(worldPack, size, center)
  arenaConfig.coverClusters = buildCoverClusters(worldPack, size, center)
  arenaConfig.terrainBands = buildTerrainBands(size)
  arenaConfig.safeZonePhases = buildSafeZonePhases(size, center)
  arenaConfig.safeZone = {
    phaseIndex: 0,
    currentRadius: arenaConfig.safeZonePhases[0].radius,
    centerX: center.x,
    centerZ: center.z,
    phaseTimer: 0,
    shrinking: false,
  }
  arenaConfig.worldPack = worldPack
  arenaConfig.worldPackId = worldPack.id
  arenaConfig.worldPackName = worldPack.name

  return arenaConfig
}
