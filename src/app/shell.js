// src/app/shell.js — the app shell: state, hash router, page header, sheets, pickers, review sheet, toast and task-page plumbing.
// CONFIRMED COMPONENTS ONLY (components.json status "confirmed"). Parts that are not confirmed on their own (kButton N-01, kPill C-19,
// kField / kChoice / kFormSection C-55) appear only inside the slot of a confirmed component that uses them in its own spec:
//   kButton → C-07 header actions · C-15 card action · C-48…C-54 sheet footer · C-62 empty-state action
//   kPill   → C-18 card status
//   kField · kChoice · kFormSection → inside a C-54 sheet body
// Screens live in src/app/screens/phase-*.js and register with route(). Inline handlers call the globals defined here and in the screens.

/* ---------- state ---------- */
const A = { me: 'P-RAVI', site: 'S-MAIN', sheet: null, dial: false, q: '', st: '', cat: '', cond: '', mw: 'all', rep: 'inventory', aud: 'todo', dsp: 'open', lab: [], form: null, formKey: '' };
const STORE = 'antz-enrichment-v2';
function save() { try { localStorage.setItem(STORE, JSON.stringify({ D, me: A.me, site: A.site })); } catch (e) { /* storage blocked: the demo still works in memory */ } }
function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.D && s.D.items) { useData(s.D, NOW_DEFAULT); A.me = s.me || A.me; A.site = s.site || A.site; return true; } } catch (e) { /* ignore */ }
  return false;
}
function resetDemo() { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } boot(); A.sheet = null; A.form = null; save(); go('#/overview'); say('Demo data reset'); }

/* ---------- words and formats ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fd = t => t ? `${+t.slice(8, 10)} ${MON[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}` : '';
const fs = t => t ? `${+t.slice(8, 10)} ${MON[+t.slice(5, 7) - 1]}` : '';
const ft = t => t ? fd(t) + (t.length > 10 ? ', ' + t.slice(11, 16) : '') : '';
const nm = id => (person(id) || {}).name || '';
const me = () => person(A.me);
const role = () => me().role;
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
const TONE = { available: 'ok', inuse: 'info', storage: '', assessment: 'warn', repair: 'warn', transit: 'info', missing: 'bad', retired: '', scrapped: '' };
const stPill = it => kPill(it.disposal ? 'Disposal requested' : STATUS[it.status], it.disposal ? 'attn' : TONE[it.status]);
const DSTATE = { validation: ['Awaiting validation', 'warn'], approval: ['Awaiting approval', 'attn'], approved: ['Approved', 'info'], rejected: ['Rejected', ''], completed: ['Completed', 'ok'] };
const dPill = d => kPill(DSTATE[d.state][0], DSTATE[d.state][1]);
const AUDTONE = { verified: 'ok', locmismatch: 'warn', condmismatch: 'warn', notfound: 'bad', action: 'attn' };
const outPill = o => kPill(AUDIT_OUT[o], AUDTONE[o]);
const catCode = it => catOf(it).code;
const locName = id => (locOf(id) || {}).name || '';
const secName = id => (sectionOf(id) || {}).name || '';
const siteName = id => (siteOf(id) || {}).name || '';
const MODE = { individual: 'Individual', batch: 'Group / quantity', excluded: 'Not tracked' };

/* ---------- scope: the site chosen in the header ---------- */
const inSite = x => A.site === 'all' || x.site === A.site;
const siteItems = () => D.items.filter(inSite);

/* ---------- router ---------- */
const ROUTES = [];
function route(pattern, fn) { ROUTES.push([new RegExp('^#/' + pattern + '$'), fn]); }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', () => { A.sheet = null; A.dial = false; render(); });

function render() {
  const h = location.hash || '#/overview';
  let out = null;
  for (const [re, fn] of ROUTES) { const m = h.match(re); if (m) { if (A.formKey !== h) { A.form = null; A.formKey = h; } out = fn(...m.slice(1)); break; } }
  if (!out) { location.replace('#/overview'); return; }
  document.getElementById('main').innerHTML = out.main;
  drawFab(out.fab);
  drawSheet();
  document.title = (out.title || 'Enrichment & Furnishing') + ' · ANTZ';
}
function redraw() { const m = document.getElementById('main'), y = m.scrollTop; render(); m.scrollTop = y; }
window.addEventListener('hashchange', () => { document.getElementById('main').scrollTop = 0; });

