// Projects/GRC-v2/grc-v2/kit/kit.js — the GRC v2 component kit: one render function per component, each returns an HTML string.
// Styles: kit/kit.css. Registry and history: components.json. Living catalogue: components.html (renders every function below).
// Started from GRC v1 markup (Projects/GRC-v1/audit-tablet) and changed by Sourav's marks (architecture.md UI-1..UI-14).
// Text styles are set here as app/type.css .t-* classes (the nine ladder classes only, CRAFT-TYPE-001); kit.css sets no font size.
// Standalone: needs nothing but icons.js (for ic()); without it, icons render as empty slots. Every text argument is escaped.
// Common options: `href` makes the element a link; `onclick` is an inline handler string (as the v2 screens write them); `attrs` adds raw attributes.

/* ---------- helpers ---------- */
// kEsc(s) — escape text for HTML (the shell's esc() does the same; the kit keeps its own so the catalogue works without app.js).
const kEsc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// kIcon(name, size = 20) — an Antz icon through icons.js ic(); name is an icons.js key (chev, back, search, filter, table, list …).
const kIcon = (name, size = 20) => (typeof ic === 'function' ? ic(name, size) : `<span class="k-icon-slot" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`);
// internal: an <a> when href is given, else a <button>; extra attributes as a string
const kTagOpen = (o, cls, extra = '') => o.href
  ? `<a class="${cls}" href="${kEsc(o.href)}"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}${extra}${o.attrs ? ' ' + o.attrs : ''}>`
  : `<button type="button" class="${cls}"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}${o.disabled ? ' disabled' : ''}${extra}${o.attrs ? ' ' + o.attrs : ''}>`;
const kTagClose = o => (o.href ? '</a>' : '</button>');
const kList = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

/* ---------- N-01 button ---------- */
// kButton({label, icon, kind, size, brand, block, href, onclick, disabled, attrs})
//   kind: 'secondary' (default, outlined) · 'primary' (filled OnPrimaryContainer, UI-1) · 'ghost' · 'danger'
//   size: 'md' 44 (default) · 'sm' 40 · 'lg' 48 (footers, A11Y-TARGET-001) · brand: true fills Primary instead (only where Sourav says, UI-1)
function kButton(o = {}) {
  const cls = ['k-btn', 't-body-title', 'k-btn--' + (o.kind || 'secondary'), o.size && o.size !== 'md' ? 'k-btn--' + o.size : '', o.brand ? 'k-btn--brand' : '', o.block ? 'k-btn--block' : ''].filter(Boolean).join(' ');
  return kTagOpen(o, cls, o.disabled && o.href ? ' aria-disabled="true"' : '') + (o.icon ? kIcon(o.icon, 20) : '') + (o.label ? `<span>${kEsc(o.label)}</span>` : '') + kTagClose(o);
}
// kIconButton({icon, label, ghost, href, onclick, disabled}) — 44 × 44 icon-only button; label is its accessible name.
function kIconButton(o = {}) {
  return kTagOpen(o, 'k-iconbtn' + (o.ghost ? ' k-iconbtn--ghost' : ''), ` aria-label="${kEsc(o.label || o.icon)}"`) + kIcon(o.icon, 20) + kTagClose(o);
}

/* ---------- C-01 bottom tab bar ---------- */
// kTabBar(items, current) — items: [{key, label, icon, href, badge}]; current: the selected key. badge: a number (count of things to act on).
function kTabBar(items = [], current) {
  return `<nav class="k-tabbar" aria-label="Sections">` + items.map(t => `<a class="k-tabbar__item t-subtext-title${t.key === current ? ' is-on' : ''}" href="${kEsc(t.href || '#/' + t.key)}"${t.key === current ? ' aria-current="page"' : ''}>`
    + kIcon(t.icon, 24) + `<span>${kEsc(t.label)}</span>` + (t.badge ? `<span class="k-tabbar__badge t-subtext-title">${kEsc(t.badge)}</span>` : '') + `</a>`).join('') + `</nav>`;
}

/* ---------- C-03 app bar ---------- */
// kAppBar({title, back, site, actions}) — back: href; site: kSiteSelector label; actions: HTML (kIconButton …). Retired on the tablet (C-03).
function kAppBar(o = {}) {
  return `<header class="k-appbar">` + (o.back ? `<a class="k-ph__back" href="${kEsc(o.back)}" aria-label="Back">${kIcon('back', 24)}</a>` : '')
    + `<span class="k-appbar__t t-medium-medium">${kEsc(o.title)}</span>` + (o.site ? kSiteSelector(o.site) : '') + (o.actions || '') + `</header>`;
}

/* ---------- C-04 site selector ---------- */
// kSiteSelector(label, {onclick}) — the site the page is scoped to ("All sites"); opens the site picker.
function kSiteSelector(label = 'All sites', o = {}) {
  return kTagOpen(o, 'k-site t-body-title', ' aria-haspopup="dialog"') + kIcon('site', 20) + `<span class="k-site__t">${kEsc(label)}</span>` + kIcon('dnc', 20) + kTagClose(o);
}

