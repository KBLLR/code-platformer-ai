import {
  validateChallengeCatalog,
  validateFighterCatalog,
  validateModeCatalog,
  validateStageCatalog,
} from "./contracts.js";

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

let cachedContent = null;

export async function loadToyboxContent() {
  if (cachedContent) return cachedContent;

  const [fighterCatalog, stageCatalog, modeCatalog, challengeCatalog] = await Promise.all([
    loadJson("/fighters/catalog.json"),
    loadJson("/stages/index.json"),
    loadJson("/modes/index.json"),
    loadJson("/challenges/index.json"),
  ]);

  cachedContent = {
    fighters: validateFighterCatalog(fighterCatalog),
    stages: validateStageCatalog(stageCatalog),
    modes: validateModeCatalog(modeCatalog),
    challenges: validateChallengeCatalog(challengeCatalog),
  };

  return cachedContent;
}
