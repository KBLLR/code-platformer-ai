/**
 * Stage generation prototype tests (offline, no network, no browser).
 *
 *   pnpm run test:stages
 *
 * Covers: determinism (same seed => same stage), schema validity across a seed
 * sweep, spawn reachability (graph model + real runtime physics), no overlaps,
 * validator negative cases, brief parsing, the offline agent fallback, and
 * loading a generated stage into ToyboxMatch behind the explicit option.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { validateFighterCatalog, validateModeCatalog, validateStageCatalog, validateStageDefinition } from "../src/content/contracts.js";
import { GENERATED_STAGE_SCHEMA, analyzeGeneratedStage, validateGeneratedStage } from "../src/content/stageContract.js";
import { createMatchConfig } from "../src/game/MatchConfig.js";
import { resolveMatchStage } from "../src/game/MatchStage.js";
import { MATCH_PHYSICS, ToyboxMatch } from "../src/game/ToyboxMatch.js";
import { normalizeArenaBrief } from "../src/stage/arenaBrief.js";
import { generateStage } from "../src/stage/StageGenerator.js";
import { generateStageFromPrompt, planArenaBrief } from "../src/stage/stageAgent.js";
import {
  DEFAULT_MOVEMENT_ENVELOPE,
  analyzeReachability,
  deriveMovementEnvelope,
  jumpCapabilities,
  platformTop,
} from "../src/stage/stageRules.js";

const rootDir = process.cwd();
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8"));
const fighters = validateFighterCatalog(await readJson("public/fighters/catalog.json"));
const catalogStages = validateStageCatalog(await readJson("public/stages/index.json"));
const modes = validateModeCatalog(await readJson("public/modes/index.json"));

// No test may touch the network: any fetch is a failure.
globalThis.fetch = () => {
  throw new Error("network access is not allowed in stage generation tests");
};

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  FAIL ${name}\n       ${error.message.split("\n").join("\n       ")}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

// Pinned output for seed "toybox-golden" with the default brief and live roster.
const GOLDEN_ID = "gen-ce155471";
const GOLDEN_FINGERPRINT = "0cc2bd77091afd62";

const LAYOUTS = ["balanced", "vertical", "wide"];
const SWEEP = [];
for (const layout of LAYOUTS) {
  for (let hazardLevel = 0; hazardLevel <= 2; hazardLevel += 1) {
    for (let tiers = 1; tiers <= 4; tiers += 1) {
      for (let index = 0; index < 12; index += 1) {
        SWEEP.push({ seed: `sweep-${layout}-${index}`, brief: { layout, hazardLevel, tiers } });
      }
    }
  }
}
const sweepStages = SWEEP.map((request) => generateStage({ ...request, fighters }));
const caps = jumpCapabilities(deriveMovementEnvelope(fighters));

const boxOfPlatform = (p) => ({ minX: p.x - p.width / 2, maxX: p.x + p.width / 2, minY: p.y - p.height / 2, maxY: p.y + p.height / 2 });
const boxOfFoot = (x, y, w, h) => ({ minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h });
const intersects = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

console.log(`Stage generation tests (${sweepStages.length} generated stages in sweep)`);

/* ---------------------------------------------------------- determinism */

await test("same seed + brief gives a byte-identical stage", () => {
  for (const request of SWEEP.filter((_, index) => index % 7 === 0)) {
    const a = JSON.stringify(generateStage({ ...request, fighters }));
    const b = JSON.stringify(generateStage({ ...request, fighters }));
    assert(a === b, `stage for ${request.seed} differs between runs`);
  }
});

await test("seed is normalised (number 42 == string \"42\", surrounding whitespace ignored)", () => {
  assert(sha(generateStage({ seed: 42 })) === sha(generateStage({ seed: " 42 " })), "numeric and string seeds diverge");
});

await test("golden fingerprint for seed \"toybox-golden\" is stable", () => {
  // If this fails after an intentional generator change, bump
  // STAGE_GENERATOR.version and update the fingerprint below.
  const stage = generateStage({ seed: "toybox-golden", fighters });
  const fingerprint = sha(stage);
  assert(stage.id === GOLDEN_ID, `golden id changed: ${stage.id}`);
  assert(fingerprint === GOLDEN_FINGERPRINT, `golden fingerprint changed: ${fingerprint}`);
});