/* ---------- C-05 FAB and speed dial ---------- */
// kFab({label, icon, open, items, abs, onclick}) — label: accessible name ("Create"); open: show the speed dial;
//   items: [{label, icon, onclick}] (bottom-up order is the caller's); abs: pin to the device's bottom-right corner.
function kFab(o = {}) {
  const fab = `<button type="button" class="k-fab${o.open ? ' is-open' : ''}${o.abs ? ' k-fab--abs' : ''}" aria-label="${kEsc(o.label || 'Create')}" aria-expanded="${o.open ? 'true' : 'false'}"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${kIcon(o.open ? 'x' : (o.icon || 'plus'), 28)}</button>`;
  if (!o.open) return fab;
  const items = kList(o.items).map(i => `<button type="button" class="k-dial__it t-minor-title"${i.onclick ? ` onclick="${kEsc(i.onclick)}"` : ''}><span>${kEsc(i.label)}</span><span class="k-dial__b">${kIcon(i.icon, 24)}</span></button>`).join('');
  return `<div class="k-dial-wrap"><div class="k-dial">${items}</div>${fab}</div>`;
}

/* ---------- C-06 bottom action bar ---------- */
// kActionBar(buttons, {lead}) — buttons: kButton options, left to right (secondary first, the primary last, CRAFT-SURFACE-FORM-001);
//   a button without `kind` is secondary; lead: optional text on the left (a count, a hint). Sits outside the scroll, at the bottom.
function kActionBar(buttons = [], o = {}) {
  return `<footer class="k-actionbar">` + (o.lead ? `<span class="k-actionbar__lead t-body-regular">${kEsc(o.lead)}</span>` : '')
    + kList(buttons).map(b => kButton(Object.assign({ size: 'lg' }, b))).join('') + `</footer>`;
}

/* ---------- C-07 page header band + level-1 tabs ---------- */
// kTabs(items, current) — items: [{key, label, count, href}]; count may be 0; the count chip takes the tab's text colour (UI-4).
function kTabs(items = [], current) {
  return `<nav class="k-tabs" aria-label="Tabs">` + items.map(t => `<a class="k-tabs__t t-minor-title${t.key === current ? ' is-on' : ''}" href="${kEsc(t.href || '#/' + t.key)}"${t.key === current ? ' aria-current="page"' : ''}>`
    + `<span>${kEsc(t.label)}</span>` + (t.count != null ? `<span class="k-tabs__n t-subtext-title">${kEsc(t.count)}</span>` : '') + `</a>`).join('') + `</nav>`;
}
// kPageHeader({title, sub, site, actions, tabs, current}) — the white band at the top of a top-level page.
//   site: label for kSiteSelector (omit for none); actions: HTML on the right (kButton …); tabs + current: level-1 tabs joined to the band.
function kPageHeader(o = {}) {
  const tabs = kList(o.tabs);
  return `<header class="k-ph${tabs.length ? ' has-tabs' : ''}"><div class="k-ph__main"><h1 class="k-ph__title t-major-medium">${kEsc(o.title)}</h1>`
    + (o.sub ? `<p class="k-ph__sub t-body-regular">${kEsc(o.sub)}</p>` : '') + `</div>`
    + (o.site || o.actions ? `<div class="k-ph__act">${o.site ? kSiteSelector(o.site, { onclick: o.siteOnclick }) : ''}${o.actions || ''}</div>` : '') + `</header>`
    + (tabs.length ? kTabs(tabs, o.current) : '');
}

/* ---------- C-08 detail header ---------- */
// kDetailHeader({back, title, pills, id, actions, tabs, current}) — back: href of the parent list; pills: HTML (kPill …) on the right;
//   id: record reference shown after the pills; tabs + current: record tabs. Same top / bottom padding as the page header band (UI-2).
function kDetailHeader(o = {}) {
  const tabs = kList(o.tabs);
  return `<header class="k-ph k-ph--detail${tabs.length ? ' has-tabs' : ''}"><div class="k-ph__main">`
    + (o.back ? `<a class="k-ph__back" href="${kEsc(o.back)}" aria-label="Back">${kIcon('back', 24)}</a>` : '')
    + `<h1 class="k-ph__title t-major-medium">${kEsc(o.title)}</h1></div>`
    + (o.pills || o.id || o.actions ? `<div class="k-ph__tags">${o.pills || ''}${o.id ? `<span class="t-body-medium">${kEsc(o.id)}</span>` : ''}${o.actions || ''}</div>` : '') + `</header>`
    + (tabs.length ? kTabs(tabs, o.current) : '');
}

/* ---------- C-09 task header ---------- */
// kTaskHeader({back, title, line, actions}) — the header of a task page (session screen, editors): title + one task line.
//   line: array of short facts joined by " · " ("Cold Chain Log", "Due 17:00", "3 entities"); same padding as the page header band (UI-2).
function kTaskHeader(o = {}) {
  return `<header class="k-ph k-ph--detail"><div class="k-ph__main">`
    + (o.back ? `<a class="k-ph__back" href="${kEsc(o.back)}" aria-label="Back">${kIcon('back', 24)}</a>` : '')
    + `<div class="k-ph__stack"><h1 class="k-ph__title t-major-medium">${kEsc(o.title)}</h1>`
    + (kList(o.line).length ? `<p class="k-ph__line t-body-medium">${kList(o.line).map(x => `<span>${kEsc(x)}</span>`).join('')}</p>` : '') + `</div></div>`
    + (o.actions ? `<div class="k-ph__act">${o.actions}</div>` : '') + `</header>`;
}

