#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOUSE_ROOT = path.resolve(__dirname, '..')
const MODEL_ZOO_ROOT = path.resolve(HOUSE_ROOT, '../../model-zoo')
const SOURCE_ROOT = path.join(MODEL_ZOO_ROOT, 'assets/world-packs')
const TARGET_ROOT = path.join(HOUSE_ROOT, 'public/world-packs')

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath)
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath)
    }
  }
}

async function main() {
  const indexPath = path.join(MODEL_ZOO_ROOT, 'metadata/world-packs.index.json')
  const hasIndex = await fileExists(indexPath)
  const worldIds = []

  if (hasIndex) {
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8'))
    for (const entry of index.worlds ?? []) {
      if (entry.worldId) worldIds.push(entry.worldId)
    }
  } else if (await fileExists(SOURCE_ROOT)) {
    const entries = await fs.readdir(SOURCE_ROOT, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) worldIds.push(entry.name)
    }
  }

  if (worldIds.length === 0) {
    throw new Error('No published world packs found in model-zoo')
  }

  const synced = []
  for (const worldId of [...new Set(worldIds)]) {
    const sourceDir = path.join(SOURCE_ROOT, worldId)
    if (!(await fileExists(sourceDir))) continue
    const targetDir = path.join(TARGET_ROOT, worldId)
    await copyDirectory(sourceDir, targetDir)
    synced.push({
      worldId,
      packPath: `/world-packs/${worldId}/world-pack.json`,
    })
  }

  await fs.mkdir(TARGET_ROOT, { recursive: true })
  await fs.writeFile(
    path.join(TARGET_ROOT, 'index.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), worlds: synced }, null, 2)}\n`,
    'utf8',
  )

  console.log(`[worlds:sync] Mirrored ${synced.length} world pack(s) into public/world-packs`)
}

main().catch((error) => {
  console.error(`[worlds:sync] ${error.message}`)
  process.exitCode = 1
})
