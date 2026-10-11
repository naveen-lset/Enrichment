// src/app/screens/phase-1-register.js — PRD Phase 1 · Configure & register.
// Overview dashboard · Item register · Item details · Pending receipts · Receive items (task page) · Register item (task page) · Setup.
// Confirmed components: C-07 page header + tabs · C-04 site selector · C-26 stat strip · C-17 KPI tiles · C-18 list card · C-15 card
// · C-59 key-value · C-60 bar rows · C-46 thumbs · C-47 timeline · C-48 / C-51 / C-53 / C-54 sheets · C-62 empty · C-05 FAB · C-63 toast.

/* ---------- actions an item offers to the person signed in (primary first; PRD §9 list-row actions) ---------- */
function actionsFor(it) {
  const r = role(), a = [], R = it.repair, tr = it.transfer, d = it.disposal && disposalOf(it.disposal), id = it.id;
  const scopeFor = act => (['bio', 'ws'].includes(r) && ['flag', 'repairStart', 'repairDone'].includes(act) ? null : it);
  if (d) a.push({ label: 'Open disposal request', icon: 'trash', href: '#/disposal/' + d.id, main: true });
  if (it.status === 'transit' && (tr.to.custodian === A.me || (r === 'afm' && me().sites.includes(tr.to.site)))) a.push({ label: 'Acknowledge receipt', icon: 'checkc', onclick: `openSheet('ack', { id: '${id}' })`, main: true });
  if (it.status === 'transit' && can(A.me, 'transferException')) a.push({ label: 'Complete by exception', icon: 'alert', onclick: `openSheet('ackx', { id: '${id}' })` });
  if (R && R.state === 'assessment') {
    if (R.bio === 'pending' && can(A.me, 'verifyBio')) a.push({ label: 'Verify animal use', icon: 'checkc', onclick: `openSheet('bio', { id: '${id}' })`, main: true });
    if (R.tech === 'pending' && can(A.me, 'assessTech')) a.push({ label: 'Assess repairability', icon: 'tool', onclick: `openSheet('tech', { id: '${id}' })`, main: true });
    if (!R.needBio && !R.needTech && can(A.me, 'decide', it)) a.push({ label: 'Decide outcome', icon: 'checkc', onclick: `openSheet('decide', { id: '${id}' })`, main: true });
  }
  if (R && R.state === 'approved' && can(A.me, 'repairStart', scopeFor('repairStart'))) a.push({ label: 'Start repair', icon: 'tool', onclick: `openSheet('start', { id: '${id}' })`, main: true });
  if (R && R.state === 'repair' && can(A.me, 'repairDone', scopeFor('repairDone'))) a.push({ label: 'Complete repair', icon: 'checkc', href: '#/repair-done/' + id, main: true });
  if (R && R.state === 'beyond' && !d && can(A.me, 'dispose', it)) a.push({ label: 'Request disposal', icon: 'trash', href: '#/dispose/' + id, main: true });
  if (MOVABLE.includes(it.status) && !d) {
    if (can(A.me, 'move', it)) a.push({ label: 'Move / rotate', icon: 'cycle', href: '#/move/' + id, main: true });
    if (can(A.me, 'flag', scopeFor('flag'))) a.push({ label: 'Mark for repair', icon: 'tool', href: '#/repair/' + id });
    if (can(A.me, 'transfer', it)) a.push({ label: 'Initiate transfer', icon: 'send', href: '#/transfer/' + id });
    if (can(A.me, 'dispose', it)) a.push({ label: 'Request disposal', icon: 'trash', href: '#/dispose/' + id });
  }
  if (it.status === 'missing') { const au = D.audits.find(x => x.state !== 'closed' && x.lines.some(l => l.item === id)); if (au) a.push({ label: 'Open audit', icon: 'checkc', href: '#/audit/' + au.id }); }
  if (labelable(it) && can(A.me, 'labels', it)) a.push({ label: A.lab.includes(id) ? 'In label queue' : 'Add to label queue', icon: 'scan', onclick: `addLabel('${id}')` });
  const main = a.find(x => x.main);
  return main ? [main].concat(a.filter(x => x !== main)) : a;
}
const runAct = x => x.href ? `go('${x.href}')` : x.onclick;
// the More menu: a C-48 sheet of nav option rows
SHEETS.acts = s => {
  const it = itemOf(s.id);
  return kSheet({ title: it.name, sub: it.id, close: 'closeSheet()',
    body: kOptions(actionsFor(it).map(x => kOption({ type: 'nav', icon: x.icon, title: x.label, onclick: `A.sheet=null;${runAct(x)}` }))) });
};

