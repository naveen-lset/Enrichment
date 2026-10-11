// src/app/screens/phase-4-optimise.js — PRD Phase 4 · Optimisation, and the work views every phase feeds.
// My work (tasks by role) · Reports (eight reports and the PRD success measures) · Notifications and reminders · QR / barcode labels.
// Confirmed components: C-07 page header + tabs · C-26 stat strip · C-17 KPI tiles · C-18 list card · C-15 card · C-59 key-value
// · C-60 trend + bar rows · C-61 compliance overview · C-24 ring · C-51 picker sheet · C-62 empty · C-63 toast.

/* ---------- My work (PRD §3: each role acts only on its own steps) ---------- */
const MW = { all: null, receive: ['receipt', 'transfer'], checks: ['bio', 'tech', 'decide', 'dbio', 'dtech'], repair: ['repair', 'dispose', 'approve', 'complete'], audit: ['exception', 'audit', 'assign'] };
function taskCard(t) {
  return card({ name: `${t.label} · ${t.title}`, about: [t.ref].concat(t.meta || []), href: t.href,
    status: t.late ? kPill('Overdue', 'bad') : t.due ? kPill('Due ' + fs(t.due), 'info') : kPill('To do', 'attn') });
}
route('mywork', () => {
  const all = tasks(A.me).filter(inScopeTask), n = k => MW[k] ? all.filter(t => MW[k].includes(t.kind)).length : all.length;
  const list = MW[A.mw] ? all.filter(t => MW[A.mw].includes(t.kind)) : all;
  const main = header('mywork', { sub: `${ROLE[role()]} · ${plural(all.length, 'task')}` })
    + kStatStrip([{ key: 'all', label: 'All', value: n('all'), tone: all.some(t => t.late) ? 'bad' : '' }, { key: 'receive', label: 'Receipts', value: n('receive') }, { key: 'checks', label: 'Checks', value: n('checks') },
      { key: 'repair', label: 'Repairs and disposal', value: n('repair') }, { key: 'audit', label: 'Audit', value: n('audit') }], { current: A.mw, onpick: 'setMw' })
    + (list.length ? cards(list.map(taskCard)) : kEmpty({ kind: all.length ? 'filtered' : 'none', icon: 'checkc', text: all.length ? 'Nothing in this group.' : 'Nothing to act on.', action: all.length ? kButton({ label: 'Show all', onclick: "setMw('all')" }) : '' }));
  return { main, title: 'My work' };
});
function setMw(k) { A.mw = k; redraw(); }

