/**
 * `arena-brief-parser`: normalize a free-text or structured arena brief into
 * the small set of knobs the generator understands. Pure and deterministic;
 * unknown input falls back to defaults instead of throwing.
 */
import { STAGE_THEMES, STAGE_THEME_IDS } from "./stageThemes.js";

export const ARENA_LAYOUTS = Object.freeze(["balanced", "vertical", "wide"]);
export const ARENA_BRIEF_FIELDS = Object.freeze({
  layout: ARENA_LAYOUTS,
  theme: STAGE_THEME_IDS,
  hazardLevel: [0, 1, 2],
  tiers: [1, 2, 3, 4],
});

const DEFAULT_TIERS = { balanced: 2, vertical: 3, wide: 2 };
const LAYOUT_KEYWORDS = {
  vertical: ["vertical", "tower", "stack", "climb", "tall", "shelves"],
  wide: ["wide", "sprawl", "open", "broad", "long"],
  balanced: ["balanced", "classic", "even", "plaza"],
};
const CALM_KEYWORDS = ["calm", "safe", "gentle", "peaceful", "no hazard", "beginner"];
const DANGER_KEYWORDS = ["hazard", "danger", "dangerous", "chaos", "chaotic", "deadly", "bumper", "spicy"];

const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));

function matchKeyword(text, keywords) {
  return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(text));
}

function briefFromText(text) {
  const lower = text.toLowerCase();
  const brief = {};
  for (const layout of ["vertical", "wide", "balanced"]) {
    if (matchKeyword(lower, LAYOUT_KEYWORDS[layout])) {
      brief.layout = layout;
      break;
    }
  }
  const theme = STAGE_THEME_IDS.find((id) => lower.includes(id) || matchKeyword(lower, STAGE_THEMES[id].keywords));
  if (theme) brief.theme = theme;
  if (matchKeyword(lower, CALM_KEYWORDS)) brief.hazardLevel = 0;
  else if (matchKeyword(lower, DANGER_KEYWORDS)) brief.hazardLevel = 2;
  const tierMatch = lower.match(/\b([1-4])\s*(?:tiers?|levels?|floors?)\b/);
  if (tierMatch) brief.tiers = Number(tierMatch[1]);
  return brief;
}

/**
 * @param {string|object|null} input free text ("tall ember tower, chaotic") or
 *   a partial `{ layout, theme, hazardLevel, tiers }` object.
 * @returns {{layout:string, theme:string|null, hazardLevel:number, tiers:number}}
 *   `theme: null` means "let the seed pick".
 */
export function normalizeArenaBrief(input = null) {
  const raw = typeof input === "string" ? briefFromText(input) : (input && typeof input === "object" ? input : {});
  const layout = ARENA_LAYOUTS.includes(raw.layout) ? raw.layout : "balanced";
  const theme = STAGE_THEME_IDS.includes(raw.theme) ? raw.theme : null;
  const hazardLevel = Number.isFinite(raw.hazardLevel) ? clampInt(raw.hazardLevel, 0, 2) : 1;
  const tiers = Number.isFinite(raw.tiers) ? clampInt(raw.tiers, 1, 4) : DEFAULT_TIERS[layout];
  return { layout, theme, hazardLevel, tiers };
}

/** Stable string form, used as part of the generation seed. */
export function briefKey(brief) {
  return `${brief.layout}/${brief.theme ?? "auto"}/h${brief.hazardLevel}/t${brief.tiers}`;
}