/* ---------- page header (C-07): top-level pages with the module tabs; every other page with Back and its actions ---------- */
function moduleTabs() {
  const t = [
    { key: 'overview', label: 'Overview', href: '#/overview' },
    { key: 'register', label: 'Register', count: siteItems().filter(isActive).length, href: '#/register' },
    { key: 'mywork', label: 'My work', count: tasks(A.me).filter(inScopeTask).length, href: '#/mywork' },
    { key: 'audits', label: 'Audits', count: D.audits.filter(a => inSite(a) && a.state !== 'closed').length, href: '#/audits' },
    { key: 'reports', label: 'Reports', href: '#/reports' },
  ];
  if (role() === 'admin') t.push({ key: 'setup', label: 'Setup', href: '#/setup' });
  return t;
}
function inScopeTask(t) {
  if (A.site === 'all') return true;
  const it = itemOf(t.ref), tk = by('tickets', t.ref), au = auditOf(t.ref), d = disposalOf(t.ref);
  const site = it ? (it.transfer && t.kind === 'transfer' ? it.transfer.to.site : it.site) : tk ? sectionOf(tk.section).site : au ? au.site : d ? itemOf(d.item).site : (D.audits.find(a => t.href.endsWith(a.id)) || {}).site;
  return !site || site === A.site;
}
// header(current, {sub, actions}) — a top-level page: title, site selector, notifications, user, module tabs
function header(current, o = {}) {
  return kPageHeader({
    title: 'Enrichment & Furnishing', sub: o.sub, site: A.site === 'all' ? 'All sites' : siteName(A.site), siteOnclick: 'pickSite()',
    actions: (o.actions || '') + tool('notif', `Notifications, ${notifications(A.me).length}`, '', '#/notifications') + tool('user', `Signed in as ${me().name}. Switch user`, 'pickUser()'),
    tabs: moduleTabs(), current,
  });
}
// tool(icon, name, onclick, href) — an icon-only header action (C-07 actions slot); name is its accessible name and tooltip
const tool = (icon, name, onclick, href) => kButton({ icon, kind: 'ghost', onclick, href, attrs: `aria-label="${kEsc(name)}" title="${kEsc(name)}"` });
// page({title, sub, back, actions, tabs, current}) — any other page: Back first, then the page's actions (secondary first, primary last)
function page(o) {
  return kPageHeader({ title: o.title, sub: o.sub, actions: (o.back ? kButton({ label: 'Back', icon: 'back', kind: 'ghost', href: o.back }) : '') + kList(o.actions).map(b => kButton(b)).join(''), tabs: o.tabs, current: o.current });
}
const notHere = (title, text, back) => ({ main: page({ title, back }) + kEmpty({ kind: 'none', text, action: kButton({ label: 'Back', href: back }) }), title });

/* ---------- FAB and speed dial (C-05): Create on top-level pages only ---------- */
function fabItems() {
  const r = role(), it = [];
  if (['sup', 'afm', 'admin'].includes(r)) it.push({ label: 'Receive items', icon: 'download', onclick: "go('#/receipts')" }, { label: 'Register item', icon: 'addc', onclick: "go('#/register-new')" }, { label: 'Print labels', icon: 'scan', onclick: "go('#/labels')" });
  if (['afm', 'admin'].includes(r)) it.push({ label: 'New audit', icon: 'checkc', onclick: "go('#/audit-new')" });
  return it;
}
function drawFab(show) {
  const items = show ? fabItems() : [];
  document.getElementById('fab').innerHTML = items.length && A.dial ? kFab({ label: 'Create', open: true, onclick: 'toggleDial()', items }) : '';
  document.getElementById('fab-closed').innerHTML = items.length && !A.dial ? kFab({ label: 'Create', abs: true, onclick: 'toggleDial()' }) : '';
}
function toggleDial() { A.dial = !A.dial; drawFab(true); }

