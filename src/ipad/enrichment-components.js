// src/ipad/enrichment-components.js — the components of the Enrichments module. Each one returns an HTML string and is built
// from the app's own parts (tg / pill tags, rows, dcard · dsec · dtbl, kv, steps, timeline, sheet cells, pickers), so the module
// looks and behaves like the rest of ANTZ. Screens and sheets that use them: enrichment-views.js. Rules: src/model/products.js.

const ENR_TYPES = Object.keys(ACT_TYPE);
const REQ_TONE = { draft: '', pending: 'warn', approved: 'info', rejected: 'bad', completed: 'ok' };

/* ---------- tags ---------- */
const TypeTag = t => t ? tg(ACT_TYPE[t], 'mint') : '';
// quiet states read as a plain tag; states that need attention keep their toned pill
const ItemStatus = it => quiet(it) ? tg(STATUS[it.status]) : stPill(it);
const ReqStatus = r => pill(REQ_STATE[r.state], REQ_TONE[r.state]);
// the transfer stage under the agreed status: Approved splits into awaiting dispatch and in transit
const STAGE_T = { dispatch: 'Awaiting dispatch', transit: 'In transit' };
const STAGE_TONE = { dispatch: 'attn', transit: 'warn' };
const StageTag = r => STAGE_T[transferStage(r)] ? pill(STAGE_T[transferStage(r)], STAGE_TONE[transferStage(r)]) : '';

/* ---------- product image: the record's photo, or a neutral placeholder with the product glyph ---------- */
const ProductImage = (it, size = 34, cls = '') => `<span class="pimg ${cls}" role="img" aria-label="${esc(it.name)}">${ic(glyphOf(it.name), size)}</span>`;

/* ---------- associations ---------- */
const spNames = ids => ids.map(s => speciesOf(s)?.name).filter(Boolean);
const anNames = ids => ids.map(a => animalOf(a)?.name).filter(Boolean);
const more = (list, n) => list.slice(0, n).join(', ') + (list.length > n ? ` +${list.length - n}` : '');
function assocLine(a) {
  const sp = spNames(a.species), an = anNames(a.animals);
  return sp.length ? `${more(sp, 1)}${an.length ? ' · ' + more(an, 2) : ''}` : '';
}
const AssocKv = (a, withLoc = true) => kv([['Species', a.species.length ? esc(spNames(a.species).join(', ')) : '<span class="t-mute">None</span>'],
  ['Animals', a.animals.length ? esc(anNames(a.animals).join(', ')) : '<span class="t-mute">None</span>'],
  withLoc && ['Enclosure', a.loc ? esc(locName(a.loc)) : '<span class="t-mute">None</span>']]);
const hasAssoc = a => a.species.length || a.animals.length || a.loc;

/* ---------- product card (default layout) and compact row (list layout) ---------- */
// o: {on, type} — type: false when a type tab already says it
function ProductCard(it, o = {}) {
  const al = assocLine(productAssoc(it));
  return `<button class="pcard ${o.on ? 'on' : ''}" data-go="#/enrichments/${it.id}">${ProductImage(it)}
    <span class="pcard__b"><span class="pcard__t">${esc(it.name)}${it.mode === 'batch' ? ` <span class="pcard__q">× ${it.qty}</span>` : ''}</span>
      <span class="tags">${o.type === false ? '' : TypeTag(productType(it))}${ItemStatus(it)}</span>
      <span class="pcard__l">${esc(it.status === 'transit' ? 'In transit' : locName(it.loc))}</span>
      ${al ? `<span class="pcard__l pcard__l--sp">${esc(al)}</span>` : ''}
      <span class="pcard__p">${av(it.custodian, 22)}<span>${esc(nm(it.custodian))}</span></span></span></button>`;
}
function ProductRow(it, o = {}) {
  const al = assocLine(productAssoc(it));
  return `<button class="row prow ${o.on ? 'on' : ''}" data-go="#/enrichments/${it.id}">
    <span class="row__b"><span class="row__t">${esc(it.name)}${it.mode === 'batch' ? ` <span class="row__m">× ${it.qty}</span>` : ''}</span><span class="row__s">${it.id} · ${esc(it.status === 'transit' ? 'In transit' : locName(it.loc))}</span></span>
    <span class="prow__c">${esc(al)}</span><span class="prow__c prow__p">${av(it.custodian, 22)}<span>${esc(nm(it.custodian))}</span></span>
    <span class="prow__e">${o.type === false ? '' : TypeTag(productType(it))}${ItemStatus(it)}</span><span class="row__chev">${ic('right', 20)}</span></button>`;
}
const ProductList = (list, view, o) => view === 'list'
  ? `<div class="rows prows">${list.map(it => ProductRow(it, Object.assign({ on: o.on === it.id }, o))).join('')}</div>`
  : `<div class="pcards">${list.map(it => ProductCard(it, Object.assign({ on: o.on === it.id }, o))).join('')}</div>`;

