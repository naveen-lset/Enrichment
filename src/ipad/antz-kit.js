// src/ipad/antz-kit.js — the Antz tablet components of Components.md (procurement tablet kit), written as plain functions that
// return HTML strings, so this app (no framework) uses the same parts: Btn, Tag, LinkBtn, IconTile, Avatar, Card, Section, KV,
// Note, EmptyState, ListBar, Chips, Fab, RecordCard, Timeline, Stepper, TaskTile, StatusFoot, ApproverRow, EndCard,
// DecisionButtons, ResultBanner, AppBar, CountTabs, BottomNav, Cols, PickRow. Styles: antz-kit.css (class prefix "ak-").
// Actions use the app's data-do / data-go attributes. Colours come only from the Antz tokens.

const akAct = o => o.go ? `data-go="${o.go}"` : o.do ? `data-do="${o.do}" data-arg="${esc(o.arg ?? '')}"` : '';

/* ---------- buttons and small pieces ---------- */
// Btn(label, {kind: pri | teal | sec | danger | ghost, icon, small, disabled, do, arg, go})
const Btn = (label, o = {}) => `<button class="ak-btn ak-btn--${o.kind || 'sec'} ${o.small ? 'ak-btn--sm' : ''}" ${akAct(o)} ${o.disabled ? 'disabled' : ''}>${o.icon ? ic(o.icon, o.small ? 16 : 18) : ''}<span>${esc(label)}</span></button>`;
// Tag(text, tone: good | info | wait | bad | none, {do, arg, go}) — with an action it is an underlined link
const Tag = (text, tone = 'none', o = {}) => `<span class="ak-tag ak-tag--${tone} ${o.do || o.go ? 'ak-tag--link' : ''}" ${akAct(o)}>${esc(text)}</span>`;
const LinkBtn = (label, o = {}) => `<button class="ak-link" ${akAct(o)}>${o.icon ? ic(o.icon, 16) : ''}<span>${esc(label)}</span>${o.icon ? '' : ic('right', 16)}</button>`;
// IconTile(icon, {size, tone: 'brand' | 'soft' | 'wait' | 'bad' | 'good'})
const IconTile = (icon, o = {}) => { const s = o.size || 36; return `<span class="ak-itile ak-itile--${o.tone || 'soft'}" style="width:${s}px;height:${s}px">${ic(icon, Math.round(s * .55))}</span>`; };
const Avatar = (id, size = 40) => { const p = person(id); if (!p) return ''; const n = p.name.replace(/^Dr\.\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); return `<span class="ak-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${n}</span>`; };

/* ---------- cards and layout ---------- */
const Card = (body, cls = '') => `<div class="ak-card ${cls}">${body}</div>`;
// Section({title, count, sub, right, flush}, body) — the titled white card of every detail page ("Title - 5")
const Section = (o, body) => `<section class="ak-sec ${o.flush ? 'ak-sec--flush' : ''}">${o.title || o.right ? `<div class="ak-sec__h"><div class="ak-sec__hb">${o.title ? `<div class="ak-sec__t">${esc(o.title)}${o.count != null ? ` - ${o.count}` : ''}</div>` : ''}${o.sub ? `<div class="ak-sec__s">${o.sub}</div>` : ''}</div>${o.right || ''}</div>` : ''}<div class="ak-sec__b">${body}</div></section>`;
// KV([[label, value]]) — labelled values in two columns; falsy rows are skipped
const KV = rows => `<div class="ak-kv">${rows.filter(Boolean).map(([k, v]) => `<div class="ak-kv__r"><div class="ak-kv__k">${esc(k)}</div><div class="ak-kv__v">${v}</div></div>`).join('')}</div>`;
// Note({tone: info | warn | bad, icon, title}, body, actions) — only for things that need attention
const Note = (o, body = '', actions = '') => `<div class="ak-note ak-note--${o.tone || 'info'}">${o.icon ? `<span class="ak-note__i">${ic(o.icon, 20)}</span>` : ''}<div class="ak-note__b">${o.title ? `<div class="ak-note__t">${esc(o.title)}</div>` : ''}${body ? `<div class="ak-note__x">${body}</div>` : ''}</div>${actions ? `<div class="ak-note__a">${actions}</div>` : ''}</div>`;
const EmptyState = (text, sub = '', icon = 'search', action = '') => `<div class="ak-empty"><span class="ak-empty__i">${ic(icon, 28)}</span><div class="ak-empty__t">${esc(text)}</div>${sub ? `<div class="ak-empty__s">${esc(sub)}</div>` : ''}${action}</div>`;
// ListBar(title, count, right) — a list title on the left, a slot for search or buttons on the right
const ListBar = (title, count, right = '') => `<div class="ak-listbar"><div class="ak-listbar__t">${esc(title)}${count != null ? ` - ${count}` : ''}</div><div class="ak-listbar__r">${right}</div></div>`;
// Cols(main, side) — 3 : 2 in landscape, one column in portrait
const Cols = (main, side) => `<div class="ak-cols"><div class="ak-cols__m">${main}</div><div class="ak-cols__s">${side}</div></div>`;
const CardGrid = cards => `<div class="ak-grid">${cards}</div>`;