/* ---------- Overview dashboard (PRD §9) ---------- */
route('overview', () => {
  const act = siteItems().filter(isActive), n = st => act.filter(i => [].concat(st).includes(i.status)).length;
  const tk = D.tickets.filter(t => t.status === 'dispatched' && inSite({ site: sectionOf(t.section).site }));
  const transit = D.items.filter(i => i.status === 'transit' && (inSite(i) || inSite({ site: i.transfer.to.site })));
  const repairs = act.filter(i => i.repair);
  const disp = D.disposals.filter(d => ['validation', 'approval', 'approved'].includes(d.state) && inSite(itemOf(d.item)));
  const exc = D.audits.filter(inSite).flatMap(a => a.lines.filter(l => l.outcome && l.outcome !== 'verified' && !(l.exc && l.exc.resolved)));
  const my = tasks(A.me).filter(inScopeTask);
  const rep = report({ site: A.site === 'all' ? '' : A.site });
  const max = Math.max(1, ...rep.byStatus.map(s => s.n));
  const next = D.audits.filter(a => inSite(a) && a.state !== 'closed').sort((a, b) => a.due.localeCompare(b.due))[0];
  const nt = notifications(A.me);
  const main = header('overview')
    + kStatStrip([
      { key: '', label: 'Active items', value: act.length }, { key: 'inuse', label: 'In use', value: n('inuse') }, { key: 'storage', label: 'In storage', value: n(['storage', 'available']) },
      { key: 'repair', label: 'In repair', value: n(['assessment', 'repair']), tone: n(['assessment', 'repair']) ? 'attn' : '' }, { key: 'missing', label: 'Missing', value: n('missing'), tone: n('missing') ? 'bad' : '' },
    ], { onpick: 'openRegister' })
    + kTiles([
      kKpi({ label: 'Pending receipts', value: tk.length, sub: plural(tk.filter(t => daysBetween(t.dispatched, NOW) > D.config.receiptDays).length, 'overdue', 'overdue'), onclick: "go('#/receipts')" }),
      kKpi({ label: 'Transfers in transit', value: transit.length, sub: plural(transit.filter(i => daysBetween(i.transfer.dispatched, NOW) > 2).length, 'overdue', 'overdue'), onclick: "openRegister('transit')" }),
      kKpi({ label: 'Assessments and repairs', value: repairs.length, sub: plural(repairs.filter(i => i.repair.state === 'repair').length, 'under repair', 'under repair'), onclick: "openRegister('repair')" }),
      kKpi({ label: 'Disposal requests', value: disp.length, sub: plural(disp.filter(d => d.state === 'approval').length, 'awaiting approval', 'awaiting approval'), onclick: "go('#/disposals')" }),
      kKpi({ label: 'Audit exceptions', value: exc.length, tone: exc.some(l => !l.exc) ? 'attn' : '', sub: plural(exc.filter(l => !l.exc).length, 'not assigned', 'not assigned'), onclick: "go('#/audits')" }),
      kKpi({ label: 'Notifications', value: nt.length, sub: plural(nt.filter(x => ['missing', 'exception'].includes(x.kind)).length, 'alert'), onclick: "go('#/notifications')" }),
    ])
    + kCard({ title: 'My work', action: my.length ? kButton({ label: 'View all', kind: 'ghost', size: 'sm', href: '#/mywork' }) : '',
      body: my.length ? kKV(my.slice(0, 4).map(t => [t.label, `${t.title} · ${t.late ? 'Overdue' : t.due ? 'Due ' + fs(t.due) : t.ref}`])) : none('Tasks') })
    + kCard({ title: 'Register by status', body: kBarRows(rep.byStatus.filter(s => s.n).map(s => ({ label: s.label, pct: Math.round(s.n / max * 100), value: String(s.n), tone: s.key === 'missing' ? 'bad' : ['assessment', 'repair'].includes(s.key) ? 'warn' : '' }))) })
    + (next ? part('Next audit', [['Period', next.period], ['Site', siteName(next.site)], ['Checked', `${auditStats(next).checked} of ${auditStats(next).n}`], ['Due', fd(next.due)]], { label: 'Open', href: '#/audit/' + next.id }) : '');
  return { main, fab: true, title: 'Overview' };
});
function openRegister(st) { A.st = st; A.q = ''; go('#/register'); }