/* ---------- toolbar parts ---------- */
const ViewSwitch = (cur, act) => `<div class="vswitch" role="group" aria-label="Layout">${[['cards', 'grid', 'Cards'], ['list', 'list', 'List']].map(([k, i, t]) => `<button class="${cur === k ? 'on' : ''}" data-do="${act}" data-arg="${k}" aria-label="${t}" aria-pressed="${cur === k}">${ic(i, 20)}</button>`).join('')}</div>`;
const FilterTokens = (tokens, unset, clear) => tokens.length ? `<div class="tokens">${tokens.map(([k, t]) => `<button class="token" data-do="${unset}" data-arg="${k}" aria-label="Remove ${esc(t)}">${esc(t)}${ic('x', 13)}</button>`).join('')}<button class="token-clear" data-do="${clear}">Clear</button></div>` : '';
// ActionBar([[label, do, arg, main, danger]]) — the record's actions, main action last (right)
const ActionBar = acts => acts.length ? `<div class="dacts">${acts.map(([t, d, arg, main, danger]) => `<button class="btn ${main ? 'btn--fill' : 'btn--plain'} ${danger ? 'danger' : ''}" data-do="${d}" data-arg="${esc(arg)}">${esc(t)}</button>`).join('')}</div>` : '';
// ModuleTabs([[key, label, count]], cur) — the module's underlined tab bar
const ModuleTabs = (tabs, cur) => `<div class="mtabs" style="--n:${tabs.length}">${tabs.map(([k, t]) => `<button class="mtab ${k === cur ? 'on' : ''}" data-go="#/${k}">${t}</button>`).join('')}</div>`;

