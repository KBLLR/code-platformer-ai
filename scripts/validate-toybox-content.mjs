import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  validateChallengeCatalog,
  validateFighterCatalog,
  validateModeCatalog,
  validateStageCatalog,
  validateRiggedRuntimeManifest,
} from "../src/content/contracts.js";

const rootDir = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

const fighterCatalog = await readJson("public/fighters/catalog.json");
const stageCatalog = await readJson("public/stages/index.json");
const modeCatalog = await readJson("public/modes/index.json");
const challengeCatalog = await readJson("public/challenges/index.json");

const fighters = validateFighterCatalog(fighterCatalog);
const stages = validateStageCatalog(stageCatalog);
const modes = validateModeCatalog(modeCatalog);
const challenges = validateChallengeCatalog(challengeCatalog);

for (const fighter of fighters) {
  const sourcePath = path.join(rootDir, "public", fighter.mirroredSourceFile.replace(/^\//, ""));
  await access(sourcePath);

  const runtimeManifestPath = path.join(rootDir, "public", fighter.runtimeRig.manifestFile.replace(/^\//, ""));
  await access(runtimeManifestPath);
  const runtimeManifest = validateRiggedRuntimeManifest(
    JSON.parse(await readFile(runtimeManifestPath, "utf8")),
    fighter.id,
  );

  if (runtimeManifest.exportStatus === "ready") {
    const runtimePath = path.join(rootDir, "public", fighter.mirroredRuntimeFile.replace(/^\//, ""));
    await access(runtimePath);
  }
}

for (const mode of modes) {
  if (!stages.find((stage) => stage.id === mode.defaultStageId)) {
    throw new Error(`Mode "${mode.id}" points to missing default stage "${mode.defaultStageId}"`);
  }
}

for (const challenge of challenges) {
  if (!fighters.find((fighter) => fighter.id === challenge.rewardFighterId)) {
    throw new Error(`Challenge "${challenge.id}" points to missing fighter "${challenge.rewardFighterId}"`);
  }
}

console.log(`Validated Toybox content: ${fighters.length} fighters, ${stages.length} stages, ${modes.length} modes, ${challenges.length} challenges.`);
