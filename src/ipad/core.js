// src/ipad/core.js — the iPad app core: state, formats, router, region painting, sheets (form sheets with a page stack),
// popovers and menus, toast with undo, spotlight search, swipe rows and long-press menus. Views register in VIEWS, handlers in DO / IN.

/* ============ state ============ */
const UI = { me: 'P-RAVI', site: 'S-MAIN', o: 'landscape', sb: true, peek: false, q: {}, f: {}, tab: {}, labels: [], dsel: '' };
const STORE = 'antz-enrichment-ipad-5';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const VIEWS = {}, DO = {}, IN = {};

function save() { try { localStorage.setItem(STORE, JSON.stringify({ D, now: nowIs(), me: UI.me, site: UI.site, o: UI.o, sb: UI.sb })); } catch (e) { /* storage blocked: the demo still runs in memory */ } }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && s.D && s.D.items) { useData(s.D, s.now || NOW_DEFAULT); Object.assign(UI, { me: s.me || UI.me, site: s.site || UI.site, o: s.o || UI.o, sb: s.sb !== false }); return true; }
  } catch (e) { /* ignore */ }
  return false;
}
function fresh() { boot(); workSeed(); activitySeed(); productSeed(); setNow(NOW_DEFAULT); }
const snapshot = () => ({ d: JSON.stringify(D), now: nowIs() });
const restore = s => useData(JSON.parse(s.d), s.now);
// each action moves the demo clock on a few minutes, so the history keeps its order and the status bar clock runs
function tick() { const d = new Date(nowIs() + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + 3); setNow(d.toISOString().slice(0, 16)); }

/* ============ words and formats ============ */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fd = t => t ? `${+t.slice(8, 10)} ${MON[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}` : '';
const fs = t => t ? `${+t.slice(8, 10)} ${MON[+t.slice(5, 7) - 1]}` : '';
const tm = t => t && t.length > 10 ? t.slice(11, 16) : '';
const dow = t => DOW[new Date(day(t) + 'T00:00:00Z').getUTCDay()];
function rel(t) {
  if (!t) return '';
  const n = daysBetween(t, nowIs());
  if (n === 0) return tm(t) ? 'Today, ' + tm(t) : 'Today';
  if (n === 1) return 'Yesterday' + (tm(t) ? ', ' + tm(t) : '');
  if (n > 1 && n < 7) return n + ' days ago';
  return fs(t) + (t.slice(0, 4) !== nowIs().slice(0, 4) ? ' ' + t.slice(0, 4) : '');
}
function dueOf(due) {
  if (!due) return null;
  const n = daysBetween(nowIs(), due);
  if (n < 0) return { t: `${-n} day${n === -1 ? '' : 's'} late`, c: 'late', n };
  if (n === 0) return { t: 'Due today', c: 'soon', n };
  if (n === 1) return { t: 'Tomorrow', c: 'soon', n };
  return { t: 'Due ' + fs(due), c: '', n };
}
const dueChip = due => { const d = dueOf(due); return d ? `<span class="due ${d.c}">${d.t}</span>` : ''; };
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
const nm = id => (person(id) || {}).name || '—';
const first = id => nm(id).replace(/^Dr\.\s*/, '').split(' ')[0];
const me = () => person(UI.me);
const role = () => me().role;
const locName = id => (locOf(id) || {}).name || '';
const secName = id => (sectionOf(id) || {}).name || '';
const siteName = id => (siteOf(id) || {}).name || '';
const catCode = it => (catOf(it) || {}).code || '';
const ROLE_SHORT = { sup: 'Supervisor', afm: 'Site manager', bio: 'Biologist', ws: 'Workshop / VIC', mgmt: 'Approver', admin: 'Admin', keeper: 'Keeper' };

/* ============ scope: the site picked in the sidebar ============ */
const mySites = () => me().sites;
function fixSite() { const s = mySites(); if (UI.site !== 'all' && !s.includes(UI.site)) UI.site = s[0]; if (UI.site === 'all' && s.length < 2) UI.site = s[0]; }
const inSite = x => UI.site === 'all' || x.site === UI.site;
const siteLabel = () => UI.site === 'all' ? 'All sites' : siteName(UI.site);