/* ---------- requests ---------- */
// RequestRow(r, {on, href, status, who})
function RequestRow(r, o) {
  const it = r.item && itemOf(r.item);
  return `<button class="row ${o.on ? 'on' : ''}" data-go="${o.href}"><span class="row__b"><span class="row__t">${esc(reqTitle(r))}${it && it.mode === 'batch' && r.qty ? ` <span class="row__m">× ${r.qty}</span>` : ''}</span>
    <span class="row__s">${r.id} · ${REQ_KIND[r.kind]}${o.who ? ' · ' + esc(nm(r.by)) : ''}</span>${o.status || StageTag(r) ? `<span class="tags">${o.status ? ReqStatus(r) : ''}${StageTag(r)}</span>` : ''}</span>
    <span class="row__m">${fs(r.submitted || r.at)}</span><span class="row__chev">${ic('right', 20)}</span></button>`;
}
// RequestFacts(r, who) — the fields of a request, by type; the product name is in the header, so the product row is its ID
function RequestFacts(r) {
  const it = r.item && itemOf(r.item), link = it ? `<span class="link" data-go="#/enrichments/${it.id}">${it.id}</span>` : '';
  const rows = {
    existing: [['Product', link], it && it.mode === 'batch' && ['Quantity', `<span class="num">${r.qty}</span>`], ['Custodian', personRow(r.custodian)]],
    proposal: [['Description', esc(r.description)], r.details && ['Details', esc(r.details)], ['Justification', esc(r.justification)], ['Site', esc(siteName(r.site))], ['Custodian', personRow(r.custodian)]],
    move: [['Product', link], ['From', esc(locName(r.from))], ['To', r.to ? esc(locName(r.to)) : ''], it && it.mode === 'batch' && ['Quantity', `<span class="num">${r.qty}</span>`]],
    transfer: [['Product', link], ['From', `${esc(locName(r.from))}<small>${esc(siteName(r.site))}</small>`], ['To', r.toSection ? `${esc(r.toLoc ? locName(r.toLoc) : secName(r.toSection))}<small>${esc([r.toLoc && secName(r.toSection), siteName(r.toSite)].filter(Boolean).join(' · '))}</small>` : ''],
      ['Receiving custodian', r.receiver ? personRow(r.receiver) : ''], r.ref && ['Reference', esc(r.ref)]],
  }[r.kind];
  return kv([...rows, r.reason && ['Reason', esc(r.reason)], r.notes && ['Notes', esc(r.notes)]]);
}
// RequestProgress(r) — every step once: the request log in time order, then what it waits for
const STEP = { 'Draft saved': ['done', 'newitem'], Submitted: ['done', 'arrow'], Edited: ['done', 'history'], Withdrawn: ['done', 'undo'], Approved: ['done', 'shield'], Rejected: ['bad', 'x'], Completed: ['done', 'check'],
  Dispatched: ['done', 'truck'], Received: ['done', 'receive'], 'Completed by exception': ['done', 'alert'] };
const sendersOf = r => D.people.filter(p => ['sup', 'afm'].includes(p.role) && can(p.id, 'transfer', itemOf(r.item)));
function RequestProgress(r) {
  const step = (cls, icon, t, s, note) => `<div class="step ${cls}"><div class="step__dot">${ic(icon)}</div><div class="step__b"><div class="step__t">${esc(t)}</div>${s ? `<div class="step__s">${s}</div>` : ''}${note ? `<div class="step__n note">${esc(note)}</div>` : ''}</div></div>`;
  const out = r.log.slice().reverse().map(l => { const [cls, icon] = STEP[l.act] || ['done', 'history']; return step(cls, icon, l.act, `${esc(nm(l.by))} · ${ft2(l.at)}`, l.note); });
  if (r.state === 'pending') out.push(step('now', 'clock', 'Review', esc(reviewersOf(r).map(p => p.name).join(' or '))));
  const stage = transferStage(r);
  if (stage === 'dispatch') out.push(step('now', 'truck', 'Dispatch', esc(sendersOf(r).map(p => p.name).join(' or '))));
  if (stage === 'transit') out.push(step('now', 'receive', 'Receipt', esc(nm(itemOf(r.item).transfer?.to.custodian || r.receiver))));
  return `<div class="steps">${out.join('')}</div>`;
}

/* ---------- product detail parts ---------- */
// o: {change: custodian link, store: 'store' | 'use' | '' and its action}
const ProductFacts = (it, change, store) => kv([['Location', `<span class="kv__line"><span>${it.status === 'transit' ? 'In transit' : esc(locName(it.loc))}<small>${esc(secName(it.section))} · ${esc(siteName(it.site))}</small></span>${store ? `<button class="link" data-do="${store.do}" data-arg="${it.id}|${store.kind}">${store.kind === 'store' ? 'Store' : 'Return to use'}</button>` : ''}</span>`],
  ['Custodian', `<span class="kv__line">${personRow(it.custodian)}${change ? `<button class="link" data-do="enrCustodian" data-arg="${it.id}">Change</button>` : ''}</span>`], ['Tracking', `${esc(catCode(it))} · ${it.mode === 'batch' ? `Group · ${it.qty} units` : 'Individual'}`], ['Last verified', fd(it.lastVerified)]]);