/* ---------- lists ---------- */
// Chips([{key, label, count}], value, act) — a sideways-scrolling filter row, "Label - n"
const Chips = (chips, value, act) => `<div class="ak-chips">${chips.map(c => `<button class="ak-chip ${c.key === value ? 'on' : ''}" data-do="${act}" data-arg="${esc(c.key)}" aria-pressed="${c.key === value}">${esc(c.label)}${c.count != null ? ` - ${c.count}` : ''}</button>`).join('')}</div>`;
// Fab(label, act) — the round "+" at the bottom right of a list
const Fab = (label, o) => `<button class="ak-fab" aria-label="${esc(label)}" ${akAct(o)}>${ic('plus', 28)}</button>`;
// RecordCard({icon, tileTone, heading, meta, text, chips, band, label, when, go, on}) — Figma "All Request cards"
// bands: wait · yours · approved · progress · completed · rejected · cancelled · none
const RecordCard = o => `<button class="ak-rec ${o.on ? 'on' : ''}" ${akAct(o)}>
  <span class="ak-rec__top">${IconTile(o.icon, { size: 40, tone: o.tileTone || 'soft' })}<span class="ak-rec__hb"><span class="ak-rec__h">${esc(o.heading)}</span><span class="ak-rec__m">${o.meta}</span></span></span>
  ${o.text ? `<span class="ak-rec__x">${o.text}</span>` : ''}${o.chips ? `<span class="ak-rec__c">${o.chips}</span>` : ''}
  <span class="ak-rec__band ak-band--${o.band || 'none'}"><span>${esc(o.label)}</span>${o.when ? `<span class="ak-rec__w">${o.when}</span>` : ''}</span></button>`;
// Timeline([{title, who, at, text, tag}]) — newest first, the newest entry marked green
const Timeline = events => `<div class="ak-tl">${events.map((e, i) => `<div class="ak-tl__e ${i ? '' : 'new'}"><span class="ak-tl__d"></span><div class="ak-tl__b"><div class="ak-tl__t">${esc(e.title)}${e.tag ? ' ' + e.tag : ''}</div>${e.text ? `<div class="ak-tl__x">${e.text}</div>` : ''}<div class="ak-tl__m">${esc(e.who)} · ${e.at}</div></div></div>`).join('')}</div>`;

/* ---------- progress and Home ---------- */
// Stepper([{label, state: done | now | todo | stop, sub}], compact) — horizontal step tracker
const Stepper = (steps, compact = false) => `<div class="ak-steps ${compact ? 'ak-steps--sm' : ''}" style="--n:${steps.length}">${steps.map(s => `<div class="ak-step ak-step--${s.state}"><span class="ak-step__d">${s.state === 'done' ? ic('check', 16) : s.state === 'stop' ? ic('x', 16) : ''}</span><span class="ak-step__l">${esc(s.label)}</span>${s.sub ? `<span class="ak-step__s">${s.sub}</span>` : '<span class="ak-step__s"></span>'}</div>`).join('')}</div>`;
// TaskTile({icon, count, label, tone, do, arg, go}) — dims at 0
const TaskTile = o => `<button class="ak-tile ${o.count ? '' : 'zero'} ${o.on ? 'on' : ''}" ${akAct(o)}>${IconTile(o.icon, { size: 40, tone: o.tone || 'brand' })}<span class="ak-tile__n">${o.count}</span><span class="ak-tile__l">${esc(o.label)}</span></button>`;

/* ---------- request parts (Figma Section 5) ---------- */
// StatusFoot({ago, label}, buttons, end) — "Current Status • 2m ago", the status line, the actions on the right
const StatusFoot = (o, buttons = '', end = '') => end ? `<div class="ak-foot ak-foot--end">${end}</div>`
  : `<div class="ak-foot"><div class="ak-foot__b"><div class="ak-foot__k">Current Status${o.ago ? ` • ${esc(o.ago)}` : ''}</div><div class="ak-foot__l">${esc(o.label || '')}</div></div><div class="ak-foot__a">${buttons}</div></div>`;
