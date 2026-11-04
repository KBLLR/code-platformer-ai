import { loadToyboxContent } from "../content/loadContent.js";
import { createMatchConfig } from "../game/MatchConfig.js";
import { applyMatchProgress, loadProfile, saveProfile } from "../game/ProfileStore.js";
import { deriveUnlockState } from "../content/contracts.js";
import { ActionMap } from "../input/ActionMap.js";
import { ToyboxRenderer } from "../render/ToyboxRenderer.js";
import { ToyboxCoreXShell } from "../ui/ToyboxCoreXShell.js";
import { buildRosterProjection } from "../content/rosterProjection.js";
import { getBindingSummary } from "../input/ActionMap.js";
import { ToyboxMatch } from "../game/ToyboxMatch.js";
import { resolveMatchStage } from "../game/MatchStage.js";

export class ToyboxArenaApp {
  constructor({ canvas, uiContainer }) {
    this.canvas = canvas;
    this.uiContainer = uiContainer;
    this.renderer = new ToyboxRenderer(canvas);
    this.input = new ActionMap(window);
    this.shell = new ToyboxCoreXShell(uiContainer, {
      onAction: (action, value) => void this._handleAction(action, value),
      onSetting: (setting, value) => void this._handleSetting(setting, value),
    });
    this.content = null;
    this.profile = loadProfile();
    this.renderer.setRuntimeSettings(this.profile.settings);
    this.unlockState = null;
    // Derived view of production state; rebuilt whenever asset resolution changes.
    this.roster = null;
    this.lastResult = null;
    this.lastPlayers = [];
    this.activeTab = "play";
    this.selectedModeId = "tdm";
    this.selectedStageId = "balanced";
    this.selectedFighterId = this.profile.selectedFighterId;
    // Opt-in generated stage ({ seed, brief }); null keeps catalog stages.
    // Set via `?stageSeed=<seed>&stageBrief=<text>` or setGeneratedStage().
    this.generatedStageRequest = null;
    this.activeStageSource = "catalog";
    this.match = null;
    this.currentSnapshot = null;
    this.lastFrame = performance.now();
    this._progressCommitted = false;
  }

  async init() {
    this.content = await loadToyboxContent();
    await this.renderer.init();
    this._refreshUnlocks();
    await this._refreshRoster();
    const shouldAutostart = this._applyUrlConfig();
    if (shouldAutostart) {
      await this._startMatch();
      return;
    }
    await this._refreshShell();
  }

  start() {
    this.lastFrame = performance.now();
    requestAnimationFrame((timestamp) => this._frame(timestamp));
  }

  async _frame(timestamp) {
    const delta = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;
    this.step(delta);
    this.renderer.render();
    requestAnimationFrame((next) => this._frame(next));
  }

  step(delta) {
    if (this.match) {
      const input = this.input.snapshot();
      if (input.pausePressed && !this.match.finished) {
        this.match.togglePause();
      }
      this.match.update(delta, input);
      this.currentSnapshot = this.match.createSnapshot();
      this.renderer.update(this.currentSnapshot, delta);
      this.shell.renderHud(this.currentSnapshot, this._shellState());

      if (this.currentSnapshot.finished && !this._progressCommitted) {
        this.lastResult = this.currentSnapshot.result ?? null;
        this.lastPlayers = this.currentSnapshot.players ?? [];
        this.profile = applyMatchProgress(this.profile, this.currentSnapshot.result);
        this._refreshUnlocks();
        this._progressCommitted = true;
      }
    } else {
      this.input.snapshot();
      this.currentSnapshot = null;
      this.renderer.update(null, delta);
    }
  }

  _shellState() {
    return {
      activeTab: this.activeTab,
      selectedModeId: this.selectedModeId,
      selectedStageId: this.selectedStageId,
      selectedFighterId: this.selectedFighterId,
      content: this.content,
      profile: this.profile,
      unlockState: this.unlockState,
      roster: this.roster,
      bindings: getBindingSummary(),
      // Results and spectate read the last finished match rather than inventing
      // rows; absent means the screens show their empty state.
      lastResult: this.lastResult ?? null,
      lastPlayers: this.lastPlayers ?? [],
    };
  }