/* ---------- sheets (C-48 shell · C-50 / C-51 pickers · C-52 confirm · C-53 review & submit · C-54 fields) ---------- */
const SHEETS = {}, SHEET_OK = {};
function openSheet(kind, o = {}) { A.sheet = Object.assign({ kind }, o); A.dial = false; drawFab(false); drawSheet(); }
function closeSheet() { const s = A.sheet; if (s && s.snap) A.form = s.snap; A.sheet = null; drawSheet(); if (s) redraw(); }
function drawSheet() {
  const el = document.getElementById('sheet');
  if (!A.sheet) { el.innerHTML = ''; return; }
  el.innerHTML = kScrim(SHEETS[A.sheet.kind](A.sheet));
  const f = el.querySelector('textarea, input'); if (f) f.focus({ preventScroll: true });
}
function sheetSync() { const b = document.querySelector('#sheet .k-sheet__f .k-btn--primary'); if (b && A.sheet && A.sheet.valid) b.disabled = !A.sheet.valid(A.sheet); }
function sheetOk() { const s = A.sheet; SHEET_OK[s.kind](s); }
const foot = (ok, valid = true, cancel = 'Cancel') => kButton({ label: cancel, onclick: 'closeSheet()' }) + kButton({ label: ok, kind: 'primary', disabled: !valid, onclick: 'sheetOk()' });
document.addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('k-scrim') && A.sheet && !A.sheet.decision) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (A.sheet && !A.sheet.decision) closeSheet(); else if (A.dial) toggleDial(); } });

// pick(title, options, current, cb) — C-51 single choice: a tap picks and closes. options: [{key, title, sub}]
function pick(title, options, current, cb) { openSheet('pick', { title, options, current, cb }); }
SHEETS.pick = s => kSheet({ title: s.title, close: 'closeSheet()',
  body: s.options.length ? kOptions(s.options.map((o, i) => kOption({ type: 'radio', title: o.title, sub: o.sub, on: o.key === s.current, onclick: `pickDone(${i})` }))) : kEmpty({ kind: 'none', text: 'Nothing to pick.' }) });
function pickDone(i) { const s = A.sheet, o = s.options[i]; A.sheet = null; s.cb(o.key); drawSheet(); redraw(); }

// confirmSheet(title, text, ok, fn) — C-52: one decision before a big change; no ✕
function confirmSheet(title, text, ok, fn) { openSheet('confirm', { title, text, ok, fn, decision: true }); }
SHEETS.confirm = s => kSheet({ title: s.title, body: s.text ? `<p class="t-minor-regular" style="margin:0">${kEsc(s.text)}</p>` : '', foot: foot(s.ok) });
SHEET_OK.confirm = s => { A.sheet = null; drawSheet(); s.fn(); };

// edit(title, fields, valid) — C-54: up to three fields of the task page in hand; Cancel restores them
// fields(): HTML list of fld() / chc() / options; they write straight into A.form
function edit(title, fields, valid) { openSheet('edit', { title, fields, valid: valid || (() => true), snap: JSON.parse(JSON.stringify(A.form)) }); }
SHEETS.edit = s => kSheet({ title: s.title, close: 'closeSheet()', body: kFormSection('', s.fields()), foot: foot('Save', s.valid(s)) });
SHEET_OK.edit = s => { A.sheet = null; drawSheet(); redraw(); };
const fld = (label, key, o = {}) => kField(Object.assign({}, o, { label, value: A.form[key] ?? '', attrs: `oninput="A.form['${key}']=this.value;sheetSync()"` }));
// lbl(label, html) — a label above a choice or a list of options, drawn as kField draws its own label (14 / 600), so every label in a sheet matches
const lbl = (label, html) => `<div class="k-field"><span class="k-field__l"><span class="t-body-title">${kEsc(label)}</span></span>${html}</div>`;
const chc = (label, key, items, multi) => lbl(label, kChoice(items, A.form[key], { onpick: multi ? `togS('${key}')` : `setS('${key}')` }));
const setS = k => v => { A.form[k] = v; drawSheet(); };
const togS = k => v => { const a = A.form[k] || []; A.form[k] = a.includes(v) ? a.filter(x => x !== v) : a.concat(v); drawSheet(); };

// review({title, sub, strip, rows, missing, ok, fn}) — C-53 review & submit: a stat strip, a summary card, Submit stopped while something is missing
function review(o) { openSheet('review', o); }
SHEETS.review = s => kSheet({ title: s.title, sub: s.sub, close: 'closeSheet()',
  body: (s.strip ? kStatStrip(s.strip) : '') + kCard({ body: kKV(s.rows.concat((s.missing || []).map(m => [m, 'Required']))) }),
  foot: foot(s.ok, !(s.missing && s.missing.length)) });
SHEET_OK.review = s => { A.sheet = null; drawSheet(); s.fn(); };
// sections of the review body sit 24 apart (app.css)