/* ---------- C-19 status pill · C-22 outcome pill ---------- */
// kPill(text, tone) — tone: '' (neutral: Upcoming, Cancelled, Paused) · 'ok' (Done) · 'info' (Open, In progress) · 'warn' (Done late, Due soon)
//   · 'attn' (needs attention) · 'bad' (Missed, Overdue, High). No dot; light background, dark text (UI-6).
function kPill(text, tone = '') {
  return `<span class="k-pill t-body-medium${tone ? ' k-pill--' + tone : ''}">${kEsc(text)}</span>`;
}
// kStatusPill(status) — the six session statuses of A-20 (upcoming · open · done · late · missed · cancelled) as kPill.
const K_STATUS = { upcoming: ['Upcoming', ''], open: ['Open', 'info'], done: ['Done', 'ok'], late: ['Done late', 'warn'], missed: ['Missed', 'bad'], cancelled: ['Cancelled', ''] };
function kStatusPill(status) { const s = K_STATUS[status] || [status, '']; return kPill(s[0], s[1]); }
// kOutcome(outcome) — an answer's outcome (A-27): 'good' · 'partial' · 'bad' · 'na' (Not counted); null/'' → "Not answered" as plain text.
const K_OUT = { good: ['Good', 'ok'], partial: ['Partial', 'warn'], bad: ['Bad', 'bad'], na: ['Not counted', ''] };
function kOutcome(outcome) {
  return K_OUT[outcome] ? kPill(K_OUT[outcome][0], K_OUT[outcome][1]) : `<span class="k-quiet t-body-regular">Not answered</span>`;
}

/* ---------- C-21 tag ---------- */
// kTag(text, {href, onclick}) — clause code, version, section number; with href / onclick it is a link chip (32 high, 44 hit area).
function kTag(text, o = {}) {
  if (o.href || o.onclick) return kTagOpen(o, 'k-tag t-subtext-title') + kEsc(text) + kTagClose(o);
  return `<span class="k-tag t-subtext-title">${kEsc(text)}</span>`;
}

/* ---------- C-10 / C-12 / C-13 row card ---------- */
// kRowCard({icon, tone, title, meta, facts, tags, status, action, href, onclick, chev}) — one item = one card (UI-3, UI-12).
//   icon + tone ('ok' 'info' 'warn' 'bad'): 40px leading chip; title: name; meta: one detail line (string or array joined by " · ");
//   facts: [{label, value}] small right-aligned stacks ("Due" / "30 Sep"); tags: HTML (kTag …); status: HTML (kPill …);
//   action: kButton options for a row button (My work); chev: true shows the chevron (default when href / onclick).
function kRowCard(o = {}) {
  const meta = Array.isArray(o.meta) ? o.meta.filter(Boolean).join(' · ') : o.meta;
  const nav = o.href || o.onclick;
  const inner = (o.icon ? `<span class="k-rowcard__ico${o.tone ? ' k-rowcard__ico--' + o.tone : ''}">${kIcon(o.icon, 20)}</span>` : '')
    + `<span class="k-rowcard__main"><span class="k-rowcard__t t-minor-title">${kEsc(o.title)}</span>${meta ? `<span class="k-rowcard__meta t-body-regular">${kEsc(meta)}</span>` : ''}</span>`
    + (o.tags || o.facts || o.status || o.action ? `<span class="k-rowcard__side">${o.tags || ''}${kList(o.facts).map(f => `<span class="k-rowcard__fact"><span class="t-subtext-regular">${kEsc(f.label)}</span><span class="t-body-title">${kEsc(f.value)}</span></span>`).join('')}${o.status || ''}${o.action ? kButton(Object.assign({ size: 'sm' }, o.action)) : ''}</span>` : '')
    + ((o.chev ?? (nav && !o.action)) ? `<span class="k-rowcard__chev">${kIcon('chev', 20)}</span>` : '');
  if (o.href && !o.action) return `<a class="k-rowcard" href="${kEsc(o.href)}">${inner}</a>`;
  return `<div class="k-rowcard"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${inner}</div>`;
}
// kCards(htmlList) — a stack of row cards, 12 apart (CRAFT-SURFACE-TABLE-001).
function kCards(list) { return `<div class="k-cards">${kList(list).join('')}</div>`; }

