export const REQUIRED_RUNTIME_CLIPS = [
  "idle",
  "run",
  "jump_start",
  "fall",
  "land",
  "attack",
  "stomp",
  "pickup",
  "throw",
  "ringout",
];

const FIGHTER_UNLOCK_TYPES = new Set(["starter", "complete_survival", "total_ringouts"]);
const MODE_IDS = new Set(["tdm", "ffa", "survival"]);
const RUNTIME_EXPORT_STATUSES = new Set(["pending", "ready", "stale", "error"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
}

function assertString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function normalizeStringArray(value, label) {
  assertArray(value, label);
  const normalized = [];
  for (const entry of value) {
    assertString(entry, `${label}[]`);
    if (!normalized.includes(entry)) {
      normalized.push(entry);
    }
  }
  return normalized;
}

function normalizeUnlockRule(rule, fighterId) {
  const normalized = rule ?? { type: "starter" };
  assert(FIGHTER_UNLOCK_TYPES.has(normalized.type), `Unsupported unlock rule for "${fighterId}": ${normalized.type}`);
  if (normalized.type === "total_ringouts" || normalized.type === "complete_survival") {
    assertNumber(normalized.target, `unlockRule.target for "${fighterId}"`);
  }
  return normalized;
}

function normalizeMovementProfile(profile, fighterId) {
  const normalized = profile ?? {};
  [
    "runSpeed",
    "acceleration",
    "airSpeed",
    "airAcceleration",
    "jumpVelocity",
    "doubleJumpVelocity",
    "weight",
  ].forEach((key) => assertNumber(normalized[key], `movementProfile.${key} for "${fighterId}"`));
  return normalized;
}

function normalizeKnockbackProfile(profile, fighterId) {
  const normalized = profile ?? {};
  ["baseAttack", "stompAttack", "launchResistance", "recoveryBias"].forEach((key) => {
    assertNumber(normalized[key], `knockbackProfile.${key} for "${fighterId}"`);
  });
  return normalized;
}

function normalizeRuntimeRig(runtimeRig, fighterId) {
  const normalized = runtimeRig ?? {};
  assertString(normalized.producerHouse, `runtimeRig.producerHouse for "${fighterId}"`);
  assertString(normalized.manifestFile, `runtimeRig.manifestFile for "${fighterId}"`);
  assertString(normalized.runtimeGlb, `runtimeRig.runtimeGlb for "${fighterId}"`);
  assertString(normalized.exportStatus, `runtimeRig.exportStatus for "${fighterId}"`);
  assert(
    RUNTIME_EXPORT_STATUSES.has(normalized.exportStatus),
    `Unsupported runtimeRig.exportStatus for "${fighterId}": ${normalized.exportStatus}`,
  );
  assertString(normalized.animationSetVersion, `runtimeRig.animationSetVersion for "${fighterId}"`);
  const requiredClips = normalizeStringArray(
    normalized.requiredClips ?? REQUIRED_RUNTIME_CLIPS,
    `runtimeRig.requiredClips for "${fighterId}"`,
  );
  REQUIRED_RUNTIME_CLIPS.forEach((clip) => {
    assert(requiredClips.includes(clip), `runtimeRig.requiredClips for "${fighterId}" missing "${clip}"`);
  });
  return {
    ...normalized,
    requiredClips,
  };
}

export function validateRiggedRuntimeManifest(manifest, expectedFighterId = null) {
  assert(manifest && typeof manifest === "object", "rigged runtime manifest must be an object");
  assertString(manifest.fighterId, "runtime manifest fighterId");
  if (expectedFighterId) {
    assert(
      manifest.fighterId === expectedFighterId,
      `runtime manifest fighterId mismatch: expected "${expectedFighterId}", got "${manifest.fighterId}"`,
    );
  }
  assertString(manifest.producerHouse, `producerHouse for "${manifest.fighterId}"`);
  assertString(manifest.sourceModel, `sourceModel for "${manifest.fighterId}"`);
  assertString(manifest.runtimeGlb, `runtimeGlb for "${manifest.fighterId}"`);
  assertString(manifest.exportStatus, `exportStatus for "${manifest.fighterId}"`);
  assert(
    RUNTIME_EXPORT_STATUSES.has(manifest.exportStatus),
    `Unsupported exportStatus for "${manifest.fighterId}": ${manifest.exportStatus}`,
  );
  assertString(manifest.animationSetVersion, `animationSetVersion for "${manifest.fighterId}"`);
  const requiredClips = normalizeStringArray(
    manifest.requiredClips ?? REQUIRED_RUNTIME_CLIPS,
    `requiredClips for "${manifest.fighterId}"`,
  );
  REQUIRED_RUNTIME_CLIPS.forEach((clip) => {
    assert(requiredClips.includes(clip), `requiredClips for "${manifest.fighterId}" missing "${clip}"`);
  });
  const availableClips = normalizeStringArray(
    manifest.availableClips ?? [],
    `availableClips for "${manifest.fighterId}"`,
  );
  if (manifest.exportStatus === "ready") {
    requiredClips.forEach((clip) => {
      assert(availableClips.includes(clip), `ready runtime manifest for "${manifest.fighterId}" missing clip "${clip}"`);
    });
  }
  return {
    ...manifest,
    requiredClips,
    availableClips,
  };
}

export function validateFighterCatalog(catalog) {
  const fighters = catalog?.fighters ?? [];
  assert(Array.isArray(fighters) && fighters.length > 0, "fighters catalog must include at least one fighter");
  const seenIds = new Set();
  return fighters.map((fighter) => {
    assertString(fighter.id, "fighter.id");
    assert(!seenIds.has(fighter.id), `Duplicate fighter id "${fighter.id}"`);
    seenIds.add(fighter.id);
    assertString(fighter.displayName, `displayName for "${fighter.id}"`);
    assertString(fighter.sourceFile, `sourceFile for "${fighter.id}"`);
    assertString(fighter.mirroredSourceFile, `mirroredSourceFile for "${fighter.id}"`);
    assertString(fighter.mirroredRuntimeFile, `mirroredRuntimeFile for "${fighter.id}"`);
    assertString(fighter.provenancePath, `provenancePath for "${fighter.id}"`);
    assertString(fighter.weightClass, `weightClass for "${fighter.id}"`);
    assertString(fighter.itemAffinity, `itemAffinity for "${fighter.id}"`);
    assertString(fighter.subtitle, `subtitle for "${fighter.id}"`);
    assertString(fighter.description, `description for "${fighter.id}"`);
    assertString(fighter.animationSetVersion, `animationSetVersion for "${fighter.id}"`);
    const runtimeRig = normalizeRuntimeRig(fighter.runtimeRig, fighter.id);
    assert(
      runtimeRig.runtimeGlb === fighter.mirroredRuntimeFile,
      `mirroredRuntimeFile mismatch for "${fighter.id}"`,
    );
    assert(
      runtimeRig.animationSetVersion === fighter.animationSetVersion,
      `animationSetVersion mismatch for "${fighter.id}"`,
    );
    return {
      ...fighter,
      unlockRule: normalizeUnlockRule(fighter.unlockRule, fighter.id),
      movementProfile: normalizeMovementProfile(fighter.movementProfile, fighter.id),
      knockbackProfile: normalizeKnockbackProfile(fighter.knockbackProfile, fighter.id),
      runtimeRig,
    };
  });
}

export function validateStageCatalog(catalog) {
  const stages = catalog?.stages ?? [];
  assert(Array.isArray(stages) && stages.length >= 3, "stages catalog must include at least three stages");
  return stages.map((stage) => {
    assertString(stage.id, "stage.id");
    assertString(stage.displayName, `displayName for stage "${stage.id}"`);
    assertString(stage.theme, `theme for stage "${stage.id}"`);
    assertString(stage.description, `description for stage "${stage.id}"`);
    assert(Array.isArray(stage.spawnPoints) && stage.spawnPoints.length >= 4, `spawnPoints missing for stage "${stage.id}"`);
    assert(Array.isArray(stage.itemSpawns) && stage.itemSpawns.length >= 5, `itemSpawns missing for stage "${stage.id}"`);
    assert(Array.isArray(stage.platforms) && stage.platforms.length >= 4, `platforms missing for stage "${stage.id}"`);
    assert(stage.blastZone, `blastZone missing for stage "${stage.id}"`);
    ["left", "right", "bottom", "top"].forEach((key) => assertNumber(stage.blastZone[key], `blastZone.${key} for stage "${stage.id}"`));
    return stage;
  });
}

export function validateModeCatalog(catalog) {
  const modes = catalog?.modes ?? [];
  assert(Array.isArray(modes) && modes.length === 3, "modes catalog must include exactly three modes");
  return modes.map((mode) => {
    assertString(mode.id, "mode.id");
    assert(MODE_IDS.has(mode.id), `Unsupported mode id "${mode.id}"`);
    assertString(mode.displayName, `displayName for mode "${mode.id}"`);
    assertString(mode.description, `description for mode "${mode.id}"`);
    assertString(mode.defaultStageId, `defaultStageId for mode "${mode.id}"`);
    assertNumber(mode.botCount, `botCount for mode "${mode.id}"`);
    assertNumber(mode.scoreLimit, `scoreLimit for mode "${mode.id}"`);
    return mode;
  });
}

export function validateChallengeCatalog(catalog) {
  const challenges = catalog?.challenges ?? [];
  assert(Array.isArray(challenges) && challenges.length >= 2, "challenges catalog must include at least two challenges");
  return challenges.map((challenge) => {
    assertString(challenge.id, "challenge.id");
    assertString(challenge.displayName, `displayName for challenge "${challenge.id}"`);
    assertString(challenge.description, `description for challenge "${challenge.id}"`);
    assertString(challenge.rewardFighterId, `rewardFighterId for challenge "${challenge.id}"`);
    assertString(challenge.type, `type for challenge "${challenge.id}"`);
    assertNumber(challenge.target, `target for challenge "${challenge.id}"`);
    return challenge;
  });
}

export function createDefaultUnlockProfile() {
  return {
    selectedFighterId: "blue",
    stats: {
      totalRingOuts: 0,
      survivalMatchesCompleted: 0,
      matchesCompleted: 0,
    },
    settings: {
      musicVolume: 0.55,
      sfxVolume: 0.8,
      reducedMotion: false,
      gamepadPrompts: true,
      screenShake: true,
    },
  };
}

function challengeProgressFor(profile, challenge) {
  if (challenge.type === "complete_survival") {
    const current = profile.stats.survivalMatchesCompleted;
    return {
      current,
      target: challenge.target,
      complete: current >= challenge.target,
    };
  }

  if (challenge.type === "total_ringouts") {
    const current = profile.stats.totalRingOuts;
    return {
      current,
      target: challenge.target,
      complete: current >= challenge.target,
    };
  }

  return { current: 0, target: challenge.target, complete: false };
}

export function deriveUnlockState(profile, fighters, challenges) {
  const progress = new Map();
  for (const challenge of challenges) {
    progress.set(challenge.id, challengeProgressFor(profile, challenge));
  }

  const unlocked = new Set();
  fighters.forEach((fighter) => {
    const rule = fighter.unlockRule;
    if (rule.type === "starter") {
      unlocked.add(fighter.id);
      return;
    }

    if (rule.type === "complete_survival" && profile.stats.survivalMatchesCompleted >= rule.target) {
      unlocked.add(fighter.id);
      return;
    }

    if (rule.type === "total_ringouts" && profile.stats.totalRingOuts >= rule.target) {
      unlocked.add(fighter.id);
    }
  });

  return {
    unlocked,
    progress,
  };
}

export function validateMatchConfig(config) {
  assertString(config.modeId, "matchConfig.modeId");
  assertString(config.stageId, "matchConfig.stageId");
  assertString(config.selectedFighterId, "matchConfig.selectedFighterId");
  assertNumber(config.botCount, "matchConfig.botCount");
  assertString(config.inputProfile, "matchConfig.inputProfile");
  return config;
}
