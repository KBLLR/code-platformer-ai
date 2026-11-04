/**
 * Picks the stage a match runs on.
 *
 * Default: the hand-made catalog stage (`public/stages/index.json`).
 * Opt-in:  `generated: { seed, brief }` builds a stage with the seeded
 *          generator instead. This is the only path that loads generated
 *          stages, so the catalog stays the default everywhere else.
 */
import { generateStage } from "../stage/StageGenerator.js";

export const STAGE_SOURCES = Object.freeze(["catalog", "generated"]);

export function resolveMatchStage({ stages, stageId, fighters = null, generated = null }) {
  if (generated && generated.seed !== undefined && generated.seed !== null && String(generated.seed).trim() !== "") {
    const stage = generateStage({ seed: generated.seed, brief: generated.brief ?? null, fighters });
    return { stage, source: "generated" };
  }
  const stage = stages.find((entry) => entry.id === stageId) ?? stages[0];
  return { stage, source: "catalog" };
}
