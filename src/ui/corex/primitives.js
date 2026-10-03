/**
 * corex/primitives — the Core-X design-system chrome, in this house's idiom.
 *
 * The Claude Design package ships these as bundled JSX
 * (`_ds/…/_ds_bundle.js`). Toybox renders vanilla template literals and has no
 * React, so rather than pull a framework in for ten pieces of chrome, each
 * component is reproduced here against the SAME vendored tokens
 * (`public/_ds/core-x-design-system/`). The tokens are the design authority;
 * these functions only arrange them.
 *
 * Prop names deliberately mirror the design's `x-import` attributes, so a
 * reviewer can diff a design usage against a call here line for line.
 *
 * The important one is `statTile`. The design uses `withheld` + `why` wherever
 * the underlying data does not exist yet, with an explicit rationale:
 *
 *     label="clips published" withheld
 *     why="no runtime-manifest.json exists for any fighter — a zero here would
 *          read as 'rigging ran and produced nothing'"
 *
 * So "withheld" is a first-class state, distinct from zero. Rendering 0 for
 * absent data is the misrepresentation this file is built to avoid; `statTile`
 * therefore refuses a value and a `withheld` flag at the same time.
 */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PROVENANCE_STATUSES = new Set(["fresh", "stale", "missing"]);
const SERVICE_STATUSES = new Set(["up", "idle", "warn", "down"]);

/** label + value + unit + note, or an explicit withheld tile carrying its reason. */
export function statTile({ label, value, unit = null, note = null, withheld = false, why = null }) {
  if (withheld && (value !== undefined && value !== null)) {
    throw new Error(`statTile "${label}" is withheld but was also given a value`);
  }
  if (withheld && !why) {
    throw new Error(`statTile "${label}" is withheld and must explain why`);
  }

  const body = withheld
    ? `<div class="cx-stat__withheld" title="${escapeHtml(why)}">
         <span class="cx-stat__withheld-mark">—</span>
         <span class="cx-stat__withheld-label">withheld</span>
       </div>
       <div class="cx-stat__note cx-stat__note--why">${escapeHtml(why)}</div>`
    : `<div class="cx-stat__value">${escapeHtml(value)}${
        unit ? `<span class="cx-stat__unit">${escapeHtml(unit)}</span>` : ""
      }</div>
       ${note ? `<div class="cx-stat__note">${escapeHtml(note)}</div>` : ""}`;

  return `<div class="cx-stat${withheld ? " cx-stat--withheld" : ""}">
    <div class="cx-stat__label">${escapeHtml(label)}</div>
    ${body}
  </div>`;
}

/** Where a value came from, and how stale it is. `missing` is not an error state — it is honest. */
export function provenanceChip({ status, detail, age = null }) {
  if (!PROVENANCE_STATUSES.has(status)) {
    throw new Error(`provenanceChip status must be fresh|stale|missing, received "${status}"`);
  }
  return `<span class="cx-prov cx-prov--${status}" title="${escapeHtml(detail)}">
    <span class="cx-prov__dot"></span>
    <span class="cx-prov__status">${escapeHtml(status)}</span>
    ${age ? `<span class="cx-prov__age">${escapeHtml(age)}</span>` : ""}
    <span class="cx-prov__detail">${escapeHtml(detail)}</span>
  </span>`;
}

export function serviceChip({ name, port = null, status, note = null }) {
  if (!SERVICE_STATUSES.has(status)) {
    throw new Error(`serviceChip status must be up|idle|warn|down, received "${status}"`);
  }
  return `<span class="cx-svc cx-svc--${status}">
    <span class="cx-svc__dot"></span>
    <span class="cx-svc__name">${escapeHtml(name)}</span>
    ${port ? `<span class="cx-svc__port">:${escapeHtml(port)}</span>` : ""}
    ${note ? `<span class="cx-svc__note">${escapeHtml(note)}</span>` : ""}
  </span>`;
}