/* ---------- Item register (PRD §9, FR-06) ---------- */
const ST_GROUP = { inuse: ['inuse'], storage: ['storage', 'available'], repair: ['assessment', 'repair'], transit: ['transit'], missing: ['missing'], closed: ['retired', 'scrapped'] };
function registerList() {
  const q = A.q.toLowerCase();
  return siteItems().filter(it => (A.st ? ST_GROUP[A.st].includes(it.status) : isActive(it)) && (!A.cat || it.cat === A.cat) && (!A.cond || it.cond === A.cond)
    && (!q || [it.id, it.name, locName(it.loc), nm(it.custodian), it.ticket, it.mt].join(' ').toLowerCase().includes(q)));
}
const itemCard = it => card({ name: it.name, about: [it.id, where(it)], status: stPill(it), href: '#/item/' + it.id,
  facts: [{ label: 'Custodian', value: nm(it.custodian) }, { label: 'Condition', value: COND[it.cond] }, it.mode === 'batch' ? { label: 'Quantity', value: it.qty } : { label: 'Category', value: catCode(it) }, { label: 'Last verified', value: fs(it.lastVerified) }] });
route('register', () => {
  const list = registerList(), all = siteItems(), cnt = k => all.filter(i => ST_GROUP[k].includes(i.status)).length;
  const on = [A.cat && by('categories', A.cat).code + ' · ' + by('categories', A.cat).name, A.cond && COND[A.cond], A.q && `“${A.q}”`, A.st === 'transit' && STATUS.transit].filter(Boolean);
  const main = header('register', { sub: (on.length ? on.join(' · ') + ' · ' : '') + plural(list.length, 'record'),
      actions: tool('search', 'Find', "openSheet('find', { v: A.q })") + tool('filter', 'Filter', "openSheet('filter', { cat: A.cat, cond: A.cond })") })
    + kStatStrip([{ key: 'inuse', label: 'In use', value: cnt('inuse') }, { key: 'storage', label: 'In storage', value: cnt('storage') }, { key: 'repair', label: 'In repair', value: cnt('repair') },
      { key: 'missing', label: 'Missing', value: cnt('missing'), tone: cnt('missing') ? 'bad' : '' }, { key: 'closed', label: 'Closed', value: cnt('closed') }], { current: A.st, onpick: 'setSt' })
    + (list.length ? cards(list.map(itemCard))
      : on.length || A.st ? kEmpty({ kind: 'filtered', text: 'No item matches these filters.', action: kButton({ label: 'Clear filters', onclick: 'clearRegister()' }) }) : kEmpty({ kind: 'none', text: 'No items registered yet.' }));
  return { main, fab: true, title: 'Register' };
});
function setSt(k) { A.st = A.st === k ? '' : k; redraw(); }
function clearRegister() { A.q = A.st = A.cat = A.cond = ''; redraw(); }
// C-51 filter picker: category and condition, Clear / Apply
SHEETS.filter = s => kSheet({ title: 'Filter', close: 'closeSheet()',
  body: kFormSection('', [lbl('Category', kOptions([{ id: '', code: '', name: 'All categories' }].concat(D.categories.filter(c => c.mode !== 'excluded')).map(c => kOption({ type: 'radio', title: c.code ? `${c.code} · ${c.name}` : c.name, on: s.cat === c.id, onclick: `A.sheet.cat='${c.id}';drawSheet()` })))),
    lbl('Condition', kOptions([['', 'All conditions']].concat(Object.entries(COND)).map(([k, v]) => kOption({ type: 'radio', title: v, on: s.cond === k, onclick: `A.sheet.cond='${k}';drawSheet()` }))))]),
  foot: kButton({ label: 'Clear', onclick: "A.sheet.cat='';A.sheet.cond='';sheetOk()" }) + kButton({ label: 'Apply', kind: 'primary', onclick: 'sheetOk()' }) });