/* ============ small parts ============ */
const AV_N = s => [...s].reduce((n, c) => n + c.charCodeAt(0), 0) % 6;
function av(id, size = 28) {
  const p = person(id); if (!p) return '';
  const ini = p.name.replace(/^Dr\.\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('');
  return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px">${ini}</span>`;
}
function tile(it, size = 44) {
  const off = it.status && !isActive(it);
  return `<span class="tile tile--${catCode(it) || 'D'} ${off ? 'tile--off' : ''}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .29)}px">${ic(glyphOf(it.name), Math.round(size * .5))}</span>`;
}
const ktile = (icon, tone = '', size = 40) => `<span class="tile tile--k ${tone ? 'tile--k-' + tone : ''}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .3)}px">${ic(icon, Math.round(size * .48))}</span>`;
const pill = (t, tone = '', icon = '', lg = false) => `<span class="pill ${tone ? 'pill--' + tone : ''} ${lg ? 'pill--lg' : ''}">${icon ? ic(icon, 13) : ''}${esc(t)}</span>`;
const STONE = { available: 'ok', inuse: 'ok', storage: 'info', assessment: 'warn', repair: 'warn', transit: 'info', missing: 'bad', retired: '', scrapped: '' };
const CTONE = { good: 'ok', needsrepair: 'warn', damaged: 'warn', unsafe: 'bad', beyond: 'bad', na: '' };
const SOLID = { ok: 'var(--t-ok-solid)', info: 'var(--t-info-solid)', warn: 'var(--t-warn-solid)', bad: 'var(--t-bad-solid)', attn: 'var(--t-attn-solid)', '': 'var(--t-mute-solid)' };
const stPill = (it, lg) => it.disposal ? pill('Disposal requested', 'attn', '', lg) : pill(STATUS[it.status], STONE[it.status], '', lg);
const cdPill = (it, lg) => pill(COND[it.cond], CTONE[it.cond], '', lg);
const DSTATE = { validation: ['Needs validation', 'warn'], approval: ['Awaiting approval', 'attn'], approved: ['Approved', 'info'], rejected: ['Rejected', ''], completed: ['Completed', 'ok'] };
const dPill = (d, lg) => pill(DSTATE[d.state][0], DSTATE[d.state][1], '', lg);
const OTONE = { verified: 'ok', locmismatch: 'warn', condmismatch: 'warn', notfound: 'bad', action: 'attn' };

function seg(id, opts, cur, act, cls = '') {
  const i = opts.findIndex(o => o.v === cur), from = SEGIDX[id] ?? i;
  return `<div class="seg ${cls}" data-id="${id}" data-i="${i}" style="--n:${opts.length};--i:${from < 0 ? 0 : from}"><span class="seg__thumb" ${i < 0 ? 'hidden' : ''}></span>${opts.map(o => `<button class="${o.v === cur ? 'on' : ''}" data-do="${act}" data-arg="${esc(o.v)}">${esc(o.t)}${o.n != null ? ` <span class="seg__n">${o.n}</span>` : ''}</button>`).join('')}</div>`;
}
function ring(p, size = 64, stroke = 7, tone = 'ok', label = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, p || 0)) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="ring__bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="ring__fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke="${SOLID[tone]}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"/></svg><div class="ring__c" style="font-size:${Math.round(size * .26)}px">${label}</div></div>`;
}
const empty = (icon, t, s = '', sm = false, act = '') => `<div class="empty ${sm ? 'empty--sm' : ''}"><div class="empty__i">${ic(icon, sm ? 26 : 34)}</div><div class="empty__t">${esc(t)}</div>${s ? `<div class="empty__s">${esc(s)}</div>` : ''}${act}</div>`;
const kv = rows => `<div class="kv">${rows.filter(Boolean).map(([k, v]) => `<div class="kv__r"><div class="kv__k">${esc(k)}</div><div class="kv__v">${v}</div></div>`).join('')}</div>`;
const card = (title, body, act = '') => `<div class="card">${title ? `<div class="card__h"><div class="card__t">${esc(title)}</div>${act ? `<div class="card__a">${act}</div>` : ''}</div>` : ''}${body}</div>`;
const groupT = (t, extra = '') => `<div class="group-t">${esc(t)}${extra}</div>`;
const photos = list => list && list.length ? `<div class="photos">${list.map(p => `<figure class="photo"><div class="photo__img">${ic('image', 24)}</div><figcaption>${esc(p.caption || 'Photo')}</figcaption></figure>`).join('')}</div>` : '';
const personRow = id => `<span style="display:inline-flex;align-items:center;gap:8px">${av(id, 24)}${esc(nm(id))}</span>`;

/* ============ router ============ */
function route() { const [v = 'today', id = '', sub = ''] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); return { v, id, sub }; }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
window.addEventListener('hashchange', () => { closePop(true); if (UI.peek) setPeek(false); render(); });

/* ============ painting ============ */
// paint(el, html, key) — a new key replaces the region and plays the enter motion; the same key only swaps changed HTML (scroll kept)
function paint(el, html, key, anim = 'enter') {
  if (!el) return false;
  const fresh = el._key !== key;
  if (!fresh && el._html === html) return false;
  el.innerHTML = html; el._html = html;
  if (fresh) {
    el._key = key;
    const sc = el.closest('.scroll'); if (sc) { sc.scrollTop = 0; sc.closest('.col')?.classList.remove('scrolled'); }
    if (anim) { el.classList.remove(anim); void el.offsetWidth; el.classList.add(anim); }
  }
  settlePaint(el, fresh);
  return fresh;
}
function settlePaint(el, fresh) {
  $$('.ring__fg', el).forEach(c => {
    if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.off; }));
    else { c.style.transition = 'none'; c.style.strokeDashoffset = c.dataset.off; }
  });
  if (fresh) $$('[data-count]', el).forEach(countUp); else $$('[data-count]', el).forEach(n => { n.textContent = n.dataset.count; });
  placeSegs(el);
}
function countUp(n) {
  const to = +n.dataset.count, t0 = performance.now(), dur = 700;
  if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) { n.textContent = to; return; }
  const f = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); n.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
const SEGIDX = {};
// placeSegs — the thumb is placed by CSS from --i (equal-width columns), so fonts and resizing never misplace it; this only animates index changes
function placeSegs(root = document) {
  $$('.seg[data-id]', root).forEach(s => {
    const to = +s.dataset.i; if (to < 0) return;
    if (+getComputedStyle(s).getPropertyValue('--i') !== to) requestAnimationFrame(() => s.style.setProperty('--i', to));
    SEGIDX[s.dataset.id] = to;
  });
}
const sbToggle = () => `<button class="icon-btn" data-do="sidebar" aria-label="Sidebar">${ic('sidebar', 22)}</button>`;
const sideHidden = () => UI.o === 'portrait' || !UI.sb;
function topActions() {
  const n = notifications(UI.me).length;
  const create = createItems().length ? `<button class="icon-btn" data-do="create" aria-label="New">${ic('plus', 23)}</button>` : '';
  return `<button class="icon-btn" data-do="bell" aria-label="Notifications">${ic('bell', 21)}${n ? `<span class="dot">${n}</span>` : ''}</button>${create}`;
}
function bar(o) { // o: {left, title, right}
  return `${o.left || ''}<div class="bar__title">${esc(o.title || '')}</div><div class="bar__sp"></div>${o.right || ''}`;
}
const lt = (t, s) => `<div class="lt"><h1 class="lt__t">${esc(t)}</h1>${s ? `<div class="lt__s">${s}</div>` : ''}</div>`;

function render() {
  fixSite();
  const r = route();
  let V = VIEWS[r.v];
  if (!V) { V = VIEWS.today; r.v = 'today'; } else if (V.allow && !V.allow()) V = VIEWS.denied;
  UI.r = r;
  paintTabbar(r);
  const main = $('#main');
  if (main.dataset.layout !== V.layout) {
    main.dataset.layout = V.layout;
    // ANTZ app shell: one white header, full-width filter bands, then the panes on the page background
    main.innerHTML = `<header class="hdr ak-bar" id="hdr"></header>` + (V.layout === 'split'
      ? `<div class="bands"><div id="ltop"></div><div id="ltabs"></div><div id="lsearch"></div></div>
         <div class="panes"><section class="pane pane--list"><div class="scroll" id="lscroll"><div class="pane__pad" id="lrows"></div></div></section>
         <section class="pane pane--detail"><div class="scroll" id="dscroll"><div class="pane__pad" id="dbody"></div></div></section></div>`
      : `<div class="bands"><div id="ltop"></div><div id="ltabs"></div><div id="lsearch"></div></div><div class="panes"><section class="pane pane--full"><div class="scroll" id="fscroll"><div class="pane__pad pane__pad--full" id="fbody"></div></div><div id="fab"></div></section></div>`);
  }
  let right = '';
  if (V.layout === 'split') {
    const L = V.list(r), hk = r.v + '|' + UI.site;
    topBand(L.top);
    const tabs = L.tabs ? `<div class="band band--tabs">${L.tabs}</div>` : '';
    if ($('#ltabs')._html !== tabs) { $('#ltabs').innerHTML = tabs; $('#ltabs')._html = tabs; placeSegs($('#ltabs')); }
    searchBand(r, L, hk);
    paint($('#lrows'), L.rows, hk, 'enter-fade');
    if (!r.id && V.autoOpen !== false) { // split view opens the first record instead of an empty pane
      const f = $('#lrows .row[data-go^="#/' + r.v + '/"]');
      if (f) { r.id = f.dataset.go.split('/')[2]; f.classList.add('on'); history.replaceState(null, '', '#/' + r.v + '/' + r.id); }
    }
    const det = V.detail(r);
    right = L.right || '';
    // record actions (more, export) sit in the record's own header card, not in the page header
    let dh = det.html;
    const hi = dh.indexOf('<div class="hero"');
    if (det.right && hi >= 0) { const end = dh.indexOf('>', hi) + 1; dh = dh.slice(0, end) + `<div class="hero__a">${det.right}</div>` + dh.slice(end); }
    paint($('#dbody'), dh, r.v + '/' + r.id + '/' + (det.key || ''));
  } else {
    const F = V.full(r);
    right = F.right || '';
    topBand(F.top);
    searchBand(r, F, r.v + '|' + UI.site);
    const tabs = F.tabs ? `<div class="band band--tabs">${F.tabs}</div>` : '';
    if ($('#ltabs')._html !== tabs) { $('#ltabs').innerHTML = tabs; $('#ltabs')._html = tabs; placeSegs($('#ltabs')); }
    paint($('#fbody'), F.html, r.v + '|' + UI.site + '|' + (F.key || ''));
    const fab = F.fab || ''; if ($('#fab')._html !== fab) { $('#fab').innerHTML = fab; $('#fab')._html = fab; }
  }
  const hdr = header(V.hdr || V.label || '', right, V.sub ? V.sub() : '');
  if ($('#hdr')._html !== hdr) { $('#hdr').innerHTML = hdr; $('#hdr')._html = hdr; placeSegs($('#hdr')); }
  paintSlide(V, r);
  if (SH) refreshSheet();
}
// the search band: search field, filter button with its count, and optional tools (a view switch); rebuilt only when its key changes, so typing keeps focus
function searchBand(r, L, hk) {
  const el = $('#lsearch'), key = hk + '|' + (L.searchKey || '');
  if (el._key !== key) { el._key = key; el.innerHTML = L.search ? `<div class="band band--search band--list">${L.listTitle ? `<div class="ak-listbar__t">${esc(L.listTitle)}</div>` : ''}${searchField(r.v, L.search)}${L.filter ? `<button class="sqbtn" data-do="${L.filter.do}" aria-label="Filters">${ic('setup', 20)}<span class="dot" ${L.filter.n ? '' : 'hidden'}>${L.filter.n}</span></button>` : ''}${L.tools || ''}</div>` : ''; }
  else if (L.filter) { const d = $('#lsearch .sqbtn .dot'); if (d) { d.hidden = !L.filter.n; d.textContent = L.filter.n; } }
}
// a module's own tab bar (underlined, like the ANTZ diet module) above the filter bands
function topBand(html) { const t = html ? `<div class="band band--mod">${html}</div>` : '', el = $('#ltop'); if (el && el._html !== t) { el.innerHTML = t; el._html = t; } }
// header: Components.md AppBar — title, the site as the sub line (a menu when the person has several), then the right slot
function header(title, right) {
  const p = me(), n = myNotifications().length, sites = mySites();
  return `<div class="ak-bar__b"><h1 class="ak-bar__t">${esc(title)}</h1><button class="ak-bar__site" ${sites.length > 1 ? 'data-do="siteMenu"' : 'disabled'}>${esc(siteLabel())}${sites.length > 1 ? ic('down', 14) : ''}</button></div>
    <div class="ak-bar__r">${right}<button class="asbtn" data-do="who">${Avatar(p.id, 28)}<span class="asbtn__l">${esc(p.name)}</span>${ic('down', 16)}</button>
    <button class="icon-btn" data-do="bell" aria-label="Notifications">${ic('bell', 22)}${n ? `<span class="dot">${n}</span>` : ''}</button></div>`;
}
DO.siteMenu = (a, el) => popover(el, menu([...mySites().map(s => ({ t: siteName(s), do: 'site', arg: s, on: UI.site === s })), { t: 'All sites', do: 'site', arg: 'all', on: UI.site === 'all' }]), { w: 220 });
function bindScroll(sc) {
  sc.addEventListener('scroll', () => sc.closest('.col')?.classList.toggle('scrolled', sc.scrollTop > 46), { passive: true });
}
function searchField(v, ph) {
  return `<label class="search">${ic('search', 18)}<input type="search" placeholder="${esc(ph)}" value="${esc(UI.q[v] || '')}" data-in="q" data-v="${v}" autocomplete="off"><button class="search__x" data-do="qclear" data-arg="${v}" ${UI.q[v] ? '' : 'hidden'}>${ic('x', 12)}</button></label>`;
}
IN.q = (val, el) => { UI.q[el.dataset.v] = val; el.parentNode.querySelector('.search__x').hidden = !val; render(); };
DO.qclear = v => { UI.q[v] = ''; const i = $('#lsearch input'); if (i) { i.value = ''; i.focus(); } $('#lsearch .search__x').hidden = true; render(); };
const match = (q, ...xs) => !q || xs.join(' ').toLowerCase().includes(q.trim().toLowerCase());

/* full-screen panel: a record opened from a list (Components.md FullPanel) — want: {close, title, sub, right, html, foot, key} */
let BANNER = null;   // {key, html, until}: ResultBanner shown in place of the footer after a decision
function paintSlide(V, r) {
  const host = $('#slide'), want = V.slide ? V.slide(r) : null, wrap = host.firstChild;
  if (!want) { if (wrap && !wrap.classList.contains('out')) { wrap.classList.add('out'); setTimeout(() => { if (host.firstChild?.classList.contains('out')) host.innerHTML = ''; }, 240); } return; }
  if (!wrap || wrap.classList.contains('out')) host.innerHTML = `<div class="fp"><div id="sbar"></div><div class="fp__body scroll"><div class="fp__in" id="sbody"></div></div><div class="fp__foot" id="sfoot"></div></div>`;
  const barH = AppBar({ title: want.title, sub: want.sub, back: want.close, right: want.right || '' });
  if ($('#sbar')._html !== barH) { $('#sbar').innerHTML = barH; $('#sbar')._html = barH; }
  paint($('#sbody'), want.html, want.key);
  const foot = BANNER && BANNER.key === want.key && Date.now() < BANNER.until ? BANNER.html : want.foot || '';
  if ($('#sfoot')._html !== foot) { $('#sfoot').innerHTML = foot; $('#sfoot')._html = foot; }
}
function showBanner(key, kind, text) { BANNER = { key, html: ResultBanner(kind, text), until: Date.now() + 1700 }; render(); setTimeout(() => { if (BANNER && Date.now() >= BANNER.until) { BANNER = null; render(); } }, 1750); }

/* ============ bottom tab bar: Home · Enrichments · Requests (the only navigation) ============ */
// Requests opens the biologist's own requests, or the approvals of a supervisor or site manager
const TABS = () => [['today', 'Home', 'today', ['today']], ['enrichments', 'Enrichments', 'layers', ['enrichments']], [canRequest() ? 'enrreq' : 'enrappr', 'Requests', 'newitem', ['enrreq', 'enrappr']]];
function paintTabbar(r) {
  const n = enrTasks().length, cur = (TABS().find(t => t[3].includes(r.v)) || [])[0];
  const html = BottomNav(TABS().map(([k, t, i]) => ({ key: k, label: t, icon: i, go: '#/' + k, badge: k === 'today' ? n : 0 })), cur);
  const el = $('#tabbar');
  if (el && el._html !== html) { el.innerHTML = html; el._html = html; el.style.setProperty('--n', 3); }
}
/* ============ sidebar (no longer shown) ============ */
function setPeek(on) { UI.peek = on; $('.app').classList.toggle('sb-peek', on); }
DO.sidebar = () => { if (UI.o === 'portrait') setPeek(!UI.peek); else { UI.sb = !UI.sb; $('.app').classList.toggle('sb-off', !UI.sb); save(); setTimeout(render, 10); } };
DO.peekClose = () => setPeek(false);
function paintSidebar(r) {
  const groups = [[null, ['today', 'overview', 'enrichments', 'sessions']], ['Items', ['register', 'receipts', 'labels']], ['Workflows', ['repairs', 'transfers', 'audits', 'disposals']], ['Insights', ['reports']], ['Admin', ['setup']]];
  const nav = groups.map(([g, keys]) => {
    const items = keys.filter(k => VIEWS[k] && (!VIEWS[k].allow || VIEWS[k].allow())).map(k => {
      const V = VIEWS[k], c = V.count ? V.count() : null, hot = c && typeof c === 'object';
      return `<button class="sb__item ${r.v === k || VIEWS[r.v]?.group === k ? 'on' : ''}" data-go="#/${k}">${ic(V.sbIcon || V.icon, 20)}<span>${V.sbLabel || V.label}</span>${hot && c.n ? `<span class="sb__count hot">${c.n}</span>` : ''}</button>`;
    }).join('');
    return items ? `<div class="sb__group">${g ? `<div class="sb__label">${g}</div>` : ''}${items}</div>` : '';
  }).join('');
  const html = `<div class="sb__in">
    <div class="sb__head"><span class="logo">${ic('logo', 20)}</span><div class="sb__title">Enrichment</div>${UI.o === 'landscape' ? `<button class="icon-btn" data-do="sidebar" aria-label="Hide sidebar">${ic('sidebar', 21)}</button>` : ''}</div>
    <button class="sb-search" data-do="search">${ic('search', 17)}<span>Search</span></button>
    <nav class="sb__nav">${nav}</nav></div>`;
  const sb = $('#sb');
  if (sb._html !== html) { sb.innerHTML = html; sb._html = html; placeSegs(sb); }
}
DO.site = s => { UI.site = s; closePop(); save(); render(); };
DO.whoOld = (a, el) => {
  const order = ['bio', 'sup', 'afm'];   // the three roles of the product
  const ppl = D.people.filter(p => order.includes(p.role)).sort((x, y) => order.indexOf(x.role) - order.indexOf(y.role));
  popover(el, `<div class="pop__h">Sign in as</div>${ppl.map(p => `<button class="mi ${p.id === UI.me ? 'on' : ''}" data-do="signIn" data-arg="${p.id}">${av(p.id, 32)}<span><span>${esc(p.name)}</span><span class="mi__s">${ROLE_SHORT[p.role]}${p.sections.length ? ' · ' + p.sections.map(secName).join(', ') : ''}</span></span>${p.id === UI.me ? `<span class="mi__e">${ic('check', 18)}</span>` : ''}</button>`).join('')}
    <div class="mi-sep"></div><button class="mi" data-do="guide">Demo guide</button><button class="mi danger" data-do="reset">Reset demo data</button>`, { w: 320 });
};
DO.who = () => {
  const order = ['bio', 'sup', 'afm'];
  const ppl = D.people.filter(p => order.includes(p.role)).sort((x, y) => order.indexOf(x.role) - order.indexOf(y.role));
  sheet({ title: 'Viewing as', alt: [{ label: 'Demo guide', do: 'guide' }, { label: 'Reset demo data', do: 'reset', kind: 'danger' }],
    body: () => Card(ppl.map(p => PickRow({ title: p.name, sub: ROLE_SHORT[p.role] + (p.sections.length ? ' · ' + p.sections.map(secName).join(', ') : ''), on: p.id === UI.me, do: 'signIn', arg: p.id, lead: Avatar(p.id, 36) })).join(''), 'ak-picks') });
};
DO.signIn = id => { UI.me = id; UI.site = person(id).sites[0]; closePop(); if (SH) closeSheet(); save(); go('#/today'); toast(`Signed in as ${nm(id)}`, { icon: 'user' }); };
DO.reset = () => { closePop(); if (SH) closeSheet(); try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } fresh(); save(); go('#/today'); toast('Demo data reset', { icon: 'reset' }); };

/* ============ popovers + menus ============ */
function screenBox() { const s = $('#screen'), r = s.getBoundingClientRect(); return { r, k: r.width / s.offsetWidth }; }
function popover(anchor, html, o = {}) {
  closePop(true);
  const { r: sr, k } = screenBox();
  const layer = $('#pop');
  layer.innerHTML = `<div class="pop-layer" data-do="popClose"></div>`;
  const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; if (o.w) p.style.width = o.w + 'px';
  layer.firstChild.appendChild(p);
  p.addEventListener('click', e => e.stopPropagation());
  const W = sr.width / k, H = sr.height / k, pw = p.offsetWidth, ph = p.offsetHeight;
  let ax, ay, aw = 0, ah = 0;
  if (anchor && anchor.getBoundingClientRect) { const a = anchor.getBoundingClientRect(); ax = (a.left - sr.left) / k; ay = (a.top - sr.top) / k; aw = a.width / k; ah = a.height / k; }
  else { ax = anchor.x; ay = anchor.y; }
  let x = o.align === 'left' ? ax : ax + aw - pw, y = ay + ah + 8;
  if (o.side === 'top' || y + ph > H - 12) y = Math.max(12, ay - ph - 8);
  if (o.point) { x = ax; y = ay; if (y + ph > H - 12) y = H - ph - 12; if (x + pw > W - 12) x = ax - pw; }
  x = Math.max(12, Math.min(W - pw - 12, x));
  p.style.left = x + 'px'; p.style.top = y + 'px';
  p.style.transformOrigin = `${Math.max(0, Math.min(pw, ax + aw / 2 - x))}px ${ay > y ? ph : 0}px`;
}
function closePop(now) {
  const l = $('#pop .pop-layer'); if (!l) return;
  if (now) { $('#pop').innerHTML = ''; return; }
  l.classList.add('out'); setTimeout(() => { if ($('#pop .pop-layer.out')) $('#pop').innerHTML = ''; }, 150);
}
DO.popClose = () => closePop();
// menu([{icon, t, s, do, arg, go, danger, on, sep, h}])
const menu = items => items.filter(Boolean).map(m => m.sep ? '<div class="mi-sep"></div>' : m.h ? `<div class="pop__h">${esc(m.h)}</div>`
  : `<button class="mi ${m.danger ? 'danger' : ''} ${m.on ? 'on' : ''}" ${m.go ? `data-go="${m.go}"` : `data-do="${m.do}" data-arg="${esc(m.arg ?? '')}"`}><span><span>${esc(m.t)}</span>${m.s ? `<span class="mi__s">${esc(m.s)}</span>` : ''}</span>${m.on ? `<span class="mi__e">${ic('check', 18)}</span>` : ''}</button>`).join('');

/* ============ toast + undo ============ */
let UNDO = null, toastT = 0;
function toast(msg, o = {}) {
  if (!msg) return;
  const slot = $('#toast'); clearTimeout(toastT);
  UNDO = o.undo || null;
  slot.innerHTML = `<div class="toast ${o.bad ? 'bad' : ''}">${ic(o.icon || (o.bad ? 'alert' : 'ok'), 20)}<span>${esc(msg)}</span>${UNDO ? `<button data-do="undo">${ic('undo', 15)}Undo</button>` : ''}</div>`;
  toastT = setTimeout(() => { const t = $('.toast', slot); if (t) { t.classList.add('out'); setTimeout(() => { if ($('.toast.out', slot)) slot.innerHTML = ''; }, 240); } UNDO = null; }, o.undo ? 5200 : 3200);
}
DO.undo = () => { if (!UNDO) return; restore(UNDO); UNDO = null; save(); render(); toast('Undone', { icon: 'undo' }); };
// act(fn, msg) — run a model action with undo: snapshot, move the clock, save, repaint, toast
// trial(fn) — run a model action on a copy of the data; keep the copy only if the rules accept it, so a refusal never leaves half a change
function trial(fn, keep = true) {
  const real = D, now = nowIs();
  useData(JSON.parse(JSON.stringify(D)), now);
  try { tick(); const r = fn(); if (!keep) useData(real, now); return r; }
  catch (e) { useData(real, now); throw e; }
}
function act(fn, msg, o = {}) {
  const snap = snapshot();
  try { const r = trial(fn); save(); render(); toast(typeof msg === 'function' ? msg(r) : msg, { undo: snap, icon: o.icon }); return r; }
  catch (e) { toast(e.message, { bad: true }); return undefined; }
}

/* ============ sheets: a form sheet with a page stack ============ */
// sheet(page, form) — page: {title, body(f) → html, done: {label, run(f) → toast text, ok(f) → bool}, pickers: {key: f => pickerPage}}
let SH = null;
// o: {wide, side (filters, from the right), dialog (a short reason dialog)}
function sheet(page, form = {}, o = {}) { closePop(true); SH = { stack: [page], f: form, err: '', wide: !!o.wide, side: !!o.side, dialog: !!o.dialog }; drawSheet('open'); }
const topPage = () => SH.stack[SH.stack.length - 1];
function drawSheet(mode) {
  const host = $('#sheet');
  if (mode === 'open' || !$('.sheet', host)) {
    host.innerHTML = `<div class="layer ${SH.side ? 'layer--side' : SH.dialog ? 'layer--dialog' : 'layer--bottom'}"><div class="layer__scrim" data-do="sheetCancel"></div><div class="sheet ak-sheet ${SH.wide ? 'sheet--wide' : ''}">${SH.side || SH.dialog ? '' : '<span class="ak-sheet__grab"></span>'}<div class="sheet__bar"></div><div class="sheet__pages"></div><div class="ak-sheet__foot"></div></div></div>`;
  }
  const p = topPage(), sh = $('.sheet', host), pages = $('.sheet__pages', host);
  const ok = !p.done || !p.done.ok || p.done.ok(SH.f), dl = p.done && (typeof p.done.label === 'function' ? p.done.label(SH.f) : p.done.label);
  const back = SH.stack.length > 1;
  $('.sheet__bar', host).innerHTML = `${back ? `<button class="ak-bar__back" data-do="sheetBack" aria-label="Back">${ic('left', 24)}</button>` : ''}<div class="sheet__t">${esc(p.title)}</div><button class="ak-sheet__x" data-do="sheetCancel" aria-label="Close">${ic('x', 22)}</button>`;
  // footer: the page's extra actions on the left (Reset, Save as draft), then Back and the one main action
  const alts = (back ? [] : (p.alt || [])).concat(p.left && !back ? [{ label: 'Reset', do: p.left }] : []);
  const foot = p.done || alts.length ? `${alts.map(a => Btn(a.label, { kind: a.kind || 'ghost', do: a.do, arg: a.arg })).join('')}<span class="ak-sheet__sp"></span>${back && p.done ? Btn('Back', { do: 'sheetBack' }) : ''}${p.done ? `<button class="ak-btn ak-btn--${p.done.kind || 'pri'} ${ok ? '' : 'is-incomplete'}" data-do="sheetDone" id="sheetDone"><span>${esc(dl || 'Done')}</span></button>` : ''}` : '';
  $('.ak-sheet__foot', host).innerHTML = foot; $('.ak-sheet__foot', host).hidden = !foot;
  // a form with a review page shows its two steps (Components.md stepped form)
  const steps = p.done && p.done.review ? Stepper([{ label: 'Details', state: 'now' }, { label: 'Review', state: 'todo' }], true) : p.reviewed ? Stepper([{ label: 'Details', state: 'done' }, { label: 'Review', state: 'now' }], true) : '';
  const body = (steps ? `<div class="ak-sheet__steps">${steps}</div>` : '') + (SH.err ? Note({ tone: 'bad', icon: 'alert', title: SH.err }) : '') + p.body(SH.f);
  if (mode === 'refresh') { const pg = $('.sheet__page', pages); if (pg) { const st = pg.scrollTop; pg.innerHTML = body; pg.scrollTop = st; placeSegs(pg); return; } }
  pages.innerHTML = `<div class="sheet__page ${mode === 'push' ? 'push-in' : mode === 'pop' ? 'pop-in' : ''}">${body}</div>`;
  const pg = $('.sheet__page', pages);
  pg.addEventListener('scroll', () => sh.classList.toggle('scrolled', pg.scrollTop > 4), { passive: true });
  sh.classList.remove('scrolled');
  placeSegs(pg);
  const auto = $('[data-autofocus]', pg); if (auto && mode !== 'refresh') setTimeout(() => auto.focus(), 320);
}
function refreshSheet() { if (SH) drawSheet('refresh'); }
function syncDone() { const b = $('#sheetDone'); if (b && topPage().done?.ok) { const ok = topPage().done.ok(SH.f); b.classList.toggle('is-incomplete', !ok); if (ok && SH.err === MISSING) { SH.err = ''; $$('#sheet .ak-field--err').forEach(x => x.classList.remove('ak-field--err')); const n = $('#sheet .ak-note--bad'); if (n) n.remove(); } } }
const MISSING = 'Fill in the fields marked *';
// the required fields that are still empty: an input or text area with no value, or a picker still showing "Choose", or an option row with nothing chosen
function markMissing() {
  $$('#sheet .ak-field').forEach(fl => {
    if (!fl.querySelector('.ak-field__l i')) return;
    const inp = fl.querySelector('input, textarea'), pick = fl.querySelector('.ak-pickf .ph'), opts = fl.querySelector('.ak-choice');
    const empty = (inp && !inp.value.trim()) || !!pick || (opts && !opts.querySelector('button.on'));
    fl.classList.toggle('ak-field--err', !!empty);
  });
}
function closeSheet() {
  const l = $('#sheet .layer'); SH = null; if (!l) return;
  l.classList.add('out'); setTimeout(() => { if ($('#sheet .layer.out')) $('#sheet').innerHTML = ''; }, 230);
}
DO.sheetCancel = (a, el) => {
  if (SH && SH.dirty && el && el.classList.contains('ak-sheet__x')) return popover(el, menu([{ icon: 'disposals', t: 'Discard changes', do: 'sheetDiscard', danger: true }, { icon: 'left', t: 'Keep editing', do: 'popClose' }]), { align: 'left', w: 240 });
  closeSheet();
};
DO.sheetDiscard = () => { closePop(true); closeSheet(); };
DO.sheetBack = () => { SH.stack.pop(); SH.err = ''; drawSheet('pop'); };
DO.sheetDone = (a, el) => {
  const p = topPage(), snap = snapshot();
  if (p.done.ok && !p.done.ok(SH.f)) { SH.err = MISSING; drawSheet('refresh'); markMissing(); const sh = $('#sheet .sheet'); sh.classList.remove('shake'); void sh.offsetWidth; sh.classList.add('shake'); return; }
  if (el) el.disabled = true;   // one tap only: the button returns with the next page or with the error
  if (p.done.review && !p.reviewed) {
    try { trial(() => p.done.run(SH.f), false); } catch (e) { SH.err = e.message; drawSheet('refresh'); const sh = $('#sheet .sheet'); sh.classList.remove('shake'); void sh.offsetWidth; sh.classList.add('shake'); return; }
    SH.err = '';
    return sheetPush({ title: p.title, reviewed: true, body: f => `${p.done.review(f)}`, done: { label: p.done.confirm || 'Confirm', run: p.done.run, kind: p.done.kind } });
  }
  try {
    const res = trial(() => p.done.run(SH.f)), msg = res && typeof res === 'object' ? res.msg : res;
    save(); closeSheet(); if (res && res.go) go(res.go); else render();
    toast(msg, { undo: snap });
  } catch (e) {
    SH.err = e.message; drawSheet('refresh');
    const sh = $('#sheet .sheet'); sh.classList.remove('shake'); void sh.offsetWidth; sh.classList.add('shake');
  }
};
function sheetPush(page) { SH.stack.push(page); SH.err = ''; drawSheet('push'); }
DO.picker = key => sheetPush(topPage().pickers[key](SH.f));
// form inputs in a sheet
IN.f = (v, el) => { SH.f[el.dataset.k] = el.type === 'number' ? +v : v; SH.dirty = true; syncDone(); };
DO.opt = a => { SH.dirty = true; const [k, v] = a.split('|'); SH.f[k] = v === '__true' ? true : v === '__false' ? false : v; refreshSheet(); syncDone(); };
DO.tog = k => { SH.dirty = true; SH.f[k] = !SH.f[k]; refreshSheet(); syncDone(); };
DO.step = a => { SH.dirty = true; const [k, d, lo, hi] = a.split('|').map((x, i) => i ? +x : x); SH.f[k] = Math.max(lo, Math.min(hi, (+SH.f[k] || 0) + d)); refreshSheet(); syncDone(); };
DO.addPhoto = k => { SH.dirty = true; (SH.f[k] = SH.f[k] || []).push({ kind: 'photo', caption: 'Photo ' + (SH.f[k].length + 1) }); refreshSheet(); syncDone(); };
DO.rmPhoto = a => { const [k, i] = a.split('|'); SH.f[k].splice(+i, 1); refreshSheet(); syncDone(); };
DO.pick = v => { SH.dirty = true; const p = topPage(); SH.f[p.pickKey] = v; if (p.after) p.after(SH.f, v); SH.stack.pop(); SH.err = ''; drawSheet('pop'); };
IN.pq = v => { topPage().q = v; const list = $('#sheet .pick-list'); if (list) list.innerHTML = pickRows(topPage()); };

// form fields (Components.md): a label above each input; inputs 48 px; Choice for options; PickField opens a picker page
const req = r => r ? '<i>*</i>' : '';
const fg = (t, cells) => `<div class="ak-fg">${t ? `<div class="ak-fg__t">${esc(t)}</div>` : ''}<div class="ak-fg__c">${cells.filter(Boolean).join('')}</div></div>`;
const fl = (k, r) => k ? `<span class="ak-field__l">${esc(k)}${req(r)}</span>` : '';
const cInfo = (k, v) => `<div class="ak-field ak-field--info"><span class="ak-field__l">${esc(k)}</span><span class="ak-field__v">${v}</span></div>`;
const cNav = (k, v, key, r) => `<div class="ak-field">${fl(k, r)}<button class="ak-pickf" data-do="picker" data-arg="${key}"><span class="${v ? '' : 'ph'}">${v ? esc(v) : 'Choose'}</span>${ic('down', 18)}</button></div>`;
const cText = (k, key, f, r, type = 'text') => `<label class="ak-field">${fl(k, r)}<input class="ak-in" type="${type}" data-in="f" data-k="${key}" value="${esc(f[key] ?? '')}"></label>`;
const cArea = (k, key, f, r, auto) => `<label class="ak-field">${fl(k, r)}<textarea class="ak-in ak-in--area" data-in="f" data-k="${key}" rows="3" ${auto ? 'data-autofocus' : ''}>${esc(f[key] || '')}</textarea></label>`;
const cStep = (k, key, f, lo, hi) => `<div class="ak-field">${fl(k)}<span class="ak-step2"><button data-do="step" data-arg="${key}|-1|${lo}|${hi}" aria-label="Less">${ic('minus', 18)}</button><b>${f[key]}</b><button data-do="step" data-arg="${key}|1|${lo}|${hi}" aria-label="More">${ic('plus', 18)}</button></span></div>`;
const cToggle = (k, key, f) => `<button class="ak-field ak-field--toggle" data-do="tog" data-arg="${key}"><span class="ak-field__l">${esc(k)}</span><span class="toggle ${f[key] ? 'on' : ''}"></span></button>`;
const cOpts = (k, key, f, opts, r) => `<div class="ak-field">${fl(k, r)}<div class="ak-choice ak-choice--wrap">${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<button class="${f[key] === v ? 'on' : ''}" data-do="opt" data-arg="${key}|${esc(v)}" aria-pressed="${f[key] === v}">${esc(t)}</button>`; }).join('')}</div></div>`;
const cSeg = (key, f, opts) => `<div class="ak-field"><div class="ak-choice" style="--n:${opts.length}">${opts.map(([v, t]) => `<button class="${f[key] === v ? 'on' : ''}" data-do="opt" data-arg="${key}|${esc(v)}" aria-pressed="${f[key] === v}">${esc(t)}</button>`).join('')}</div></div>`;
const cDate = (k, key, f, r) => `<label class="ak-field">${fl(k, r)}<input class="ak-in" type="date" data-in="f" data-k="${key}" value="${esc(f[key] || '')}"></label>`;
const cChoices = (key, f, opts) => Card(opts.map(o => PickRow({ title: o.t, sub: o.s, on: f[key] === o.v, dis: o.dis, do: 'opt', arg: `${key}|${o.v}` })).join(''), 'ak-picks');
const cPhotos = (key, f, r) => `<div class="ak-field">${fl('Photos', r)}<div class="photos" style="padding:0">${(f[key] || []).map((p, i) => `<button class="photo" data-do="rmPhoto" data-arg="${key}|${i}"><div class="photo__img">${ic('image', 24)}<span class="photo__x">${ic('x', 12)}</span></div><figcaption>${esc(p.caption)}</figcaption></button>`).join('')}<button class="photo" data-do="addPhoto" data-arg="${key}"><div class="photo__img photo__img--add">${ic('camera', 22)}</div><figcaption>Add photo</figcaption></button></div></div>`;
// the record a sheet acts on: a header card (Components.md detail header)
const sumItem = it => `<div class="ak-sum">${IconTile(glyphOf(it.name), { size: 40 })}<div class="ak-sum__b"><div class="ak-sum__t">${esc(it.name)}</div><div class="ak-sum__s">${esc(it.id)} · ${esc(where(it))}</div></div></div>`;

// pickerPage({title, key, options: [{v, t, s, tile, group, dis}], search, after})
function pickerPage(o) {
  return { title: o.title, pickKey: o.key, after: o.after, q: '', opts: o.options,
    body: f => `${o.search ? `<label class="search ak-search">${ic('search', 18)}<input type="search" placeholder="Search" data-in="pq" autocomplete="off"></label>` : ''}<div class="pick-list">${pickRows({ opts: o.options, q: '', pickKey: o.key }, f)}</div>` };
}
function pickRows(p, f = SH.f) {
  const list = p.opts.filter(o => match(p.q, o.t, o.s || ''));
  if (!list.length) return empty('search', 'No matches', '', true);
  const groups = [...new Set(list.map(o => o.group || ''))];
  return groups.map(g => fg(g, [Card(list.filter(o => (o.group || '') === g).map(o => PickRow({ title: o.t, sub: o.s ? esc(o.s) : '', on: f[p.pickKey] === o.v, dis: o.dis, do: 'pick', arg: o.v, lead: o.tile })).join(''), 'ak-picks')])).join('');
}
// common pickers
const locOpts = filter => D.locations.filter(filter).map(l => ({ v: l.id, t: l.name, s: `${secName(l.section)} · ${siteName(l.site)}`, group: l.kind === 'enclosure' ? 'Enclosures' : 'Stores' }));
const peopleOpts = filter => D.people.filter(filter).map(p => ({ v: p.id, t: p.name, s: ROLE_SHORT[p.role] + (p.sections.length ? ' · ' + p.sections.map(secName).join(', ') : ''), tile: av(p.id, 36) }));
const custodiansOf = secId => { const s = sectionOf(secId); return p => (p.role === 'sup' && p.sections.includes(secId)) || (p.role === 'afm' && p.sites.includes(s.site)); };

/* ============ spotlight search ============ */
DO.search = () => {
  closePop(true);
  $('#sheet').innerHTML = `<div class="layer"><div class="layer__scrim" data-do="spotClose"></div><div class="spot"><div class="spot__in">${ic('search', 22)}<input id="spotq" placeholder="Items, activities, species, audits" data-in="spot" autocomplete="off"><button class="text-btn" data-do="spotClose">Cancel</button></div><div class="spot__r" id="spotr">${spotRows('')}</div></div></div>`;
  setTimeout(() => $('#spotq')?.focus(), 60);
};
DO.spotClose = () => { const l = $('#sheet .layer'); if (!l) return; l.classList.add('out'); setTimeout(() => { if ($('#sheet .layer.out')) $('#sheet').innerHTML = ''; }, 220); };
IN.spot = v => { $('#spotr').innerHTML = spotRows(v); };
function spotRows(q) {
  if (!q.trim()) {
    const recent = D.items.filter(isActive).slice(-5).reverse();
    return `<div class="spot__g">Jump to</div>${menu(Object.entries(VIEWS).filter(([, V]) => !V.allow || V.allow()).slice(0, 8).map(([k, V]) => ({ icon: V.icon, t: V.label, go: '#/' + k })))}<div class="spot__g">Recent items</div>${menu(recent.map(it => ({ icon: glyphOf(it.name), t: it.name, s: `${it.id} · ${where(it)}`, go: '#/register/' + it.id })))}`;
  }
  const its = D.items.filter(it => match(q, it.id, it.name, locName(it.loc), secName(it.section), it.ticket)).slice(0, 8);
  const tks = D.tickets.filter(t => match(q, t.id, t.name, t.mt, t.ws)).slice(0, 4);
  const dps = D.disposals.filter(d => match(q, d.id, itemOf(d.item).name, d.reason)).slice(0, 4);
  const aus = D.audits.filter(a => match(q, a.id, a.period, siteName(a.site))).slice(0, 3);
  const acs = A().activities.filter(a => match(q, a.id, a.name, a.sub)).slice(0, 4);
  const sps = A().species.filter(s => match(q, s.name, s.sci)).slice(0, 4);
  const out = [
    its.length && `<div class="spot__g">Items</div>${menu(its.map(it => ({ icon: glyphOf(it.name), t: it.name, s: `${it.id} · ${STATUS[it.status]} · ${where(it)}`, go: '#/register/' + it.id })))}`,
    tks.length && `<div class="spot__g">Deliveries</div>${menu(tks.map(t => ({ icon: 'receipts', t: t.name, s: `${t.id} · ${t.status === 'dispatched' ? 'Waiting' : 'Received'}`, go: '#/receipts/' + t.id })))}`,
    dps.length && `<div class="spot__g">Disposals</div>${menu(dps.map(d => ({ icon: 'disposals', t: itemOf(d.item).name, s: `${d.id} · ${DSTATE[d.state][0]}`, go: '#/disposals/' + d.id })))}`,
    acs.length && `<div class="spot__g">Activities</div>${menu(acs.map(a => ({ t: a.name, s: `${a.id} · ${ACT_TYPE[a.type]}`, go: '#/activities/' + a.id })))}`,
    sps.length && `<div class="spot__g">Species</div>${menu(sps.map(s => ({ t: s.name, s: s.sci, go: '#/species/' + s.id })))}`,
    aus.length && `<div class="spot__g">Audits</div>${menu(aus.map(a => ({ icon: 'audits', t: `${a.period} audit`, s: `${a.id} · ${siteName(a.site)}`, go: '#/audits/' + a.id })))}`,
  ].filter(Boolean).join('');
  return out || empty('search', 'No results', `Nothing matches “${q}”.`, true);
}

/* ============ global input ============ */
let noClickUntil = 0;
document.addEventListener('click', e => {
  if (Date.now() < noClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target.closest('[data-go],[data-do]');
  if (!t || t.disabled) return;
  if (t.dataset.go) { e.preventDefault(); if ($('#sheet .spot')) DO.spotClose(); closePop(true); go(t.dataset.go); return; }
  const f = DO[t.dataset.do]; if (f) { e.preventDefault(); f(t.dataset.arg, t, e); }
}, true);
document.addEventListener('input', e => { const t = e.target.closest('[data-in]'); if (t && IN[t.dataset.in]) IN[t.dataset.in](t.value, t, e); });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); DO.search(); return; }
  if (e.key === 'Escape') { if ($('#pop .pop-layer')) closePop(); else if ($('#sheet .spot')) DO.spotClose(); else if (SH) closeSheet(); else if (UI.peek) setPeek(false); }
  if (e.key === 'Enter' && e.target.id === 'spotq') { const f = $('#spotr .mi'); if (f) f.click(); }
});
// long press or right click on [data-ctx] opens its context menu
let lp = null;
document.addEventListener('contextmenu', e => { const t = e.target.closest('[data-ctx]'); if (!t) return; e.preventDefault(); ctxMenu(t, e); });
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('[data-ctx]'); if (!t || e.pointerType === 'mouse') return;
  const x = e.clientX, y = e.clientY;
  lp = { x, y, t: setTimeout(() => { noClickUntil = Date.now() + 500; ctxMenu(t, { clientX: x, clientY: y }); lp = null; }, 480) };
});
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { if (lp) { clearTimeout(lp.t); lp = null; } }));
document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) { clearTimeout(lp.t); lp = null; } });
function ctxMenu(t, e) {
  const [kind, id] = t.dataset.ctx.split(':');
  const { r, k } = screenBox();
  const items = kind === 'item' ? itemMenu(itemOf(id)) : [];
  if (!items.length) return;
  t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1200);
  popover({ x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }, menu(items), { point: true, w: 260 });
}
// swipe rows: drag a .swipe row left to show its actions
let SW = null;
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('.swipe'); $$('.swipe.open').forEach(o => { if (o !== s) { o.classList.remove('open'); $('.row', o).style.transform = ''; } });
  if (!s || e.target.closest('.swipe__acts') || e.button) return;
  SW = { s, row: $('.row', s), x0: e.clientX, y0: e.clientY, base: s.classList.contains('open') ? -$('.swipe__acts', s).offsetWidth : 0, on: false, id: e.pointerId, x: 0 };
});
document.addEventListener('pointermove', e => {
  if (!SW || e.pointerId !== SW.id) return;
  const k = screenBox().k, dx = (e.clientX - SW.x0) / k, dy = (e.clientY - SW.y0) / k;
  if (!SW.on) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) { SW.on = true; SW.s.classList.add('dragging'); if (lp) { clearTimeout(lp.t); lp = null; } }
    else if (Math.abs(dy) > 10) { SW = null; return; } else return;
  }
  const w = $('.swipe__acts', SW.s).offsetWidth; let x = Math.min(0, SW.base + dx); if (x < -w) x = -w + (x + w) * .3;
  SW.row.style.transform = `translateX(${x}px)`; SW.x = x; SW.w = w;
});
document.addEventListener('pointerup', () => {
  if (!SW) return;
  if (SW.on) { noClickUntil = Date.now() + 120; SW.s.classList.remove('dragging'); const open = SW.x < -SW.w * .45; SW.row.style.transform = open ? `translateX(${-SW.w}px)` : ''; SW.s.classList.toggle('open', open); }
  SW = null;
});
