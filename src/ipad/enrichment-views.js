// src/ipad/enrichment-views.js — Enrichments: the site's enrichment products and the requests around them, drawn with the
// Antz tablet components (src/ipad/antz-kit.js, from Components.md). Bottom tabs Home · Enrichments · Requests; a record opens as
// a full-screen panel (header card, step tracker, two columns, status footer). Every action calls one rule of products.js.

const ENR_VIEWS = ['enrichments', 'enrreq', 'enrappr'];
const VIEW_KEY = 'antz-enrichments-view';
const enrView = () => { if (!UI.f.enrView) { try { UI.f.enrView = localStorage.getItem(VIEW_KEY) || 'cards'; } catch (e) { UI.f.enrView = 'cards'; } } return UI.f.enrView; };
DO.enrView = v => { UI.f.enrView = v; try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* storage blocked: the choice lasts this visit */ } render(); };

const canRequest = () => can(UI.me, 'prodRequest');
const canApprove = () => CAN.prodReview.includes(role());
const myRequests = () => EN().requests.filter(r => r.by === UI.me && (UI.site === 'all' || r.site === UI.site));
const reviewable = r => r.state !== 'draft' && r.by !== UI.me && reviewScope(me(), r) && (UI.site === 'all' || r.site === UI.site);
const enrTabsBar = () => '';
const newFab = () => canRequest() ? Fab('New request', { do: 'enrNew' }) : '';
DO.enrNew = (a, el) => popover(el, menu([{ t: 'Request product', do: 'enrRequest' }, { t: 'Propose product', do: 'enrPropose' }]), { w: 230, side: 'top' });
const siteSub = () => esc(siteLabel());

/* ---------- tones ---------- */
const ST_TONE = { available: 'good', inuse: 'good', storage: 'info', transit: 'info', assessment: 'wait', repair: 'wait', missing: 'bad', retired: 'none', scrapped: 'none' };
const ST_BAND = { available: 'approved', inuse: 'approved', storage: 'progress', transit: 'progress', assessment: 'wait', repair: 'wait', missing: 'rejected', retired: 'none', scrapped: 'none' };
const statusTag = it => Tag(STATUS[it.status], ST_TONE[it.status]);
const REQ_TAG = { draft: 'none', pending: 'wait', approved: 'good', rejected: 'bad', completed: 'good' };
const REQ_ICON = { existing: 'layers', proposal: 'newitem', move: 'move', transfer: 'truck' };
const reqLabel = r => r.state === 'approved' && STAGE_T[transferStage(r)] ? STAGE_T[transferStage(r)] : REQ_STATE[r.state];
const reqTag = r => Tag(reqLabel(r), transferStage(r) === 'transit' ? 'info' : transferStage(r) === 'dispatch' ? 'wait' : REQ_TAG[r.state]);
function reqBand(r) {
  if (r.state === 'pending') return canReviewReq(UI.me, r) ? 'yours' : 'wait';
  if (r.state === 'approved') { const g = transferStage(r); return g === 'dispatch' ? (canDispatch(UI.me, r) ? 'yours' : 'wait') : g === 'transit' ? 'progress' : 'approved'; }
  return { draft: 'none', rejected: 'rejected', completed: 'completed' }[r.state];
}
const dueTag = due => { const d = dueOf(due); return d ? Tag(d.t, d.c === 'late' ? 'bad' : d.c === 'soon' ? 'wait' : 'none') : ''; };

/* ============ Products: each product definition with its physical items ============ */
const ENR_F = { st: '', cond: '', rv: '', mat: '', cust: '', loc: '', sp: '', an: '' };
const enrFilter = () => Object.assign({}, ENR_F, UI.f.enr);
// status filter: the stored statuses, plus Unavailable (any state that stops normal use) and Disposed / retired (records kept)
const ST_GROUP = { unavail: ['assessment', 'repair', 'transit', 'missing'], retired: ['retired', 'scrapped'] };
const ST_LABEL = k => k === 'unavail' ? 'Unavailable' : k === 'retired' ? 'Disposed / retired' : STATUS[k];
const stOk = (it, st) => !st || (ST_GROUP[st] ? ST_GROUP[st].includes(it.status) : it.status === st);
function enrTokens(f) {
  return [f.st && ['st', ST_LABEL(f.st)], f.cond && ['cond', COND[f.cond]], f.rv && ['rv', REVIEW[f.rv]], f.mat && ['mat', f.mat], f.cust && ['cust', f.cust === '__none' ? 'Awaiting assignment' : nm(f.cust)],
    f.loc && ['loc', locName(f.loc)], f.sp && ['sp', speciesOf(f.sp)?.name], f.an && ['an', animalOf(f.an)?.name]].filter(Boolean);
}
function enrMatch(it, f, q) {
  const a = productAssoc(it), p = productOf(it);
  return stOk(it, f.st) && (!f.cond || it.cond === f.cond) && (!f.rv || reviewState(it) === f.rv) && (!f.mat || materialOf(it) === f.mat)
    && (!f.cust || (f.cust === '__none' ? !it.custodian : it.custodian === f.cust)) && (!f.loc || it.loc === f.loc) && (!f.sp || a.species.includes(f.sp)) && (!f.an || a.animals.includes(f.an))
    && match(q, it.id, it.name, p.id, materialOf(it), locName(it.loc), siteName(it.site), inCharge(it), ACT_TYPE[p.type], it.ticket, spNames(a.species).join(' '), anNames(a.animals).join(' '));
}
const enrBase = (f = enrFilter()) => enrItems(f.st === 'retired').filter(inSite).filter(it => enrMatch(it, f, UI.q.enrichments || ''));
// groups: products with an item available for use first, then by name; inside a group the available items first
function productGroups(list) {
  const m = new Map();
  list.forEach(it => { if (!m.has(it.product)) m.set(it.product, []); m.get(it.product).push(it); });
  return [...m].map(([pid, items]) => ({ p: prodOf(pid), items: items.sort(byAvail), avail: items.filter(availableForUse).length }))
    .sort((x, y) => (y.avail > 0) - (x.avail > 0) || x.p.name.localeCompare(y.p.name));
}
// a product as one card: its definition in the header (tap → product), then its physical items as compact rows (tap → item)
const PC_ROWS = 5;
const itemLine = it => `<button class="ak-irow" data-go="#/enrichments/${it.id}"><span class="ak-irow__id">${it.id}${it.mode === 'batch' ? ` × ${it.qty}` : ''}</span><span class="ak-irow__s">${esc(placeOf(it))} · ${esc(inCharge(it))}</span><span class="ak-irow__e">${reviewTag(it, true)}${statusTag(it)}</span></button>`;
const productBlock = (g, withType) => `<section class="ak-pc"><button class="ak-pc__h" data-go="#/enrichments/${g.p.id}">${IconTile(glyphOf(g.p.name), { size: 44 })}<span class="ak-pc__b"><span class="ak-pc__t">${esc(g.p.name)}</span><span class="ak-pc__s">${esc([withType && ACT_TYPE[g.p.type], g.p.material, lifeText(g.p.life), trackText(g.p)].filter(Boolean).join(' · '))}</span></span>${g.avail ? Tag(`${g.avail} available`, 'good') : Tag('None available', 'none')}<span class="ak-row__chev">${ic('right', 18)}</span></button>
  <div class="ak-pc__rows">${g.items.slice(0, PC_ROWS).map(itemLine).join('')}</div>${g.items.length > PC_ROWS ? `<button class="ak-pc__more" data-go="#/enrichments/${g.p.id}">Show all ${g.items.length}</button>` : ''}</section>`;
// list layout: every item on one line, with its product
const itemFlat = it => `<button class="ak-row" data-go="#/enrichments/${it.id}"><span class="ak-row__b"><span class="ak-row__t">${esc(it.name)}${it.mode === 'batch' ? ` × ${it.qty}` : ''}</span><span class="ak-row__s">${it.id} • ${esc(placeOf(it))} • ${esc(inCharge(it))}</span></span><span class="ak-row__e">${reviewTag(it, true)}${statusTag(it)}</span><span class="ak-row__chev">${ic('right', 18)}</span></button>`;