// the activities that use the product: their type-specific details stay on the activity screen
function ProductActivities(it) {
  const acts = productActivities(it);
  return dtbl([['Activity'], ['Plans', '72px'], ['Rating', '104px']], acts.map(a => { const s = activityStats(a.id), pl = A().plans.filter(p => p.active && p.activity === a.id && sitePlan(p)).length;
    return { c: [`<b>${esc(a.name)}</b><small>${esc([ACT_TYPE[a.type], a.sub, a.mins + ' min', a.additives].filter(Boolean).join(' · '))}</small>`, pl, s.rating != null ? stars(s.rating) : '<span class="t-mute">—</span>'] }; }), 'None');
}
function ProductSessions(it) {
  const used = A().sessions.filter(s => s.materials.includes(it.id)).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5);
  return used.length ? dtbl([['Session'], ['Rating', '104px']], used.map(s => { const p = planOf(s.plan); return { c: [`<b>${esc(activityOf(s.activity).name)}</b><small>${fs(s.date)} · ${esc(planName(p))}${s.safety && s.safety.item === it.id ? ' · Safety incident' : ''}</small>`, stars(s.rating)] }; })) : '';
}

/* ---------- sheet cells and pickers ---------- */
// associations: optional species, animals and one enclosure, at one site
const cAssoc = f => fg('Associations', [cNav('Species', more(spNames(f.species), 2), 'species'), cNav('Animals', more(anNames(f.animals), 2), 'animals'), cNav('Enclosure', locName(f.loc), 'loc')]);
function assocPickers(siteOf) {
  const animalsAt = f => A().animals.filter(a => a.site === siteOf(f));
  return {
    species: f => multiPage({ title: 'Species', key: 'species', options: [...new Set(animalsAt(f).map(a => a.species))].map(speciesOf).map(sp => ({ v: sp.id, t: sp.name, s: `<i>${esc(sp.sci)}</i>`, group: sp.cls })) }),
    animals: f => multiPage({ title: 'Animals', key: 'animals', options: animalsAt(f).filter(a => !f.species.length || f.species.includes(a.species)).map(a => ({ v: a.id, t: a.name, s: `${a.id} · ${esc(locName(a.loc))}`, group: speciesOf(a.species).name })) }),
    loc: f => pickerPage({ title: 'Enclosure', key: 'loc', options: [{ v: '', t: 'None' }, ...locOpts(l => l.kind === 'enclosure' && l.site === siteOf(f))] }),
  };
}
const reqSum = r => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(reqTitle(r))}</div><div class="row__s">${r.id} · ${REQ_KIND[r.kind]} · ${esc(nm(r.by))}</div></div></div>`;
const draftBtn = () => `<div class="sheet__alt"><button class="btn btn--plain btn--block" data-do="enrDraft">Save as draft</button></div>`;

/* ---------- Phase 2: lifecycle parts ---------- */
// a step with the action of the person signed in, when the step is theirs
const stepA = (cls, icon, t, sub, note, btn) => `<div class="step ${cls}"><div class="step__dot">${ic(icon)}</div><div class="step__b"><div class="step__t">${esc(t)}</div>${sub ? `<div class="step__s">${sub}</div>` : ''}${note ? `<div class="step__n note">${esc(note)}</div>` : ''}${btn ? `<div class="step__a">${btn}</div>` : ''}</div></div>`;
const actBtn = (t, d, arg, main = true) => `<button class="btn btn--sm ${main ? 'btn--fill' : 'btn--plain'}" data-do="${d}" data-arg="${esc(arg)}">${esc(t)}</button>`;
const who = (id, at) => `${esc(nm(id))} · ${ft2(at)}`;

// RepairPanel(it) — the open issue as its steps (with the action at the current step), then earlier issues and repairs
const REPAIR_OUT = { done: 'Repaired', cleared: 'Cleared', closed: 'Closed', beyond: 'Beyond repair' };
function RepairPanel(it) {
  const r = it.repair, rows = [['Condition', cdPill(it)]];
  let steps = '';
  if (r) {
    const out = [stepA('done', 'flag', 'Issue reported', who(r.by, r.opened), [r.issue, r.notes].filter(Boolean).join(' · '))];
    if (r.needBio) out.push(r.bio === 'pending' ? stepA('now', 'paw', 'Animal-use check', 'Biologist', '', can(UI.me, 'verifyBio') ? actBtn('Check', 'actBio', it.id) : '')
      : stepA(r.bio === 'suitable' ? 'done' : 'bad', r.bio === 'suitable' ? 'check' : 'x', `Animal use · ${r.bio === 'suitable' ? 'Suitable' : 'Unsuitable'}`, who(r.bioBy, r.bioAt), r.bioNote));
    if (r.needTech) out.push(r.tech === 'pending' ? stepA('now', 'repairs', 'Repairability check', '', '', '')
      : stepA(r.tech === 'repairable' ? 'done' : 'bad', r.tech === 'repairable' ? 'check' : 'x', r.tech === 'repairable' ? 'Repairable' : 'Beyond repair', who(r.techBy, r.techAt), r.techNote));
    if (!r.needTech) out.push(r.state === 'assessment' ? stepA(r.bio === 'pending' ? 'todo' : 'now', 'flag', 'Decision', esc(nm(it.custodian)), '', r.bio !== 'pending' && can(UI.me, 'decide', it) ? actBtn('Decide', 'actDecide', it.id) : '')
      : stepA(r.state === 'beyond' ? 'bad' : 'done', r.state === 'beyond' ? 'x' : 'check', r.state === 'beyond' ? 'Beyond repair' : 'Repair approved', '', ''));
    if (r.state === 'approved') out.push(stepA('now', 'repairs', 'Repair', 'Not started', '', can(UI.me, 'repairStart', it) ? actBtn('Start repair', 'actStartRepair', it.id) : ''));
    if (r.state === 'repair') out.push(stepA('now', 'repairs', `In repair · ${r.team}`, `Started ${ft2(r.started)}`, '', can(UI.me, 'repairDone', it) ? actBtn('Complete', 'actCompleteRepair', it.id) : ''));
    if (r.state === 'beyond' && r.needTech) out.push(stepA('bad', 'alert', 'Beyond repair', '', ''));
    steps = `<div class="steps steps--panel">${out.join('')}</div>`;
  }
  const past = it.repairs || [];
  return kv(rows) + steps + (past.length ? `<div class="dsec__k dsec__k--in">Earlier issues</div>` + dtbl([['Issue'], ['Outcome', '132px']], past.map(x => ({ c: [`<b>${esc(x.issue)}</b><small>${x.id} · ${fs(x.opened)}${x.done?.notes ? ' · ' + esc(x.done.notes) : ''}</small>`, `${REPAIR_OUT[x.state] || x.state}<small>${x.done ? fs(x.done.at) : ''}</small>`] }))) : '');
}

// TransferPanel(it) — Requested → Approved → In transit → Received, each stage distinct; the action of the current stage below
function openTransferReq(it) { return EN().requests.filter(r => r.item === it.id && r.kind === 'transfer' && ['pending', 'approved'].includes(r.state)).pop(); }
function TransferPanel(it) {
  const r = openTransferReq(it), tr = it.transfer;
  if (!r && !tr) return '';
  const st = (k, icon, t, sub) => `<div class="stage stage--${k}"><span class="stage__dot">${ic(k === 'done' ? 'check' : icon, 16)}</span><span class="stage__t">${t}</span><span class="stage__s">${sub || ''}</span></div>`;
  let stages, act = '', facts;
  if (r) {
    const sg = transferStage(r);
    stages = [st('done', 'arrow', 'Requested', `${esc(first(r.by))} · ${fs(r.submitted)}`),
      st(r.state === 'pending' ? 'now' : 'done', 'shield', 'Approved', r.decision ? `${esc(first(r.decision.by))} · ${fs(r.decision.at)}` : ''),
      st(sg === 'transit' ? 'now' : sg === 'dispatch' ? 'next' : 'todo', 'truck', 'In transit', r.dispatched ? `${esc(first(r.dispatched.by))} · ${fs(r.dispatched.at)}` : ''),
      st('todo', 'receive', 'Received', '')];
    if (r.state === 'pending' && canReviewReq(UI.me, r)) act = actBtn('Review', 'enrDecide', r.id);
    if (canDispatch(UI.me, r)) act = actBtn('Dispatch', 'enrDispatch', r.id);
    facts = [['To', `${esc(r.toLoc ? locName(r.toLoc) : secName(r.toSection))}<small>${esc([r.toLoc && secName(r.toSection), siteName(r.toSite)].filter(Boolean).join(' · '))}</small>`], ['Receiver', personRow(r.receiver)], r.ref && ['Reference', esc(r.ref)], ['Request', `<span class="link" data-go="#/${r.by === UI.me ? 'enrreq' : 'enrappr'}/${r.id}">${r.id}</span>`]];
  } else {
    stages = [st('done', 'truck', 'Dispatched', `${esc(first(tr.by))} · ${fs(tr.dispatched)}`), st('now', 'receive', 'Received', '')];
    facts = [['To', `${esc(secName(tr.to.section))}<small>${esc(siteName(tr.to.site))}</small>`], ['Receiver', personRow(tr.to.custodian)], tr.ref && ['Reference', esc(tr.ref)]];
  }
  if (tr && (UI.me === tr.to.custodian || (role() === 'afm' && me().sites.includes(tr.to.site)))) act = actBtn('Acknowledge receipt', 'actAck', it.id);
  return `<div class="stages" style="--n:${stages.length}">${stages.join('')}</div>${act ? `<div class="dacts dacts--in">${act}</div>` : ''}${kv(facts)}`;
}

// LifecycleTimeline(it, type, all) — stored events only, newest first, filterable by type
const LC_TONE = { movement: 'info', storage: 'info', condition: 'warn', repair: 'attn', transfer: 'info', custodian: '', request: 'ok', other: '' };
function LifecycleTimeline(it, type, all) {
  const ev = lifecycleEvents(it), types = Object.keys(LC_TYPE).filter(t => ev.some(e => e.type === t));
  const list = ev.filter(e => !type || e.type === type), shown = all ? list : list.slice(0, 10);
  const chips = types.length > 1 ? fchips([['', 'All', ev.length], ...types.map(t => [t, LC_TYPE[t], ev.filter(e => e.type === t).length])], type, 'enrLcType') : '';
  const row = e => `<div class="tl__e"><div class="tl__i"><i style="background:${SOLID[LC_TONE[e.type]] || 'var(--c-fill-3)'}"></i></div><div class="tl__b">
    <div class="tl__t">${esc(e.title)}${type ? '' : ` <span class="tg">${LC_TYPE[e.type]}</span>`}</div>
    ${e.from || e.to ? `<div class="tl__ft">${e.from ? esc(e.from) : ''}${e.from && e.to ? ic('arrow', 14) : ''}${e.to ? esc(e.to) : ''}</div>` : ''}
    ${e.note ? `<div class="tl__n">${esc(e.note)}</div>` : ''}
    <div class="tl__m">${av(e.by, 18)}${esc(nm(e.by))} · ${ft2(e.at)}${e.ref ? ' · ' + esc(e.ref) : ''}</div></div></div>`;
  return `<div class="lc">${chips}${shown.length ? `<div class="tl">${shown.map(row).join('')}</div>` : '<div class="dtbl__empty">None</div>'}${list.length > shown.length ? `<button class="btn btn--plain btn--sm lc__more" data-do="enrLcAll">Show all ${list.length}</button>` : ''}</div>`;
}
