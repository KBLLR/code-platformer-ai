import { getBindingSummary } from "../input/ActionMap.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unlockCopy(fighter) {
  if (fighter.unlockRule.type === "starter") return "Available at first boot";
  if (fighter.unlockRule.type === "complete_survival") return `Unlock: complete ${fighter.unlockRule.target} Survival match`;
  if (fighter.unlockRule.type === "total_ringouts") return `Unlock: earn ${fighter.unlockRule.target} total ring-outs`;
  return "Unlock pending";
}

function rigStatusCopy(fighter) {
  if (fighter.runtimeRig.exportStatus === "ready") {
    return `Rigged runtime ready · ${fighter.animationSetVersion}`;
  }
  if (fighter.runtimeRig.exportStatus === "stale") {
    return `Rigged runtime stale · using debug fallback`;
  }
  if (fighter.runtimeRig.exportStatus === "error") {
    return "Rigging export failed · using debug fallback";
  }
  return "Rigging Palace export pending · procedural fallback active";
}

function progressForFighter(fighter, unlockState, challenges) {
  const challenge = challenges.find((entry) => entry.rewardFighterId === fighter.id);
  if (!challenge) return null;
  return unlockState.progress.get(challenge.id) ?? null;
}

function fighterCard(fighter, selectedFighterId, unlocked, progress, activeChallengeText) {
  const isSelected = fighter.id === selectedFighterId;
  const progressMarkup = progress
    ? `<div class="toybox-progress"><span style="width:${Math.min(100, (progress.current / progress.target) * 100)}%"></span></div>
       <div class="toybox-card__meta">${progress.current} / ${progress.target}</div>`
    : `<div class="toybox-card__meta">${activeChallengeText}</div>`;

  return `
    <button
      type="button"
      class="toybox-card toybox-fighter-card ${isSelected ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}"
      data-action="select-fighter"
      data-value="${fighter.id}"
      ${unlocked ? "" : "data-locked=true"}
    >
      <div class="toybox-fighter-card__chip">${unlocked ? "Ready" : "Locked"}</div>
      <div class="toybox-card__title">${fighter.displayName}</div>
      <div class="toybox-card__subtitle">${fighter.subtitle}</div>
      <div class="toybox-card__body">${fighter.description}</div>
      <div class="toybox-traits">
        <span>${fighter.weightClass}</span>
        <span>${fighter.itemAffinity}</span>
      </div>
      <div class="toybox-card__meta">${rigStatusCopy(fighter)}</div>
      ${progressMarkup}
    </button>
  `;
}