VIEWS.enrichments = {
  label: 'Enrichments', hdr: 'Enrichments', icon: 'layers', layout: 'full',
  full(r) {
    const f = enrFilter(), type = UI.tab.enr || 'all', view = enrView(), base = enrBase(f), list = base.filter(it => type === 'all' || productType(it) === type);
    const tokens = enrTokens(f), withType = type === 'all', groups = productGroups(list);
    const body = !groups.length ? Card(EmptyState(UI.q.enrichments || tokens.length ? 'No matching items' : 'No items', '', 'layers', tokens.length ? Btn('Clear filters', { small: true, do: 'enrClear' }) : ''))
      : view === 'list' ? Card(groups.flatMap(g => g.items).map(itemFlat).join(''), 'ak-list') : `<div class="ak-pcs">${groups.map(g => productBlock(g, withType)).join('')}</div>`;
    return { title: 'Enrichments', key: type + view, fab: newFab(),
      tabs: CountTabs([{ key: 'all', label: 'All', count: base.length }, ...ENR_TYPES.map(t => ({ key: t, label: ACT_TYPE[t], count: base.filter(it => productType(it) === t).length }))], type, 'enrType'),
      listTitle: 'Products', search: 'Search product, ID, material, place or custodian', filter: { do: 'enrFilter', n: tokens.length }, tools: ViewSwitch(view, 'enrView'), searchKey: view,
      html: (tokens.length ? `<div class="ak-tokens">${Chips(tokens.map(([k, t]) => ({ key: k, label: t + ' ✕' })), '', 'enrUnset')}</div>` : '') + body };
  },
  slide(r) { return !r.id ? null : r.id.startsWith('EP-') ? productDefPanel(r.id) : productPanel(r.id); },
};
VIEWS.enrichments.sub = siteSub;
DO.enrType = t => { UI.tab.enr = t; render(); };
DO.enrUnset = k => { UI.f.enr = Object.assign(enrFilter(), { [k]: '' }); render(); };
DO.enrClear = () => { UI.f.enr = {}; render(); };
DO.enrFilter = () => {
  const all = enrItems(true).filter(inSite), act = all.filter(isActive), assoc = act.map(productAssoc);
  const sts = Object.keys(STATUS).filter(k => !ST_GROUP.retired.includes(k) && act.some(it => it.status === k)).concat(act.some(it => ST_GROUP.unavail.includes(it.status)) ? ['unavail'] : [], all.some(it => !isActive(it)) ? ['retired'] : []);
  const conds = Object.keys(COND).filter(k => act.some(it => it.cond === k)), rvs = ['soon', 'due', 'replace', 'none'].filter(k => act.some(it => reviewState(it) === k));
  const mats = (D.config.materials || []).filter(m => act.some(it => materialOf(it) === m)), custs = [...new Set(act.map(it => it.custodian).filter(Boolean))];
  const sps = [...new Set(assoc.flatMap(a => a.species))].map(speciesOf), ans = [...new Set(assoc.flatMap(a => a.animals))].map(animalOf);
  const locs = [...new Set(act.map(it => it.loc))].map(locOf).filter(Boolean);
  sheet({
    title: 'Filters', left: 'enrReset',
    body: f => fg('Status', [cOpts('', 'st', f, [['', 'Any'], ...sts.map(k => [k, ST_LABEL(k)])])]) + fg('Condition', [cOpts('', 'cond', f, [['', 'Any'], ...conds.map(k => [k, COND[k]])])])
      + fg('Usable life', [cOpts('', 'rv', f, [['', 'Any'], ...rvs.map(k => [k, REVIEW[k]])])])
      + fg('What, who and where', [cNav('Material', f.mat || 'Any', 'mat'), cNav('Custodian', f.cust === '__none' ? 'Awaiting assignment' : f.cust ? nm(f.cust) : 'Anyone', 'cust'), cNav('Location', f.loc ? locName(f.loc) : 'Any', 'loc'), cNav('Species', f.sp ? speciesOf(f.sp).name : 'Any', 'sp'), cNav('Animal', f.an ? animalOf(f.an).name : 'Any', 'an')]),
    pickers: {
      mat: () => pickerPage({ title: 'Material', key: 'mat', options: [{ v: '', t: 'Any' }, ...mats.map(m => ({ v: m, t: m }))] }),
      cust: () => pickerPage({ title: 'Custodian', key: 'cust', options: [{ v: '', t: 'Anyone' }, ...(act.some(it => !it.custodian) ? [{ v: '__none', t: 'Awaiting assignment' }] : []), ...peopleOpts(p => custs.includes(p.id)).map(o => Object.assign(o, { tile: Avatar(o.v, 32) }))] }),
      loc: () => pickerPage({ title: 'Location', key: 'loc', search: true, options: [{ v: '', t: 'Any' }, ...locs.map(l => ({ v: l.id, t: l.name, s: `${secName(l.section)} · ${siteName(l.site)}`, group: l.kind === 'enclosure' ? 'Enclosures' : 'Stores' }))] }),
      sp: () => pickerPage({ title: 'Species', key: 'sp', search: true, options: [{ v: '', t: 'Any' }, ...sps.map(sp => ({ v: sp.id, t: sp.name, s: sp.sci }))] }),
      an: f => pickerPage({ title: 'Animal', key: 'an', search: true, options: [{ v: '', t: 'Any' }, ...ans.filter(a => !f.sp || a.species === f.sp).map(a => ({ v: a.id, t: a.name, s: `${a.id} · ${locName(a.loc)}`, group: speciesOf(a.species).name }))] }),
    },
    done: { label: f => `Show ${enrBase(f).filter(it => (UI.tab.enr || 'all') === 'all' || productType(it) === UI.tab.enr).length}`, run: f => { UI.f.enr = Object.assign({}, f); return ''; } },
  }, enrFilter(), { side: true });
};
DO.enrReset = () => { Object.assign(SH.f, ENR_F); SH.dirty = true; refreshSheet(); };