/* ---------- Reports (PRD §10, FR-13) ---------- */
const REPORTS = { inventory: 'Site register', storage: 'In storage', repairs: 'Repair ageing', transfers: 'Transfer history', missing: 'Missing and exceptions', disposal: 'Disposal and scrap register', reuse: 'Repair, reuse and rotation', audit: 'Audit compliance' };
function pickReport() { pick('Report', Object.keys(REPORTS).map(k => ({ key: k, title: REPORTS[k] })), A.rep, k => { A.rep = k; }); }
function pickRepCat() { pick('Category', [{ key: '', title: 'All categories' }].concat(D.categories.filter(c => c.mode !== 'excluded').map(c => ({ key: c.id, title: `${c.code} · ${c.name}` }))), A.cat, k => { A.cat = k; }); }
const lastClosed = site => D.audits.filter(x => x.state === 'closed' && (!site || x.site === site)).sort((x, y) => y.closed.at.localeCompare(x.closed.at))[0];
route('reports', () => {
  const site = A.site === 'all' ? '' : A.site, r = report({ site, cat: A.cat });
  const its = D.items.filter(i => (!site || i.site === site) && (!A.cat || i.cat === A.cat));
  const pct = (n, m) => Math.round(n / Math.max(1, m) * 100), none = t => kEmpty({ kind: 'none', text: t });
  const moved = i => i.history.filter(h => h.act === 'Moved').length;
  let body = '';
  if (A.rep === 'inventory') {
    const max = Math.max(1, ...r.byStatus.map(s => s.n)), lc = lastClosed(site);
    body = kTiles([kKpi({ label: 'Register coverage', value: r.coverage ?? '—', unit: '%', sub: `${r.active} of ${D.config.target}` }),
        kKpi({ label: 'Location accuracy', value: r.accuracy ?? '—', unit: r.accuracy == null ? '' : '%', sub: lc ? lc.period : '' }),
        kKpi({ label: 'Disposal compliance', value: r.compliance ?? '—', unit: r.compliance == null ? '' : '%', sub: plural(r.disposals.filter(d => d.state === 'completed').length, 'completed', 'completed') })])
      + kCard({ title: 'By status', body: kBarRows(r.byStatus.filter(s => s.n).map(s => ({ label: s.label, pct: pct(s.n, max), value: String(s.n), tone: s.key === 'missing' ? 'bad' : ['assessment', 'repair'].includes(s.key) ? 'warn' : '' }))) })
      + kCard({ title: 'By category', body: kBarRows(D.categories.filter(c => c.mode !== 'excluded').map(c => { const n = its.filter(i => i.cat === c.id && isActive(i)).length; return { label: `${c.code} · ${c.name}`, pct: pct(n, r.active), value: String(n) }; })) })
      + kCard({ title: 'By section', body: kKV(D.sections.filter(s => !site || s.site === site).map(s => { const x = its.filter(i => i.section === s.id), c = st => x.filter(i => st.includes(i.status)).length;
        return [s.name, `${c(['inuse'])} in use · ${c(['storage', 'available'])} in storage · ${c(['assessment', 'repair'])} in repair · ${c(['missing'])} missing`]; })) });
  }
  if (A.rep === 'storage') body = r.storage.length ? cards(r.storage.map(itemCard)) : none('No items in storage.');
  if (A.rep === 'repairs') {
    const RS = { assessment: ['Under assessment', 'warn'], approved: ['Repair approved', 'info'], repair: ['Under repair', 'warn'], beyond: ['Beyond repair', 'bad'] };
    body = kTiles([kKpi({ label: 'Open', value: r.repairs.length }), kKpi({ label: 'Over 14 days', value: r.repairs.filter(x => x.age > 14).length, tone: r.repairs.some(x => x.age > 14) ? 'bad' : '' }), kKpi({ label: 'Repaired', value: r.repaired })])
      + (r.repairs.length ? cards(r.repairs.sort((a, b) => b.age - a.age).map(x => card({ name: x.name, about: [x.id, x.issue], status: kPill(RS[x.state][0], RS[x.state][1]), href: '#/item/' + x.id,
        facts: [{ label: 'Age', value: plural(x.age, 'day') }, { label: 'Opened', value: fs(itemOf(x.id).repair.opened) }, { label: 'Team', value: itemOf(x.id).repair.team || '' }] }))) : none('No open repairs.'));
  }
  if (A.rep === 'transfers') body = kTiles([kKpi({ label: 'Transfers', value: r.transfers.length }), kKpi({ label: 'In transit', value: r.transfers.filter(t => !t.ack).length }), kKpi({ label: 'Rotations', value: r.moves })])
    + (r.transfers.length ? cards(r.transfers.sort((a, b) => b.dispatched.localeCompare(a.dispatched)).map(t => card({ name: t.name, about: [t.id, `${secName(t.from.section)} → ${secName(t.to.section)}`, t.ref], href: '#/item/' + t.item,
      status: t.ack ? kPill(t.exception ? 'By exception' : 'Received', 'ok') : kPill('In transit', 'info'), facts: [{ label: 'Dispatched', value: fs(t.dispatched) }, { label: 'By', value: nm(t.by) }, { label: 'Received', value: t.ack ? fs(t.ack.at) : '' }, { label: 'Receiver', value: nm(t.to.custodian) }] }))) : none('No transfers.'));
  if (A.rep === 'missing') { const ex = r.exceptions.filter(l => !site || auditOf(l.audit).site === site);
    body = ex.length ? cards(ex.map(l => { const i = itemOf(l.item); return card({ name: i.name, about: [i.id, auditOf(l.audit).period, l.note], status: outPill(l.outcome), href: '#/audit/' + l.audit,
      facts: [{ label: 'Recorded at', value: locName(l.expected.loc) }, { label: 'Assigned to', value: l.exc ? nm(l.exc.to) : 'Not assigned' }, { label: 'Due', value: l.exc ? fs(l.exc.due) : '' }] }); })) : none('No missing items or open exceptions.'); }
  if (A.rep === 'disposal') body = r.disposals.length ? cards(r.disposals.slice().sort((a, b) => b.at.localeCompare(a.at)).map(d => card({ name: itemOf(d.item).name, about: [d.id, d.reason], href: '#/disposal/' + d.id,
    status: d.outcome ? kPill(DISPOSITION[d.outcome], d.outcome === 'scrapped' ? '' : 'ok') : dPill(d),
    facts: [{ label: 'Validators', value: [d.bio ? nm(d.bio.by) : '', d.tech ? nm(d.tech.by) : ''].filter(Boolean).join(', ') || '—' }, { label: 'Approver', value: nm(d.approver) }, { label: 'Decision', value: d.decision ? (d.decision.approved ? 'Approved ' : 'Rejected ') + fs(d.decision.at) : '—' }, { label: 'Completed', value: d.completed ? fs(d.completed.date) : '—' }] }))) : none('No disposal requests.');
  if (A.rep === 'reuse') {
    const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const mv = months.map(m => its.reduce((n, i) => n + i.history.filter(h => h.act === 'Moved' && h.at.startsWith(m)).length, 0)), mx = Math.max(1, ...mv);
    const top = its.filter(moved).sort((a, b) => moved(b) - moved(a)).slice(0, 5), tm = Math.max(1, ...top.map(moved));
    body = kTiles([kKpi({ label: 'Repaired', value: r.repaired }), kKpi({ label: 'Reused by transfer', value: r.reused }), kKpi({ label: 'Avoided replacements', value: r.repaired + r.reused })])
      + kCard({ title: 'Movements by month', body: kTrend(mv.map(n => pct(n, mx)), months.map(m => `${MON[+m.slice(5) - 1]} · ${mv[months.indexOf(m)]}`)) })
      + kCard({ title: 'Most rotated', body: top.length ? kBarRows(top.map(i => ({ label: `${i.name} · ${i.id}`, pct: pct(moved(i), tm), value: String(moved(i)) }))) : none('No movements.') });
  }
  if (A.rep === 'audit') {
    const au = D.audits.filter(a => !site || a.site === site), done = au.filter(a => a.state === 'closed'), lc = lastClosed(site);
    body = kCard({ title: 'Compliance', pad: 'lg', body: kRing(lc ? auditStats(lc).accuracy : 0, 120, { sub: lc ? lc.period : '' })
        + kTrend(done.map(a => auditStats(a).accuracy || 0), done.map(a => a.period))
        + kBarRows(D.sections.filter(s => !site || s.site === site).map(s => { const ls = done.flatMap(a => a.lines.filter(l => l.outcome && l.expected && sectionOf(itemOf(l.item).section) && itemOf(l.item).section === s.id));
          const ok = ls.filter(l => l.outcome === 'verified').length; return { label: s.name, pct: pct(ok, ls.length), value: ls.length ? pct(ok, ls.length) + '%' : '—', tone: ls.length && ok < ls.length ? 'warn' : '' }; })) })
      + cards(au.map(auditCard));
  }
  const main = header('reports', { sub: REPORTS[A.rep] + (A.cat ? ' · ' + by('categories', A.cat).code : ''),
      actions: tool('list', 'Report', 'pickReport()') + tool('filter', 'Category', 'pickRepCat()') + tool('download', 'Export', `say('${REPORTS[A.rep]} exported as CSV', 'download')`) })
    + body;
  return { main, title: 'Reports' };
});