await test("different seeds produce different stages", () => {
  const fingerprints = new Set(sweepStages.map(sha));
  assert(fingerprints.size === sweepStages.length, `${sweepStages.length - fingerprints.size} duplicate stages in sweep`);
});

await test("brief changes the stage for the same seed", () => {
  const a = generateStage({ seed: "same", brief: "vertical" });
  const b = generateStage({ seed: "same", brief: "wide" });
  assert(a.id !== b.id && sha(a) !== sha(b), "brief did not affect the output");
});

/* --------------------------------------------------------------- schema */

await test("every sweep stage validates against toybox-generated-stage-v1", () => {
  for (const stage of sweepStages) {
    assert(stage.schemaVersion === GENERATED_STAGE_SCHEMA, `${stage.id}: wrong schemaVersion`);
    validateStageDefinition(stage);
    validateGeneratedStage(stage, { fighters });
  }
});

await test("generated stages are plain data (survive a JSON round-trip and still validate)", () => {
  for (const stage of sweepStages.slice(0, 40)) {
    validateGeneratedStage(JSON.parse(JSON.stringify(stage)), { fighters });
  }
});

await test("brief knobs are honoured (layout, tiers, hazard level, theme)", () => {
  for (const [index, stage] of sweepStages.entries()) {
    const { brief } = SWEEP[index];
    assert(stage.generator.brief.layout === brief.layout, `${stage.id}: layout`);
    const tierPlatforms = stage.platforms.filter((p) => p.kind === "step" || p.kind === "crown");
    const tiers = new Set(tierPlatforms.map((p) => platformTop(p))).size;
    assert(tiers === brief.tiers, `${stage.id}: expected ${brief.tiers} tiers, got ${tiers}`);
    const bumpers = stage.hazards.filter((h) => h.kind === "bumper").length;
    assert(bumpers === (brief.hazardLevel === 0 ? 0 : 2), `${stage.id}: ${bumpers} bumpers at hazard level ${brief.hazardLevel}`);
  }
  const themed = generateStage({ seed: "t", brief: { theme: "reef-night" } });
  assert(themed.theme === "reef-night" && themed.palette.skyTop === "#203a6b", "explicit theme ignored");
});

/* --------------------------------------------------------- reachability */

await test("default movement envelope is never more permissive than the live roster", () => {
  const roster = deriveMovementEnvelope(fighters);
  for (const key of Object.keys(DEFAULT_MOVEMENT_ENVELOPE)) {
    assert(DEFAULT_MOVEMENT_ENVELOPE[key] <= roster[key], `DEFAULT_MOVEMENT_ENVELOPE.${key} exceeds roster minimum`);
  }
});

await test("runtime physics reaches at least the modelled max rise (weakest fighter, jump + double jump)", () => {
  const weakest = [...fighters].sort((a, b) => a.movementProfile.jumpVelocity - b.movementProfile.jumpVelocity)[0];
  const flat = {
    ...catalogStages[0],
    platforms: [{ x: 0, y: 0, width: 30, height: 1.4, kind: "main" }, ...catalogStages[0].platforms.slice(1).map((p) => ({ ...p, y: p.y + 100 }))],
    spawnPoints: [{ x: 0, y: 0.7 }, { x: -12, y: 0.7 }, { x: 12, y: 0.7 }, { x: 10, y: 0.7 }],
  };
  const match = new ToyboxMatch({ mode: modes[0], stage: flat, fighters, config: createMatchConfig({ selectedFighterId: weakest.id }) });
  const human = match.human;
  const idle = { moveX: 0, jumpPressed: false, attackPressed: false, itemPressed: false };
  const dt = 1 / 120;
  for (let frame = 0; frame < 30; frame += 1) { match._handlePlayerActions(human, idle, dt); match._integratePlayer(human, dt); }
  assert(human.onGround, "fighter did not settle on the flat stage");
  const startY = human.y;
  let maxY = startY;
  let doubled = false;
  for (let frame = 0; frame < 240; frame += 1) {
    const jumpPressed = frame === 0 || (!doubled && human.vy <= 0 && frame > 1);
    if (jumpPressed && frame > 0) doubled = true;
    match._handlePlayerActions(human, { ...idle, jumpPressed }, dt);
    match._integratePlayer(human, dt);
    maxY = Math.max(maxY, human.y);
  }
  const rise = maxY - startY;
  assert(rise >= caps.maxRise, `simulated rise ${rise.toFixed(2)} < modelled max rise ${caps.maxRise.toFixed(2)}`);
  console.log(`       (${weakest.id}: simulated rise ${rise.toFixed(2)}, model allows ${caps.maxRise.toFixed(2)}, apex ${caps.apexHeight.toFixed(2)})`);
});