/* ---------- header pickers ---------- */
function pickSite() {
  const p = me(), sites = D.sites.filter(s => p.sites.includes(s.id));
  pick('Site', (sites.length > 1 ? [{ key: 'all', title: 'All sites' }] : []).concat(sites.map(s => ({ key: s.id, title: s.name }))), A.site, k => { A.site = k; save(); });
}
function pickUser() { openSheet('user'); }
SHEETS.user = () => kSheet({ title: 'Switch user', close: 'closeSheet()',
  body: kOptions(D.people.map(p => kOption({ type: 'radio', title: p.name, sub: ROLE[p.role] + (p.role === 'sup' ? ' · ' + p.sections.map(secName).join(', ') : ''), on: p.id === A.me, onclick: `setUser('${p.id}')` }))),
  foot: kButton({ label: 'Reset demo data', kind: 'ghost', onclick: 'resetDemo()' }) });
function setUser(id) {
  A.me = id; const p = me();
  if (A.site !== 'all' && !p.sites.includes(A.site)) A.site = p.sites[0];
  if (p.sites.length === 1) A.site = p.sites[0];
  A.sheet = null; A.st = A.cat = A.cond = A.q = ''; A.mw = 'all'; save(); drawSheet(); go('#/overview'); say('Signed in as ' + p.name, 'user');
}

/* ---------- toast (C-63) ---------- */
function say(text, icon = 'check') { const t = document.getElementById('toast'); t.innerHTML = kToast(text, { icon }); clearTimeout(say.h); say.h = setTimeout(() => { t.innerHTML = ''; }, 2800); }

/* ---------- actions: run a model action, save, confirm, move on ---------- */
function act(fn, ok, next) {
  try { fn(); } catch (e) { say(e.message, 'alert'); return false; }
  save(); A.sheet = null; drawSheet();
  if (next) { A.form = null; go(next); } else redraw();
  if (ok) say(ok);
  return true;
}

/* ---------- task pages: a draft in A.form, one card per topic, each card's action opens its sheet ---------- */
function F(init) { if (!A.form) A.form = Object.assign({ photos: [] }, typeof init === 'function' ? init() : init || {}); return A.form; }
// part(title, rows, action) — one topic of a task page (C-15 card + C-59 key-value; action: the card's button)
const part = (title, rows, action) => kCard({ title, action: action ? kButton(Object.assign({ size: 'sm', kind: 'ghost' }, action)) : '', body: kKV(rows) });
function addPhoto() { A.form.photos.push({ kind: 'photo', caption: 'Photo ' + (A.form.photos.length + 1) + ' · ' + fs(NOW) }); redraw(); }
const photosPart = (title = 'Photos') => kCard({ title, action: kButton({ label: 'Add photo', icon: 'cam', size: 'sm', kind: 'ghost', onclick: 'addPhoto()' }), body: A.form.photos.length ? kThumbs(A.form.photos) : kKV([['Photos', 'None']]) });
// evidence(photos) — thumbnails, or a plain value when there are none (no dashed box inside a card)
const evidence = (photos, title = 'Evidence') => kCard({ title, body: photos.length ? kThumbs(photos) : kKV([['Photos', 'None']]) });
// a list inside a card is a timeline (C-47), never cards inside a card
const none = (label) => kKV([[label, 'None']]);
function pickLocation(key, filter, title = 'Location') {
  pick(title, D.locations.filter(filter).map(l => ({ key: l.id, title: l.name, sub: (l.kind === 'enclosure' ? 'Enclosure' : 'Store') + ' · ' + secName(l.section) })), A.form[key], k => { A.form[key] = k; });
}
function pickPerson(key, filter, title = 'Person') {
  pick(title, D.people.filter(filter).map(p => ({ key: p.id, title: p.name, sub: ROLE[p.role] })), A.form[key], k => { A.form[key] = k; });
}
const custodiansOf = secId => p => (p.role === 'sup' && p.sections.includes(secId)) || (p.role === 'afm' && p.sites.includes(sectionOf(secId).site));
const locLabel = id => { const l = locOf(id); return l ? `${l.name} · ${l.kind === 'enclosure' ? 'Enclosure' : 'Store'}` : ''; };

/* ---------- list card (C-18): one record = one card, name · detail line · status · up to four facts ---------- */
const card = o => kAuditCard({ name: o.name, about: kList(o.about).filter(Boolean).join(' · '), status: o.status || '', facts: kList(o.facts).filter(f => f && f.value !== '' && f.value != null).slice(0, 4), href: o.href, onclick: o.onclick });
const cards = list => list.join('');
