/**
 * Offline-safe "agent" step for stage generation.
 *
 * The Featured Stage Generation Agent spec (docs/FEATURED_STAGE_GENERATION_AGENT.md)
 * describes turning a free-form arena brief into a playable stage. This module
 * is that seam:
 *
 *   prompt --(optional planner)--> arena brief --(deterministic)--> stage
 *
 * - `planner` is an injected async function (e.g. an LLM bridge supplied by a
 *   Core-X host). Toybox never imports a network client here.
 * - Whatever the planner returns is treated as untrusted data: it is reduced
 *   to the four known brief fields by `normalizeArenaBrief`, and the stage is
 *   still produced by the deterministic generator and contract.
 * - If no planner is given, it throws, it times out, or it returns nothing
 *   usable, the deterministic keyword parser is used instead.
 */
import { ARENA_BRIEF_FIELDS, normalizeArenaBrief } from "./arenaBrief.js";
import { generateStage } from "./StageGenerator.js";

export const DEFAULT_PLANNER_TIMEOUT_MS = 4000;

function withTimeout(promise, timeoutMs) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`planner timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function hasBriefFields(value) {
  return Boolean(value) && typeof value === "object"
    && Object.keys(ARENA_BRIEF_FIELDS).some((key) => value[key] !== undefined);
}

/**
 * @returns {Promise<{brief: object, source: "planner"|"deterministic", notes: string[]}>}
 */
export async function planArenaBrief(prompt, { planner = null, timeoutMs = DEFAULT_PLANNER_TIMEOUT_MS } = {}) {
  const fallback = () => normalizeArenaBrief(typeof prompt === "string" ? prompt : null);
  if (typeof planner !== "function") {
    return { brief: fallback(), source: "deterministic", notes: ["no planner supplied"] };
  }
  try {
    const proposal = await withTimeout(
      Promise.resolve(planner({ prompt: String(prompt ?? ""), fields: ARENA_BRIEF_FIELDS })),
      timeoutMs,
    );
    if (!hasBriefFields(proposal)) {
      return { brief: fallback(), source: "deterministic", notes: ["planner returned no usable brief fields"] };
    }
    return { brief: normalizeArenaBrief(proposal), source: "planner", notes: [] };
  } catch (error) {
    return { brief: fallback(), source: "deterministic", notes: [`planner failed: ${error.message}`] };
  }
}

/** Prompt + seed -> validated stage, with provenance of how the brief was made. */
export async function generateStageFromPrompt(prompt, { seed, fighters = null, planner = null, timeoutMs } = {}) {
  const plan = await planArenaBrief(prompt, { planner, timeoutMs });
  const stage = generateStage({ seed, brief: plan.brief, fighters });
  return { stage, plan };
}