await test("every platform is mutually reachable with the main platform", () => {
  for (const stage of sweepStages) {
    const { connected } = analyzeReachability(stage.platforms, caps);
    assert(connected.size === stage.platforms.length, `${stage.id}: only ${connected.size}/${stage.platforms.length} platforms connected`);
  }
});

await test("spawns sit on reachable platforms and land there under runtime physics", () => {
  const idle = { moveX: 0, jumpPressed: false, attackPressed: false, itemPressed: false };
  for (const stage of sweepStages.filter((_, index) => index % 3 === 0)) {
    const { connected } = analyzeReachability(stage.platforms, caps);
    const match = new ToyboxMatch({ mode: modes[0], stage, fighters, config: createMatchConfig({ stageId: stage.id }) });
    match.players.forEach((player, index) => {
      const spawn = stage.spawnPoints[index];
      const platformIndex = stage.platforms.findIndex((p) => p.id === spawn.platformId);
      assert(connected.has(platformIndex), `${stage.id}: spawn ${index} on unreachable ${spawn.platformId}`);
      for (let frame = 0; frame < 90; frame += 1) {
        match._handlePlayerActions(player, idle, 1 / 60);
        match._integratePlayer(player, 1 / 60);
      }
      const top = platformTop(stage.platforms[platformIndex]);
      assert(player.onGround && Math.abs(player.y - top) < 1e-6, `${stage.id}: spawn ${index} did not land on ${spawn.platformId} (y=${player.y.toFixed(2)}, top=${top})`);
      assert(Math.abs(player.x - spawn.x) < 1e-6, `${stage.id}: spawn ${index} slid sideways`);
    });
  }
});

/* -------------------------------------------------------------- overlap */

await test("nothing overlaps: platforms, spawns, items, bumpers (independent AABB check)", () => {
  const { playerWidth, playerHeight, pickupSize } = MATCH_PHYSICS;
  for (const stage of sweepStages) {
    const platformBoxes = stage.platforms.map(boxOfPlatform);
    const spawnBoxes = stage.spawnPoints.map((s) => boxOfFoot(s.x, s.y, playerWidth, playerHeight));
    const itemBoxes = stage.itemSpawns.map((i) => boxOfFoot(i.x, i.y, pickupSize, pickupSize));
    const bumperBoxes = stage.hazards.filter((h) => h.kind === "bumper").map((h) => boxOfFoot(h.x, h.y, h.width, h.height));
    const groups = { platform: platformBoxes, spawn: spawnBoxes, item: itemBoxes, bumper: bumperBoxes };
    const names = Object.keys(groups);
    for (let g1 = 0; g1 < names.length; g1 += 1) {
      for (let g2 = g1; g2 < names.length; g2 += 1) {
        const a = groups[names[g1]];
        const b = groups[names[g2]];
        a.forEach((boxA, i) => b.forEach((boxB, j) => {
          if (g1 === g2 && j <= i) return;
          assert(!intersects(boxA, boxB), `${stage.id}: ${names[g1]}[${i}] overlaps ${names[g2]}[${j}]`);
        }));
      }
    }
  }
});

/* --------------------------------------------------- validator rejects */

function mutated(fn) {
  const stage = structuredClone(generateStage({ seed: "mutation-base", brief: { layout: "balanced", hazardLevel: 1, tiers: 2 }, fighters }));
  fn(stage);
  return analyzeGeneratedStage(stage, { fighters });
}
const expectRejected = (label, fn, pattern) => test(`validator rejects: ${label}`, () => {
  const { ok, errors } = mutated(fn);
  assert(!ok, "mutation was accepted");
  assert(errors.some((message) => pattern.test(message)), `expected ${pattern}, got:\n${errors.join("\n")}`);
});

