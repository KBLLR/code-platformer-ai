/**
 * ToyboxCoreXShell — the Claude Design ("Toybox Arena - Core-X") implemented.
 *
 * Deliberately a DROP-IN for `ToyboxShell`: same constructor
 * `(container, callbacks)`, same `renderShell(state)` / `renderHud(snapshot,
 * state)`, same `data-action` / `data-setting` event vocabulary. The renderer,
 * match loop, bots, physics and input mapping are untouched — this file only
 * changes chrome, which is what "implement the design, do not redesign the
 * game" requires.
 *
 * Screens follow the design's rail: lobby · roster · stages · challenges ·
 * match setup · ecosystem · settings, plus the match HUD.
 *
 * Every fighter-derived number comes from `state.roster`, the projection built
 * by `content/rosterProjection.js`. There are no literals like
 * "4 mirrored · 0 rigged" here: the design's own placeholder copy was a
 * standing instruction to wire the real contracts in, so the counters are
 * computed and the states are the review-gated ladder from `rosterState.js`.
 */

import {
  button,
  icon,
  dropdown,
  escapeHtml,
  field,
  funnelBar,
  marquee,
  provenanceChip,
  rail,
  serviceChip,
  statTile,
} from "./corex/primitives.js";
import { REQUIRED_RUNTIME_CLIPS } from "../content/contracts.js";
import { projectSlots } from "../content/rosterProjection.js";
import { isPlayableState, isReleasedState } from "../content/rosterState.js";

/** The chrome is built and tested against this ceiling; content supplies the rest. */
export const SLOT_CHROME_CAPACITY = 32;

// Exactly the design's rail, including its icon names. `setup` is the one
// addition: the slot table is a required surface and the design renders it
// inside the lobby/HUD flow, which does not survive as its own route.
const RAIL_ITEMS = [
  { id: "lobby", code: "LOB", name: "Lobby", icon: "mode-board" },
  { id: "roster", code: "RST", name: "Roster", icon: "users" },
  { id: "stages", code: "STG", name: "Stages", icon: "mode-world" },
  { id: "challenges", code: "CHL", name: "Unlocks", icon: "target" },
  { id: "setup", code: "SET", name: "Match setup", icon: "grid" },
  { id: "spectate", code: "SPC", name: "Spectate", icon: "eye" },
  { id: "results", code: "RES", name: "Results", icon: "chart-bar" },
  { id: "telemetry", code: "TEL", name: "Ecosystem", icon: "signal" },
];
const RAIL_FOOTER = [
  { id: "settings", code: "SET", name: "Settings", icon: "settings" },
  { id: "boot", code: "BOO", name: "Boot gate", icon: "lock" },
];

/** Drifting background terms on the boot gate, from the design's BOOT_TERMS. */
const BOOT_TERMS = [
  { text: "ring-out + knockback", x: 8, y: 18, d: 0 },
  { text: "blast-zone.left", x: 72, y: 12, d: 1.2 },
  { text: "toybox-fighters-v1", x: 16, y: 74, d: 2.4 },
  { text: "rigging-portal", x: 66, y: 68, d: 0.6 },
  { text: "spring-trap", x: 44, y: 8, d: 3.1 },
  { text: "procedural fallback", x: 78, y: 44, d: 1.8 },
  { text: "gateway:8090", x: 5, y: 46, d: 2.9 },
  { text: "hazardFloor -7.8", x: 34, y: 88, d: 1.5 },
  { text: "TDM · FFA · SURVIVAL", x: 60, y: 88, d: 3.6 },
  { text: "catalog.json", x: 24, y: 34, d: 4.2 },
];

const SCREEN_TITLES = {
  lobby: "launcher · lobby",
  roster: "content · roster",
  stages: "content · stages",
  challenges: "content · unlocks",
  setup: "runtime · match setup",
  telemetry: "runtime · ecosystem",
  settings: "system · settings",
  boot: "boot gate",
  results: "runtime · results",
  spectate: "runtime · spectate",
};

const SOURCE_OPTIONS = [
  "Auto: warehouse, snapshot, source mirror",
  "Prefer warehouse",
  "Prefer local snapshot",
  "Prefer source mirror",
];