SHEET_OK.filter = s => { A.cat = s.cat; A.cond = s.cond; A.sheet = null; drawSheet(); redraw(); };
// C-54 find: an item ID (label scan) opens the item; any other text filters the register (FR-14)
SHEETS.find = s => kSheet({ title: 'Find', close: 'closeSheet()',
  body: kFormSection('', [kField({ label: 'Item ID or name', value: s.v || '', attrs: 'oninput="A.sheet.v=this.value" onkeydown="if(event.key===\'Enter\')sheetOk()" autocomplete="off"' })]),
  foot: kButton({ label: 'Clear', onclick: "A.sheet.v='';sheetOk()" }) + kButton({ label: 'Find', kind: 'primary', onclick: 'sheetOk()' }) });
SHEET_OK.find = s => { const v = String(s.v || '').trim(), it = itemOf(v.toUpperCase()); A.sheet = null; drawSheet(); if (it) { go('#/item/' + it.id); return; } A.q = v; if (location.hash === '#/register') redraw(); else go('#/register'); };

/* ---------- Item details (PRD §9, FR-15) ---------- */
route('item/([\\w-]+)', id => itemScreen(id, 'summary'));
route('item/([\\w-]+)/(summary|timeline|links)', (id, tab) => itemScreen(id, tab));
function itemScreen(id, tab) {
  const it = itemOf(id);
  if (!it) return notHere('Item', 'This item does not exist.', '#/register');
  const c = catOf(it), R = it.repair, d = it.disposal && disposalOf(it.disposal);
  const tabs = [{ key: 'summary', label: 'Summary', href: `#/item/${id}/summary` }, { key: 'timeline', label: 'Timeline', count: it.history.length, href: `#/item/${id}/timeline` },
    { key: 'links', label: 'Repairs and transfers', count: (it.repairs || []).length + (it.transfers || []).length + (R ? 1 : 0) + (it.transfer ? 1 : 0), href: `#/item/${id}/links` }];
  const chk = (st, who, at) => st === 'notreq' ? 'Not required' : st === 'pending' ? 'Pending' : `${{ suitable: 'Suitable', unsuitable: 'Unsuitable', repairable: 'Repairable', beyond: 'Beyond repair' }[st]} · ${nm(who)} · ${fs(at)}`;
  const last = (it.repairs || [])[0];
  let body = '';
  if (tab === 'summary') {
    body = part('Current assignment', [['Status', STATUS[it.status]], ['Site', siteName(it.site)], ['Section', secName(it.section)], ['Location', it.status === 'transit' ? 'In transit' : locName(it.loc)],
        ['Custodian', nm(it.custodian)], ['Quantity', String(it.qty)], ['Last verified', fd(it.lastVerified)]].concat(it.status === 'transit' ? [['Receiving', `${secName(it.transfer.to.section)}, ${siteName(it.transfer.to.site)} · ${nm(it.transfer.to.custodian)}`]] : []))
      + part('Condition', [['Condition', COND[it.cond]], ['Animal use', R ? chk(R.bio, R.bioBy, R.bioAt) : usableForAnimals(it) ? 'Suitable' : 'Not cleared'],
        ['Technical assessment', R ? chk(R.tech, R.techBy, R.techAt) : last && last.tech !== 'notreq' ? chk(last.tech, last.techBy, last.techAt) : 'Not required']]
        .concat(R ? [['Open issue', `${R.issue} · ${fs(R.opened)}`], ['Stage', { assessment: 'Under assessment', approved: 'Repair approved', repair: 'Under repair · ' + (R.team || ''), beyond: 'Beyond repair' }[R.state]]] : []))
      + (d ? part('Disposal request', [['Request', d.id], ['Reason', d.reason], ['State', DSTATE[d.state][0]], ['Requested', `${fs(d.at)} · ${nm(d.by)}`], ['Approver', nm(d.approver)]], { label: 'Open', href: '#/disposal/' + d.id }) : '')
      + part('Record', [['Item ID', it.id], ['Category', `${c.code} · ${c.name}`], ['Tracking mode', MODE[it.mode]]].concat(it.parent ? [['Split from', it.parent]] : []).concat(it.final ? [['Final disposition', DISPOSITION[it.final]]] : []).concat(it.labelled ? [['Label printed', fd(it.labelled)]] : []))
      + part('Source', [['Request ticket', it.ticket], ['Workshop reference', it.ws], ['Material transfer', it.mt], ['Received', ft(it.received)]])
      + evidence(it.photos);
  } else if (tab === 'timeline') {
    body = kCard({ title: 'Lifecycle', body: kTimeline(it.history.map((h, i) => ({ title: `${h.act} · ${ft(h.at)} · ${nm(h.by)}`, text: [h.from && h.to ? `${h.from} → ${h.to}` : h.to || h.from, h.ref, h.note].filter(Boolean).join(' · '), current: i === 0 }))) });
  } else {
    const rp = (R ? [R] : []).concat(it.repairs || []), tr = (it.transfer ? [it.transfer] : []).concat(it.transfers || []);
    const RS = { assessment: ['Under assessment', 'warn'], approved: ['Repair approved', 'info'], repair: ['Under repair', 'warn'], beyond: ['Beyond repair', 'bad'], done: ['Repaired', 'ok'], cleared: ['Cleared', 'ok'], closed: ['Closed', ''] };
    body = kCard({ title: 'Repairs', body: rp.length ? kTimeline(rp.map((r, i) => ({ title: `${RS[r.state][0]} · ${r.issue} · ${fs(r.opened)}`, text: [r.id, r.done && r.done.team || r.team, r.done && r.done.notes || r.notes].filter(Boolean).join(' · '), current: i === 0 }))) : none('Repairs') })
      + kCard({ title: 'Transfers', body: tr.length ? kTimeline(tr.map((t, i) => ({ title: `${t.ack ? (t.exception ? 'Received by exception' : 'Received') : 'In transit'} · ${secName(t.from.section)} → ${secName(t.to.section)}`,
        text: [t.id, t.ref, `Dispatched ${fs(t.dispatched)} · ${nm(t.by)}`, t.ack ? `Received ${fs(t.ack.at)} · ${nm(t.ack.by)}` : ''].filter(Boolean).join(' · '), current: i === 0 }))) : none('Transfers') });
  }
  const acts = actionsFor(it), main = acts[0] && acts[0].main ? acts[0] : null, rest = acts.filter(x => x !== main);
  const actions = [];
  if (rest.length) actions.push({ label: 'More', icon: 'more', kind: 'ghost', onclick: `openSheet('acts', { id: '${id}' })` });
  if (main) actions.push({ label: main.label, kind: 'primary', onclick: runAct(main) });
  return { main: page({ title: it.name, sub: `${it.id} · ${it.disposal ? 'Disposal requested' : STATUS[it.status]} · ${COND[it.cond]}`, back: '#/register', actions, tabs, current: tab }) + body, title: it.name };
}