/* ============ Product: full-screen panel ============ */
// the actions on a product for the person signed in; the step waiting for them first. The footer shows the first three.
function productActions(it) {
  const out = [], r = it.repair, tr = it.transfer, q = openTransferReq(it), add = (t, o) => out.push(Object.assign({ t }, o));
  if (tr && (UI.me === tr.to.custodian || (role() === 'afm' && me().sites.includes(tr.to.site)))) add('Acknowledge receipt', { do: 'actAck', arg: it.id });
  if (q && q.state === 'pending' && canReviewReq(UI.me, q)) add('Review request', { go: '#/enrappr/' + q.id });
  if (q && canDispatch(UI.me, q)) add('Dispatch', { do: 'enrDispatch', arg: q.id });
  if (r && r.state === 'assessment' && r.bio === 'pending' && can(UI.me, 'verifyBio')) add('Animal-use check', { do: 'actBio', arg: it.id });
  if (r && r.state === 'assessment' && r.bio !== 'pending' && can(UI.me, 'decide', it)) add('Decide', { do: 'actDecide', arg: it.id });
  if (r && r.state === 'approved' && can(UI.me, 'repairStart', it)) add('Start repair', { do: 'actStartRepair', arg: it.id });
  if (r && r.state === 'repair' && can(UI.me, 'repairDone', it)) add('Complete repair', { do: 'actCompleteRepair', arg: it.id });
  const custOk = isActive(it) && it.status !== 'transit' && can(UI.me, 'prodCustodian', it), lifeOk = isActive(it) && it.status !== 'transit' && canLife(UI.me, it);
  if (!it.custodian && custOk) add('Assign custodian', { do: 'enrCustodian', arg: it.id });
  if (lifeOk && ['soon', 'due', 'replace'].includes(reviewState(it))) add('Life review', { do: 'enrLifeReview', arg: it.id });
  if (!canRequest() && can(UI.me, 'move', it) && MOVABLE.includes(it.status) && it.custodian && usableForAnimals(it) && !it.disposal && !openMoveOf(it.id)) add('Assign for use', { do: 'enrAssign', arg: it.id });
  const mv = MOVABLE.includes(it.status) && !it.disposal && !openMoveOf(it.id), st = storeAction(it);
  if (canRequest() && !['transit', 'missing'].includes(it.status)) add('Request', { do: 'enrRequest', arg: it.id });
  if (st) add(st.kind === 'store' ? 'Store' : 'Return to use', { do: st.do, arg: `${it.id}|${st.kind}` });
  if (mv && (canRequest() || can(UI.me, 'move', it))) add('Move', { do: canRequest() ? 'enrMove' : 'actMove', arg: it.id });
  if (mv && (canRequest() ? D.sites.some(s => s.id !== it.site) : can(UI.me, 'transfer', it))) add('Transfer', { do: canRequest() ? 'enrTransfer' : 'actTransfer', arg: it.id });
  if (MOVABLE.includes(it.status) && can(UI.me, 'flag', ['bio', 'ws'].includes(role()) ? null : it)) add('Report issue', { do: 'actFlag', arg: it.id + '|enr' });
  if (lifeOk && !['soon', 'due', 'replace'].includes(reviewState(it))) add('Life review', { do: 'enrLifeReview', arg: it.id });
  if (lifeOk) add('Usable life', { do: 'enrLife', arg: it.id });
  return out;
}
// Store / Return to use: offered when the item can move and its section has a location of the other kind
function storeAction(it) {
  if (!MOVABLE.includes(it.status) || it.disposal || openMoveOf(it.id)) return null;
  const kind = it.status === 'storage' ? 'use' : 'store';
  if (!D.locations.some(l => l.section === it.section && l.id !== it.loc && (kind === 'store' ? l.kind === 'store' : l.kind !== 'store'))) return null;
  if (canRequest()) return { do: 'enrMove', kind };
  return can(UI.me, 'move', it) && kind === 'store' ? { do: 'actMove', kind } : null;   // into use: Assign for use
}
// the step tracker of what is in progress on the product: a transfer, or an issue and its repair
function productSteps(it) {
  const q = openTransferReq(it), tr = it.transfer, r = it.repair;
  if (q) { const g = transferStage(q); return [{ label: 'Requested', state: 'done', sub: `${esc(first(q.by))} · ${fs(q.submitted)}` }, { label: 'Approved', state: q.state === 'pending' ? 'now' : 'done', sub: q.decision ? `${esc(first(q.decision.by))} · ${fs(q.decision.at)}` : '' },
    { label: 'In transit', state: g === 'dispatch' || g === 'transit' ? 'now' : 'todo', sub: q.dispatched ? `${esc(first(q.dispatched.by))} · ${fs(q.dispatched.at)}` : '' }, { label: 'Received', state: 'todo', sub: esc(first(q.receiver)) }]; }
  if (tr) return [{ label: 'Dispatched', state: 'done', sub: `${esc(first(tr.by))} · ${fs(tr.dispatched)}` }, { label: 'Received', state: 'now', sub: esc(first(tr.to.custodian)) }];
  if (!r) return null;
  const steps = [{ label: 'Issue reported', state: 'done', sub: fs(r.opened) }];
  if (r.needBio) steps.push({ label: 'Animal-use check', state: r.bio === 'pending' ? 'now' : r.bio === 'unsuitable' ? 'stop' : 'done', sub: r.bio === 'pending' ? '' : r.bio === 'suitable' ? 'Suitable' : 'Unsuitable' });
  steps.push({ label: r.state === 'beyond' ? 'Beyond repair' : 'Decision', state: r.state === 'beyond' ? 'stop' : r.state === 'assessment' ? (r.bio === 'pending' ? 'todo' : 'now') : 'done', sub: esc(first(it.custodian)) });
  steps.push({ label: 'Repair', state: r.state === 'approved' || r.state === 'repair' ? 'now' : 'todo', sub: r.state === 'repair' ? esc(r.team) : '' });
  return steps;
}
function productPanel(id) {
  const it = itemOf(id);
  if (!it) return { close: '#/enrichments', title: 'Product', html: Card(EmptyState('Product not found', '', 'layers')), key: id };
  const lc = UI.f.enrLc && UI.f.enrLc.id === it.id ? UI.f.enrLc : { type: '', all: false };
  const a = productAssoc(it), r = it.repair, steps = productSteps(it), acts = productActions(it);
  const reqs = EN().requests.filter(x => x.item === it.id && (x.by === UI.me || reviewable(x))).sort((x, y) => y.at.localeCompare(x.at));
  const custOk = isActive(it) && it.status !== 'transit' && can(UI.me, 'prodCustodian', it), p = productOf(it), l = lifeOf(it), due = reviewDue(it);
  const head = `<div class="ak-head">${IconTile(glyphOf(it.name), { size: 56, tone: 'brand' })}<div class="ak-head__b"><div class="ak-head__t">${esc(it.name)}${it.mode === 'batch' ? ` × ${it.qty}` : ''}</div><div class="ak-head__x">${esc(it.status === 'transit' ? 'In transit' : locName(it.loc))} · ${esc(secName(it.section))} · ${esc(siteName(it.site))}</div></div></div>`;
  const ctag = c => Tag(COND[c], CTONE[c] === 'ok' ? 'good' : CTONE[c] === 'warn' ? 'wait' : CTONE[c] === 'bad' ? 'bad' : 'none');
  const details = Section({ title: 'Details' }, KV([['Custodian', `<span class="ak-kvline">${custodianCell(it)}${custOk ? LinkBtn(it.custodian ? 'Change' : 'Assign', { do: 'enrCustodian', arg: it.id }) : ''}</span>`], ['Condition', ctag(it.cond)],
    ['Tracking', `${esc(catCode(it))} · ${it.mode === 'batch' ? `Group · ${it.qty} units` : 'Individual'}`],
    ['Received', `${fd(it.received)}<small>${esc([it.ticket, it.mt, it.receivedCond && it.receivedCond !== it.cond && 'Arrived ' + COND[it.receivedCond].toLowerCase()].filter(Boolean).join(' · '))}</small>`], ['Last verified', fd(it.lastVerified)]]));
  const rv = (it.reviews || [])[0];
  const lifeS = Section({ title: 'Product and life' }, KV([['Product', LinkBtn(p.id, { go: '#/enrichments/' + p.id })], ['Material', esc(materialOf(it))],
    ['Usable life', l ? `${lifeText(l)}${it.life ? `<small>${esc(it.lifeWhy || '')}</small>` : ''}` : '<span class="t-mute">Not set</span>'],
    due && ['Review by', `<span class="ak-inl">${fd(due)}${reviewTag(it)}</span>`],
    rv && ['Last review', `${rv.outcome === 'fit' ? 'Still fit for use' : REVIEW.replace}<small>${esc([nm(rv.by), ft2(rv.at), rv.note].filter(Boolean).join(' · '))}</small>`]]));
  const replace = it.replace ? Note({ tone: 'bad', icon: 'alert', title: REVIEW.replace }, `${esc(it.replace.note)}<br>${esc(nm(it.replace.by))} · ${ft2(it.replace.at)}`) : '';
  const issue = r ? Section({ title: 'Open issue' }, KV([['Issue', esc(r.issue)], ['Reported', `${esc(nm(r.by))}<small>${ft2(r.opened)}</small>`], r.notes && ['Notes', esc(r.notes)], r.bioBy && ['Animal use', `${r.bio === 'suitable' ? 'Suitable' : 'Unsuitable'}<small>${esc(nm(r.bioBy))} · ${ft2(r.bioAt)}${r.bioNote ? ' · ' + esc(r.bioNote) : ''}</small>`], r.started && ['Repair', `${esc(r.team)}<small>Started ${ft2(r.started)}</small>`]])) : '';
  const past = (it.repairs || []).length ? Section({ title: 'Earlier issues', count: it.repairs.length }, it.repairs.map(x => `<div class="ak-row"><span class="ak-row__b"><span class="ak-row__t">${esc(x.issue)}</span><span class="ak-row__s">${x.id} · ${fs(x.opened)}${x.done?.notes ? ' · ' + esc(x.done.notes) : ''}</span></span>${Tag(REPAIR_OUT[x.state] || x.state, x.state === 'done' || x.state === 'cleared' ? 'good' : 'none')}</div>`).join('')) : '';
  const tq = openTransferReq(it), tr = it.transfer;
  const transferS = tq || tr ? Section({ title: 'Transfer' }, KV(tq ? [['To', `${esc(tq.toLoc ? locName(tq.toLoc) : secName(tq.toSection))}<small>${esc([tq.toLoc && secName(tq.toSection), siteName(tq.toSite)].filter(Boolean).join(' · '))}</small>`], ['Receiver', personRow(tq.receiver)], tq.ref && ['Reference', esc(tq.ref)], ['Request', LinkBtn(tq.id, { go: `#/${tq.by === UI.me ? 'enrreq' : 'enrappr'}/${tq.id}` })]]
    : [['To', `${esc(secName(tr.to.section))}<small>${esc(siteName(tr.to.site))}</small>`], ['Receiver', personRow(tr.to.custodian)], tr.ref && ['Reference', esc(tr.ref)]])) : '';
  const assoc = !a.species.length && !a.animals.length ? '' : Section({ title: 'Associations' }, KV([['Species', a.species.length ? esc(spNames(a.species).join(', ')) : '<span class="t-mute">None</span>'], ['Animals', a.animals.length ? esc(anNames(a.animals).join(', ')) : '<span class="t-mute">None</span>']]));
  const pa = productActivities(it);
  const activities = !pa.length ? '' : Section({ title: 'Enrichment activities', count: pa.length }, pa.length ? pa.map(x => { const st = activityStats(x.id); return `<div class="ak-row"><span class="ak-row__b"><span class="ak-row__t">${esc(x.name)}</span><span class="ak-row__s">${esc([ACT_TYPE[x.type], x.sub, x.mins + ' min', x.additives].filter(Boolean).join(' · '))}</span></span>${st.rating != null ? stars(st.rating) : ''}</div>`; }).join('') : EmptyState('No activities use this product', '', 'sparkle'));
  const requests = reqs.length ? Section({ title: 'Requests', count: reqs.length }, reqs.map(x => `<button class="ak-row" data-go="#/${x.by === UI.me ? 'enrreq' : 'enrappr'}/${x.id}"><span class="ak-row__b"><span class="ak-row__t">${REQ_KIND[x.kind]}</span><span class="ak-row__s">${x.id} · ${fs(x.submitted || x.at)}</span></span>${reqTag(x)}<span class="ak-row__chev">${ic('right', 18)}</span></button>`).join('')) : '';
  // history: stored events only, newest first, by type
  const ev = lifecycleEvents(it), types = Object.keys(LC_TYPE).filter(t => ev.some(e => e.type === t)), list = ev.filter(e => !lc.type || e.type === lc.type), shown = lc.all ? list : list.slice(0, 12);
  const history = Section({ title: 'History', count: ev.length }, (types.length > 1 ? `<div class="ak-histchips">${Chips([{ key: '', label: 'All' }, ...types.map(t => ({ key: t, label: LC_TYPE[t], count: ev.filter(e => e.type === t).length }))], lc.type, 'enrLcType')}</div>` : '')
    + (shown.length ? Timeline(shown.map(e => ({ title: e.title, who: nm(e.by), at: ft2(e.at) + (e.ref ? ' · ' + esc(e.ref) : ''), text: [e.from || e.to ? `${esc(e.from)}${e.from && e.to ? ' → ' : ''}${esc(e.to)}` : '', esc(e.note)].filter(Boolean).join('<br>'), tag: lc.type ? '' : Tag(LC_TYPE[e.type], 'none') }))) : EmptyState('Nothing recorded', '', 'history'))
    + (list.length > shown.length ? `<div class="ak-more">${LinkBtn(`Show all ${list.length}`, { do: 'enrLcAll' })}</div>` : ''));
  // footer: the current status, the first actions; the rest in the ⋮ menu
  const main = acts.slice(0, 3), rest = acts.slice(3);
  const foot = StatusFoot({ ago: ev[0] ? rel(ev[0].at) : '', label: STATUS[it.status] }, main.map((x, i) => Btn(x.t, Object.assign({ kind: i ? 'sec' : 'pri' }, x))).join(''));
  return { close: '#/enrichments', title: it.id, sub: esc(ACT_TYPE[productType(it)] || ''), key: it.id + '|' + lc.type + lc.all,
    right: rest.length ? `<button class="icon-btn" data-do="enrMore" data-arg="${it.id}" aria-label="More">${ic('more', 24)}</button>` : '',
    html: head + (steps ? Card(Stepper(steps), 'ak-stepcard') : '') + Cols(replace + details + lifeS + transferS + issue + assoc + activities + requests + past, history), foot };
}
DO.enrMore = (id, el) => popover(el, menu(productActions(itemOf(id)).slice(3).map(x => ({ t: x.t, do: x.do, arg: x.arg, go: x.go }))), { w: 240 });
DO.enrLcType = t => { UI.f.enrLc = { id: route().id, type: t, all: false }; render(); };
DO.enrLcAll = () => { const lc = UI.f.enrLc && UI.f.enrLc.id === route().id ? UI.f.enrLc : { type: '' }; UI.f.enrLc = { id: route().id, type: lc.type, all: true }; render(); };