await expectRejected("wrong schemaVersion", (s) => { s.schemaVersion = "v0"; }, /schemaVersion/);
await expectRejected("unknown theme", (s) => { s.theme = "neon-void"; }, /unknown theme/);
await expectRejected("overlapping platforms", (s) => { s.platforms[1].x = s.platforms[0].x; s.platforms[1].y = s.platforms[0].y; }, /overlap/);
await expectRejected("unreachable floating platform", (s) => {
  s.platforms.push({ id: "step-99", x: 0, y: platformTop(s.platforms.at(-1)) + 7, width: 3, height: 0.8, kind: "step" });
  s.bounds.top += 8; s.blastZone.top = Math.min(26, s.blastZone.top + 8);
}, /not mutually reachable/);
await expectRejected("spawn inside a platform", (s) => { s.spawnPoints[0].y = s.platforms.find((p) => p.id === s.spawnPoints[0].platformId).y - 0.3; }, /spawnPoints\[0\]/);
await expectRejected("spawn over the void", (s) => { s.spawnPoints[0].x = s.bounds.left + 0.6; }, /spawnPoints\[0\]/);
await expectRejected("spawns stacked on each other", (s) => { s.spawnPoints[1] = { ...s.spawnPoints[0] }; }, /spawnPoints\[0\] is 0/);
await expectRejected("item buried in a platform", (s) => { s.itemSpawns[0].y = s.platforms.find((p) => p.id === s.itemSpawns[0].platformId).y - 0.4; }, /itemSpawns\[0\]/);
await expectRejected("item out of reach above its platform", (s) => { s.itemSpawns[0].y += 2.5; }, /itemSpawns\[0\]/);
await expectRejected("bumper on top of a spawn", (s) => {
  const b = s.hazards.find((h) => h.kind === "bumper");
  b.x = s.spawnPoints[0].x; b.y = s.spawnPoints[0].y;
}, /bumper/);
await expectRejected("missing rising floor", (s) => { s.hazards = s.hazards.filter((h) => h.kind !== "rising-floor"); }, /rising-floor/);
await expectRejected("hazardFloor out of sync with rising-floor hazard", (s) => { s.hazardFloor += 1; }, /hazardFloor/);
await expectRejected("blast zone beyond render-safe area", (s) => { s.blastZone.right = 30; }, /render-safe/);
await expectRejected("three spawns instead of four", (s) => { s.spawnPoints.pop(); }, /spawn/);

/* --------------------------------------------------------- brief/agent */

await test("arena brief parser maps text to knobs and clamps objects", () => {
  const text = normalizeArenaBrief("A tall ember tower, chaotic, 4 tiers");
  assert(text.layout === "vertical" && text.theme === "ember-dusk" && text.hazardLevel === 2 && text.tiers === 4, JSON.stringify(text));
  const mixed = normalizeArenaBrief("balanced clockwork chaotic");
  assert(mixed.layout === "balanced" && mixed.theme === "clockwork" && mixed.hazardLevel === 2, `layout words must not pick a theme: ${JSON.stringify(mixed)}`);
  const calm = normalizeArenaBrief("calm wide reef lagoon");
  assert(calm.layout === "wide" && calm.theme === "reef-night" && calm.hazardLevel === 0, JSON.stringify(calm));
  const clamped = normalizeArenaBrief({ layout: "spiral", theme: "nope", hazardLevel: 9, tiers: -3 });
  assert(clamped.layout === "balanced" && clamped.theme === null && clamped.hazardLevel === 2 && clamped.tiers === 1, JSON.stringify(clamped));
  const empty = normalizeArenaBrief();
  assert(empty.layout === "balanced" && empty.tiers === 2 && empty.hazardLevel === 1, JSON.stringify(empty));
});

await test("agent step without a planner uses the deterministic parser", async () => {
  const plan = await planArenaBrief("vertical jade garden");
  assert(plan.source === "deterministic" && plan.brief.layout === "vertical" && plan.brief.theme === "jade-mist", JSON.stringify(plan));
});

await test("agent step falls back when the planner throws, times out, or returns junk", async () => {
  const thrown = await planArenaBrief("wide", { planner: () => { throw new Error("offline"); } });
  assert(thrown.source === "deterministic" && /offline/.test(thrown.notes[0]) && thrown.brief.layout === "wide", JSON.stringify(thrown));
  const slow = await planArenaBrief("wide", { planner: () => new Promise(() => {}), timeoutMs: 30 });
  assert(slow.source === "deterministic" && /timed out/.test(slow.notes[0]), JSON.stringify(slow));
  const junk = await planArenaBrief("wide", { planner: async () => "<html>rate limited</html>" });
  assert(junk.source === "deterministic" && junk.brief.layout === "wide", JSON.stringify(junk));
});