/* ---------- C-14 data table + view switch ---------- */
// kTable({cols, rows, onRow}) — cols: [{key, label, align:'right', width, html:true}]; rows: [{…values, _href, _onclick}];
//   a cell is escaped text unless its column has html: true (pills, tags). Wide tables scroll inside their card.
function kTable(o = {}) {
  const cols = kList(o.cols);
  const head = `<thead><tr>${cols.map(c => `<th class="t-subtext-title${c.align === 'right' ? ' is-r' : ''}"${c.width ? ` style="width:${kEsc(c.width)}"` : ''}>${kEsc(c.label)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${kList(o.rows).map(r => `<tr${r._onclick ? ` onclick="${kEsc(r._onclick)}"` : r._href ? ` data-href="${kEsc(r._href)}" onclick="location.hash=this.dataset.href"` : ''}>`
    + cols.map((c, i) => `<td class="${i === 0 ? 't-body-title' : 't-body-regular'}${c.align === 'right' ? ' is-r' : ''}">${c.html ? (r[c.key] ?? '') : `<span class="k-one">${kEsc(r[c.key] ?? '—')}</span>`}</td>`).join('') + `</tr>`).join('')}</tbody>`;
  return `<div class="k-table-wrap"><table class="k-table">${head}${body}</table></div>`;
}
// kViewSwitch(current, {onpick}) — Cards / Table, icon only (UI-5). current: 'cards' | 'table'; onpick: name of a function called with the key.
function kViewSwitch(current = 'cards', o = {}) {
  const b = (k, icon, label) => `<button type="button" class="k-vsw__b${k === current ? ' is-on' : ''}" aria-pressed="${k === current}" aria-label="${label}" title="${label}"${o.onpick ? ` onclick="${kEsc(o.onpick)}('${k}')"` : ''}>${kIcon(icon, 20)}</button>`;
  return `<div class="k-vsw" role="group" aria-label="View">${b('cards', 'list', 'Cards')}${b('table', 'table', 'Table')}</div>`;
}

/* ---------- C-15 white container and section header ---------- */
// kCard({title, eyebrow, action, body, pad}) — a white container. title: section heading (.t-medium-medium); eyebrow: small caption above it;
//   action: HTML on the right of the heading; body: HTML; pad: 'md' 16 (default) · 'lg' 24 · 'none'.
function kCard(o = {}) {
  const pad = o.pad === 'none' ? '' : o.pad === 'lg' ? ' k-card--roomy' : ' k-card--pad';
  const h = o.title || o.action ? `<div class="k-card__h"><div>${o.eyebrow ? `<span class="k-card__eyebrow t-subtext-title">${kEsc(o.eyebrow)}</span>` : ''}${o.title ? `<h2 class="t-medium-medium">${kEsc(o.title)}</h2>` : ''}</div>${o.action || ''}</div>` : '';
  return `<section class="k-card${pad}">${h}${o.body || ''}</section>`;
}

/* ---------- C-16 area tile · C-17 KPI tile ---------- */
// kAreaTile({label, value, sub, icon, href, onclick}) — a module area with its headline number (no dot, UI-6). Put several in kTiles().
function kAreaTile(o = {}) {
  const inner = `<span class="k-tile__h">${o.icon ? `<span class="k-tile__ico">${kIcon(o.icon, 20)}</span>` : ''}<span class="t-body-title">${kEsc(o.label)}</span></span>`
    + `<span class="k-tile__n t-major-medium">${kEsc(o.value)}</span>${o.sub ? `<span class="k-tile__sub t-body-regular">${kEsc(o.sub)}</span>` : ''}`;
  return o.href ? `<a class="k-tile" href="${kEsc(o.href)}">${inner}</a>` : `<div class="k-tile"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${inner}</div>`;
}
// kKpi({label, value, unit, sub, tone, trend}) — one figure: caption, number (+ unit), one line under it.
//   tone: 'bad' | 'attn' colours the number only (≥ 3:1 at 24px); trend: HTML (kMiniBars …) beside the line.
function kKpi(o = {}) {
  return `<div class="k-tile k-kpi"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}><span class="k-kpi__label t-subtext-title">${kEsc(o.label)}</span>`
    + `<span class="k-tile__n t-major-medium${o.tone ? ' k-num--' + o.tone : ''}">${kEsc(o.value)}${o.unit ? `<small class="t-body-medium">${kEsc(o.unit)}</small>` : ''}</span>`
    + (o.sub || o.trend ? `<span class="k-tile__sub t-body-regular">${o.trend || ''}${kEsc(o.sub || '')}</span>` : '') + `</div>`;
}
// kTiles(htmlList, cols = 3) — a grid of tiles (KPI / area), 12 apart; 3 across on the tablet (CRAFT-LAYOUT-001).
function kTiles(list, cols = 3) { return `<div class="k-tiles"${cols !== 3 ? ` style="grid-template-columns:repeat(${+cols},minmax(0,1fr))"` : ''}>${kList(list).join('')}</div>`; }

/* ---------- C-18 audit card ---------- */
// kAuditCard({name, about, status, facts, sections, href, onclick}) — an audit in the Audits list.
//   status: HTML (kPill); facts: up to 4 [{label, value}] in the strip (information-design §2.4); sections: array of section names.
function kAuditCard(o = {}) {
  const inner = `<div class="k-acard__h"><div><span class="t-minor-title">${kEsc(o.name)}</span>${o.about ? `<span class="t-body-regular">${kEsc(o.about)}</span>` : ''}</div>${o.status || ''}</div>`
    + (kList(o.facts).length ? `<div class="k-acard__strip">${kList(o.facts).slice(0, 4).map(f => `<div><span class="t-subtext-regular">${kEsc(f.label)}</span><span class="t-minor-title">${kEsc(f.value)}</span></div>`).join('')}</div>` : '')
    + (kList(o.sections).length ? `<div class="k-acard__secs t-body-regular">${kList(o.sections).map(s => `<span>${kEsc(s)}</span>`).join('')}</div>` : '');
  return o.href ? `<a class="k-acard" href="${kEsc(o.href)}">${inner}</a>` : `<div class="k-acard"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${inner}</div>`;
}

/* ---------- C-23 entity card ---------- */
// kEntityCard({name, kind, site, icon, pct, result}) — an entity a session checks (enclosure, kitchen, animal group).
//   kind / site: detail line; pct: progress 0..100 shown as a ring; result: HTML (kOutcome / kPill) on the right.
function kEntityCard(o = {}) {
  return `<div class="k-ecard"><span class="k-rowcard__ico">${kIcon(o.icon || 'site', 20)}</span><span class="k-ecard__main"><span class="t-minor-title">${kEsc(o.name)}</span>`
    + `<span class="t-body-regular">${kEsc([o.kind, o.site].filter(Boolean).join(' · '))}</span></span>`
    + (o.pct != null || o.result ? `<span class="k-ecard__side">${o.pct != null ? kRing(o.pct, 36) : ''}${o.result || ''}</span>` : '') + `</div>`;
}

/* ---------- C-24 progress ring and section tick ---------- */
// kRing(pct, size = 36, {tone, label, sub}) — progress ring; sub: a second line under the label; tone: '' (Primary) | 'warn' | 'bad'; label: text in the centre
//   (default "pct%" for size ≥ 56, none below 32). Sizes in use: 28 (section), 36 (row), 120 (overview).
function kRing(pct, size = 36, o = {}) {
  const p = Math.max(0, Math.min(100, +pct || 0)), sw = size >= 96 ? 10 : size >= 56 ? 6 : 4, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const label = o.label ?? (size >= 32 ? p + '%' : '');
  const cls = size >= 96 ? 't-medium-medium' : 't-subtext-title';
  return `<span class="k-ring${o.tone ? ' k-ring--' + o.tone : ''}" style="width:${size}px;height:${size}px" role="img" aria-label="${p}%">`
    + `<svg width="${size}" height="${size}"><circle class="k-ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/>`
    + `<circle class="k-ring__arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(2)} ${c.toFixed(2)}"/></svg>`
    + (label !== '' ? `<span class="k-ring__c"><span class="${cls}">${kEsc(label)}</span>${o.sub ? `<span class="t-subtext-regular">${kEsc(o.sub)}</span>` : ''}</span>` : '') + `</span>`;
}
// kTick(on = true) — a finished section's tick (28px); off: the empty circle.
function kTick(on = true) { return `<span class="k-tick${on ? '' : ' k-tick--off'}" role="img" aria-label="${on ? 'Complete' : 'Not complete'}">${on ? kIcon('check', 16) : ''}</span>`; }