/* ============ Requests: record cards; a request opens as a full-screen panel ============ */
const requestCard = (r, base, who) => RecordCard({ icon: REQ_ICON[r.kind], tileTone: r.kind === 'proposal' ? 'brand' : 'soft', heading: reqTitle(r) + (r.item && itemOf(r.item)?.mode === 'batch' && r.qty ? ` × ${r.qty}` : ''),
  meta: `${r.id} • ${REQ_KIND[r.kind]}${who ? ' • ' + esc(nm(r.by)) : ''}`, text: esc(r.reason || r.justification || ''), chips: r.kind === 'proposal' && ACT_TYPE[r.type] ? Tag(ACT_TYPE[r.type], 'info') : '',
  band: reqBand(r), label: reqLabel(r), when: rel(r.decision?.at || r.submitted || r.at), go: base + r.id });
const REQ_TABS = ['all', 'draft', 'pending', 'approved', 'rejected', 'completed'];
VIEWS.enrreq = {
  label: 'Requests', hdr: 'Requests', icon: 'layers', layout: 'full', sub: siteSub,
  allow: () => canRequest() || EN().requests.some(r => r.by === UI.me),
  full() {
    const tab = UI.tab.enrreq || 'all', q = UI.q.enrreq || '';
    const base = myRequests().filter(x => match(q, x.id, reqTitle(x), REQ_KIND[x.kind], x.reason));
    const list = base.filter(x => tab === 'all' || x.state === tab).sort((x, y) => (y.submitted || y.at).localeCompare(x.submitted || x.at));
    return { title: 'Requests', key: tab, fab: newFab(), listTitle: 'My requests', search: 'Search request or product',
      tabs: CountTabs(REQ_TABS.map(k => ({ key: k, label: k === 'all' ? 'All' : k === 'pending' ? 'Pending' : REQ_STATE[k], count: base.filter(x => k === 'all' || x.state === k).length })), tab, 'enrReqTab'),
      html: list.length ? CardGrid(list.map(x => requestCard(x, '#/enrreq/')).join('')) : Card(EmptyState(q ? 'No results' : 'No requests', '', 'newitem')) };
  },
  slide(r) { return r.id ? requestPanel(r.id, false, '#/enrreq') : null; },
};
DO.enrReqTab = t => { UI.tab.enrreq = t; render(); };
VIEWS.enrappr = {
  label: 'Requests', hdr: 'Requests', icon: 'layers', layout: 'full', allow: canApprove, sub: siteSub,
  full() {
    const tab = UI.tab.enrappr || 'pending', kind = UI.f.enrappr?.kind || '', q = UI.q.enrappr || '', dels = deliveries();
    const inTab = x => tab === 'pending' ? x.state === 'pending' : tab === 'dispatch' ? transferStage(x) === 'dispatch' : x.state !== 'pending' && transferStage(x) !== 'dispatch';
    const all = EN().requests.filter(reviewable), scope = all.filter(x => inTab(x) && match(q, x.id, reqTitle(x), nm(x.by), REQ_KIND[x.kind], siteName(x.site)));
    const list = scope.filter(x => !kind || x.kind === kind).sort((x, y) => tab === 'decided' ? (y.decision?.at || '').localeCompare(x.decision?.at || '') : x.submitted.localeCompare(y.submitted));
    const chips = Chips([{ key: '', label: 'All', count: scope.length }, ...Object.entries(REQ_KIND).map(([k, t]) => ({ key: k, label: t, count: scope.filter(x => x.kind === k).length })).filter(x => x.count)], kind, 'enrApprKind');
    const tabs = CountTabs([{ key: 'pending', label: 'Pending approval', count: all.filter(x => x.state === 'pending').length }, { key: 'dispatch', label: 'To dispatch', count: all.filter(x => transferStage(x) === 'dispatch').length },
      { key: 'receive', label: 'To receive', count: dels.length }, { key: 'decided', label: 'Decided', count: all.filter(x => x.state !== 'pending' && transferStage(x) !== 'dispatch').length }], tab, 'enrApprTab');
    if (tab === 'receive') {
      const dl = dels.filter(t => match(q, t.id, t.name, t.mt, t.ws, secName(t.section))).sort((x, y) => x.dispatched.localeCompare(y.dispatched));
      return { title: 'Requests', key: tab, listTitle: 'Deliveries', search: 'Search delivery, product or reference', searchKey: tab, tabs,
        html: dl.length ? CardGrid(dl.map(deliveryCard).join('')) : Card(EmptyState('Nothing to receive', '', 'ok')) };
    }
    return { title: 'Requests', key: tab + kind, listTitle: 'Approvals', search: 'Search request, product or biologist', searchKey: tab === 'receive' ? 'receive' : 'appr', tabs,
      html: `<div class="ak-chiprow">${chips}</div>` + (list.length ? CardGrid(list.map(x => requestCard(x, '#/enrappr/', true)).join('')) : Card(EmptyState(tab === 'pending' ? 'Nothing to review' : tab === 'dispatch' ? 'Nothing to dispatch' : 'No decisions', '', 'ok'))) };
  },
  slide(r) { if (r.id && r.id.startsWith('TK-')) { UI.tab.enrappr = 'receive'; return deliveryPanel(r.id); } return r.id ? requestPanel(r.id, true, '#/enrappr') : null; },
};
DO.enrApprTab = t => { UI.tab.enrappr = t; render(); };
DO.enrApprKind = k => { UI.f.enrappr = { kind: k }; render(); };