await test("agent step accepts planner output only through the brief normaliser", async () => {
  const plan = await planArenaBrief("anything", { planner: async () => ({ layout: "vertical", tiers: 99, theme: "clockwork", extra: "ignored" }) });
  assert(plan.source === "planner" && plan.brief.tiers === 4 && !("extra" in plan.brief), JSON.stringify(plan));
  const { stage } = await generateStageFromPrompt("anything", { seed: "agent", planner: async () => ({ layout: "vertical" }), fighters });
  validateGeneratedStage(stage, { fighters });
  const direct = generateStage({ seed: "agent", brief: { layout: "vertical" }, fighters });
  assert(sha(stage) === sha(direct), "planner path is not reproducible from its brief + seed");
});

/* --------------------------------------------------- match integration */

await test("catalog stage stays the default; generated stage only with the explicit option", () => {
  const byDefault = resolveMatchStage({ stages: catalogStages, stageId: "vertical", fighters });
  assert(byDefault.source === "catalog" && byDefault.stage.id === "vertical", "default did not use the catalog");
  const blankSeed = resolveMatchStage({ stages: catalogStages, stageId: "balanced", generated: { seed: "  " } });
  assert(blankSeed.source === "catalog", "blank seed should not opt in");
  const generated = resolveMatchStage({ stages: catalogStages, stageId: "balanced", fighters, generated: { seed: "opt-in", brief: "wide" } });
  assert(generated.source === "generated" && generated.stage.id.startsWith("gen-"), "generated option ignored");
  assert(createMatchConfig().stageSource === "catalog", "MatchConfig default stageSource should be catalog");
  let threw = false;
  try { createMatchConfig({ stageSource: "generated" }); } catch { threw = true; }
  assert(threw, "generated MatchConfig without a seed should be rejected");
});

await test("catalog stages keep their original rising-floor rule and have no bumpers", () => {
  for (const stage of catalogStages) {
    const match = new ToyboxMatch({ mode: modes.find((m) => m.id === "tdm"), stage, fighters, config: createMatchConfig({ stageId: stage.id }) });
    assert(match.bumpers.length === 0, `${stage.id} unexpectedly has bumpers`);
    match._updateModeHazard(1);
    const expected = stage.hazardFloor + (stage.id === "hazard" ? 0.1 : 0.04);
    assert(Math.abs(match.hazardFloor - expected) < 1e-9, `${stage.id} hazard rise changed`);
  }
});

await test("generated stages run full matches in every mode", () => {
  const scripted = (frame) => ({ moveX: frame % 240 < 120 ? 1 : -1, jumpPressed: frame % 90 === 0, attackPressed: frame % 40 === 0, itemPressed: frame % 120 === 0, pausePressed: false });
  for (const mode of modes) {
    for (const layout of LAYOUTS) {
      const { stage } = resolveMatchStage({ stages: catalogStages, stageId: "balanced", fighters, generated: { seed: `run-${mode.id}`, brief: { layout, hazardLevel: 2 } } });
      const match = new ToyboxMatch({ mode, stage, fighters, config: createMatchConfig({ modeId: mode.id, stageId: stage.id, stageSource: "generated", stageSeed: stage.generator.seed }) });
      assert(match.hazardFloor === stage.hazardFloor && match.bumpers.length === 2, `${stage.id}: hazards not loaded`);
      for (let frame = 0; frame < 1500 && !match.finished; frame += 1) match.update(1 / 60, scripted(frame));
      const snapshot = match.createSnapshot();
      assert(snapshot.players.length === 4, `${mode.id}/${layout}: expected 4 fighters`);
      assert(snapshot.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), `${mode.id}/${layout}: invalid positions`);
      assert(snapshot.hazardFloor > stage.hazardFloor, `${mode.id}/${layout}: rising floor did not rise`);
    }
  }
});

/* --------------------------------------------------------------- report */

const catalogReport = catalogStages.map((stage) => {
  const { connected } = analyzeReachability(stage.platforms, caps);
  return `${stage.id} ${connected.size}/${stage.platforms.length}`;
});
const attempts = sweepStages.reduce((sum, stage) => sum + stage.generator.attempt, 0);
console.log(`\n  info: retries across sweep: ${attempts} extra attempts for ${sweepStages.length} stages`);
console.log(`  info: hand-made catalog stages under the same reachability model (informational): ${catalogReport.join(", ")}`);

if (failures.length) {
  console.error(`\nStage generation tests: ${failures.length} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`\nStage generation tests passed: ${passed} checks.`);