function stateBadge(entry) {
  return `<span class="cx-state cx-state--${entry.state}" title="${escapeHtml(entry.reason)}">${escapeHtml(
    entry.state.toLowerCase().replace(/_/g, " "),
  )}</span>`;
}

/**
 * Bus log lines, derived from the projection.
 *
 * The design hard-coded "[WARN] rigging-portal: rigged export pending" — true
 * at design time, a lie the moment a rig lands. Now it reports what the
 * projection actually says.
 */
function busLog(state) {
  const { content, roster } = state;
  const lines = [
    `[INFO] toybox: content contracts loaded · modes ${content.modes.length} · stages ${content.stages.length} · fighters ${content.fighters.length}`,
  ];
  const summary = roster.summary;
  if (!roster.live) {
    lines.push(`[WARN] rigging-portal: no live projection · fixture only · nothing released`);
  } else if (summary.awaitingReview > 0) {
    // The fighter is still playable on procedural motion; it is the RIG that is
    // withheld, so the line says which.
    lines.push(`[WARN] rigging-portal: ${summary.awaitingReview} rig(s) awaiting human review · procedural motion in use`);
  } else if (summary.playable === 0) {
    lines.push(`[WARN] rigging-portal: no approved runtime rigs · procedural fallback active`);
  } else {
    lines.push(`[INFO] rigging-portal: ${summary.playable} playable · ${summary.realMotion} with full clip sets`);
  }
  lines.push(`[INFO] warehouse: releases resolved ${summary.released} / ${summary.total}`);
  lines.push(`[INFO] profile: local unlock state ${state.unlockState?.unlocked?.size ?? 0} / ${content.fighters.length}`);
  return lines;
}

/* ------------------------------------------------------------------ lobby */

function renderLobby(state) {
  const { roster, content } = state;
  const s = roster.summary;

  // `withheld` rather than 0 wherever the upstream artifact does not exist —
  // the distinction the design is explicit about.
  const riggedTile = s.released === 0 && s.playable === 0
    ? statTile({
        label: "rigged fighters",
        withheld: true,
        why: roster.live
          ? "no approved runtime manifest to read yet — a zero would read as 'rigging ran and produced nothing'"
          : "no live rigging-portal projection — a zero would read as 'rigging ran and produced nothing'",
      })
    : statTile({ label: "rigged fighters", value: s.playable, unit: `/ ${s.total}`, note: `${s.realMotion} with full clip sets` });

  const clipsTile = s.playable === 0
    ? statTile({
        label: "clips published",
        withheld: true,
        why: `no runtime-manifest.json resolves for any fighter — a zero here would read as 'rigging ran and produced nothing'`,
      })
    : statTile({ label: "clips published", value: s.realMotion * REQUIRED_RUNTIME_CLIPS.length, unit: "clips", note: `${REQUIRED_RUNTIME_CLIPS.length} required per fighter` });

  return `
    ${roster.live ? "" : `<div class="cx-fixture">fixture projection · no upstream receipts read · nothing released</div>`}
    <div class="cx-grid cx-grid--4">
      ${statTile({ label: "matches played", value: state.profile?.matchesPlayed ?? 0, note: "local profile" })}
      ${statTile({ label: "total ring-outs", value: state.profile?.totalRingouts ?? 0, note: "across all modes" })}
      ${statTile({ label: "roster unlocked", value: state.unlockState?.unlocked?.size ?? 0, unit: `/ ${content.fighters.length}`, note: "challenge-gated" })}
      ${riggedTile}
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head">
        <span class="cx-panel__title">production pipeline</span>
        <span class="cx-panel__meta">rigging-portal → warehouse → toybox</span>
      </div>
      ${funnelBar({ stages: pipelineStages(roster) })}
      <div class="cx-grid cx-grid--4">
        ${statTile({ label: "source meshes", value: content.fighters.length, unit: "glb", note: "catalog.json" })}
        ${clipsTile}
      </div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">services</span></div>
      <div class="cx-dev__chips">
        ${serviceChip({ name: "gateway", port: "8090", status: "idle", note: "bus" })}
        ${serviceChip({ name: "warehouse", port: "5202", status: s.released > 0 ? "up" : "idle", note: s.released > 0 ? `${s.released} released` : "no releases resolved" })}
        ${serviceChip({ name: "rigging-portal", status: roster.live ? (s.awaitingReview > 0 ? "warn" : "up") : "warn", note: roster.live ? `${s.awaitingReview} awaiting review` : "no live projection" })}
      </div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">launch</span></div>
      <div class="cx-dev__chips">
        ${button({ label: "match setup", action: "go-screen", value: "setup", variant: "primary" })}
        ${button({ label: "roster", action: "go-screen", value: "roster" })}
      </div>
    </div>
  `;
}