function requestRows(r) {
  const it = r.item && itemOf(r.item), link = it ? LinkBtn(it.id, { go: '#/enrichments/' + it.id }) : '';
  const rows = {
    existing: [['Product', link], it && it.mode === 'batch' && ['Quantity', `${r.qty}`], ['Custodian', personRow(r.custodian)]],
    proposal: [['Description', esc(r.description)], r.details && ['Details', esc(r.details)], ['Justification', esc(r.justification)], ['Site', esc(siteName(r.site))], ['Custodian', personRow(r.custodian)]],
    move: [['Product', link], ['From', esc(locName(r.from))], ['To', r.to ? esc(locName(r.to)) : ''], it && it.mode === 'batch' && ['Quantity', `${r.qty}`]],
    transfer: [['Product', link], ['From', `${esc(locName(r.from))}<small>${esc(siteName(r.site))}</small>`], ['To', r.toSection ? `${esc(r.toLoc ? locName(r.toLoc) : secName(r.toSection))}<small>${esc([r.toLoc && secName(r.toSection), siteName(r.toSite)].filter(Boolean).join(' · '))}</small>` : ''], ['Receiving custodian', r.receiver ? personRow(r.receiver) : ''], r.ref && ['Reference', esc(r.ref)]],
  }[r.kind];
  return [...rows, r.reason && ['Reason', esc(r.reason)], r.notes && ['Notes', esc(r.notes)]];
}
function requestSteps(r) {
  if (r.state === 'draft') return [{ label: 'Draft', state: 'now' }, { label: 'Approved', state: 'todo' }];
  const s = [{ label: 'Submitted', state: 'done', sub: fs(r.submitted) }, { label: r.state === 'rejected' ? 'Rejected' : 'Approved', state: r.state === 'pending' ? 'now' : r.state === 'rejected' ? 'stop' : 'done', sub: r.decision ? `${esc(first(r.decision.by))} · ${fs(r.decision.at)}` : '' }];
  if (r.kind === 'move') s.push({ label: 'Completed', state: r.state === 'completed' ? 'done' : 'todo' });
  if (r.kind === 'transfer') { const g = transferStage(r); s.push({ label: 'In transit', state: g === 'received' ? 'done' : g === 'dispatch' || g === 'transit' ? 'now' : 'todo', sub: r.dispatched ? fs(r.dispatched.at) : '' }, { label: 'Received', state: g === 'received' ? 'done' : 'todo', sub: r.completed ? fs(r.completed.at) : '' }); }
  return s;
}
function requestPanel(id, review, back) {
  const r = ereqOf(id);
  if (!r) return { close: back, title: 'Request', html: Card(EmptyState('Request not found', '', 'newitem')), key: id };
  const it = r.item && itemOf(r.item), own = r.by === UI.me, assoc = { species: r.species, animals: r.animals, loc: r.loc };
  const head = `<div class="ak-head">${it ? IconTile(glyphOf(it.name), { size: 56, tone: 'brand' }) : IconTile(REQ_ICON[r.kind], { size: 56, tone: 'brand' })}<div class="ak-head__b"><div class="ak-head__t">${esc(reqTitle(r))}${it && it.mode === 'batch' && r.qty ? ` × ${r.qty}` : ''}</div><div class="ak-head__x">${it ? `${esc(where(it))}` : esc(ACT_TYPE[r.type] || '')}</div><div class="ak-head__c">${reqTag(r)}</div></div></div>`;
  const approver = r.state === 'draft' || r.state === 'rejected' ? '' : Section({ title: 'Approver', flush: true }, r.decision ? ApproverRow({ state: 'approved', name: nm(r.decision.by), role: ROLE_SHORT[person(r.decision.by).role], reason: r.decision.note })
    : ApproverRow({ state: 'awaiting', name: reviewersOf(r).map(p => p.name).join(' or '), role: 'Supervisor or site manager' }));
  const main = Section({ title: 'Request' }, KV(requestRows(r))) + approver + (hasAssoc(assoc) ? Section({ title: 'Associations' }, KV([assoc.species.length && ['Species', esc(spNames(assoc.species).join(', '))], assoc.animals.length && ['Animals', esc(anNames(assoc.animals).join(', '))], assoc.loc && ['Enclosure', esc(locName(assoc.loc))]])) : '') + (r.photos && r.photos.length ? Section({ title: 'Supporting photos' }, photos(r.photos)) : '');
  // the decision note is shown by the approver row or the end card, so the history leaves it out
  const side = Section({ title: 'History', count: r.log.length }, Timeline(r.log.map(l => ({ title: l.act, who: nm(l.by), at: ft2(l.at), text: ['Approved', 'Rejected'].includes(l.act) ? '' : esc(l.note || '') }))));
  // footer: decision buttons for the reviewer; dispatch for the sender; edit / withdraw / submit / revise for the requester
  let buttons = '', end = '';
  if (review && r.state === 'pending' && canReviewReq(UI.me, r)) buttons = DecisionButtons({ approve: 'enrApprove', reject: 'enrReject', arg: r.id });
  else if (review && canDispatch(UI.me, r)) buttons = Btn('Dispatch', { kind: 'pri', icon: 'truck', do: 'enrDispatch', arg: r.id });
  else if (own && r.state === 'draft') buttons = Btn('Delete', { kind: 'danger', do: 'enrDelete', arg: r.id }) + Btn('Edit', { do: 'enrEdit', arg: r.id }) + Btn('Submit', { kind: 'pri', do: 'enrSubmit', arg: r.id });
  else if (own && r.state === 'pending') buttons = Btn('Withdraw', { kind: 'danger', do: 'enrWithdraw', arg: r.id }) + Btn('Edit', { kind: 'pri', do: 'enrEdit', arg: r.id });
  if (r.state === 'rejected') end = `<div class="ak-endrow">${EndCard({ kind: 'rejected', title: 'Request rejected', name: nm(r.decision.by), role: ROLE_SHORT[person(r.decision.by).role], when: ft2(r.decision.at), reason: r.decision.note })}${own && !EN().requests.some(x => x.from === r.id) ? Btn('Revise', { kind: 'pri', do: 'enrRevise', arg: r.id }) : ''}</div>`;
  const foot = StatusFoot({ ago: rel(r.log[0].at), label: reqLabel(r) }, buttons, end);
  return { close: back, title: r.id, sub: REQ_KIND[r.kind], key: r.id, html: head + Card(Stepper(requestSteps(r)), 'ak-stepcard') + Cols(main, side), foot };
}
// Approve: no dialog, the result banner confirms it (Components.md); Reject: the reason dialog, the reason is required
DO.enrApprove = id => {
  const r = ereqOf(id), snap = snapshot();
  try { trial(() => approveRequest(id, UI.me, '')); } catch (e) { toast(e.message, { bad: true }); return; }
  save(); showBanner(id, 'approved', r.kind === 'move' ? 'You Approved · Movement completed' : 'You Approved');
  setTimeout(() => toast('Request approved', { undo: snap }), 1800);
};
DO.enrReject = id => sheet({ title: 'Reject request', body: f => fg('', [cArea('Reason', 'note', f, true, true)]),
  done: { label: 'Reject', kind: 'danger', ok: f => f.note.trim(), run: f => { rejectRequest(id, UI.me, f.note); setTimeout(() => showBanner(id, 'rejected', 'Request Rejected'), 0); return ''; } } }, { note: '' }, { dialog: true });

