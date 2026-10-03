/**
 * sync-rigging-projection — read upstream review state, write Toybox's view.
 *
 * Produces `public/fighters/rigging-projection.json`, the only channel through
 * which Rigging Palace review verdicts reach this app. Read-only upstream:
 * nothing is written outside this house, and nothing is published anywhere.
 *
 *   node scripts/sync-rigging-projection.mjs [--rigging-root <path>] [--dry-run]
 *
 * WHICH UPSTREAM ARTIFACT IS AUTHORITATIVE
 *
 * Rigging Palace writes two things that both look like "review passed", and
 * only one of them is a human decision:
 *
 *   var/receipts/review/<id>.json      schema rigging-palace.stage-receipt.v1
 *                                      `status: "passed"` — the review PACK was
 *                                      built. A pipeline fact. 1314 of these
 *                                      exist, including for every Toybox
 *                                      fighter id.
 *
 *   var/rigging/jobs/<job>/rig-review.json
 *                                      schema corex.character-rig-review.v1
 *                                      `review_status`, `reviewer`,
 *                                      `promotion_allowed` — the HUMAN verdict.
 *
 * Reading the stage receipt as approval would mark the entire upstream catalogue
 * released on the strength of a pack-build step. So the human verdict is the
 * only thing that can produce `approved` here, it additionally requires
 * `promotion_allowed === true` and a named reviewer, and a stage receipt on its
 * own can raise a fighter no higher than `awaiting_review`.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validateFighterCatalog } from "../src/content/contracts.js";
import { RIGGING_PROJECTION_SCHEMA, validateRiggingProjection } from "../src/content/riggingProjection.js";
import { CHARACTER_RIG_REVIEW_SCHEMA } from "../src/content/rosterState.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOUSE_ROOT = path.resolve(HERE, "..");

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const DRY_RUN = process.argv.includes("--dry-run");
const RIGGING_ROOT = path.resolve(arg("rigging-root", path.join(HOUSE_ROOT, "..", "rigging-portal")));
const OUT_PATH = path.join(HOUSE_ROOT, "public", "fighters", "rigging-projection.json");
const MAP_PATH = path.join(HOUSE_ROOT, "config", "rigging-character-map.json");

async function sha256OfFile(file) {
  try {
    return createHash("sha256").update(await readFile(file)).digest("hex");
  } catch {
    return null;
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * characterId -> verdict for that character's CURRENT job only.
 *
 * Deliberately NOT "the strongest verdict across jobs". If job A was approved
 * and job B then produced a new rig awaiting review, the current rig is B's and
 * it has no approval; carrying A's verdict forward would authorize an artifact
 * no human ever saw. So the newest produced rig wins, whatever its verdict, and
 * a superseded approval survives only as history.
 */
async function readHumanVerdicts() {
  const jobsRoot = path.join(RIGGING_ROOT, "var", "rigging", "jobs");
  const current = new Map();
  let jobs;
  try {
    jobs = await readdir(jobsRoot, { withFileTypes: true });
  } catch {
    return current;
  }

  for (const job of jobs) {
    if (!job.isDirectory()) continue;
    const dir = path.join(jobsRoot, job.name);
    const review = await readJson(path.join(dir, "rig-review.json"));
    const artifact = await readJson(path.join(dir, "rig-artifact.json"));
    if (!review?.character_id || !artifact?.generated_at) continue;
    if (artifact.character_id !== review.character_id) continue;

    const existing = current.get(review.character_id);
    if (existing && Date.parse(existing.generatedAt) >= Date.parse(artifact.generated_at)) continue;

    // Every clause of the approval predicate, checked at the source.
    const approved =
      review.schema_version === CHARACTER_RIG_REVIEW_SCHEMA &&
      review.review_status === "approved" &&
      typeof review.reviewer === "string" &&
      review.reviewer.trim() !== "" &&
      review.promotion_allowed === true;

    // The digest of the rig this verdict is about. Without it an approval
    // cannot be bound to a consumed artifact, so it cannot be emitted as one.
    const runtimeRel = artifact.runtime_glb ?? null;
    const rigSha256 = runtimeRel
      ? await sha256OfFile(path.isAbsolute(runtimeRel) ? runtimeRel : path.join(RIGGING_ROOT, runtimeRel))
      : null;

    current.set(review.character_id, {
      phase: approved && rigSha256 ? "approved" : "awaiting_review",
      generatedAt: artifact.generated_at,
      evidence: `${path.join("var/rigging/jobs", job.name, "rig-review.json")} · review_status=${review.review_status} · promotion_allowed=${review.promotion_allowed}`,
      reviewedAt: review.reviewed_at ?? null,
      approval:
        approved && rigSha256
          ? {
              schema: CHARACTER_RIG_REVIEW_SCHEMA,
              review_status: review.review_status,
              reviewer: review.reviewer,
              promotion_allowed: true,
              job_id: review.job_id ?? artifact.job_id ?? job.name,
              rig_sha256: rigSha256,
              reviewed_at: review.reviewed_at ?? null,
            }
          : null,
      // An approval that could not be bound is reported, not silently dropped.
      unbindable: approved && !rigSha256,
    });
  }
  return current;
}