function renderPlayTab(state) {
  const { content, selectedModeId, selectedStageId, selectedFighterId, unlockState } = state;
  const activeMode = content.modes.find((mode) => mode.id === selectedModeId);
  const activeStage = content.stages.find((stage) => stage.id === selectedStageId);
  const activeFighter = content.fighters.find((fighter) => fighter.id === selectedFighterId);

  return `
    <section class="toybox-panel">
      <div class="toybox-panel__header">
        <div>
          <div class="toybox-kicker">Play</div>
          <h1>Toybox Arena</h1>
          <p>Side-view 2.5D platform battles with ring-outs, throwables, and bots-first chaos.</p>
        </div>
        <div class="toybox-badge">1 Human + 3 Bots</div>
      </div>

      <div class="toybox-grid toybox-grid--modes">
        ${content.modes.map((mode) => `
          <button
            type="button"
            class="toybox-card ${mode.id === selectedModeId ? "is-selected" : ""}"
            data-action="select-mode"
            data-value="${mode.id}"
          >
            <div class="toybox-card__title">${mode.displayName}</div>
            <div class="toybox-card__body">${mode.description}</div>
            <div class="toybox-card__meta">${mode.respawns ? "Respawns On" : "No Respawns"} · Score ${mode.scoreLimit}</div>
          </button>
        `).join("")}
      </div>

      <div class="toybox-quick-fighters">
        ${content.fighters.map((fighter) => `
          <button
            type="button"
            class="toybox-mini-fighter ${fighter.id === selectedFighterId ? "is-selected" : ""} ${unlockState.unlocked.has(fighter.id) ? "" : "is-locked"}"
            data-action="select-fighter"
            data-value="${fighter.id}"
            ${unlockState.unlocked.has(fighter.id) ? "" : "data-locked=true"}
          >
            <span>${fighter.displayName}</span>
            <strong>${unlockState.unlocked.has(fighter.id) ? fighter.subtitle : "Locked"}</strong>
          </button>
        `).join("")}
      </div>

      <div class="toybox-grid toybox-grid--stages">
        ${content.stages.map((stage) => `
          <button
            type="button"
            class="toybox-card ${stage.id === selectedStageId ? "is-selected" : ""}"
            data-action="select-stage"
            data-value="${stage.id}"
          >
            <div class="toybox-card__title">${stage.displayName}</div>
            <div class="toybox-card__subtitle">${stage.theme}</div>
            <div class="toybox-card__body">${stage.description}</div>
          </button>
        `).join("")}
      </div>

      <div class="toybox-summary-row">
        <div class="toybox-summary-card">
          <div class="toybox-kicker">Active Fighter</div>
          <div class="toybox-card__title">${activeFighter.displayName}</div>
          <div class="toybox-card__body">${activeFighter.description}</div>
          <div class="toybox-card__meta">${unlockState.unlocked.has(activeFighter.id) ? "Unlocked" : unlockCopy(activeFighter)}</div>
          <div class="toybox-card__meta">${rigStatusCopy(activeFighter)}</div>
        </div>
        <div class="toybox-summary-card">
          <div class="toybox-kicker">Match Setup</div>
          <div class="toybox-card__title">${activeMode.displayName} on ${activeStage.displayName}</div>
          <div class="toybox-card__body">Bots first, 4 fighters total, ring-out scoring, side-view combat, and stage toy hazards built for fast recoveries.</div>
          <div class="toybox-card__meta">${activeStage.theme} diorama · ${activeMode.respawns ? "Respawns On" : "No Respawns"} · Score ${activeMode.scoreLimit}</div>
          <div class="toybox-actions">
            <button type="button" class="toybox-primary" data-action="start-match">Start Match</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderFightersTab(state) {
  const { content, selectedFighterId, unlockState } = state;
  return `
    <section class="toybox-panel">
      <div class="toybox-panel__header">
        <div>
          <div class="toybox-kicker">Fighters</div>
          <h1>Starter Roster</h1>
          <p>Two fighters unlocked immediately. Two more open through challenge milestones.</p>
        </div>
      </div>
      <div class="toybox-grid toybox-grid--fighters">
        ${content.fighters.map((fighter) => fighterCard(
          fighter,
          selectedFighterId,
          unlockState.unlocked.has(fighter.id),
          progressForFighter(fighter, unlockState, content.challenges),
          unlockCopy(fighter),
        )).join("")}
      </div>
    </section>
  `;
}

function renderChallengesTab(state) {
  const { content, unlockState } = state;
  return `
    <section class="toybox-panel">
      <div class="toybox-panel__header">
        <div>
          <div class="toybox-kicker">Challenges</div>
          <h1>Unlock Track</h1>
          <p>Progress is stored locally and updates after every completed match.</p>
        </div>
      </div>
      <div class="toybox-grid toybox-grid--challenges">
        ${content.challenges.map((challenge) => {
          const progress = unlockState.progress.get(challenge.id);
          return `
            <article class="toybox-card ${progress?.complete ? "is-complete" : ""}">
              <div class="toybox-card__title">${challenge.displayName}</div>
              <div class="toybox-card__body">${challenge.description}</div>
              <div class="toybox-progress"><span style="width:${Math.min(100, (progress.current / progress.target) * 100)}%"></span></div>
              <div class="toybox-card__meta">${progress.current} / ${progress.target} · Rewards ${challenge.rewardFighterId}</div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSettingsTab(state) {
  const bindings = getBindingSummary();
  const { settings } = state.profile;
  const warehouseUrlOverride = escapeHtml(settings.warehouseUrlOverride ?? "");
  return `
    <section class="toybox-panel">
      <div class="toybox-panel__header">
        <div>
          <div class="toybox-kicker">Settings</div>
          <h1>Controls and Access</h1>
          <p>Keyboard and gamepad parity are built into the match loop from the start.</p>
        </div>
      </div>
      <div class="toybox-settings-grid">
        <article class="toybox-card">
          <div class="toybox-card__title">Keyboard</div>
          ${Object.entries(bindings.keyboard).map(([label, value]) => `<div class="toybox-setting-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}
        </article>
        <article class="toybox-card">
          <div class="toybox-card__title">Gamepad</div>
          ${Object.entries(bindings.gamepad).map(([label, value]) => `<div class="toybox-setting-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}
        </article>
        <article class="toybox-card">
          <div class="toybox-card__title">Audio + Accessibility</div>
          <label class="toybox-setting-input">
            <span>Music Volume</span>
            <input type="range" min="0" max="1" step="0.05" value="${settings.musicVolume}" data-setting="musicVolume" />
          </label>
          <label class="toybox-setting-input">
            <span>SFX Volume</span>
            <input type="range" min="0" max="1" step="0.05" value="${settings.sfxVolume}" data-setting="sfxVolume" />
          </label>
          <label class="toybox-setting-check">
            <input type="checkbox" ${settings.reducedMotion ? "checked" : ""} data-setting="reducedMotion" />
            <span>Reduced Motion</span>
          </label>
          <label class="toybox-setting-check">
            <input type="checkbox" ${settings.gamepadPrompts ? "checked" : ""} data-setting="gamepadPrompts" />
            <span>Gamepad Prompts</span>
          </label>
          <label class="toybox-setting-check">
            <input type="checkbox" ${settings.screenShake ? "checked" : ""} data-setting="screenShake" />
            <span>Screen Shake</span>
          </label>
        </article>
        <article class="toybox-card">
          <div class="toybox-card__title">Fighter Runtime</div>
          <div class="toybox-card__body">Choose which fighter delivery layer Toybox should try first. Changes apply to shell previews immediately and to new matches after the next start.</div>
          <label class="toybox-setting-input">
            <span>Source Priority</span>
            <select data-setting="fighterAssetSource">
              <option value="auto" ${settings.fighterAssetSource === "auto" ? "selected" : ""}>Auto: warehouse, snapshot, source mirror</option>
              <option value="warehouse" ${settings.fighterAssetSource === "warehouse" ? "selected" : ""}>Prefer warehouse</option>
              <option value="snapshot" ${settings.fighterAssetSource === "snapshot" ? "selected" : ""}>Prefer local snapshot</option>
              <option value="source-mirror" ${settings.fighterAssetSource === "source-mirror" ? "selected" : ""}>Prefer source mirror</option>
            </select>
          </label>
          <label class="toybox-setting-input">
            <span>Warehouse URL Override</span>
            <input
              type="text"
              value="${warehouseUrlOverride}"
              placeholder="Empty uses VITE_WAREHOUSE_URL or http://127.0.0.1:5202"
              data-setting="warehouseUrlOverride"
            />
          </label>
          <div class="toybox-card__meta">Leave the URL empty to keep the env/default warehouse endpoint. Current matches keep their already loaded fighter assets.</div>
        </article>
      </div>
    </section>
  `;
}

export class ToyboxShell {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.shellMarkup = "";
    this.hudMarkup = "";
    this.shellEl = document.createElement("div");
    this.shellEl.className = "toybox-shell";
    this.hudEl = document.createElement("div");
    this.hudEl.className = "toybox-hud hidden";
    this.container.innerHTML = "";
    this.container.append(this.shellEl, this.hudEl);

    this.container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.locked === "true") return;
      this.callbacks.onAction?.(button.dataset.action, button.dataset.value);
    });

    this.container.addEventListener("change", (event) => {
      const field = event.target.closest("[data-setting]");
      if (!field) return;
      let value = field.value;
      if (field.type === "checkbox") {
        value = field.checked;
      } else if (field.type === "range" || field.type === "number") {
        value = Number(field.value);
      }
      this.callbacks.onSetting?.(field.dataset.setting, value);
    });
  }

  renderShell(state) {
    this.hudEl.classList.add("hidden");
    this.shellEl.classList.remove("hidden");

    let tabMarkup = renderPlayTab(state);
    if (state.activeTab === "fighters") tabMarkup = renderFightersTab(state);
    if (state.activeTab === "challenges") tabMarkup = renderChallengesTab(state);
    if (state.activeTab === "settings") tabMarkup = renderSettingsTab(state);

    const markup = `
      <div class="toybox-shell__frame">
        <header class="toybox-shell__header">
          <div class="toybox-brand">
            <span class="toybox-brand__eyebrow">Fantasy Toybox Platform Battler</span>
            <strong>Toybox Arena</strong>
          </div>
          <nav class="toybox-tabs">
            ${["play", "fighters", "challenges", "settings"].map((tab) => `
              <button
                type="button"
                class="toybox-tab ${state.activeTab === tab ? "is-active" : ""}"
                data-action="switch-tab"
                data-value="${tab}"
              >
                ${tab.charAt(0).toUpperCase()}${tab.slice(1)}
              </button>
            `).join("")}
          </nav>
        </header>
        ${tabMarkup}
      </div>
    `;

    if (markup !== this.shellMarkup) {
      this.shellEl.innerHTML = markup;
      this.shellMarkup = markup;
    }
  }

  renderHud(snapshot, state) {
    this.shellEl.classList.add("hidden");
    this.hudEl.classList.remove("hidden");

    const human = snapshot.players.find((player) => player.isHuman) ?? snapshot.players[0];
    const scoreboard = snapshot.mode.id === "tdm"
      ? `Sun ${snapshot.teamScores.sun} · Moon ${snapshot.teamScores.moon}`
      : `${human.displayName} ${human.score}`;
    const danger = human.x < snapshot.stage.blastZone.left + 3
      || human.x > snapshot.stage.blastZone.right - 3
      || human.y < snapshot.hazardFloor + 4;

    const markup = `
      <div class="toybox-hud__top">
        <div class="toybox-hud-chip">
          <span>${snapshot.mode.displayName}</span>
          <strong>${snapshot.stage.displayName}</strong>
        </div>
        <div class="toybox-hud-chip">
          <span>Score</span>
          <strong>${scoreboard}</strong>
        </div>
        <div class="toybox-hud-chip">
          <span>Remaining</span>
          <strong>${snapshot.aliveCount}</strong>
        </div>
      </div>
      <div class="toybox-hud__bottom">
        <div class="toybox-hud-panel">
          <span>${human.displayName}</span>
          <strong>${Math.round(human.damage)}%</strong>
          <small>${human.heldItem ?? "hands free"}</small>
        </div>
        <div class="toybox-hud-panel ${danger ? "is-danger" : ""}">
          <span>${danger ? "Danger" : "Status"}</span>
          <strong>${danger ? "Near ring-out" : "Stable footing"}</strong>
          <small>Esc / P pause · J attack · K item</small>
        </div>
      </div>
      ${snapshot.paused ? `
        <div class="toybox-overlay">
          <div class="toybox-overlay__card">
            <h2>Match Paused</h2>
            <p>Camera control is frozen while the pause surface is open.</p>
            <div class="toybox-actions">
              <button type="button" class="toybox-primary" data-action="resume-match">Resume</button>
              <button type="button" class="toybox-secondary" data-action="leave-match">Back to Menu</button>
            </div>
          </div>
        </div>
      ` : ""}
      ${snapshot.finished ? `
        <div class="toybox-overlay">
          <div class="toybox-overlay__card">
            <h2>${snapshot.result.winnerLabel}</h2>
            <p>${snapshot.result.summary}</p>
            <div class="toybox-actions">
              <button type="button" class="toybox-primary" data-action="rematch">Rematch</button>
              <button type="button" class="toybox-secondary" data-action="leave-match">Back to Menu</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;

    if (markup !== this.hudMarkup) {
      this.hudEl.innerHTML = markup;
      this.hudMarkup = markup;
    }
  }
}