/* ============ sheets ============ */
// one form for every request type: k = existing | proposal | move | transfer; edit = the request being edited
function requestSheet(k, init, edit) {
  const it0 = init.item && itemOf(init.item);
  const siteOfForm = f => k === 'proposal' ? (f.loc ? locOf(f.loc).site : f.site) : itemOf(f.item)?.site;
  const products = () => enrProducts().filter(it => inSite(it) && mySites().includes(it.site));
  const titles = { existing: 'Request product', proposal: 'Propose product', move: 'Movement request', transfer: 'Transfer request' };
  const prodCell = f => it0 || edit ? sumItem(itemOf(f.item)) : fg('', [cNav('Product', itemOf(f.item)?.name || '', 'item', true)]);
  const body = f => {
    const it = f.item && itemOf(f.item);
    if (k === 'proposal') return fg('Product', [cText('Name', 'name', f, true), cOpts('Enrichment type', 'type', f, ENR_TYPES.map(t => [t, ACT_TYPE[t]]), true), cArea('Description', 'description', f, true), cText('Details', 'details', f)])
      + fg('', [cArea('Justification', 'justification', f, true), mySites().length > 1 && !f.loc && cNav('Site', siteName(f.site), 'site', true), cNav('Custodian', nm(f.custodian), 'custodian')])
      + cAssoc(f) + fg('Supporting information', [cPhotos('photos', f)]);
    if (k === 'existing') return prodCell(f) + (it && it.mode === 'batch' ? fg('', [cStep('Quantity', 'qty', f, 1, it.qty)]) : '')
      + fg('Request', [cArea('Reason', 'reason', f, true), cArea('Notes', 'notes', f), cNav('Custodian', nm(f.custodian), 'custodian')]) + cAssoc(f);
    if (k === 'move') return prodCell(f) + fg('Destination', [cNav('To', locName(f.to), 'to', true), it.mode === 'batch' && cStep('Quantity', 'qty', f, 1, it.qty)])
      + fg('Reason', [cOpts('', 'reason', f, REASONS, true), cArea('Notes', 'notes', f)]) + cAssoc(f);
    const needRef = (catOf(it).req?.transfer || []).includes('ref');
    return prodCell(f) + fg('To', [cNav('Site', siteName(f.toSite), 'toSite', true), f.toSite && cNav('Section', secName(f.toSection), 'toSection', true), f.toSection && cNav('Location', locName(f.toLoc), 'toLoc'), f.toSection && cNav('Receiving custodian', f.receiver ? nm(f.receiver) : '', 'receiver', true), cText('Material-transfer reference', 'ref', f, needRef)])
      + fg('Reason', [cArea('Reason', 'reason', f, true), cArea('Notes', 'notes', f)]);
  };
  const ok = f => k === 'proposal' ? f.name.trim() && f.type && f.description.trim() && f.justification.trim() && (f.site || f.loc)
    : f.item && f.reason.trim() && (k !== 'move' || f.to) && (k !== 'transfer' || (f.toSite && f.toSection && f.receiver));
  const payload = f => Object.assign({ kind: k }, f);
  const review = f => {
    const it = f.item && itemOf(f.item), sp = spNames(f.species), an = anNames(f.animals);
    return reviewOf([k === 'proposal' ? ['Product', esc(f.name)] : ['Product', `${esc(it.name)} · ${it.id}`], k === 'proposal' && ['Enrichment type', ACT_TYPE[f.type]],
      it && it.mode === 'batch' && k !== 'transfer' && ['Quantity', `${f.qty} of ${it.qty}`], k === 'move' && ['To', esc(locName(f.to))],
      k === 'transfer' && ['To', esc([f.toLoc ? locName(f.toLoc) : secName(f.toSection), siteName(f.toSite)].join(' · '))], k === 'transfer' && ['Receiver', esc(nm(f.receiver))],
      f.reason && ['Reason', esc(f.reason)], ['existing', 'proposal'].includes(k) && ['Custodian', esc(nm(f.custodian))],
      sp.length && ['Species', esc(sp.join(', '))], an.length && ['Animals', esc(an.join(', '))], f.loc && ['Enclosure', esc(locName(f.loc))],
      ['Reviewer', esc(reviewersOf(shapeRequest(UI.me, payload(f))).map(p => p.name).join(' or ') || '—')]]);
  };
  const editing = edit && edit.state === 'pending';
  const page = {
    title: edit ? 'Edit request' : k === 'move' && init.dest ? (init.dest === 'store' ? 'Move to storage' : 'Return to use') : titles[k],
    body: f => body(f), alt: editing ? [] : [{ label: 'Save as draft', do: 'enrDraft' }],
    draft: f => { if (edit) { updateRequest(edit.id, UI.me, payload(f)); return { msg: 'Draft saved', go: '#/enrreq/' + edit.id }; } const id = createRequest(UI.me, payload(f), true); return { msg: 'Draft saved', go: '#/enrreq/' + id }; },
    pickers: Object.assign(assocPickers(siteOfForm), {
      item: () => pickerPage({ title: 'Product', key: 'item', search: true, after: f => { const it = itemOf(f.item); f.qty = it.mode === 'batch' ? Math.min(f.qty || 1, it.qty) : 1; },
        options: products().map(it => ({ v: it.id, t: it.name, s: `${it.id} · ${where(it)}`, group: ACT_TYPE[productType(it)], dis: ['transit', 'missing'].includes(it.status) })) }),
      custodian: f => pickerPage({ title: 'Custodian', key: 'custodian', options: peopleOpts(p => ['bio', 'sup', 'afm'].includes(p.role) && p.sites.includes(siteOfForm(f) || mySites()[0])) }),
      site: () => pickerPage({ title: 'Site', key: 'site', options: mySites().map(s => ({ v: s, t: siteName(s) })) }),
      to: f => { const it = itemOf(f.item), use = usableForAnimals(it); return pickerPage({ title: 'Destination', key: 'to', options: locOpts(l => l.section === it.section && l.id !== it.loc && (!f.dest || (f.dest === 'store') === (l.kind === 'store'))).map(o => Object.assign(o, { dis: locOf(o.v).kind === 'enclosure' && !use })) }); },
      toSite: f => pickerPage({ title: 'Site', key: 'toSite', after: g => { g.toSection = ''; g.toLoc = ''; g.receiver = ''; }, options: D.sites.filter(s => s.id !== itemOf(f.item).site).map(s => ({ v: s.id, t: s.name })) }),
      toSection: f => pickerPage({ title: 'Section', key: 'toSection', after: g => { g.toLoc = ''; const rc = receiversOf(g.toSection); if (!rc.some(p => p.id === g.receiver)) g.receiver = rc.length === 1 ? rc[0].id : (rc.find(p => p.role === 'sup') || {}).id || ''; }, options: D.sections.filter(s => s.site === f.toSite).map(s => ({ v: s.id, t: s.name })) }),
      toLoc: f => pickerPage({ title: 'Location', key: 'toLoc', options: [{ v: '', t: 'Any' }, ...locOpts(l => l.section === f.toSection)] }),
      receiver: f => pickerPage({ title: 'Receiving custodian', key: 'receiver', options: peopleOpts(p => receiversOf(f.toSection).some(x => x.id === p.id)) }),
    }),
    done: {
      label: 'Next', confirm: edit ? (editing ? 'Save' : 'Submit') : 'Submit', ok, review,
      run: f => {
        if (edit) { updateRequest(edit.id, UI.me, payload(f)); if (!editing) submitRequest(edit.id, UI.me); return { msg: editing ? 'Request updated' : 'Request submitted', go: '#/enrreq/' + edit.id }; }
        const id = createRequest(UI.me, payload(f)); return { msg: 'Request submitted', go: '#/enrreq/' + id };
      },
    },
  };
  sheet(page, Object.assign({ item: '', qty: 1, reason: '', notes: '', species: [], animals: [], loc: '', custodian: UI.me, name: '', type: '', description: '', details: '', justification: '', photos: [],
    site: UI.site !== 'all' ? UI.site : mySites()[0], to: '', toSite: '', toSection: '', toLoc: '', receiver: '', ref: '' }, init));
}
DO.enrRequest = id => { closePop(true); requestSheet('existing', { item: id || '' }); };
DO.enrPropose = () => { closePop(true); requestSheet('proposal', {}); };
// enrMove('EF-x') or 'EF-x|store' / 'EF-x|use' — the same movement request, with the destinations of that kind
DO.enrMove = arg => { closePop(true); const [id, dest = ''] = String(arg).split('|'); requestSheet('move', { item: id, qty: itemOf(id).qty, dest, reason: dest === 'store' ? 'Storage' : dest === 'use' ? 'Rotation' : '' }); };
DO.enrTransfer = id => { closePop(true); requestSheet('transfer', { item: id }); };
DO.enrEdit = id => { const r = ereqOf(id); requestSheet(r.kind, JSON.parse(JSON.stringify(r)), r); };
// Save as draft: runs the page's draft rule on a copy first, like Done, so a refusal leaves nothing behind
DO.enrDraft = () => {
  const p = SH.stack[0], snap = snapshot();
  try { const res = trial(() => p.draft(SH.f)); save(); closeSheet(); go(res.go); toast(res.msg, { undo: snap }); }
  catch (e) { SH.err = e.message; drawSheet('refresh'); }
};
DO.enrSubmit = id => act(() => submitRequest(id, UI.me), 'Request submitted');
DO.enrRevise = id => { const nid = act(() => reviseRequest(id, UI.me), 'Draft created'); if (nid) go('#/enrreq/' + nid); };
const confirmPop = (el, t, doo, arg) => popover(el, menu([{ t, do: doo, arg, danger: true }, { t: 'Keep', do: 'popClose' }]), { w: 230 });
DO.enrWithdraw = (id, el) => confirmPop(el, 'Withdraw request', 'enrWithdrawGo', id);
DO.enrWithdrawGo = id => { closePop(); act(() => withdrawRequest(id, UI.me), 'Request withdrawn'); };
DO.enrDelete = (id, el) => confirmPop(el, 'Delete draft', 'enrDeleteGo', id);
DO.enrDeleteGo = id => { closePop(); if (act(() => deleteDraft(id, UI.me), 'Draft deleted') !== undefined || !ereqOf(id)) go('#/enrreq'); };