/* ---------- Notifications and reminders (PRD §10) ---------- */
const N_TONE = { receipt: 'warn', transfer: 'info', repair: 'warn', disposal: 'info', missing: 'bad', audit: 'info', exception: 'bad' };
const N_WORD = { receipt: 'Receipt', transfer: 'Transfer', repair: 'Repair', disposal: 'Disposal', missing: 'Missing', audit: 'Audit', exception: 'Exception' };
route('notifications', () => {
  const list = notifications(A.me);
  const main = page({ title: 'Notifications', sub: plural(list.length, 'alert'), back: '#/overview' })
    + (list.length ? cards(list.map(n => card({ name: n.title, about: n.text, status: kPill(N_WORD[n.kind], N_TONE[n.kind]), facts: [{ label: 'Since', value: fs(n.at) }], href: n.href })))
      : kEmpty({ kind: 'none', icon: 'notif', text: 'No notifications.' }));
  return { main, title: 'Notifications' };
});

/* ---------- QR / barcode labels (FR-14) ---------- */
function addLabel(id) { A.sheet = null; drawSheet(); if (!A.lab.includes(id)) A.lab.push(id); redraw(); say('Added to label queue · ' + A.lab.length, 'scan'); }
function dropLabel(id) { A.lab = A.lab.filter(x => x !== id); redraw(); }
route('labels', () => {
  const pool = siteItems().filter(i => labelable(i) && can(A.me, 'labels', i) && !A.lab.includes(i.id));
  const queue = A.lab.map(itemOf).filter(Boolean);
  const main = page({ title: 'Print labels', sub: `${plural(queue.length, 'label')} in the queue`, back: '#/register',
      actions: [{ label: 'Clear', kind: 'ghost', disabled: !queue.length, onclick: 'A.lab=[];redraw()' }, { label: `Print ${plural(queue.length, 'label')}`, kind: 'primary', disabled: !queue.length, onclick: 'doPrint()' }] })
    + kStatStrip([{ label: 'In the queue', value: queue.length }, { label: 'Labelled', value: pool.filter(i => i.labelled).length }, { label: 'No label', value: pool.filter(i => !i.labelled).length }])
    + cards(queue.map(i => card({ name: i.name, about: [i.id, where(i)], status: kPill('In queue', 'info'), onclick: `dropLabel('${i.id}')`,
        facts: [{ label: 'Category', value: catCode(i) }, { label: 'Label', value: QR[catOf(i).qr] }, { label: 'Custodian', value: nm(i.custodian) }] })))
    + cards(pool.map(i => card({ name: i.name, about: [i.id, where(i)], status: i.labelled ? kPill('Labelled', 'ok') : kPill('No label', ''), onclick: `addLabel('${i.id}')`,
        facts: [{ label: 'Category', value: catCode(i) }, { label: 'Label', value: QR[catOf(i).qr] }, { label: 'Printed', value: i.labelled ? fs(i.labelled) : '' }] })));
  return { main, title: 'Print labels' };
});
function doPrint() { const n = A.lab.length; if (act(() => printLabels(A.me, A.lab))) { A.lab = []; redraw(); say(plural(n, 'label') + ' sent to the printer', 'scan'); } }