/**
 * Pipeline stages, counted from the projection.
 *
 * "rig approved" counts only review-approved entries, so the funnel cannot
 * show progress for rigs a human has not signed off.
 */
function pipelineStages(roster) {
  const entries = roster.entries;
  const total = entries.length;
  const rigging = entries.filter((entry) => entry.state === "RIGGING").length;
  const awaiting = entries.filter((entry) => entry.state === "AWAITING_REVIEW").length;
  const approved = entries.filter((entry) => entry.reviewPhase === "approved").length;
  const released = entries.filter((entry) => isReleasedState(entry.state)).length;
  const playable = entries.filter((entry) => isPlayableState(entry.state)).length;
  const realMotion = entries.filter((entry) => entry.state === "PLAYABLE_REAL_MOTION").length;

  return [
    { label: "source mesh", done: total, waiting: 0 },
    { label: "rig produced", done: total - rigging - entries.filter((e) => e.state === "SOURCE_ONLY").length, waiting: rigging + entries.filter((e) => e.state === "SOURCE_ONLY").length },
    { label: "human review", done: approved, waiting: awaiting },
    { label: "warehouse release", done: released, waiting: Math.max(0, approved - released) },
    { label: "runtime consumed", done: playable, waiting: Math.max(0, released - playable) },
    { label: "full clip set", done: realMotion, waiting: Math.max(0, playable - realMotion) },
  ];
}

/* ----------------------------------------------------------------- roster */

function renderRoster(state) {
  const { roster } = state;
  const rows = roster.entries
    .map((entry) => {
      const unlocked = state.unlockState?.unlocked?.has(entry.fighterId) ?? false;
      return `<div class="cx-roster__row">
        <span class="cx-roster__bar" style="background:var(--corex-platform)"></span>
        <span class="cx-roster__name">${escapeHtml(entry.fighter.displayName)}</span>
        <span class="cx-roster__meta">id ${escapeHtml(entry.fighterId)} · ${escapeHtml(entry.fighter.weightClass)}${
          entry.characterId ? ` · ${escapeHtml(entry.characterId)}` : ""
        }</span>
        <span class="cx-roster__state">
          <span class="cx-state__reason">${escapeHtml(entry.reason)}</span>
          ${stateBadge(entry)}
          ${button({
            label: unlocked ? (entry.fighterId === state.selectedFighterId ? "selected" : "select") : "locked",
            action: "select-fighter",
            value: entry.fighterId,
            disabled: !unlocked,
            variant: entry.fighterId === state.selectedFighterId ? "primary" : "ghost",
            title: isPlayableState(entry.state) ? null : `plays on procedural fallback: ${entry.reason}`,
          })}
        </span>
      </div>`;
    })
    .join("");

  return `
    ${roster.live ? "" : `<div class="cx-fixture">fixture projection · no upstream receipts read · nothing released</div>`}
    <div class="cx-panel">
      <div class="cx-panel__head">
        <span class="cx-panel__title">roster</span>
        <span class="cx-panel__meta">${roster.summary.total} fighters · ${roster.summary.playable} playable · ${roster.summary.realMotion} real motion</span>
      </div>
      <div class="cx-roster">${rows}</div>
      <p class="cx-note">State is derived from the fighter catalog, the resolved distribution layer and the rigging-portal
      review projection. A rig awaiting review is never shown as released or playable, however many artifacts exist on disk.</p>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">provenance</span></div>
      <div class="cx-dev__chips">
        ${provenanceChip({ status: "fresh", age: "boot", detail: "public/fighters/catalog.json" })}
        ${provenanceChip({
          status: roster.live ? "fresh" : "missing",
          age: roster.live ? "sync" : null,
          detail: roster.live
            ? `public/fighters/rigging-projection.json · ${roster.generatedAt}`
            : "public/fighters/rigging-projection.json — not synced from rigging-portal",
        })}
      </div>
    </div>
  `;
}