  /**
   * Rebuild the roster projection.
   *
   * Depends on runtime settings (which asset layer wins) and on the synced
   * rigging projection, so it is refreshed on settings changes rather than
   * cached for the session.
   */
  async _refreshRoster() {
    this.roster = await buildRosterProjection(this.content, { runtimeSettings: this.profile.settings });
  }

  _refreshUnlocks() {
    this.unlockState = deriveUnlockState(this.profile, this.content.fighters, this.content.challenges);
    if (!this.unlockState.unlocked.has(this.selectedFighterId)) {
      this.selectedFighterId = this.content.fighters.find((fighter) => this.unlockState.unlocked.has(fighter.id))?.id ?? "blue";
    }
    this.profile.selectedFighterId = this.selectedFighterId;
    saveProfile(this.profile);
  }

  _applyUrlConfig() {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const modeId = params.get("mode");
    const stageId = params.get("stage");
    const fighterId = params.get("fighter");
    const autostart = params.get("autostart");
    const stageSeed = params.get("stageSeed");

    if (modeId && this.content.modes.some((entry) => entry.id === modeId)) {
      this.selectedModeId = modeId;
      const mode = this.content.modes.find((entry) => entry.id === modeId);
      if (mode?.defaultStageId) {
        this.selectedStageId = mode.defaultStageId;
      }
    }

    if (stageId && this.content.stages.some((entry) => entry.id === stageId)) {
      this.selectedStageId = stageId;
    }

    if (stageSeed && stageSeed.trim()) {
      this.setGeneratedStage({ seed: stageSeed.trim(), brief: params.get("stageBrief") });
    }

    if (fighterId && this.unlockState.unlocked.has(fighterId)) {
      this.selectedFighterId = fighterId;
      this.profile.selectedFighterId = fighterId;
      saveProfile(this.profile);
    }

    return autostart === "1";
  }

  async _refreshShell() {
    this.shell.renderShell(this._shellState());
    const fighter = this.content.fighters.find((entry) => entry.id === this.selectedFighterId) ?? this.content.fighters[0];
    const stage = this.content.stages.find((entry) => entry.id === this.selectedStageId) ?? this.content.stages[0];
    await this.renderer.showShellPreview({
      fighter,
      stage,
      tab: this.activeTab,
    });
  }

  async _handleAction(action, value) {
    if (action === "switch-tab") {
      this.activeTab = value;
      await this._refreshShell();
      return;
    }

    if (action === "select-mode") {
      const nextMode = this.content.modes.find((entry) => entry.id === value);
      this.selectedModeId = value;
      if (nextMode?.defaultStageId) {
        this.selectedStageId = nextMode.defaultStageId;
      }
      await this._refreshShell();
      return;
    }

    if (action === "select-stage") {
      this.selectedStageId = value;
      await this._refreshShell();
      return;
    }

    if (action === "select-fighter") {
      if (!this.unlockState.unlocked.has(value)) return;
      this.selectedFighterId = value;
      this.profile.selectedFighterId = value;
      saveProfile(this.profile);
      await this._refreshShell();
      return;
    }

    if (action === "start-match") {
      await this._startMatch();
      return;
    }

    if (action === "resume-match") {
      if (this.match) this.match.togglePause();
      return;
    }

    if (action === "leave-match") {
      this.match = null;
      this.currentSnapshot = null;
      this.activeTab = "play";
      this._progressCommitted = false;
      await this._refreshShell();
      return;
    }

    if (action === "rematch") {
      await this._startMatch();
    }
  }

  async _handleSetting(setting, value) {
    const nextValue = setting === "warehouseUrlOverride" && typeof value === "string"
      ? value.trim()
      : value;
    this.profile.settings[setting] = nextValue;
    saveProfile(this.profile);

    if (setting === "fighterAssetSource" || setting === "warehouseUrlOverride") {
      this.renderer.setRuntimeSettings(this.profile.settings);
      if (!this.match) {
        // Which layer resolves decides the derived roster state, so the
        // projection has to be rebuilt before the shell is drawn again.
        await this._refreshRoster();
        await this._refreshShell();
      }
    }
  }