// enrDecide('ER-x|yes') — approve or reject; rejection needs a comment; approving a movement or transfer completes it
DO.enrDecide = arg => {
  closePop(true);
  const [id, pre = ''] = String(arg).split('|'), r = ereqOf(id), ends = r.kind === 'move';
  sheet({
    title: 'Review request',
    body: f => reqSum(r) + fg('Decision', [cSeg('ok', f, [['yes', 'Approve'], ['no', 'Reject']]), cArea(f.ok === 'no' ? 'Comments' : 'Note', 'note', f, f.ok === 'no', true)]),
    done: {
      label: 'Next', get confirm() { return SH && SH.f.ok === 'no' ? 'Reject' : 'Approve'; }, ok: f => f.ok && (f.ok === 'yes' || f.note.trim()),
      review: f => reqSum(r) + reviewOf([['Decision', f.ok === 'yes' ? 'Approve' : 'Reject'], f.note.trim() && [f.ok === 'no' ? 'Comments' : 'Note', esc(f.note)], ['Status', f.ok === 'no' ? REQ_STATE.rejected : ends ? REQ_STATE.completed : REQ_STATE.approved],
        f.ok === 'yes' && r.kind === 'move' && ['Moves to', esc(locName(r.to))], f.ok === 'yes' && r.kind === 'transfer' && ['Next', 'Dispatch']]),
      run: f => { if (f.ok === 'yes') { approveRequest(id, UI.me, f.note); return ends ? `${REQ_KIND[r.kind]} completed` : 'Request approved'; } rejectRequest(id, UI.me, f.note); return 'Request rejected'; },
    },
  }, { ok: pre, note: '' });
};

// custodian: direct change, no approval; a review page confirms it
DO.enrCustodian = id => {
  closePop(true);
  const it = itemOf(id);
  sheet({
    title: it.custodian ? 'Change custodian' : 'Assign custodian',
    body: f => sumItem(it) + fg('', [it.custodian && cInfo('Current', personRow(it.custodian)), cNav(it.custodian ? 'New custodian' : 'Custodian', f.to ? nm(f.to) : '', 'to', true), cArea('Note', 'note', f)]),
    pickers: { to: () => pickerPage({ title: 'New custodian', key: 'to', options: peopleOpts(p => custodianChoices(it).some(x => x.id === p.id) && p.id !== it.custodian) }) },
    done: { label: 'Next', confirm: it.custodian ? 'Change' : 'Assign', ok: f => f.to, review: f => sumItem(it) + reviewOf([it.custodian && ['From', esc(nm(it.custodian))], ['To', esc(nm(f.to))], f.note.trim() && ['Note', esc(f.note)]]),
      run: f => { reassignCustodian(id, UI.me, { to: f.to, note: f.note }); return `${nm(f.to)} is now the custodian`; } },
  }, { to: '', note: '' });
};