/* ---------- C-25 progress, stacked and mini bars ---------- */
// kBars(parts, {label}) — one bar 8 high. parts: a number (simple progress %) or [{pct, tone}] stacked left to right,
//   tone '' (Primary) · 'warn' · 'bad' · 'none'; label: accessible text.
function kBars(parts, o = {}) {
  const ps = typeof parts === 'number' ? [{ pct: parts }] : kList(parts);
  return `<div class="k-bar" role="img" aria-label="${kEsc(o.label || ps.map(p => p.pct + '%').join(', '))}">${ps.map(p => `<i class="${p.tone ? 'is-' + p.tone : ''}" style="width:${Math.max(0, Math.min(100, +p.pct || 0))}%"></i>`).join('')}</div>`;
}
// kMiniBars(values, {max, bad}) — a small trend of 4–8 values (28 high); the last bar is Primary; bad: indexes drawn in Error.
function kMiniBars(values = [], o = {}) {
  const max = o.max || Math.max(1, ...values), bad = kList(o.bad);
  return `<span class="k-mini" role="img" aria-label="Trend ${kEsc(values.join(', '))}">${values.map((v, i) => `<i class="${bad.includes(i) ? 'is-bad' : ''}" style="height:${Math.max(8, Math.round(28 * v / max))}px"></i>`).join('')}</span>`;
}

/* ---------- C-26 stat strip ---------- */
// kStatStrip(items, {current, onpick}) — one card, equal cells. items: [{key, label, value, tone}] (tone 'bad' | 'attn' colours the number);
//   with onpick (a function name) the cells are buttons and `current` is the chosen filter (Surface tint + Primary underline).
function kStatStrip(items = [], o = {}) {
  return `<div class="k-strip">${kList(items).map(s => {
    const inner = `<span class="k-strip__n t-medium-medium${s.tone ? ' k-num--' + s.tone : ''}">${kEsc(s.value)}</span><span class="t-body-regular">${kEsc(s.label)}</span>`;
    return o.onpick ? `<button type="button" class="k-strip__c${s.key === o.current ? ' is-on' : ''}" aria-pressed="${s.key === o.current}" onclick="${kEsc(o.onpick)}('${kEsc(s.key)}')">${inner}</button>` : `<div class="k-strip__c">${inner}</div>`;
  }).join('')}</div>`;
}

