/**
 * Toybox-safe themes for generated stages (spec skill: `arena-theme-selector`).
 *
 * A theme is pure data: a palette the StageFactory can render with, plus the
 * words used for display names and keyword matching in arena briefs. The first
 * three reuse the hand-made catalog palettes so generated stages sit in the
 * same visual family; the last three echo the old world-pack atmospheres.
 */
export const STAGE_THEMES = Object.freeze({
  "toy-plaza": {
    label: "Toy Plaza",
    nouns: ["Plaza", "Borough", "Square"],
    keywords: ["plaza", "toy", "town", "borough"],
    palette: { skyTop: "#8fd3ff", skyBottom: "#f8f1d1", platform: "#69c1ff", accent: "#ffef87", hazard: "#ff9b5c" },
  },
  "kite-sky": {
    label: "Kite Sky",
    nouns: ["Stack", "Kites", "Heights"],
    keywords: ["kite", "sky", "cloud", "air"],
    palette: { skyTop: "#7ad6ff", skyBottom: "#ffe0f3", platform: "#8f80ff", accent: "#fff7b8", hazard: "#ff8ec8" },
  },
  clockwork: {
    label: "Clockwork",
    nouns: ["Works", "Drop", "Gearbox"],
    keywords: ["clock", "clockwork", "factory", "gear", "machine"],
    palette: { skyTop: "#ffb877", skyBottom: "#ff7d98", platform: "#ffdf8a", accent: "#ffd4e6", hazard: "#ff5c5c" },
  },
  "ember-dusk": {
    label: "Ember Dusk",
    nouns: ["Crown", "Forge", "Cinders"],
    keywords: ["ember", "fire", "lava", "dusk", "volcano"],
    palette: { skyTop: "#ff9a62", skyBottom: "#3b1d2e", platform: "#c9643f", accent: "#ffd27a", hazard: "#ff4b2b" },
  },
  "jade-mist": {
    label: "Jade Mist",
    nouns: ["Terraces", "Grove", "Steps"],
    keywords: ["jade", "forest", "mist", "garden", "verdant"],
    palette: { skyTop: "#b9f0d8", skyBottom: "#e8f7ef", platform: "#4fb48a", accent: "#f4ffcf", hazard: "#7a5cff" },
  },
  "reef-night": {
    label: "Reef Night",
    nouns: ["Atoll", "Reef", "Lagoon"],
    keywords: ["reef", "ocean", "sea", "night", "water", "atoll"],
    palette: { skyTop: "#203a6b", skyBottom: "#0f1d3a", platform: "#3fc6d9", accent: "#ff9ad5", hazard: "#ffcc4d" },
  },
});

export const STAGE_THEME_IDS = Object.freeze(Object.keys(STAGE_THEMES));

export function paletteForTheme(themeId) {
  return STAGE_THEMES[themeId]?.palette ?? null;
}