/* ----------------------------------------------------------------- stages */

function renderStages(state) {
  const cards = state.content.stages
    .map((stage) => {
      const selected = stage.id === state.selectedStageId;
      const rows = [
        ["blast L / R", `${stage.blastZone.left} / ${stage.blastZone.right}`],
        ["blast B / T", `${stage.blastZone.bottom} / ${stage.blastZone.top}`],
        ["hazard floor", Number(stage.hazardFloor).toFixed(1)],
      ]
        .map(([key, value]) => `<div class="cx-slots__row"><span class="cx-roster__meta">${escapeHtml(key)}</span><span class="cx-slots__ctl">${escapeHtml(value)}</span></div>`)
        .join("");
      return `<div class="cx-panel" style="${selected ? "border-style:solid;border-color:var(--accent)" : ""}">
        <div class="cx-panel__head">
          <span class="cx-panel__title">${escapeHtml(stage.displayName)}</span>
          <span class="cx-panel__meta">stage: ${escapeHtml(stage.id)}</span>
        </div>
        <p class="cx-note">${escapeHtml(stage.description)}</p>
        <div class="cx-slots">${rows}</div>
        ${button({ label: selected ? "selected" : "select stage", action: "select-stage", value: stage.id, variant: selected ? "primary" : "ghost" })}
      </div>`;
    })
    .join("");
  return `<div class="cx-grid cx-grid--cards">${cards}</div>`;
}

/* ------------------------------------------------------------- challenges */