// ApproverRow({state: awaiting | approved | rejected, name, role, label, reason, note})
const APPROVER = { awaiting: ['clock', 'Awaiting approval'], approved: ['check', 'Approved'], rejected: ['x', 'Rejected'] };
const ApproverRow = o => `<div class="ak-appr ak-appr--${o.state}"><span class="ak-appr__i">${ic(APPROVER[o.state][0], 16)}</span><div class="ak-appr__b"><div class="ak-appr__n">${esc(o.name)}</div><div class="ak-appr__r">${esc(o.role)}</div>${o.reason ? `<div class="ak-appr__x">${esc(o.reason)}</div>` : ''}</div><span class="ak-appr__l">${esc(o.label || APPROVER[o.state][1])}</span></div>`;
// EndCard({kind: rejected | cancelled, title, name, role, when, reason})
const EndCard = o => `<div class="ak-end ak-end--${o.kind}"><span class="ak-end__i">${ic('x', 18)}</span><div class="ak-end__b"><div class="ak-end__t">${esc(o.title)}</div><div class="ak-end__m">${esc(o.name)} · ${esc(o.role)} · ${esc(o.when)}</div>${o.reason ? `<div class="ak-end__x">${esc(o.reason)}</div>` : ''}</div></div>`;
// DecisionButtons({approve, reject, arg}) — Reject (red) and Approve (green), side by side
const DecisionButtons = o => `<div class="ak-decide"><button class="ak-dec ak-dec--reject" data-do="${o.reject}" data-arg="${esc(o.arg)}">${ic('x', 18)}<span>${esc(o.rejectLabel || 'Reject')}</span></button><button class="ak-dec ak-dec--approve" data-do="${o.approve}" data-arg="${esc(o.arg)}">${ic('check', 18)}<span>${esc(o.approveLabel || 'Approve')}</span></button></div>`;
// ResultBanner(kind: approved | canceled | rejected, text) — shown in place of the footer for about 1.7 s
const ResultBanner = (kind, text) => `<div class="ak-result ak-result--${kind}">${ic(kind === 'approved' ? 'check' : 'x', 22)}<span>${esc(text)}</span></div>`;

/* ---------- frame ---------- */
// AppBar({title, sub, back, right}) — back is a route
const AppBar = o => `<div class="ak-bar">${o.back ? `<button class="ak-bar__back" data-go="${o.back}" aria-label="Back">${ic('left', 24)}</button>` : ''}<div class="ak-bar__b"><div class="ak-bar__t">${esc(o.title)}</div>${o.sub ? `<div class="ak-bar__s">${o.sub}</div>` : ''}</div><div class="ak-bar__r">${o.right || ''}</div></div>`;
// CountTabs([{key, label, count}], value, act) — the count above the label, a sliding underline
const CountTabs = (tabs, value, act) => { const i = Math.max(0, tabs.findIndex(t => t.key === value));
  return `<div class="ak-ctabs" style="--n:${tabs.length};--i:${i}">${tabs.map(t => `<button class="ak-ctab ${t.key === value ? 'on' : ''}" data-do="${act}" data-arg="${esc(t.key)}" aria-pressed="${t.key === value}"><b>${t.count ?? ''}</b><span>${esc(t.label)}</span></button>`).join('')}<span class="ak-ctabs__u"></span></div>`; };
// BottomNav([{key, label, icon, badge, go}], value) — pill on the active tab, red badge
const BottomNav = (items, value) => items.map(t => `<button class="ak-nav ${t.key === value ? 'on' : ''}" data-go="${t.go}" ${t.key === value ? 'aria-current="page"' : ''}><span class="ak-nav__pill">${ic(t.icon, 24)}${t.badge ? `<span class="ak-nav__b">${t.badge}</span>` : ''}</span><span class="ak-nav__l">${esc(t.label)}</span></button>`).join('');
// PickRow({title, sub, on, check, do, arg, lead}) — a tappable row in a picker sheet: radio, or checkbox when check
const PickRow = o => `<button class="ak-pick ${o.on ? 'on' : ''} ${o.dis ? 'dis' : ''}" ${akAct(o)} ${o.dis ? 'disabled' : ''}>${o.lead || ''}<span class="ak-pick__b"><span class="ak-pick__t">${esc(o.title)}</span>${o.sub ? `<span class="ak-pick__s">${o.sub}</span>` : ''}</span><span class="ak-pick__m ${o.check ? 'ak-pick__m--check' : ''}">${o.on ? ic('check', 14) : ''}</span></button>`;