/* ---------- Pending receipts (PRD §5.1) ---------- */
route('receipts', () => {
  const tk = D.tickets.filter(t => t.status === 'dispatched' && inSite({ site: sectionOf(t.section).site }));
  const done = D.tickets.filter(t => t.status === 'received' && inSite({ site: sectionOf(t.section).site })).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5);
  const late = t => daysBetween(t.dispatched, NOW) > D.config.receiptDays;
  const main = page({ title: 'Pending receipts', sub: plural(tk.length, 'ticket'), back: '#/overview' })
    + (tk.length ? cards(tk.map(t => { const sec = sectionOf(t.section), ok = can(A.me, 'receive', { section: t.section, site: sec.site });
      return card({ name: t.name, about: [t.id, sec.name, nm(t.requestedBy)], status: late(t) ? kPill('Overdue', 'bad') : kPill('Awaiting receipt', 'attn'), href: ok ? '#/receive/' + t.id : '',
        facts: [{ label: 'Quantity', value: t.qty }, { label: 'Category', value: by('categories', t.cat).code }, { label: 'Dispatched', value: fs(t.dispatched) }, { label: 'Transfer', value: t.mt }] });
    })) : kEmpty({ kind: 'none', icon: 'download', text: 'No receipts pending.' }))
    + (done.length ? kCard({ title: 'Recently received', body: kTimeline(done.map((t, i) => ({ title: `${t.name} · ${ft(t.receivedAt)} · ${nm(t.receivedBy)}`, text: `${t.id} · ${plural(t.items.length, 'record')}${t.discrepancy ? ' · ' + t.discrepancy : ''}`, current: i === 0 }))) }) : '');
  return { main, title: 'Pending receipts' };
});

