import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { validateChallengeCatalog, validateFighterCatalog, validateModeCatalog, validateStageCatalog } from "../src/content/contracts.js";
import { createMatchConfig } from "../src/game/MatchConfig.js";
import { ToyboxMatch } from "../src/game/ToyboxMatch.js";

const rootDir = process.cwd();

async function readJson(relativePath) {
  const raw = await readFile(path.join(rootDir, relativePath), "utf8");
  return JSON.parse(raw);
}

const fighters = validateFighterCatalog(await readJson("public/fighters/catalog.json"));
const stages = validateStageCatalog(await readJson("public/stages/index.json"));
const modes = validateModeCatalog(await readJson("public/modes/index.json"));
validateChallengeCatalog(await readJson("public/challenges/index.json"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function scriptedInput(frame) {
  return {
    moveX: frame % 240 < 120 ? 1 : -1,
    jumpPressed: frame % 90 === 0,
    attackPressed: frame % 40 === 0,
    itemPressed: frame % 120 === 0,
    pausePressed: false,
  };
}

const ffaMode = modes.find((mode) => mode.id === "ffa");
const hazardStage = stages.find((stage) => stage.id === "hazard");
const ffaConfig = createMatchConfig({
  modeId: ffaMode.id,
  stageId: hazardStage.id,
  selectedFighterId: "blue",
  botCount: ffaMode.botCount,
});

const ffaMatch = new ToyboxMatch({
  mode: ffaMode,
  stage: hazardStage,
  fighters,
  config: ffaConfig,
});

for (let frame = 0; frame < 720; frame += 1) {
  ffaMatch.update(1 / 60, scriptedInput(frame));
}

const ffaSnapshot = ffaMatch.createSnapshot();
assert(ffaSnapshot.players.length === 4, "FFA smoke: expected four fighters");
assert(ffaSnapshot.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.y)), "FFA smoke: invalid player positions");
assert(ffaSnapshot.pickups.length >= 5, "FFA smoke: expected pickups");
assert(ffaSnapshot.players.some((player) => player.score > 0 || !player.alive || player.respawnTimer > 0), "FFA smoke: expected combat or ring-out activity");
assert(ffaSnapshot.players.every((player) => typeof player.animationState === "string"), "FFA smoke: expected animation state output");

const survivalMode = modes.find((mode) => mode.id === "survival");
const verticalStage = stages.find((stage) => stage.id === survivalMode.defaultStageId);
const survivalConfig = createMatchConfig({
  modeId: survivalMode.id,
  stageId: verticalStage.id,
  selectedFighterId: "red",
  botCount: survivalMode.botCount,
});

const survivalMatch = new ToyboxMatch({
  mode: survivalMode,
  stage: verticalStage,
  fighters,
  config: survivalConfig,
});

for (let frame = 0; frame < 3200 && !survivalMatch.finished; frame += 1) {
  survivalMatch.update(1 / 60, scriptedInput(frame));
}

const survivalSnapshot = survivalMatch.createSnapshot();
assert(survivalSnapshot.finished, "Survival smoke: expected match to finish");
assert(survivalSnapshot.result?.completedSurvival === true, "Survival smoke: expected survival completion result");
assert(survivalSnapshot.players.every((player) => typeof player.loopAnimationState === "string"), "Survival smoke: expected loop animation state output");

console.log(`Toybox smoke passed: FFA scores ${ffaSnapshot.players.map((player) => `${player.fighterId}:${player.score}`).join(", ")}; survival winner ${survivalSnapshot.result.winnerLabel}.`);
