import { createDefaultUnlockProfile } from "../content/contracts.js";

const STORAGE_KEY = "toybox-arena-profile-v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadProfile() {
  const defaults = createDefaultUnlockProfile();
  if (!canUseStorage()) return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      stats: {
        ...defaults.stats,
        ...(parsed.stats ?? {}),
      },
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveProfile(profile) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function applyMatchProgress(profile, matchSummary) {
  const next = {
    ...profile,
    stats: {
      ...profile.stats,
      totalRingOuts: profile.stats.totalRingOuts + (matchSummary.humanRingOuts ?? 0),
      survivalMatchesCompleted:
        profile.stats.survivalMatchesCompleted + (matchSummary.completedSurvival ? 1 : 0),
      matchesCompleted: profile.stats.matchesCompleted + 1,
    },
  };
  saveProfile(next);
  return next;
}