  /** Opt into (or, with null, out of) generated stages for the next match. */
  setGeneratedStage(request) {
    this.generatedStageRequest = request && request.seed ? { seed: String(request.seed), brief: request.brief ?? null } : null;
  }

  _resolveStage() {
    try {
      return resolveMatchStage({
        stages: this.content.stages,
        stageId: this.selectedStageId,
        fighters: this.content.fighters,
        generated: this.generatedStageRequest,
      });
    } catch (error) {
      // A generated stage must never block play: fall back to the catalog.
      console.warn("[toybox] stage generation failed; using catalog stage", error);
      return resolveMatchStage({ stages: this.content.stages, stageId: this.selectedStageId });
    }
  }

  async _startMatch() {
    const mode = this.content.modes.find((entry) => entry.id === this.selectedModeId) ?? this.content.modes[0];
    const { stage, source } = this._resolveStage();
    this.activeStageSource = source;
    const config = createMatchConfig({
      modeId: mode.id,
      stageId: stage.id,
      selectedFighterId: this.selectedFighterId,
      botCount: mode.botCount,
      stageSource: source,
      stageSeed: source === "generated" ? stage.generator.seed : null,
    });

    this.match = new ToyboxMatch({
      mode,
      stage,
      fighters: this.content.fighters,
      config,
    });
    this._progressCommitted = false;
    this.currentSnapshot = this.match.createSnapshot();
    await this.renderer.startMatch(this.currentSnapshot);
  }

  advanceTime(ms) {
    const frameCount = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let index = 0; index < frameCount; index += 1) {
      this.step(1 / 60);
    }
    this.lastFrame = performance.now();
    this.renderer.render();
  }

  renderGameToText() {
    if (!this.currentSnapshot) {
      return JSON.stringify({
        scene: "shell",
        activeTab: this.activeTab,
        selectedModeId: this.selectedModeId,
        selectedStageId: this.selectedStageId,
        selectedFighterId: this.selectedFighterId,
        unlockedFighters: [...this.unlockState.unlocked],
      });
    }

    const human = this.currentSnapshot.players.find((player) => player.isHuman) ?? this.currentSnapshot.players[0];
    return JSON.stringify({
      scene: "match",
      coordinates: {
        origin: "stage center",
        x: "left negative, right positive",
        y: "up positive",
      },
      mode: this.currentSnapshot.mode.id,
      stage: this.currentSnapshot.stage.id,
      stageSource: this.activeStageSource,
      paused: this.currentSnapshot.paused,
      finished: this.currentSnapshot.finished,
      aliveCount: this.currentSnapshot.aliveCount,
      hazardFloor: Number(this.currentSnapshot.hazardFloor.toFixed(2)),
      human: {
        fighterId: human.fighterId,
        x: Number(human.x.toFixed(2)),
        y: Number(human.y.toFixed(2)),
        vx: Number(human.vx.toFixed(2)),
        vy: Number(human.vy.toFixed(2)),
        damage: Number(human.damage.toFixed(1)),
        heldItem: human.heldItem,
        alive: human.alive,
        animationState: human.animationState,
        loopAnimationState: human.loopAnimationState,
      },
      players: this.currentSnapshot.players.map((player) => ({
        id: player.playerId,
        fighterId: player.fighterId,
        x: Number(player.x.toFixed(2)),
        y: Number(player.y.toFixed(2)),
        alive: player.alive,
        score: player.score,
        animationState: player.animationState,
      })),
      pickups: this.currentSnapshot.pickups
        .filter((pickup) => pickup.available)
        .map((pickup) => ({
          id: pickup.pickupId,
          type: pickup.type,
          x: Number(pickup.x.toFixed(2)),
          y: Number(pickup.y.toFixed(2)),
        })),
      projectiles: this.currentSnapshot.projectiles.length,
      traps: this.currentSnapshot.traps.length,
    });
  }
}