/** characterIds that merely have a built review pack — never more than awaiting_review. */
async function readStageReceipts() {
  const dir = path.join(RIGGING_ROOT, "var", "receipts", "review");
  const built = new Set();
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return built;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const receipt = await readJson(path.join(dir, file));
    if (receipt?.stage === "review" && receipt?.status === "passed" && receipt?.characterId) {
      built.add(receipt.characterId);
    }
  }
  return built;
}

const catalog = validateFighterCatalog(await readJson(path.join(HOUSE_ROOT, "public", "fighters", "catalog.json")));
const explicitMap = (await readJson(MAP_PATH)) ?? {};
const verdicts = await readHumanVerdicts();
const packsBuilt = await readStageReceipts();

const upstreamReachable = verdicts.size > 0 || packsBuilt.size > 0;

const fighters = catalog.map((fighter) => {
  // Mapping precedence: an explicit map entry, else an identical id upstream.
  const characterId = explicitMap[fighter.id] ?? (verdicts.has(fighter.id) || packsBuilt.has(fighter.id) ? fighter.id : null);
  if (!characterId) {
    return { fighterId: fighter.id, phase: "none", evidence: null, characterId: null, reviewedAt: null };
  }

  const verdict = verdicts.get(characterId);
  if (verdict) {
    return {
      fighterId: fighter.id,
      phase: verdict.phase,
      evidence: verdict.unbindable
        ? `${verdict.evidence} · approval NOT BOUND: the approved rig could not be hashed`
        : verdict.evidence,
      characterId,
      reviewedAt: verdict.reviewedAt,
      approval: verdict.approval,
    };
  }
  if (packsBuilt.has(characterId)) {
    return {
      fighterId: fighter.id,
      phase: "awaiting_review",
      evidence: `var/receipts/review/${characterId}.json · stage receipt only · no human verdict recorded`,
      characterId,
      reviewedAt: null,
    };
  }
  return { fighterId: fighter.id, phase: "none", evidence: null, characterId, reviewedAt: null };
});

const projection = validateRiggingProjection({
  schema: RIGGING_PROJECTION_SCHEMA,
  // `live` means "upstream was actually read", not "upstream approved anything".
  live: upstreamReachable,
  // A house name, never an absolute path: the projection must not carry one
  // machine's layout into an artifact another clone may read.
  source: upstreamReachable ? "rigging-portal" : "unreachable",
  note: upstreamReachable
    ? "human verdicts from corex.character-rig-review.v1 · stage receipts cannot exceed awaiting_review"
    : "rigging-portal not reachable — nothing read, nothing approved",
  generatedAt: new Date().toISOString(),
  fighters,
});

const counts = fighters.reduce((acc, entry) => ({ ...acc, [entry.phase]: (acc[entry.phase] ?? 0) + 1 }), {});
console.log(`[rigging-projection] upstream: ${RIGGING_ROOT}`);
console.log(`[rigging-projection] human verdicts read: ${verdicts.size} · review packs built: ${packsBuilt.size}`);
console.log(`[rigging-projection] approved upstream: ${[...verdicts.values()].filter((v) => v.phase === "approved").length}`);
console.log(`[rigging-projection] fighter phases: ${JSON.stringify(counts)}`);

if (DRY_RUN) {
  console.log("[rigging-projection] dry run — nothing written");
  process.exit(0);
}
await writeFile(OUT_PATH, `${JSON.stringify(projection, null, 2)}\n`, "utf8");
console.log(`[rigging-projection] wrote ${path.relative(HOUSE_ROOT, OUT_PATH)}`);