/* ---------- Receive items: task page, one card per topic, review and submit (PRD §5.1, FR-02, FR-03) ---------- */
route('receive/([\\w-]+)', tid => {
  const t = by('tickets', tid);
  if (!t || t.status !== 'dispatched') return notHere('Receive items', 'This ticket is already received.', '#/receipts');
  const sec = sectionOf(t.section), cat = by('categories', t.cat);
  const f = F({ qty: String(t.qty), cond: 'good', fit: 'yes', loc: '', custodian: custodiansOf(t.section)(me()) ? A.me : '', discrepancy: '', notes: '' });
  const main = page({ title: 'Receive items', sub: `${t.id} · ${t.name}`, back: '#/receipts', actions: [{ label: 'Review', kind: 'primary', onclick: `reviewReceive('${tid}')` }] })
    + part('Ticket', [['Item', t.name], ['Category', `${cat.code} · ${cat.name}`], ['Dispatched quantity', String(t.qty)], ['Workshop reference', t.ws], ['Material transfer', t.mt], ['Dispatched', ft(t.dispatched)], ['Requested by', nm(t.requestedBy)]])
    + part('Receipt', [['Quantity received', f.qty], ['Discrepancy', f.discrepancy]], { label: 'Edit', onclick: 'editReceipt()' })
    + part('Condition', [['Visible condition', COND[f.cond]], ['Fit for use', f.fit === 'no' ? 'No' : 'Yes']], { label: 'Edit', onclick: 'editCondition()' })
    + (f.fit === 'no' ? part('Issue', [['Notes', f.notes]], { label: 'Edit', onclick: "edit('Issue', () => [fld('Notes', 'notes', { type: 'textarea' })])" }) : '')
    + part('Location', [['Site', siteName(sec.site)], ['Section', sec.name], ['Location', locLabel(f.loc)]], { label: f.loc ? 'Change' : 'Pick', onclick: `pickLocation('loc', l => l.section === '${t.section}', 'Receiving location')` })
    + part('Custodian', [['Custodian', nm(f.custodian)]], { label: f.custodian ? 'Change' : 'Pick', onclick: `pickPerson('custodian', custodiansOf('${t.section}'), 'Custodian')` });
  return { main, title: 'Receive items' };
});
function editReceipt() { edit('Receipt', () => [fld('Quantity received', 'qty', { type: 'number' }), fld('Discrepancy', 'discrepancy', { type: 'textarea' })], () => Number.isInteger(+A.form.qty) && +A.form.qty > 0); }
function editCondition() {
  edit('Condition', () => [chc('Visible condition', 'cond', [{ key: 'good', label: 'Good' }, { key: 'needsrepair', label: 'Needs repair' }, { key: 'damaged', label: 'Damaged' }, { key: 'unsafe', label: 'Unsafe' }]),
    chc('Fit for use', 'fit', [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }])]);
}
function reviewReceive(tid) {
  const t = by('tickets', tid), f = A.form, cat = by('categories', t.cat), diff = +f.qty !== t.qty, n = cat.mode === 'individual' ? +f.qty : 1;
  const status = f.fit === 'no' ? STATUS.assessment : f.loc ? (locOf(f.loc).kind === 'enclosure' ? STATUS.inuse : STATUS.storage) : '';
  review({ title: 'Confirm receipt', sub: `${t.id} · ${t.name}`, ok: 'Confirm receipt', fn: () => doReceive(tid),
    strip: [{ label: 'Received', value: `${f.qty} / ${t.qty}`, tone: diff ? 'attn' : '' }, { label: cat.mode === 'individual' ? 'Item IDs' : 'Batch', value: n }, { label: 'Condition', value: COND[f.fit === 'no' && f.cond === 'good' ? 'damaged' : f.cond] }],
    rows: [['Discrepancy', diff ? f.discrepancy : ''], ['Status', status], ['Location', locLabel(f.loc)], ['Custodian', nm(f.custodian)]],
    missing: [diff && !String(f.discrepancy).trim() ? 'Discrepancy' : '', !f.loc ? 'Location' : '', !f.custodian ? 'Custodian' : ''].filter(Boolean) });
}
function doReceive(tid) {
  const f = A.form; let ids;
  if (act(() => { ids = receive(tid, A.me, { qty: +f.qty, cond: f.cond, fit: f.fit !== 'no', loc: f.loc, custodian: f.custodian, discrepancy: f.discrepancy, notes: f.notes }); })) {
    go('#/item/' + ids[0]); say(ids.length > 1 ? `${ids.length} items received · ${ids[0]} to ${ids[ids.length - 1]}` : `Received · ${ids[0]}`);
  }
}