// dispatch an approved transfer: the sending supervisor or site manager; the item goes In transit through transfer()
DO.enrDispatch = id => {
  closePop(true);
  const r = ereqOf(id), it = itemOf(r.item), needRef = (catOf(it).req?.transfer || []).includes('ref');
  const to = [r.toLoc ? locName(r.toLoc) : secName(r.toSection), siteName(r.toSite)].join(' · ');
  sheet({
    title: 'Dispatch transfer',
    body: f => sumItem(it) + fg('Dispatch', [cDate('Date', 'date', f, true), cText('Material-transfer reference', 'ref', f, needRef), cArea('Note', 'note', f)]),
    done: { label: 'Next', confirm: 'Dispatch', ok: f => f.date && (!needRef || f.ref.trim()),
      review: f => sumItem(it) + reviewOf([['To', esc(to)], ['Receiver', esc(nm(r.receiver))], ['Date', fd(f.date)], f.ref.trim() && ['Reference', esc(f.ref)], ['Status', STATUS.transit]]),
      run: f => { dispatchTransfer(id, UI.me, f); return 'Dispatched · in transit'; } },
  }, { date: day(nowIs()), ref: r.ref || '', note: '' });
};

/* ============ Home: only what this person has to do in the Enrichments flow ============ */
// biologist: animal-use checks, own drafts and rejected requests · supervisor / site manager: reviews, dispatches, receipts, repair decisions
function enrTasks() {
  const p = me(), out = [], item = (it, k, btn, d, due) => out.push({ k, t: it.name, s: it.id, due: due ? day(due) : '', go: '#/enrichments/' + it.id, do: d, arg: it.id, btn });
  productTasks(UI.me).filter(t => inSite(ereqOf(t.ref))).forEach(t => out.push(t.kind === 'prodDispatch'
    ? { k: 'Dispatch', t: t.title, s: t.ref, due: t.due, go: '#/enrappr/' + t.ref, do: 'enrDispatch', arg: t.ref, btn: 'Dispatch' }
    : { k: 'Review', t: t.title, s: t.ref, due: t.due, go: '#/enrappr/' + t.ref, btn: 'Review' }));
  if (canRequest()) EN().requests.filter(r => r.by === UI.me && inSite(r) && (r.state === 'draft' || (r.state === 'rejected' && !EN().requests.some(x => x.from === r.id))))
    .forEach(r => out.push({ k: r.state === 'draft' ? 'Draft' : 'Rejected', t: reqTitle(r), s: r.id, due: '', go: '#/enrreq/' + r.id, do: r.state === 'draft' ? 'enrSubmit' : 'enrRevise', arg: r.id, btn: r.state === 'draft' ? 'Submit' : 'Revise' }));
  enrProducts().forEach(it => {
    const r = it.repair, tr = it.transfer;
    if (tr && (UI.me === tr.to.custodian || (p.role === 'afm' && p.sites.includes(tr.to.site)))) item(it, 'Receive', 'Acknowledge', 'actAck', addDays(tr.dispatched, 2));
    if (!inSite(it) || !r) return;
    if (r.state === 'assessment' && r.bio === 'pending' && can(UI.me, 'verifyBio')) item(it, 'Animal-use check', 'Check', 'actBio', addDays(r.opened, D.config.assessDays));
    if (r.state === 'assessment' && r.bio !== 'pending' && can(UI.me, 'decide', it)) item(it, 'Decide repair', 'Decide', 'actDecide', addDays(r.opened, D.config.assessDays));
    if (r.state === 'approved' && can(UI.me, 'repairStart', it)) item(it, 'Repair', 'Start', 'actStartRepair', '');
    if (r.state === 'repair' && can(UI.me, 'repairDone', it)) item(it, 'In repair', 'Complete', 'actCompleteRepair', addDays(r.started, D.config.repairDays));
  });
  registerTasks(UI.me).filter(t => UI.site === 'all' || t.site === UI.site).forEach(t => out.push(
    t.kind === 'receipt' ? { k: 'Delivery', t: t.title, s: t.ref, due: t.due, go: '#/enrappr/' + t.ref, do: 'enrReceive', arg: t.ref, btn: 'Receive' }
      : t.kind === 'assign' ? { k: 'Assign custodian', t: t.title, s: t.ref, due: '', go: '#/enrichments/' + t.ref, do: 'enrCustodian', arg: t.ref, btn: 'Assign' }
        : { k: 'Life review', t: t.title, s: t.ref, due: t.due, go: '#/enrichments/' + t.ref, do: 'enrLifeReview', arg: t.ref, btn: 'Review' }));
  return out.sort((x, y) => String(x.due || '9').localeCompare(String(y.due || '9')));
}
// notifications of this flow only: the biologist's request updates; for supervisors and site managers also transfers and repairs
function myNotifications() {
  const keep = role() === 'bio' ? ['enr'] : ['enr', 'transfer', 'repair', 'receipt'];
  return notifications(UI.me).filter(n => keep.includes(n.kind)).map(n => n.kind === 'enr' ? n : Object.assign({}, n, { href: n.href.replace('#/item/', '#/enrichments/').replace('#/receive/', '#/enrappr/') }));
}
DO.bell = (a, el) => { const ns = myNotifications(); popover(el.closest('.icon-btn') || el, `<div class="pop__h">Notifications</div>${ns.length ? ns.map(notifRow).join('') : empty('bell', 'No notifications', '', true)}`, { w: 380 }); };
// Home: task tiles by kind (tap to filter), then To do and Updates (anything already in To do is left out)
const homeGroup = k => ['Decide repair', 'Repair', 'In repair'].includes(k) ? 'Repairs' : k === 'Draft' || k === 'Rejected' ? 'My requests' : ['Delivery', 'Assign custodian'].includes(k) ? 'Receive' : k === 'Life review' ? 'Life reviews' : k;
const homeTiles = () => role() === 'bio' ? [['Animal-use check', 'paw', 'Animal-use checks'], ['Life reviews', 'clock', 'Life reviews'], ['My requests', 'newitem', 'Drafts and rejected']]
  : [['Review', 'newitem', 'To review'], ['Dispatch', 'truck', 'To dispatch'], ['Receive', 'receive', 'To receive'], ['Repairs', 'repairs', 'Repairs'], ['Life reviews', 'clock', 'Life reviews']];
const taskRowK = t => `<div class="ak-row"><button class="ak-row__b" data-go="${t.go}"><span class="ak-row__t">${esc(t.t)}</span><span class="ak-row__s">${esc(t.k)} · ${esc(t.s)}</span></button><span class="ak-row__e">${dueTag(t.due)}${t.do ? Btn(t.btn, { small: true, do: t.do, arg: t.arg }) : Btn(t.btn, { small: true, go: t.go })}</span></div>`;
VIEWS.today = {
  label: 'Home', hdr: 'Home', icon: 'today', layout: 'full', sub: siteSub,
  full() {
    const all = enrTasks(), pick = UI.f.home || '', list = all.filter(t => !pick || homeGroup(t.k) === pick);
    const todo = new Set(all.map(t => t.go)), notes = myNotifications().filter(n => !todo.has(n.href));
    const tiles = homeTiles();
    const updates = notes.slice(0, 10).map(n => `<button class="ak-row" data-go="${n.href}"><span class="ak-row__b"><span class="ak-row__t">${esc(n.title)}</span><span class="ak-row__s">${esc(n.text)}</span></span><span class="ak-row__chev">${ic('right', 18)}</span></button>`).join('');
    return { title: 'Home', key: UI.me + pick, html: `<div class="ak-tiles" style="--n:${tiles.length}">${tiles.map(([g, icon, label]) => TaskTile({ icon, label, count: all.filter(t => homeGroup(t.k) === g).length, on: pick === g, do: 'homePick', arg: g })).join('')}</div>`
      + Cols(Section({ title: 'To do', count: list.length }, list.length ? list.map(taskRowK).join('') : EmptyState('All clear', '', 'ok')), Section({ title: 'Updates' }, updates || EmptyState('No updates', '', 'bell'))) };
  },
};
DO.homePick = g => { UI.f.home = UI.f.home === g ? '' : g; render(); };