/* ---------- C-27 list toolbar · C-36 run toolbar ---------- */
// kSearch({placeholder, value, oninput, attrs}) — the search box (44 high, radius 8). attrs go on the <input>.
function kSearch(o = {}) {
  return `<label class="k-search">${kIcon('search', 20)}<input class="t-minor-regular" type="search" placeholder="${kEsc(o.placeholder || 'Search')}" value="${kEsc(o.value || '')}"${o.oninput ? ` oninput="${kEsc(o.oninput)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}></label>`;
}
// kFilterButton({label, value, on, onclick}) — "Audit: All" opens its picker sheet; on: a filter is set (Surface fill, Primary border).
//   Text in OnSurfaceVariant (C-14 mark).
function kFilterButton(o = {}) {
  return `<button type="button" class="k-fbtn t-body-title${o.on ? ' is-on' : ''}" aria-haspopup="dialog"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${kEsc(o.label)}${o.value != null ? ': ' + kEsc(o.value) : ''}${kIcon('dnc', 20)}</button>`;
}
// kChip(text, {on, remove, onclick}) — a chip, radius 8. on: chosen; remove: shows ✕ (an active filter that clears on tap).
function kChip(text, o = {}) {
  return `<button type="button" class="k-chip t-body-medium${o.on ? ' is-on' : ''}"${o.on != null ? ` aria-pressed="${!!o.on}"` : ''}${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${kEsc(text)}${o.remove ? `<span class="k-chip__x" aria-label="Remove">${kIcon('x', 16)}</span>` : ''}</button>`;
}
// kToolbar({search, filters, chips, count, view, left, right, clear}) — fixed under the app bar, edge to edge, 75% white (UI-7).
//   search: kSearch options; filters: [kFilterButton options]; chips: [{text, onclick}] active filters (+ Clear all via clear: onclick);
//   count: "10 findings"; view: {current, onpick} for kViewSwitch; left / right: extra HTML (the run toolbar puts kSegment, icon buttons here).
function kToolbar(o = {}) {
  const row1 = (o.search ? kSearch(o.search) : '') + (o.left || '') + kList(o.filters).map(kFilterButton).join('')
    + (o.count || o.view || o.right ? `<span class="k-toolbar__grow"></span>` : '') + (o.count ? `<span class="k-toolbar__count t-body-regular">${kEsc(o.count)}</span>` : '')
    + (o.right || '') + (o.view ? kViewSwitch(o.view.current, o.view) : '');
  const chips = kList(o.chips);
  const row2 = chips.length ? `<div class="k-toolbar__row">${chips.map(c => kChip(c.text, { on: true, remove: true, onclick: c.onclick })).join('')}${o.clear ? kButton({ label: 'Clear all', kind: 'ghost', size: 'sm', onclick: o.clear }) : ''}</div>` : '';
  return `<div class="k-toolbar" role="toolbar"><div class="k-toolbar__row">${row1}</div>${row2}</div>`;
}

/* ---------- C-28 segmented control ---------- */
// kSegment(items, current, {onpick, size}) — items: strings or [{key, label, count, icon}]; current: selected key;
//   onpick: name of a function called with the key; size 'lg' for 40-high items. Count takes the label's colour (UI-4).
function kSegment(items = [], current, o = {}) {
  const it = kList(items).map(x => (typeof x === 'string' ? { key: x, label: x } : x));
  return `<div class="k-seg${o.size === 'lg' ? ' k-seg--lg' : ''}" role="group">${it.map(x => `<button type="button" class="k-seg__b t-body-medium${x.key === current ? ' is-on' : ''}" aria-pressed="${x.key === current}"${o.onpick ? ` onclick="${kEsc(o.onpick)}('${kEsc(x.key)}')"` : ''}>`
    + (x.icon ? kIcon(x.icon, 20) : '') + (x.label ? `<span>${kEsc(x.label)}</span>` : '') + (x.count != null ? `<span class="k-seg__n t-subtext-title">${kEsc(x.count)}</span>` : '') + `</button>`).join('')}</div>`;
}

/* ---------- C-45 corrective action card ---------- */
// kActionCard({title, status, owner, due, note, actions}) — one corrective action inside a finding (A-7).
//   status: HTML (kPill); actions: [kButton options] on the bottom right.
function kActionCard(o = {}) {
  return `<div class="k-actcard"><div class="k-actcard__h"><div><span class="t-subtext-title k-kpi__label">Corrective action</span><span class="t-minor-title">${kEsc(o.title)}</span></div>${o.status || ''}</div>`
    + kKV([['Owner', o.owner || '—'], ['Due', o.due || '—']].concat(o.note ? [['Note', o.note]] : []))
    + (kList(o.actions).length ? `<div class="k-actcard__f">${kList(o.actions).map(b => kButton(Object.assign({ size: 'sm' }, b))).join('')}</div>` : '') + `</div>`;
}

/* ---------- C-46 evidence thumbnails ---------- */
// kThumbs(items) — items: [{kind:'photo'|'doc', caption, on}] in a 4-across grid; on: selected (2px Primary frame).
function kThumbs(items = []) {
  return `<div class="k-thumbs">${kList(items).map(t => `<div class="k-thumb k-thumb--${t.kind === 'doc' ? 'doc' : 'photo'}${t.on ? ' is-on' : ''}" role="img" aria-label="${kEsc(t.caption || t.kind)}">${kIcon(t.kind === 'doc' ? 'file' : 'cam', 28)}${t.caption ? `<span class="k-thumb__cap t-subtext-title">${kEsc(t.caption)}</span>` : ''}</div>`).join('')}</div>`;
}