/**
 * Pipeline funnel: per stage, how many are done and how many are waiting.
 *
 * Widths come from the stage's own done/waiting pair rather than from a running
 * maximum, so a stage with nothing done renders as visibly empty instead of
 * silently full.
 */
export function funnelBar({ stages, showTotals = true, labelWidth = 116 }) {
  const rows = stages
    .map((stage) => {
      const total = stage.done + stage.waiting;
      const pct = total > 0 ? Math.round((stage.done / total) * 100) : 0;
      return `<div class="cx-funnel__row">
        <span class="cx-funnel__label" style="width:${labelWidth}px">${escapeHtml(stage.label)}</span>
        <span class="cx-funnel__track">
          <span class="cx-funnel__fill" style="width:${pct}%"></span>
        </span>
        ${
          showTotals
            ? `<span class="cx-funnel__totals">${stage.done} / ${total}</span>`
            : ""
        }
      </div>`;
    })
    .join("");
  return `<div class="cx-funnel">${rows}</div>`;
}

/** Scrolling bus log. Duplicated once so the CSS translate loop has no visible seam. */
export function marquee({ items, duration = 44, height = 28 }) {
  const line = items.map((item) => `<span class="cx-marquee__item">${escapeHtml(item)}</span>`).join("");
  return `<div class="cx-marquee" style="height:${height}px">
    <div class="cx-marquee__track" style="animation-duration:${duration}s">${line}${line}</div>
  </div>`;
}

export function button({ label, action = null, value = null, variant = "ghost", disabled = false, title = null }) {
  return `<button type="button" class="cx-btn cx-btn--${variant}"
    ${action ? `data-action="${escapeHtml(action)}"` : ""}
    ${value !== null ? `data-value="${escapeHtml(value)}"` : ""}
    ${disabled ? "disabled" : ""}
    ${title ? `title="${escapeHtml(title)}"` : ""}
  >${escapeHtml(label)}</button>`;
}

export function field({ label, placeholder = "", hint = null, value = "", action = null }) {
  return `<label class="cx-field">
    <span class="cx-field__label">${escapeHtml(label)}</span>
    <input class="cx-field__input" type="text" placeholder="${escapeHtml(placeholder)}"
      value="${escapeHtml(value)}" ${action ? `data-action="${escapeHtml(action)}"` : ""} />
    ${hint ? `<span class="cx-field__hint">${escapeHtml(hint)}</span>` : ""}
  </label>`;
}

export function dropdown({ label, options, value, action = null }) {
  const opts = options
    .map((option) => `<option value="${escapeHtml(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
  return `<label class="cx-field cx-field--select">
    <span class="cx-field__label">${escapeHtml(label)}</span>
    <select class="cx-field__input" ${action ? `data-action="${escapeHtml(action)}"` : ""}>${opts}</select>
  </label>`;
}

/**
 * Navigation rail. `items` carry { id, code, name }; `code` is the three-letter
 * form the collapsed rail shows, which is why the design stores both.
 */
export function rail({ items, active, brand, footer = [], svc = null, expanded = true }) {
  const row = (item) => `<button type="button"
      class="cx-rail__item${item.id === active ? " is-active" : ""}"
      data-action="go-screen" data-value="${escapeHtml(item.id)}" title="${escapeHtml(item.name)}">
      <span class="cx-rail__code">${escapeHtml(item.code)}</span>
      ${expanded ? `<span class="cx-rail__name">${escapeHtml(item.name)}</span>` : ""}
    </button>`;

  return `<nav class="cx-rail${expanded ? "" : " cx-rail--collapsed"}">
    <div class="cx-rail__brand">
      <span class="cx-rail__tag">${escapeHtml(brand.tag)}</span>
      ${expanded ? `<span class="cx-rail__sub">${escapeHtml(brand.sub)}</span>` : ""}
    </div>
    <div class="cx-rail__items">${items.map(row).join("")}</div>
    <div class="cx-rail__footer">
      ${footer.map(row).join("")}
      ${svc && expanded ? `<div class="cx-rail__svc">${escapeHtml(svc)}</div>` : ""}
    </div>
  </nav>`;
}