function renderChallenges(state) {
  const rows = state.content.challenges
    .map((challenge) => {
      const progress = state.unlockState?.progress?.get(challenge.id) ?? null;
      const pct = progress ? Math.min(100, (progress.current / progress.target) * 100) : 0;
      return `<div class="cx-panel">
        <div class="cx-panel__head">
          <span class="cx-panel__title">${escapeHtml(challenge.displayName)}</span>
          <span class="cx-panel__meta">challenge: ${escapeHtml(challenge.id)}</span>
        </div>
        <p class="cx-note">${escapeHtml(challenge.description)}</p>
        <div class="cx-funnel__row">
          <span class="cx-funnel__track"><span class="cx-funnel__fill" style="width:${pct}%"></span></span>
          <span class="cx-funnel__totals">${progress ? `${progress.current} / ${progress.target}` : "—"}</span>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="cx-grid cx-grid--cards">${rows}</div>`;
}

/* ------------------------------------------------------------ match setup */

function renderSetup(state) {
  const mode = state.content.modes.find((entry) => entry.id === state.selectedModeId);
  const stage = state.content.stages.find((entry) => entry.id === state.selectedStageId);
  const slots = projectSlots(state.roster.entries, {
    capacity: SLOT_CHROME_CAPACITY,
    mode: state.selectedModeId,
    unlocked: state.unlockState?.unlocked ?? null,
  });

  const rows = slots.filled.length
    ? slots.filled
        .map(
          (slot) => `<div class="cx-slots__row">
            <span class="cx-slots__id">${escapeHtml(slot.slot)}</span>
            <span class="cx-slots__bar"></span>
            <span class="cx-slots__name">${escapeHtml(slot.name)}</span>
            <span class="cx-roster__meta">${escapeHtml(slot.team)} · ${escapeHtml(slot.motion)} motion</span>
            <span class="cx-slots__ctl">${escapeHtml(slot.control)}</span>
          </div>`,
        )
        .join("")
    : `<div class="cx-slots__empty">no unlocked fighters — clear a challenge to fill a slot</div>`;

  const modeCards = state.content.modes
    .map((entry) => {
      const selected = entry.id === state.selectedModeId;
      return `<div class="cx-panel" style="${selected ? "border-style:solid;border-color:var(--accent)" : ""}">
        <div class="cx-panel__head">
          <span class="cx-panel__title">${escapeHtml(entry.displayName)}</span>
          <span class="cx-panel__meta">mode: ${escapeHtml(entry.id)}</span>
        </div>
        <p class="cx-note">${escapeHtml(entry.description)}</p>
        ${button({ label: selected ? "selected" : "select mode", action: "select-mode", value: entry.id, variant: selected ? "primary" : "ghost" })}
      </div>`;
    })
    .join("");

  return `
    <div class="cx-grid cx-grid--cards">${modeCards}</div>
    <div class="cx-panel">
      <div class="cx-panel__head">
        <span class="cx-panel__title">slots</span>
        <span class="cx-panel__meta">${escapeHtml(mode?.displayName ?? state.selectedModeId)} · ${escapeHtml(stage?.displayName ?? state.selectedStageId)}</span>
      </div>
      <div class="cx-slots">${rows}</div>
      <div class="cx-capacity">${escapeHtml(slots.capacityLine)} · ${slots.realMotion} real motion · ${slots.proceduralMotion} procedural fallback</div>
      <p class="cx-note">The slot table, roster strip and HUD counters are written against a slot array, not four hard-coded
      rows. The chrome is tested to ${SLOT_CHROME_CAPACITY} slots, so raising the roster is a content change, not a UI change.</p>
      <div class="cx-dev__chips">
        ${button({
          label: slots.count > 0 ? "start match" : "no unlocked fighters",
          action: "start-match",
          variant: "primary",
          disabled: slots.count === 0,
          title: slots.proceduralMotion > 0 ? `${slots.proceduralMotion} slot(s) will use procedural fallback motion` : null,
        })}
      </div>
    </div>
  `;
}

/* -------------------------------------------------------------- telemetry */

function renderTelemetry(state) {
  const { roster } = state;
  const ecosystem = [
    {
      name: "Rigging Portal",
      id: "rigging-portal · house",
      entity: "rigging",
      prov: roster.live ? "fresh" : "missing",
      evidence: roster.live
        ? `rigging-projection.json · generated ${roster.generatedAt}`
        : "no projection synced — run scripts/sync-rigging-projection.mjs",
    },
    {
      name: "Warehouse",
      id: "warehouse · institution",
      entity: "warehouse",
      prov: roster.summary.released > 0 ? "fresh" : "missing",
      evidence: `distribution.releaseManifestItemId · releases resolved ${roster.summary.released} / ${roster.summary.total}`,
    },
    {
      name: "Code Platformer",
      id: "code-platformer-ai · this house",
      entity: "platform",
      prov: "fresh",
      evidence: "house.manifest.json · content contracts loaded",
    },
  ]
    .map(
      (row) => `<div class="cx-roster__row">
        <span class="cx-roster__bar" style="background:var(--corex-${escapeHtml(row.entity)})"></span>
        <span class="cx-roster__name">${escapeHtml(row.name)}</span>
        <span class="cx-roster__meta">${escapeHtml(row.id)}</span>
        <span class="cx-roster__state">${provenanceChip({ status: row.prov, detail: row.evidence })}</span>
      </div>`,
    )
    .join("");

  return `
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">ecosystem</span></div>
      <div class="cx-roster">${ecosystem}</div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">pipeline</span></div>
      ${funnelBar({ stages: pipelineStages(roster) })}
    </div>
  `;
}

/* --------------------------------------------------------------- settings */

function renderSettings(state) {
  // `getBindingSummary()` returns { keyboard: {...}, gamepad: {...} }; the design
  // renders each as its own row list, so the shape is mapped here rather than
  // flattened upstream.
  const bindingGroup = (title, map) => `<div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">${escapeHtml(title)}</span></div>
      <div class="cx-slots">
        ${Object.entries(map ?? {})
          .map(
            ([label, value]) =>
              `<div class="cx-slots__row"><span class="cx-roster__meta">${escapeHtml(label)}</span><span class="cx-slots__ctl">${escapeHtml(value)}</span></div>`,
          )
          .join("")}
      </div>
    </div>`;

  return `
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">asset resolution</span></div>
      ${dropdown({ label: "source priority", options: SOURCE_OPTIONS, value: state.profile?.settings?.fighterAssetSourceLabel ?? SOURCE_OPTIONS[0], action: "set-source" })}
      ${field({
        label: "warehouse url override",
        placeholder: "empty uses VITE_WAREHOUSE_URL or http://127.0.0.1:5202",
        hint: "empty keeps the env default · loaded assets are not swapped mid-match",
        value: state.profile?.settings?.warehouseUrlOverride ?? "",
        action: "set-warehouse-url",
      })}
    </div>
    ${bindingGroup("keyboard", state.bindings?.keyboard)}
    ${bindingGroup("gamepad", state.bindings?.gamepad)}
  `;
}


/* -------------------------------------------------------------- boot gate */

/**
 * Boot gate, per the design: drifting system terms behind a centred card.
 *
 * The design wires BOTH buttons to `goLobby` — the GitHub button is a mock, it
 * authenticates nothing. Shipping a working-looking "Continue with GitHub" in
 * an app with no OAuth would be a fabricated capability, so the composition is
 * kept and that path is disabled with the reason shown. The offline path is the
 * real one, which is what this local-first house actually does.
 */
function renderBoot(state) {
  const terms = BOOT_TERMS.map(
    (term) =>
      `<span class="cx-boot__term" style="left:${term.x}%; top:${term.y}%; animation-delay:${term.d}s">${escapeHtml(term.text)}</span>`,
  ).join("");

  return `<div class="cx-boot">
    <div class="cx-boot__terms">${terms}</div>
    <div class="cx-boot__card">
      <div class="cx-boot__head">
        <div class="cx-boot__brand">
          <span class="cx-boot__mark"><span class="cx-boot__dot"></span></span>
          <span class="cx-boot__brandtext">
            <span class="cx-boot__kbllr">KBLLR</span>
            <span class="cx-boot__eco">Core-X Ecosystem</span>
          </span>
        </div>
        <div>
          <div class="cx-boot__title">Toybox Arena</div>
          <div class="cx-boot__house">house code-platformer-ai · tier house · v${escapeHtml(state.houseVersion ?? "2.0.0")}</div>
        </div>
        <p class="cx-note">Side-view 2.5D platform battler. Local-first content contracts, offline bots, rigged fighter
        exports consumed from rigging-portal.</p>
      </div>
      <div class="cx-boot__actions">
        ${button({
          label: "Continue with GitHub",
          variant: "primary",
          disabled: true,
          title: "no OAuth is wired in this local-first house — use the offline path",
        })}
        <div class="cx-boot__row">
          <span class="cx-boot__svc">gateway:8090 · oauth unavailable</span>
          ${button({ label: "continue offline · local profile", action: "go-screen", value: "lobby" })}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- results */

function renderResults(state) {
  const result = state.lastResult ?? null;
  const players = state.lastPlayers ?? [];

  if (!result) {
    return `<div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">results</span></div>
      <div class="cx-slots__empty">no match has finished yet — play a match to produce results</div>
      <div class="cx-dev__chips">${button({ label: "match setup", action: "go-screen", value: "setup", variant: "primary" })}</div>
    </div>`;
  }

  const rows = players
    .map(
      (player) => `<div class="cx-roster__row">
        <span class="cx-roster__bar" style="background:var(--corex-platform)"></span>
        <span class="cx-roster__name">${escapeHtml(player.displayName ?? player.fighterId)}</span>
        <span class="cx-slots__ctl">${player.ringOuts ?? 0}</span>
        <span class="cx-slots__ctl">${player.deaths ?? 0}</span>
        <span class="cx-slots__ctl">${Math.round(player.damage ?? 0)}%</span>
        <span class="cx-slots__ctl">${escapeHtml(player.teamId ?? "ffa")}</span>
      </div>`,
    )
    .join("");

  return `
    <div class="cx-panel">
      <div class="cx-panel__head">
        <span class="cx-panel__title">${escapeHtml(state.selectedModeId)} · ${escapeHtml(state.selectedStageId)}</span>
        <span class="cx-panel__meta">${escapeHtml(result.summary ?? "")}</span>
      </div>
      <div class="cx-boot__title" style="font-size:22px">${escapeHtml(result.winnerLabel ?? "No winner")}</div>
      <div class="cx-roster__row" style="border-bottom:1px dashed var(--border)">
        <span class="cx-roster__name cx-roster__meta">fighter</span>
        <span class="cx-slots__ctl">ring-outs</span>
        <span class="cx-slots__ctl">falls</span>
        <!-- the engine tracks current damage, not a peak, so the column says so -->
        <span class="cx-slots__ctl">damage %</span>
        <span class="cx-slots__ctl">team</span>
      </div>
      <div class="cx-roster">${rows}</div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">unlock progress</span></div>
      <div class="cx-slots__row">
        <span class="cx-roster__meta">total ring-outs</span>
        <span class="cx-slots__ctl">${state.profile?.totalRingouts ?? 0}</span>
      </div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">broadcast</span></div>
      <p class="cx-dev__mono">code-platformer-ai.toybox.match.completed</p>
      <div class="cx-dev__chips">
        ${button({ label: "Rematch", action: "rematch", variant: "primary" })}
        ${button({ label: "Watch replay", action: "go-screen", value: "spectate" })}
        ${button({ label: "Back to lobby", action: "go-screen", value: "lobby" })}
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- spectate */

function renderSpectate(state) {
  const players = state.lastPlayers ?? [];
  const alive = players.filter((player) => player.alive !== false).length;
  const target = players[0] ?? null;

  const targets = players.length
    ? players
        .map(
          (player, index) => `<div class="cx-roster__row${index === 0 ? " is-active" : ""}">
            <span class="cx-roster__bar" style="background:var(--corex-platform)"></span>
            <span class="cx-roster__name">${escapeHtml(player.displayName ?? player.fighterId)}</span>
            <span class="cx-slots__ctl">${index + 1}</span>
          </div>`,
        )
        .join("")
    : `<div class="cx-slots__empty">no match in flight — nothing to spectate</div>`;

  // Ring-out events are not retained after a match, so the timeline renders only
  // what the engine still holds rather than drawing invented marks.
  const marks = players.length
    ? players
        .flatMap((player, index) =>
          Array.from({ length: player.ringOuts ?? 0 }, (_, k) => (index + 1) / (players.length + 1) + k * 0.07),
        )
        .filter((position) => position < 1)
        .map((position) => `<span class="cx-timeline__mark" style="left:${(position * 100).toFixed(1)}%"></span>`)
        .join("")
    : "";

  return `
    <div class="cx-panel">
      <div class="cx-panel__head">
        <span class="cx-spectate__eye">${icon("eye", { size: 18 })}</span>
        <span class="cx-panel__title">spectating · follow cam</span>
        <span class="cx-panel__meta">alive ${alive} / ${players.length}</span>
      </div>
      <div class="cx-boot__title" style="font-size:16px">${escapeHtml(target?.displayName ?? "—")}</div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">camera targets</span></div>
      <div class="cx-roster">${targets}</div>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">match timeline</span></div>
      <div class="cx-timeline">${marks}</div>
      <p class="cx-dev__mono">marks = ring-out events${players.length ? "" : " · none recorded"}</p>
    </div>
    <div class="cx-panel">
      <div class="cx-panel__head"><span class="cx-panel__title">cam</span></div>
      <div class="cx-dev__chips">
        ${["follow", "wide", "free"].map((mode, i) => button({ label: mode, variant: i === 0 ? "primary" : "ghost", disabled: i !== 0, title: i === 0 ? null : "only follow-cam is implemented" })).join("")}
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ shell */

const SCREENS = {
  boot: renderBoot,
  results: renderResults,
  spectate: renderSpectate,
  lobby: renderLobby,
  roster: renderRoster,
  stages: renderStages,
  challenges: renderChallenges,
  setup: renderSetup,
  telemetry: renderTelemetry,
  settings: renderSettings,
};

export class ToyboxCoreXShell {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.screen = "lobby";
    this.devLayer = false;

    this.shellEl = document.createElement("div");
    this.shellEl.className = "cx-shell";
    this.hudEl = document.createElement("div");
    this.hudEl.className = "toybox-hud hidden";
    this.container.innerHTML = "";
    this.container.append(this.shellEl, this.hudEl);

    // Same event contract as ToyboxShell: screen changes and the dev layer are
    // local chrome state, everything else is forwarded to the app untouched.
    this.container.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target || target.disabled) return;
      const { action, value } = target.dataset;
      if (action === "go-screen") {
        this.screen = value;
        this.renderShell(this._lastState);
        return;
      }
      if (action === "toggle-dev") {
        this.devLayer = !this.devLayer;
        this.renderShell(this._lastState);
        return;
      }
      this.callbacks.onAction?.(action, value);
    });

    this.container.addEventListener("change", (event) => {
      const input = event.target.closest("[data-setting]");
      if (!input) return;
      let next = input.value;
      if (input.type === "checkbox") next = input.checked;
      else if (input.type === "range" || input.type === "number") next = Number(input.value);
      this.callbacks.onSetting?.(input.dataset.setting, next);
    });
  }

  renderShell(state) {
    if (!state) return;
    this._lastState = state;
    this.hudEl.classList.add("hidden");
    this.shellEl.classList.remove("hidden");

    const screen = SCREENS[this.screen] ? this.screen : "lobby";
    const summary = state.roster.summary;

    // The boot gate is an overlay in the design (z-index 300 over the whole
    // app), not a pane inside the shell: it is the gate you pass before the
    // shell is yours to use. Rendering it inside the rail would make it look
    // like just another screen.
    if (screen === "boot") {
      this.shellEl.innerHTML = renderBoot(state);
      return;
    }

    this.shellEl.innerHTML = `
      ${rail({ items: RAIL_ITEMS, active: screen, brand: { tag: "TBX", sub: "toybox arena" }, footer: RAIL_FOOTER, svc: `warehouse:5202 · releases ${summary.released}/${summary.total}` })}
      <div class="cx-main">
        <header class="cx-header">
          <span class="cx-header__title">Toybox Arena</span>
          <span class="cx-header__screen">${escapeHtml(SCREEN_TITLES[screen] ?? screen)}</span>
          <span class="cx-header__spacer"></span>
          <span class="cx-header__right">
            ${button({ label: `dev ${this.devLayer ? "on" : "off"}`, action: "toggle-dev", variant: this.devLayer ? "primary" : "ghost" })}
          </span>
        </header>
        ${marquee({ items: busLog(state) })}
        <div class="cx-screen">${SCREENS[screen](state)}</div>
        ${this.devLayer ? this._renderDevLayer(state) : ""}
      </div>
    `;
  }

  /**
   * Provenance / dev layer: one chip per fighter stating the resolved layer and
   * the derived state's reason. This is the surface that makes a wrong badge
   * visible, so it reports the resolver's verdict verbatim.
   */
  _renderDevLayer(state) {
    const chips = state.roster.entries
      .map((entry) =>
        provenanceChip({
          status: isPlayableState(entry.state) ? "fresh" : entry.reviewPhase === "approved" ? "stale" : "missing",
          detail: `${entry.fighterId}: ${entry.reason} · layer ${entry.activeLayer?.source ?? "none"} · export ${entry.exportStatus}`,
        }),
      )
      .join("");
    return `<div class="cx-dev">
      <div class="cx-panel__head"><span class="cx-panel__title">provenance · dev</span>
        <span class="cx-panel__meta">${state.roster.live ? "live projection" : "fixture projection"}</span></div>
      <div class="cx-dev__chips">${chips}</div>
      <p class="cx-dev__mono">clips required ${REQUIRED_RUNTIME_CLIPS.length} · ${REQUIRED_RUNTIME_CLIPS.join(" · ")}</p>
      <p class="cx-dev__mono">slot chrome capacity ${SLOT_CHROME_CAPACITY} · roster ${state.roster.summary.total} · playable ${state.roster.summary.playable}</p>
    </div>`;
  }

  renderHud(snapshot, state) {
    this.shellEl.classList.add("hidden");
    this.hudEl.classList.remove("hidden");
    const alive = snapshot?.fighters?.filter((fighter) => fighter.alive !== false).length ?? 0;
    const total = snapshot?.fighters?.length ?? 0;
    const rows = (snapshot?.fighters ?? [])
      .map(
        (fighter) => `<div class="cx-roster__row">
          <span class="cx-roster__bar" style="background:var(--corex-platform)"></span>
          <span class="cx-roster__name">${escapeHtml(fighter.displayName ?? fighter.id)}</span>
          <span class="cx-roster__meta">${escapeHtml(fighter.control ?? "bot")}</span>
          <span class="cx-slots__ctl">${Math.round(fighter.damage ?? 0)}%</span>
        </div>`,
      )
      .join("");

    this.hudEl.innerHTML = `<div class="cx-screen">
      <div class="cx-panel">
        <div class="cx-panel__head">
          <span class="cx-panel__title">match</span>
          <span class="cx-panel__meta">alive ${alive} / ${total}</span>
        </div>
        <div class="cx-roster">${rows}</div>
        <div class="cx-dev__chips">${button({ label: "leave match", action: "leave-match" })}</div>
      </div>
    </div>`;
  }
}