/* ---------- Register an item already on site (pilot backfill) ---------- */
route('register-new', () => {
  const f = F({ name: '', cat: '', qty: '1', loc: '', custodian: ['sup', 'afm'].includes(role()) ? A.me : '', cond: 'good', ticket: '' });
  const cat = f.cat && by('categories', f.cat), loc = f.loc && locOf(f.loc);
  const main = page({ title: 'Register item', back: '#/register', actions: [{ label: 'Review', kind: 'primary', onclick: 'reviewRegister()' }] })
    + part('Item', [['Name', f.name], ['Category', cat ? `${cat.code} · ${cat.name}` : ''], ['Quantity', cat && cat.mode === 'batch' ? f.qty : '1']], { label: 'Edit', onclick: 'editNewItem()' })
    + part('Condition', [['Condition', COND[f.cond]]], { label: 'Edit', onclick: "edit('Condition', () => [chc('Condition', 'cond', Object.keys(COND).filter(k => k !== 'beyond').map(k => ({ key: k, label: COND[k] })))])" })
    + part('Location', [['Location', locLabel(f.loc)], ['Section', loc ? secName(loc.section) : '']], { label: f.loc ? 'Change' : 'Pick', onclick: "pickLocation('loc', l => me().role === 'sup' ? me().sections.includes(l.section) : me().sites.includes(l.site))" })
    + part('Custodian', [['Custodian', nm(f.custodian)]], { label: f.custodian ? 'Change' : 'Pick', onclick: loc ? `pickPerson('custodian', custodiansOf('${loc.section}'), 'Custodian')` : "say('Pick the location first', 'alert')" })
    + part('Source', [['Request ticket', f.ticket]], { label: 'Edit', onclick: "edit('Source', () => [fld('Request ticket', 'ticket')])" });
  return { main, title: 'Register item' };
});
function editNewItem() {
  edit('Item', () => [fld('Name', 'name'), chc('Category', 'cat', D.categories.filter(c => c.mode !== 'excluded').map(c => ({ key: c.id, label: `${c.code} · ${c.name}` })))]
    .concat(A.form.cat && by('categories', A.form.cat).mode === 'batch' ? [fld('Quantity', 'qty', { type: 'number' })] : []), () => !!String(A.form.name).trim());
}
function reviewRegister() {
  const f = A.form, cat = f.cat && by('categories', f.cat);
  review({ title: 'Register item', sub: f.name, ok: 'Register', fn: doRegister,
    rows: [['Name', f.name], ['Category', cat ? `${cat.code} · ${cat.name}` : ''], ['Quantity', cat && cat.mode === 'batch' ? f.qty : '1'], ['Condition', COND[f.cond]], ['Location', locLabel(f.loc)], ['Custodian', nm(f.custodian)], ['Request ticket', f.ticket]],
    missing: [!String(f.name).trim() ? 'Name' : '', !f.cat ? 'Category' : '', !f.loc ? 'Location' : '', !f.custodian ? 'Custodian' : ''].filter(Boolean) });
}
function doRegister() { const f = A.form; let id; if (act(() => { id = register(A.me, { name: f.name, cat: f.cat, qty: +f.qty, loc: f.loc, custodian: f.custodian, cond: f.cond, ticket: f.ticket }); })) { go('#/item/' + id); say('Registered · ' + id); } }