/* ---------- C-47 activity timeline ---------- */
// kTimeline(items) — newest first: [{title, text, current}]; title: "Reopened · 5 Oct 10:20 · Priya"; current: the latest step (Primary node).
function kTimeline(items = []) {
  return `<ol class="k-tl">${kList(items).map(i => `<li class="k-tl__i${i.current ? ' is-cur' : ''}"><span class="t-body-title">${kEsc(i.title)}</span>${i.text ? `<span class="t-body-regular">${kEsc(i.text)}</span>` : ''}</li>`).join('')}</ol>`;
}

/* ---------- C-48 sheet shell + option rows ---------- */
// kSheet({title, sub, body, foot, lead, close, grab}) — bottom sheet: header / body (only this scrolls) / footer (CRAFT-SHEET-001).
//   body, foot: HTML (foot usually kButton … secondary first, primary last); lead: text left in the footer ("3 selected");
//   close: onclick for the ✕ (omit to hide); grab: false hides the handle. Wrap in kScrim() to show it over a page.
function kSheet(o = {}) {
  return `<div class="k-sheet" role="dialog" aria-modal="true" aria-label="${kEsc(o.title)}">${o.grab === false ? '' : '<span class="k-sheet__grab"></span>'}`
    + `<div class="k-sheet__h"><div><h2 class="t-medium-medium">${kEsc(o.title)}</h2>${o.sub ? `<p class="t-body-regular">${kEsc(o.sub)}</p>` : ''}</div>${o.close ? kIconButton({ icon: 'x', label: 'Close', ghost: true, onclick: o.close }) : ''}</div>`
    + `<div class="k-sheet__b">${o.body || ''}</div>` + (o.foot || o.lead ? `<div class="k-sheet__f">${o.lead ? `<span class="k-sheet__lead t-body-medium">${kEsc(o.lead)}</span>` : ''}${o.foot || ''}</div>` : '') + `</div>`;
}
// kScrim(html) — the dimmed layer a sheet sits on, inside the device frame.
function kScrim(html) { return `<div class="k-scrim">${html}</div>`; }
// kOption({type, icon, title, sub, on, onclick}) — a row inside a sheet. type: 'nav' (icon + chevron, e.g. the Create menu) ·
//   'radio' (single choice, C-51) · 'check' (multi-select, C-50). on: chosen. Stack several in kOptions().
function kOption(o = {}) {
  const lead = o.type === 'check' ? `<span class="k-box">${kIcon('check', 16)}</span>` : o.type === 'radio' ? '<span class="k-radio"></span>' : o.icon ? `<span class="k-opt__ico">${kIcon(o.icon, 20)}</span>` : '';
  const role = o.type === 'check' ? 'checkbox' : o.type === 'radio' ? 'radio' : '';
  return `<button type="button" class="k-opt${o.on ? ' is-on' : ''}"${role ? ` role="${role}" aria-checked="${!!o.on}"` : ''}${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}>${lead}`
    + `<span class="k-opt__main"><span class="t-minor-title">${kEsc(o.title)}</span>${o.sub ? `<span class="t-body-regular">${kEsc(o.sub)}</span>` : ''}</span>${o.type === 'nav' || (!o.type && o.icon) ? `<span class="k-rowcard__chev">${kIcon('chev', 20)}</span>` : ''}</button>`;
}
function kOptions(list) { return `<div class="k-opts">${kList(list).join('')}</div>`; }