/* ---------- Setup: categories and tracking modes (PRD §4, FR-01; admin only) ---------- */
const BIO = { always: 'Always', inuse: 'Only while in use', never: 'Never' };
const QR = { required: 'Required', optional: 'Optional', none: 'None' };
route('setup', () => {
  if (role() !== 'admin') return { main: header('overview') + kEmpty({ kind: 'error', text: 'Only the ANTZ admin can open Setup.', action: kButton({ label: 'Overview', href: '#/overview' }) }) };
  const main = header('setup', { sub: plural(D.categories.length, 'category', 'categories') })
    + cards(D.categories.map(c => card({ name: `${c.code} · ${c.name}`, about: c.about, status: kPill(MODE[c.mode], c.mode === 'excluded' ? '' : 'info'), href: '#/setup/' + c.id,
      facts: [{ label: 'Biologist', value: BIO[c.bio] }, { label: 'Technical', value: c.tech ? 'Workshop / VIC' : 'Not required' }, { label: 'Labels', value: QR[c.qr] }, { label: 'Items', value: D.items.filter(i => i.cat === c.id && isActive(i)).length }] })))
    + kCard({ title: 'Reminders', body: kKV([['Receipt pending after', plural(D.config.receiptDays, 'day')], ['Assessment overdue after', plural(D.config.assessDays, 'day')], ['Repair overdue after', plural(D.config.repairDays, 'day')], ['Approval overdue after', plural(D.config.approveDays, 'day')]]) })
    + kCard({ title: 'Roles', body: kKV(Object.keys(ROLE).map(k => [ROLE[k], D.people.filter(p => p.role === k).map(p => p.name).join(', ')])) });
  return { main, title: 'Setup' };
});
const REQ = { photo: 'Photo', notes: 'Notes', ref: 'Transfer reference' };
route('setup/([\\w-]+)', cid => {
  const c = by('categories', cid);
  if (!c || role() !== 'admin') return notHere('Category', 'Only the ANTZ admin can change a category.', '#/setup');
  const f = F(() => Object.assign(JSON.parse(JSON.stringify(c)), { techK: c.tech ? 'yes' : 'no', rRepair: c.req.repair, rTransfer: c.req.transfer, rDisposal: c.req.disposal }));
  const list = a => a.length ? a.map(k => REQ[k]).join(', ') : 'None';
  const main = page({ title: 'Category ' + f.code, sub: f.name, back: '#/setup', actions: [{ label: 'Save', kind: 'primary', onclick: 'doSaveCat()' }] })
    + part('Category', [['Code', f.code], ['Name', f.name], ['Description', f.about]], { label: 'Edit', onclick: "edit('Category', () => [fld('Code', 'code'), fld('Name', 'name'), fld('Description', 'about', { type: 'textarea' })], () => !!String(A.form.name).trim())" })
    + part('Tracking', [['Tracking mode', MODE[f.mode]]], { label: 'Edit', onclick: "edit('Tracking', () => [chc('Tracking mode', 'mode', Object.keys(MODE).map(k => ({ key: k, label: MODE[k] })))])" })
    + part('Routing', [['Biologist verification', BIO[f.bio]], ['Technical assessment', f.techK === 'yes' ? 'Workshop / VIC' : 'Not required'], ['QR / barcode label', QR[f.qr]]], { label: 'Edit', onclick: 'editRouting()' })
    + part('Required fields', [['Repair request', list(f.rRepair)], ['Transfer', list(f.rTransfer)], ['Disposal request', list(f.rDisposal)]], { label: 'Edit', onclick: 'editRequired()' });
  return { main, title: c.name };
});
function editRouting() {
  edit('Routing', () => [chc('Biologist verification', 'bio', Object.keys(BIO).map(k => ({ key: k, label: BIO[k] }))), chc('Technical assessment', 'techK', [{ key: 'yes', label: 'Workshop / VIC' }, { key: 'no', label: 'Not required' }]),
    chc('QR / barcode label', 'qr', Object.keys(QR).map(k => ({ key: k, label: QR[k] })))]);
}
function editRequired() {
  edit('Required fields', () => [chc('Repair request', 'rRepair', [{ key: 'photo', label: 'Photo' }, { key: 'notes', label: 'Notes' }], true), chc('Transfer', 'rTransfer', [{ key: 'ref', label: 'Transfer reference' }], true),
    chc('Disposal request', 'rDisposal', [{ key: 'photo', label: 'Photo' }, { key: 'notes', label: 'Notes' }], true)]);
}
function doSaveCat() {
  const f = A.form, c = { id: f.id, code: f.code, name: f.name, about: f.about, mode: f.mode, bio: f.bio, tech: f.techK === 'yes', qr: f.qr, owner: f.owner, req: { repair: f.rRepair, transfer: f.rTransfer, disposal: f.rDisposal } };
  act(() => saveCategory(A.me, c), 'Category saved', '#/setup');
}