/* ---------- C-49 / C-55 full-page form ---------- */
// kSteps(steps, current) — step bar: steps: labels; current: index (0-based) of the step in hand; earlier steps are done.
function kSteps(steps = [], current = 0) {
  return `<ol class="k-steps">${kList(steps).map((s, i) => `<li class="k-steps__s t-subtext-title${i < current ? ' is-done' : i === current ? ' is-cur' : ''}"${i === current ? ' aria-current="step"' : ''}><i></i><span>${i + 1} · ${kEsc(s)}</span></li>`).join('')}</ol>`;
}
// kField({label, hint, type, value, placeholder, options, error, attrs}) — label above the field (D6), radius 8 (D8), 44 high on the tablet.
//   type: 'text' (default) · 'textarea' · 'select' (a button that opens a picker sheet; shows value or placeholder) · 'date' · 'time' · 'number';
//   hint: extra info beside the label ("Optional"); error: message under the field.
function kField(o = {}) {
  const t = o.type || 'text', a = o.attrs ? ' ' + o.attrs : '';
  const ctl = t === 'textarea' ? `<textarea class="k-inp t-minor-regular" placeholder="${kEsc(o.placeholder || '')}"${a}>${kEsc(o.value || '')}</textarea>`
    : t === 'select' ? `<button type="button" class="k-inp k-sel t-minor-regular" aria-haspopup="dialog"${o.onclick ? ` onclick="${kEsc(o.onclick)}"` : ''}${a}><span>${kEsc(o.value || o.placeholder || 'Select')}</span>${kIcon('dnc', 20)}</button>`
    : `<input class="k-inp t-minor-regular" type="${kEsc(t)}" value="${kEsc(o.value || '')}" placeholder="${kEsc(o.placeholder || '')}"${a}>`;
  return `<label class="k-field${o.error ? ' is-error' : ''}"><span class="k-field__l"><span class="t-body-title">${kEsc(o.label)}</span>${o.hint ? `<span class="k-field__hint t-body-regular">${kEsc(o.hint)}</span>` : ''}</span>${ctl}${o.error ? `<span class="k-field__err t-body-regular">${kEsc(o.error)}</span>` : ''}</label>`;
}
// kChoice(items, selected, {onpick}) — a chip choice group (radius 8, 44 high). items: strings or [{key, label}];
//   selected: a key or an array of keys (multi); onpick: function name called with the key.
function kChoice(items = [], selected, o = {}) {
  const sel = kList(selected), it = kList(items).map(x => (typeof x === 'string' ? { key: x, label: x } : x));
  return `<div class="k-choice" role="group">${it.map(x => kChip(x.label, { on: sel.includes(x.key), onclick: o.onpick ? `${o.onpick}('${x.key}')` : '' })).join('')}</div>`;
}
// kFormSection(title, fields) — one section of a form: heading + fields 12 apart; sections are 24 apart. fields: HTML list;
//   wrap two paired fields (from / to) in kPair().
function kFormSection(title, fields) { return `<section class="k-form__sec">${title ? `<h2 class="t-medium-medium">${kEsc(title)}</h2>` : ''}${kList(fields).join('')}</section>`; }
function kPair(a, b) { return `<div class="k-form__pair">${a}${b}</div>`; }
// kFormPage({back, title, line, steps, current, body, buttons, lead}) — a multi-step or long form as a full page (UI-8, T1.7):
//   task header, step bar, body (kFormSection …), sticky action bar (buttons: kButton options; lead: text on the left).
function kFormPage(o = {}) {
  return `<div class="k-form">${kTaskHeader({ back: o.back, title: o.title, line: o.line })}`
    + (kList(o.steps).length ? `<div class="k-form__steps">${kSteps(o.steps, o.current)}</div>` : '')
    + `<div class="k-form__body">${o.body || ''}</div>${kActionBar(o.buttons || [], { lead: o.lead })}</div>`;
}

/* ---------- C-59 key-value list ---------- */
// kKV(obj) — an object {label: value} or an array of [label, value] pairs; empty values show "—" (CRAFT-SURFACE-DETAIL-001).
function kKV(obj = {}) {
  const pairs = Array.isArray(obj) ? obj : Object.entries(obj);
  return `<dl class="k-kv">${pairs.map(([k, v]) => `<dt class="t-body-regular">${kEsc(k)}</dt><dd class="t-body-medium">${kEsc(v === '' || v == null ? '—' : v)}</dd>`).join('')}</dl>`;
}

/* ---------- C-60 trend bars and bar rows ---------- */
// kTrend(values, labels) — score by session: one bar per value (0..100), label under each; the latest bar is Primary.
function kTrend(values = [], labels = []) {
  return `<div class="k-trend" role="img" aria-label="Trend ${kEsc(values.join(', '))}">${values.map((v, i) => `<div class="k-trend__c"><span class="t-subtext-title">${kEsc(v)}%</span><i style="height:${Math.max(4, Math.round(80 * v / 100))}px"></i><span class="t-subtext-regular">${kEsc(labels[i] || '')}</span></div>`).join('')}</div>`;
}
// kBarRows(rows) — [{label, pct, value, tone}]: a ranked list (most-failed questions, by standard); value: text at the right (default pct%).
function kBarRows(rows = []) {
  return `<div class="k-barrows">${kList(rows).map(r => `<div class="k-barrow"><span class="k-barrow__t t-body-regular">${kEsc(r.label)}</span>${kBars([{ pct: r.pct, tone: r.tone }])}<span class="k-barrow__n t-body-title">${kEsc(r.value ?? r.pct + '%')}</span></div>`).join('')}</div>`;
}

/* ---------- C-62 empty state ---------- */
// kEmpty({kind, icon, text, action}) — kind: 'none' (nothing exists yet; offer the action) · 'filtered' (nothing matches; offer Clear) ·
//   'error' (failed to load; offer Retry). Three kinds, three different sentences (T1.8). action: HTML (kButton).
function kEmpty(o = {}) {
  const icon = o.icon || (o.kind === 'filtered' ? 'search' : o.kind === 'error' ? 'alert' : 'list');
  return `<div class="k-empty${o.kind === 'error' ? ' k-empty--error' : ''}"${o.kind === 'error' ? ' role="alert"' : ''}><span class="k-empty__ico">${kIcon(icon, 24)}</span><span class="t-body-regular">${kEsc(o.text)}</span>${o.action || ''}</div>`;
}

/* ---------- C-63 toast ---------- */
// kToast(text, {icon}) — the confirmation line after an action (the shell's toast() shows and hides it).
function kToast(text, o = {}) { return `<div class="k-toast t-body-medium" role="status">${o.icon ? kIcon(o.icon, 20) : ''}<span>${kEsc(text)}</span></div>`; }
