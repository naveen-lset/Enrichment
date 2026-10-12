// src/ipad/views.js — every screen. A view is {label, icon, layout: 'split' | 'full', allow(), count(), list(r), detail(r) | full(r), slide(r)}.
// Split views: a list column and a detail pane (iPad split view). Full views: one wide pane. Actions open sheets from actions.js.

const R = (...roles) => () => roles.includes(role());
const mlist = rows => `<div class="mlist">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>`;
// lrow({href | do+arg, on, t, s, right, lead}) — one list row: title, one detail line, an optional right side
const lrow = o => `<div class="row ${o.on ? 'on' : ''}" ${o.do ? `data-do="${o.do}" data-arg="${esc(o.arg)}"` : `data-go="${o.href}"`}>${o.lead || ''}<div class="row__b"><div class="row__t">${o.t}</div>${o.s ? `<div class="row__s">${o.s}</div>` : ''}${o.badge ? `<div class="row__badge">${o.badge}</div>` : ''}</div>${o.right ? `<div class="row__e">${o.right}</div>` : ''}${o.do ? '' : `<span class="row__chev">${ic('right', 20)}</span>`}</div>`;
const siteItems = () => D.items.filter(inSite);
const activeItems = () => siteItems().filter(isActive);

/* ============ item helpers ============ */
function itemActs(it) {
  const mv = MOVABLE.includes(it.status) && !it.disposal;
  return {
    move: mv && can(UI.me, 'move', it),
    transfer: mv && can(UI.me, 'transfer', it),
    flag: MOVABLE.includes(it.status) && can(UI.me, 'flag', ['bio', 'ws'].includes(role()) ? null : it),
    dispose: isActive(it) && it.status !== 'transit' && !it.disposal && can(UI.me, 'dispose', it),
    label: labelable(it) && can(UI.me, 'labels', it),
  };
}
function itemMenu(it) {
  if (!it) return [];
  const a = itemActs(it);
  return [
    { icon: 'arrow', t: 'Open', go: '#/register/' + it.id },
    a.move && { icon: 'move', t: 'Move', do: 'actMove', arg: it.id },
    a.transfer && { icon: 'transfers', t: 'Transfer', do: 'actTransfer', arg: it.id },
    a.flag && { icon: 'flag', t: 'Report issue', do: 'actFlag', arg: it.id },
    a.label && { icon: 'printer', t: 'Print label', do: 'printOne', arg: it.id },
    a.dispose && { sep: true }, a.dispose && { icon: 'disposals', t: 'Request disposal', do: 'actDispose', arg: it.id, danger: true },
  ];
}
// the one thing to do next on an item, for the person signed in
function nextStep(it) {
  const r = it.repair, d = it.disposal && disposalOf(it.disposal), p = me();
  if (it.status === 'transit') {
    const tr = it.transfer, mine = p.id === tr.to.custodian || (p.role === 'afm' && p.sites.includes(tr.to.site));
    const days = daysBetween(tr.dispatched, nowIs());
    if (mine) return { icon: 'truck', t: `Arriving from ${secName(tr.from.section)}`, s: `Dispatched ${rel(tr.dispatched)}${tr.ref ? ' · ' + tr.ref : ''}`, btn: 'Acknowledge', do: 'actAck', arg: it.id };
    return { wait: true, icon: 'truck', t: `In transit to ${secName(tr.to.section)}`, s: `${nm(tr.to.custodian)} · ${plural(days, 'day')}` };
  }
  if (d) {
    if (['validation', 'approved'].includes(d.state) && d.needBio && !d.bio && can(UI.me, 'validateBio')) return { icon: 'paw', t: 'Disposal needs your validation', s: d.reason, btn: 'Validate', do: 'actValidate', arg: d.id + '|bio' };
    if (['validation', 'approved'].includes(d.state) && d.needTech && !d.tech && can(UI.me, 'validateTech')) return { icon: 'repairs', t: 'Disposal needs your validation', s: d.reason, btn: 'Validate', do: 'actValidate', arg: d.id + '|tech' };
    if ((d.state === 'approval' || (d.state === 'validation' && d.expedited)) && (d.approver === p.id || p.role === 'admin') && can(UI.me, 'approve')) return { icon: 'shield', t: 'Disposal awaiting your decision', s: d.reason, btn: 'Review', do: 'actReview', arg: d.id };
    if (d.state === 'approved' && can(UI.me, 'completeDisposal', it) && (!d.needBio || d.bio) && (!d.needTech || d.tech)) return { icon: 'disposals', t: 'Disposal approved', s: d.reason, btn: 'Complete', do: 'actCompleteDisposal', arg: d.id };
    return { wait: true, icon: 'disposals', t: DSTATE[d.state][0], s: `${d.id} · ${d.reason}`, btn: 'Open', go: '#/disposals/' + d.id };
  }
  if (r) {
    if (r.state === 'assessment') {
      if (r.bio === 'pending' && can(UI.me, 'verifyBio')) return { icon: 'paw', t: 'Animal-use check', s: r.issue, btn: 'Check', do: 'actBio', arg: it.id };
      if (r.tech === 'pending' && can(UI.me, 'assessTech')) return { icon: 'repairs', t: 'Repairability check', s: r.issue, btn: 'Assess', do: 'actTech', arg: it.id };
      if (!r.needBio && !r.needTech && can(UI.me, 'decide', it)) return { icon: 'flag', t: 'Decide outcome', s: r.issue, btn: 'Decide', do: 'actDecide', arg: it.id };
      return { wait: true, icon: 'clock', t: 'Under assessment', s: [r.bio === 'pending' ? 'Biologist' : '', r.tech === 'pending' ? 'Workshop' : ''].filter(Boolean).join(' · ') || r.issue };
    }
    if (r.state === 'approved') return can(UI.me, 'repairStart', role() === 'ws' ? null : it) ? { icon: 'repairs', t: 'Repair approved', s: r.issue, btn: 'Start repair', do: 'actStartRepair', arg: it.id } : { wait: true, icon: 'repairs', t: 'Repair approved', s: r.issue };
    if (r.state === 'repair') return can(UI.me, 'repairDone', role() === 'ws' ? null : it) ? { icon: 'repairs', t: `Under repair · ${r.team}`, s: `Started ${rel(r.started)}`, btn: 'Complete', do: 'actCompleteRepair', arg: it.id } : { wait: true, icon: 'repairs', t: `Under repair · ${r.team}`, s: `Started ${rel(r.started)}` };
    if (r.state === 'beyond') return itemActs(it).dispose ? { icon: 'alert', t: 'Beyond repair', s: r.techNote || r.issue, btn: 'Request disposal', do: 'actDispose', arg: it.id } : { wait: true, icon: 'alert', t: 'Beyond repair', s: r.issue };
  }
  if (it.status === 'missing') {
    const a = D.audits.find(x => x.lines.some(l => l.item === it.id && l.outcome === 'notfound' && !(l.exc && l.exc.resolved)));
    const l = a && a.lines.find(x => x.item === it.id);
    if (l && l.exc && (l.exc.to === p.id || CAN.auditAssign.includes(p.role))) return { icon: 'notfound', t: 'Missing', s: `${a.period} audit · due ${fs(l.exc.due)}`, btn: 'Resolve', do: 'actResolve', arg: a.id + '|' + it.id };
    return { wait: true, icon: 'notfound', t: 'Missing', s: a ? `${a.period} audit` : '' };
  }
  return null;
}
const nextCard = n => n ? `<div class="next ${n.wait ? 'next--wait' : ''}"><div class="next__i">${ic(n.icon, 22)}</div><div class="next__b"><div class="next__t">${esc(n.t)}</div>${n.s ? `<div class="next__s">${esc(n.s)}</div>` : ''}</div>${n.btn ? `<button class="btn btn--sm" ${n.go ? `data-go="${n.go}"` : `data-do="${n.do}" data-arg="${esc(n.arg)}"`}>${esc(n.btn)}</button>` : ''}</div>` : '';

const HICON = { Received: ['receive', 'ok'], Registered: ['newitem', 'ok'], Moved: ['move', 'info'], 'Status changed': ['swap', ''], 'Condition flagged': ['flag', 'warn'], 'Assessment requested': ['clock', 'warn'],
  'Animal use verified': ['paw', 'info'], 'Repairability assessed': ['repairs', 'info'], 'Repair approved': ['ok', 'ok'], 'Repair completed': ['repairs', 'ok'], 'Condition changed': ['alert', 'warn'],
  'Transfer dispatched': ['truck', 'info'], 'Transfer received': ['ok', 'ok'], 'Transfer completed by exception': ['alert', 'attn'], 'Custodian changed': ['user', ''], 'Disposal requested': ['disposals', 'attn'],
  'Disposal approved': ['shield', 'ok'], 'Disposal rejected': ['no', 'bad'], 'Disposal completed': ['disposals', ''], 'Audit verified': ['audits', 'ok'], 'Location corrected in audit': ['pin', 'warn'],
  'Marked missing': ['notfound', 'bad'], 'Audit exception': ['alert', 'warn'], 'Exception assigned': ['user', ''], 'Exception resolved': ['ok', 'ok'], Found: ['ok', 'ok'], 'Label printed': ['printer', ''],
  'Quantity split': ['layers', ''], 'Split from batch': ['layers', ''] };
function timeline(hist, withItem) {
  return `<div class="tl">${hist.map(h => {
    const [i, t] = HICON[h.act] || (h.act.startsWith('Disposal validated') ? ['shield', 'info'] : ['history', '']);
    return `<div class="tl__e"><div class="tl__i"><i style="background:${SOLID[t] || 'var(--c-fill-3)'}"></i></div><div class="tl__b"><div class="tl__t">${esc(withItem ? `${h.act} · ${h.item.name}` : h.act)}</div>
      ${h.from || h.to ? `<div class="tl__ft">${h.from ? esc(h.from) : ''}${h.from && h.to ? ic('arrow', 14) : ''}${h.to ? esc(h.to) : ''}</div>` : ''}
      ${h.note ? `<div class="tl__n">${esc(h.note)}</div>` : ''}
      <div class="tl__m">${av(h.by, 18)}${esc(nm(h.by))} · ${rel(h.at)}${h.ref ? ' · ' + esc(h.ref) : ''}</div></div></div>`;
  }).join('')}</div>`;
}

/* ============ My tasks ============ */
const KIND = {
  receipt: ['receive', 'info', 'actReceive'], transfer: ['truck', 'info', 'actAck'], bio: ['paw', 'warn', 'actBio'], tech: ['repairs', 'warn', 'actTech'], decide: ['flag', 'warn', 'actDecide'],
  dispose: ['disposals', 'attn', 'actDispose'], dbio: ['paw', 'attn', null], dtech: ['repairs', 'attn', null], approve: ['shield', 'attn', 'actReview'], complete: ['disposals', 'ok', 'actCompleteDisposal'],
  assign: ['users', 'warn', null], audit: ['audits', 'info', null], corrective: ['alert', 'bad', 'actResolve'],
};
function pending() {
  const out = tasks(UI.me).filter(t => !['audit', 'exception'].includes(t.kind)).map(t => {
    const [icon, tone] = KIND[t.kind] || ['clock', ''];
    let go = t.href.replace('#/item/', '#/register/').replace('#/receive/', '#/receipts/').replace('#/repair-done/', '#/register/').replace('#/dispose/', '#/register/').replace('#/disposal/', '#/disposals/').replace('#/audit/', '#/audits/');
    let doo = KIND[t.kind]?.[2], arg = t.ref;
    if (t.kind === 'repair') doo = t.label === 'Start repair' ? 'actStartRepair' : 'actCompleteRepair';
    if (t.kind === 'dbio' || t.kind === 'dtech') { doo = 'actValidate'; arg = t.ref + '|' + (t.kind === 'dbio' ? 'bio' : 'tech'); }
    if (t.kind === 'assign') { doo = null; go = '#/audits/' + t.ref; }
    return { icon, tone, k: t.label, t: t.title, s: t.meta.filter(Boolean).join(' · '), due: t.due, go, do: doo, arg, btn: t.label };
  });
  workTasks(UI.me).forEach(w => {
    const a = auditOf(w.audit), s = a ? auditStats(a) : null;
    if (w.kind === 'audit') out.push({ icon: 'audits', tone: 'info', k: 'Audit', t: w.title, s: `${siteName(a.site)} · ${s.checked} of ${s.n} checked · ${w.id}`, due: w.due, go: '#/audits/' + w.audit, btn: 'Continue' });
    else out.push({ icon: 'alert', tone: 'bad', k: 'Corrective action', t: itemOf(w.item).name, s: `${w.title.split(' · ')[0]} · ${a.period} · ${w.id}`, due: w.due, go: '#/register/' + w.item, do: 'actResolve', arg: w.audit + '|' + w.item, btn: 'Resolve' });
  });
  return out.sort((x, y) => String(x.due || '9').localeCompare(String(y.due || '9')));
}
const VERB = { 'Confirm receipt': 'Receive', 'Verify animal use': 'Check', 'Assess repair': 'Assess', 'Decide outcome': 'Decide', 'Start repair': 'Start', 'Complete repair': 'Complete', 'Request disposal': 'Request', 'Complete disposal': 'Complete', 'Continue': 'Open' };
function taskRow(t) {
  return `<div class="task" data-go="${t.go}"><div class="task__b"><div class="task__t">${esc(t.t)}</div><div class="task__s">${esc([t.k, t.s.split(' · ')[0]].filter(Boolean).join(' · '))}</div></div>
    ${dueChip(t.due)}${t.do ? `<button class="btn btn--tint btn--sm" data-do="${t.do}" data-arg="${esc(t.arg)}">${esc(VERB[t.btn] || t.btn)}</button>` : ic('right', 18, 'chev')}</div>`;
}
const NICON = { receipt: 'receive', transfer: 'truck', repair: 'repairs', missing: 'notfound', disposal: 'disposals', audit: 'audits', exception: 'alert' };
const notifRow = n => `<button class="mi mi--n" data-go="${n.href.replace('#/item/', '#/register/').replace('#/receive/', '#/receipts/').replace('#/disposal/', '#/disposals/').replace('#/audit/', '#/audits/')}"><i class="ndot ${['missing', 'exception'].includes(n.kind) ? 'bad' : ''}"></i><span style="min-width:0"><span>${esc(n.title)}</span><span class="mi__s">${esc(n.text)}</span></span></button>`;

VIEWS.today = {
  label: 'My tasks', icon: 'today', layout: 'full',
  count: () => { const n = pending().length; return n ? { n } : 0; },
  full() {
    const list = pending(), today = day(nowIs());
    const groups = [['Overdue', list.filter(t => t.due && t.due < today), 'late'], ['Today', list.filter(t => t.due === today), ''], ['Upcoming', list.filter(t => t.due && t.due > today), ''], ['Anytime', list.filter(t => !t.due), '']].filter(g => g[1].length);
    const mine = activeItems().filter(it => role() !== 'sup' || me().sections.includes(it.section));
    const cnt = st => mine.filter(i => st.includes(i.status)).length;
    const notes = notifications(UI.me);
    const html = `
      <div class="today"><div class="stack">${card('', groups.length ? `<div class="tasks">${groups.map(([g, ts, c]) => `<div class="tasks__h ${c}">${g}<span>${ts.length}</span></div>${ts.map(taskRow).join('')}`).join('')}</div>` : empty('ok', 'All clear', '', true))}</div>
      <div class="stack">
        <div class="w"><div class="w__t">${role() === 'sup' ? 'My sections' : esc(siteLabel())}</div><div class="stats4">
          ${[['In use', ['inuse', 'available'], 'ok', 'inuse'], ['In storage', ['storage'], 'info', 'storage'], ['Repair', ['assessment', 'repair'], 'warn', 'attention'], ['Missing', ['missing'], 'bad', 'missing']].map(([l, st, tone, f]) => `<div class="stat" data-do="drill" data-arg="register|st|${f}"><div class="stat__n" data-count="${cnt(st)}">${cnt(st)}</div><div class="stat__l"><i style="background:${SOLID[tone]}"></i>${l}</div></div>`).join('')}
        </div></div>
        ${card('Notifications', notes.length ? `<div style="padding:4px 6px 8px">${notes.slice(0, 6).map(notifRow).join('')}</div>` : empty('bell', 'No notifications', '', true), notes.length > 6 ? `<button class="text-btn" data-do="bell">All ${notes.length}</button>` : '')}
      </div></div>`;
    return { title: 'My tasks', html, key: UI.me };
  },
};
DO.tabSet = a => { const [k, v] = a.split('|'); UI.tab[{ rcp: 'receipts', trf: 'transfers', dsp: 'disposals' }[k]] = v; render(); };
DO.drill = a => { const [v, k, val] = a.split('|'); UI.f[v] = Object.assign({}, UI.f[v], { [k]: val }); go('#/' + v); };
DO.bell = (a, el) => {
  const ns = notifications(UI.me);
  popover(el.closest('.icon-btn') || el, `<div class="pop__h">Notifications</div>${ns.length ? ns.map(notifRow).join('') : empty('bell', 'No notifications', '', true)}`, { w: 380 });
};
function createItems() {
  return [
    can(UI.me, 'receive') && { icon: 'receive', t: 'Receive delivery', do: 'newReceipt' },
    can(UI.me, 'receive') && { icon: 'newitem', t: 'Register existing item', do: 'actRegister' },
    can(UI.me, 'auditCreate') && { icon: 'calendar', t: 'Schedule audit', do: 'actSchedule' },
    can(UI.me, 'labels') && { icon: 'printer', t: 'Print labels', go: '#/labels' },
  ].filter(Boolean);
}
DO.create = (a, el) => popover(el, menu(createItems()), { w: 260 });

/* ============ Overview ============ */
VIEWS.overview = {
  label: 'Overview', icon: 'overview', layout: 'full',
  full() {
    const units = UI.f.overview?.units === 'units';
    const rep = report({ site: UI.site === 'all' ? '' : UI.site, units });
    const n = k => rep.byStatus.find(s => s.key === k).n;
    const items = activeItems();
    const pendingApprovals = D.disposals.filter(d => ['validation', 'approval'].includes(d.state) && inSite(itemOf(d.item))).length;
    const overdue = tasks('P-NEHA').filter(t => t.late && (!t.ref || !itemOf(t.ref) || inSite(itemOf(t.ref)))).length;
    const audits = D.audits.filter(a => a.state !== 'closed' && inSite(a));
    const exc = audits.reduce((s, a) => s + auditStats(a).exceptions - a.lines.filter(l => l.exc && l.exc.resolved).length, 0);
    const kpi = (l, v, icon, tone, drill) => `<button class="kstat" ${drill ? `data-do="drill" data-arg="${drill}"` : 'disabled'}><span class="kstat__l"><i style="background:${tone ? SOLID[tone] : 'var(--c-brand)'}"></i>${l}</span><span class="kstat__n" data-count="${v}">${v}</span></button>`;
    const total = rep.active;
    const order = ['inuse', 'storage', 'assessment', 'repair', 'transit', 'missing'];
    const donutData = order.map(k => ({ k, n: n(k), tone: STONE[k] }));
    const secs = D.sections.filter(s => UI.site === 'all' || s.site === UI.site).map(s => {
      const its = items.filter(i => i.section === s.id);
      return { s, n: its.length, use: its.filter(i => i.status === 'inuse').length, st: its.filter(i => i.status === 'storage').length, att: its.filter(i => ['assessment', 'repair', 'missing'].includes(i.status)).length, v: its.filter(i => daysBetween(i.lastVerified, nowIs()) <= 30).length };
    });
    const rp = siteItems().filter(i => i.repair);
    const pipe = [['Assessment', rp.filter(i => i.repair.state === 'assessment').length], ['Approved', rp.filter(i => i.repair.state === 'approved').length], ['In repair', rp.filter(i => i.repair.state === 'repair').length], ['Beyond repair', rp.filter(i => i.repair.state === 'beyond').length]];
    const html = `
      <div class="grid"><div class="w w--4 kstats">
        ${kpi(units ? 'Tracked units' : 'Tracked items', total, 'register', '', 'register|st|all')}
        ${kpi('In use', n('inuse') + n('available'), 'paw', 'ok', 'register|st|inuse')}
        ${kpi('In storage', n('storage'), 'register', 'info', 'register|st|storage')}
        ${kpi('Under repair', n('assessment') + n('repair'), 'repairs', 'warn', 'register|st|attention')}
        ${kpi('In transit', n('transit'), 'truck', 'info', 'register|st|transit')}
        ${kpi('Missing', n('missing'), 'notfound', 'bad', 'register|st|missing')}
        ${kpi('Pending approvals', pendingApprovals, 'shield', 'attn', 'disposals|st|open')}
        ${kpi('Overdue work', overdue, 'clock', 'bad', '')}</div>
        <div class="w w--2"><div class="w__t">By status</div><div class="donut-w">${donut(donutData, total)}<div class="legend">${donutData.map(d => `<div><i style="background:${SOLID[d.tone]}"></i>${STATUS[d.k]}<b>${d.n}</b></div>`).join('')}</div></div></div>
        <div class="w w--2"><div class="w__t">Repairs</div><div class="pipe">${pipe.map(([l, c]) => `<div class="pipe__s" data-go="#/repairs"><div class="pipe__n" data-count="${c}">${c}</div><div class="pipe__l">${l}</div></div>`).join('')}</div>
          <div class="w__t" style="margin:22px 0 12px">Audits</div>${audits.length ? audits.map(a => { const s = auditStats(a); return `<div class="row" data-go="#/audits/${a.id}" style="min-height:52px">${ring(s.pct, 40, 5, 'ok', '')}<div class="row__b"><div class="row__t">${esc(a.period)} · ${esc(siteName(a.site))}</div><div class="row__s">${s.checked} of ${s.n} · ${s.exceptions} findings</div></div>${dueChip(a.due)}</div>`; }).join('') : empty('audits', 'No open audits', '', true)}
</div>
        <div class="w w--4"><div class="w__t">By section</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Section</th><th>Items</th><th>In use</th><th>Storage</th><th>Attention</th><th>Verified ≤ 30 days</th></tr></thead><tbody>
          ${secs.map(x => `<tr data-do="drill" data-arg="register|sec|${x.s.id}"><td><b>${esc(x.s.name)}</b></td><td>${x.n}</td><td>${x.use}</td><td>${x.st}</td><td>${x.att ? `<span class="pill pill--warn">${x.att}</span>` : '0'}</td><td>${x.n ? Math.round(x.v / x.n * 100) : 0}%<span class="mini"><i style="width:${x.n ? x.v / x.n * 100 : 0}%"></i></span></td></tr>`).join('')}</tbody></table></div></div>
      </div>`;
    return { title: 'Overview', html: `<div class="ctop"><span>${esc(siteLabel())}</span>${seg('units', [{ v: 'records', t: 'Records' }, { v: 'units', t: 'Units' }], units ? 'units' : 'records', 'units')}</div>` + html, key: units ? 'u' : 'r' };
  },
};
DO.units = v => { UI.f.overview = { units: v }; render(); };
function donut(data, total, size = 148) {
  const r = 56, c = 2 * Math.PI * r; let acc = 0;
  const sum = data.reduce((s, d) => s + d.n, 0) || 1;
  const arcs = data.filter(d => d.n).map(d => { const len = d.n / sum * c, seg = `<circle cx="74" cy="74" r="${r}" fill="none" stroke="${SOLID[d.tone]}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-acc}"/>`; acc += len; return seg; }).join('');
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 148 148"><circle cx="74" cy="74" r="${r}" fill="none" stroke="var(--c-fill)" stroke-width="18"/>${arcs}</svg><div class="ring__c" style="font-size:28px"><div><span data-count="${total}">${total}</span><small>active</small></div></div></div>`;
}

/* ============ Items (register) ============ */
const ST_CHIPS = [['all', 'All', i => isActive(i)], ['inuse', 'In use', i => ['inuse', 'available'].includes(i.status)], ['storage', 'Storage', i => i.status === 'storage'], ['attention', 'Repair', i => ['assessment', 'repair'].includes(i.status)],
  ['transit', 'Transit', i => i.status === 'transit'], ['missing', 'Missing', i => i.status === 'missing'], ['closed', 'Closed', i => !isActive(i)]];
const SORTS = { section: 'Section', name: 'Name', id: 'Item ID', verified: 'Last verified' };
function regFilter() { return Object.assign({ st: 'all', sort: 'section', cat: '', cond: '', sec: '', kind: '', cust: '', stale: '' }, UI.f.register); }
function regTokens(f) {
  const K = { enclosure: 'Enclosures', store: 'Stores' };
  return [f.cat && ['cat', by('categories', f.cat).code + ' · ' + by('categories', f.cat).name.split(' ')[0]], f.cond && ['cond', COND[f.cond]], f.sec && ['sec', secName(f.sec)], f.kind && ['kind', K[f.kind]], f.cust && ['cust', nm(f.cust)], f.stale && ['stale', `Not verified ${f.stale}+ days`]].filter(Boolean);
}
function regItems(f) {
  const q = UI.q.register || '', chip = ST_CHIPS.find(c => c[0] === f.st) || ST_CHIPS[0];
  return siteItems().filter(chip[2]).filter(i => (!f.cat || i.cat === f.cat) && (!f.cond || i.cond === f.cond) && (!f.sec || i.section === f.sec) && (!f.kind || locOf(i.loc)?.kind === f.kind) && (!f.cust || i.custodian === f.cust) && (!f.stale || daysBetween(i.lastVerified, nowIs()) > +f.stale)
    && match(q, i.id, i.name, locName(i.loc), secName(i.section), nm(i.custodian), i.ticket, i.mt));
}
const quiet = it => !it.disposal && ['inuse', 'available', 'storage'].includes(it.status);
function itemRow(it, on, opts = {}) {
  const a = itemActs(it), acts = [a.move && `<button class="a-move" data-do="actMove" data-arg="${it.id}">Move</button>`, a.flag && `<button class="a-flag" data-do="actFlag" data-arg="${it.id}">Issue</button>`].filter(Boolean);
  const row = `<div class="row ${on ? 'on' : ''}" data-go="${opts.href || '#/register/' + it.id}" data-ctx="item:${it.id}"><div class="row__b"><div class="row__t">${esc(it.name)}${it.mode === 'batch' ? ` <span class="row__m">× ${it.qty}</span>` : ''}</div><div class="row__s">${esc(it.id)} · ${esc(it.status === 'transit' ? 'In transit' : locName(it.loc))}</div></div><div class="row__e">${quiet(it) ? '' : stPill(it)}${opts.meta ? `<span class="row__m">${opts.meta}</span>` : ''}</div><span class="row__chev">${ic('right', 20)}</span></div>`;
  return acts.length && !opts.noSwipe ? `<div class="swipe"><div class="swipe__acts">${acts.join('')}</div>${row}</div>` : row;
}
VIEWS.register = {
  label: 'Items', icon: 'register', layout: 'split',
  count: () => activeItems().length,
  list(r) {
    const f = regFilter(), list = regItems(f);
    const nFilters = regTokens(f).length;
    const sorted = list.slice().sort(f.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : f.sort === 'id' ? (a, b) => a.id.localeCompare(b.id) : f.sort === 'verified' ? (a, b) => a.lastVerified.localeCompare(b.lastVerified) : (a, b) => secName(a.section).localeCompare(secName(b.section)) || a.name.localeCompare(b.name));
    const tokens = regTokens(f);
    const chips = `<div class="chips">${ST_CHIPS.map(([k, t]) => `<button class="chip ${f.st === k ? 'on' : ''}" data-do="regSt" data-arg="${k}">${t}</button>`).join('')}</div>${tokens.length ? `<div class="tokens">${tokens.map(([k, t]) => `<button class="token" data-do="regUnset" data-arg="${k}">${esc(t)}${ic('x', 13)}</button>`).join('')}<button class="token-clear" data-do="regClear">Clear</button></div>` : ''}`;
    let rows;
    if (!sorted.length) rows = empty('search', UI.q.register ? 'No results' : 'No items', '', true, nFilters ? `<button class="btn btn--tint btn--sm" data-do="regClear">Clear filters</button>` : '');
    else if (f.sort === 'section') rows = [...new Set(sorted.map(i => i.section))].map(s => { const g = sorted.filter(i => i.section === s); return `<div class="sec-h">${esc(secName(s))} (${g.length})</div><div class="rows">${g.map(it => itemRow(it, it.id === r.id)).join('')}</div>`; }).join('');
    else rows = `<div class="rows" style="margin-top:8px">${sorted.map(it => itemRow(it, it.id === r.id, { meta: f.sort === 'verified' ? fs(it.lastVerified) : '' })).join('')}</div>`;
    return { title: 'Items', search: 'Search items', filter: { do: 'regFilter', n: nFilters }, rows: `<div class="lcount"><span>Items (${list.length})</span><button class="pillbtn" data-do="regSort">${ic('sort', 16)}${SORTS[f.sort]}</button></div>` + chips + rows, };
  },
  detail(r) { return itemDetail(r.id, '#/register/' + r.id); },
};
DO.regSt = k => { UI.f.register = Object.assign(regFilter(), { st: k }); render(); };
DO.regClear = () => { UI.f.register = { st: regFilter().st }; render(); };
DO.regSort = (a, el) => popover(el, menu(Object.entries(SORTS).map(([k, t]) => ({ t, do: 'regSet', arg: 'sort|' + k, on: regFilter().sort === k }))), { w: 220 });
DO.regUnset = k => { UI.f.register = Object.assign(regFilter(), { [k]: '' }); render(); };
DO.regFilter = () => {
  const secs = D.sections.filter(x => UI.site === 'all' || x.site === UI.site);
  const custs = [...new Set(siteItems().filter(isActive).map(i => i.custodian))];
  sheet({
    title: 'Filters',
    left: `<button class="text-btn" data-do="regReset">Reset</button>`,
    body: f => fg('Sort by', [cSeg('sort', f, [['section', 'Section'], ['name', 'Name'], ['id', 'ID'], ['verified', 'Verified']])])
      + fg('Category', [cOpts('', 'cat', f, [['', 'All'], ...D.categories.filter(c => c.mode !== 'excluded').map(c => [c.id, `${c.code} · ${c.name.split(' ')[0]}`])])])
      + fg('Condition', [cOpts('', 'cond', f, [['', 'Any'], ...['good', 'needsrepair', 'damaged', 'unsafe', 'beyond'].map(k => [k, COND[k]])])])
      + fg('Section', [cOpts('', 'sec', f, [['', 'All'], ...secs.map(x => [x.id, x.name])])])
      + fg('Location', [cOpts('', 'kind', f, [['', 'All'], ['enclosure', 'Enclosures'], ['store', 'Stores']]), cNav('Custodian', f.cust ? nm(f.cust) : 'Anyone', 'cust')])
      + fg('Last verified', [cOpts('', 'stale', f, [['', 'Any time'], ['30', 'Over 30 days'], ['90', 'Over 90 days']])]),
    pickers: { cust: () => pickerPage({ title: 'Custodian', key: 'cust', options: [{ v: '', t: 'Anyone' }, ...peopleOpts(p => custs.includes(p.id))] }) },
    done: { label: f => `Show ${regItems(Object.assign(regFilter(), f)).length}`, run: f => { UI.f.register = Object.assign({}, f); return ''; } },
  }, Object.assign({}, regFilter()));
};
DO.regReset = () => { Object.assign(SH.f, { sort: 'section', cat: '', cond: '', sec: '', kind: '', cust: '', stale: '' }); SH.dirty = true; refreshSheet(); };

function itemDetail(id, base, compact) {
  const it = itemOf(id);
  if (!it) return { html: empty('register', id ? 'Item not found' : 'No item selected'), title: '' };
  const tab = UI.tab.item || 'overview', a = itemActs(it), c = catOf(it), n = nextStep(it);
  const more = `<button class="icon-btn" data-do="itemMore" data-arg="${it.id}" aria-label="More">${ic('more', 22)}</button>`;
  const qa = [a.move && ['move', 'Move', 'actMove'], a.transfer && ['transfers', 'Transfer', 'actTransfer'], a.flag && ['flag', 'Report issue', 'actFlag'], a.dispose && ['disposals', 'Dispose', 'actDispose']].filter(Boolean);
  const r = it.repair, assessments = [...(r ? [r] : []), ...(it.repairs || [])].flatMap(x => [
    x.needBio && { t: 'Animal-use suitability', by: x.bioBy, at: x.bioAt, res: x.bio, note: x.bioNote, tone: x.bio === 'suitable' ? 'ok' : x.bio === 'unsuitable' ? 'bad' : 'warn' },
    x.needTech && { t: 'Repairability', by: x.techBy, at: x.techAt, res: x.tech, note: x.techNote, tone: x.tech === 'repairable' ? 'ok' : x.tech === 'beyond' ? 'bad' : 'warn' }].filter(Boolean));
  const transfers = [...(it.transfer ? [it.transfer] : []), ...(it.transfers || [])];
  const auditLines = D.audits.flatMap(au => au.lines.filter(l => l.item === it.id && l.outcome).map(l => ({ au, l })));
  const wtasks = W().tasks.filter(t => t.item === it.id);
  const disposals = D.disposals.filter(d => d.item === it.id);
  const RES = { pending: 'Pending', suitable: 'Suitable', unsuitable: 'Unsuitable', repairable: 'Repairable', beyond: 'Beyond repair' };
  let body = '';
  if (tab === 'overview') {
    body = `${nextCard(n)}${!n && qa.length ? `<div class="qa">${qa.map(([i, t, d]) => `<button class="qa__b ${d === 'actDispose' ? 'danger' : ''}" data-do="${d}" data-arg="${it.id}">${t}</button>`).join('')}</div>` : ''}
      ${card('Location', kv([['Location', `${it.status === 'transit' ? 'In transit' : esc(locName(it.loc))}<small>${esc(secName(it.section))} · ${esc(siteName(it.site))}</small>`], ['Custodian', personRow(it.custodian)], ['Last verified', `${fd(it.lastVerified)}`]]))}
      ${card('Details', kv([['Category', `${esc(c.code)} · ${esc(c.name)}<small>${it.mode === 'batch' ? `Group · ${it.qty} units` : 'Individual'}</small>`],
        it.parent && ['Split from', `<span class="link" data-go="#/register/${it.parent}">${esc(it.parent)}</span>`], it.ticket && ['References', `<span class="link" data-go="#/receipts/${it.ticket}">${esc(it.ticket)}</span>${[it.ws, it.mt].filter(Boolean).map(x => `<span class="row__m">${esc(x)}</span>`).join('')}`],
        ['Received', fd(it.received)], it.labelled && ['Label printed', fd(it.labelled)], it.final && ['Final disposition', esc(DISPOSITION[it.final])]]))}
      ${it.photos.length ? card('Evidence', photos(it.photos)) : ''}`;
  } else if (tab === 'history') {
    body = card('', timeline(it.history));
  } else {
    const sec = (t, rows) => rows.length ? card(t, `<div class="cardlist">${rows.join('')}</div>`) : '';
    body = [
      sec('Tasks', wtasks.map(t => `<div class="row" data-go="#/audits/${t.audit}"><div class="row__b"><div class="row__t">${esc(t.title)}</div><div class="row__s">${t.id} · ${esc(nm(t.assignee))}</div></div>${pill(t.state === 'done' ? 'Done' : 'Open', t.state === 'done' ? 'ok' : 'warn')}</div>`)),
      sec('Assessments', assessments.map(x => `<div class="row" style="cursor:default"><div class="row__b"><div class="row__t">${esc(x.t)}</div><div class="row__s">${x.by ? esc(nm(x.by)) + ' · ' + rel(x.at) : 'Waiting'}${x.note ? ' · ' + esc(x.note) : ''}</div></div>${pill(RES[x.res] || x.res, x.tone)}</div>`)),
      sec('Repairs', [...(r ? [r] : []), ...(it.repairs || [])].map(x => `<div class="row" style="cursor:default"><div class="row__b"><div class="row__t">${esc(x.issue)}</div><div class="row__s">${x.id} · ${rel(x.opened)}${x.done ? ' · ' + esc(x.done.notes || '') : ''}</div></div>${pill({ assessment: 'Assessment', approved: 'Approved', repair: 'In repair', beyond: 'Beyond repair', done: 'Repaired', cleared: 'Cleared', closed: 'Closed' }[x.state], x.state === 'done' || x.state === 'cleared' ? 'ok' : x.state === 'beyond' ? 'bad' : 'warn')}</div>`)),
      sec('Transfers', transfers.map(t => `<div class="row" data-go="#/transfers/${t.id}"><div class="row__b"><div class="row__t">${esc(secName(t.from.section))} → ${esc(secName(t.to.section))}</div><div class="row__s">${t.id} · ${rel(t.dispatched)}${t.ref ? ' · ' + esc(t.ref) : ''}</div></div>${pill(t.ack ? (t.exception ? 'By exception' : 'Received') : 'In transit', t.ack ? 'ok' : 'info')}</div>`)),
      sec('Audits', auditLines.map(({ au, l }) => `<div class="row" data-go="#/audits/${au.id}"><div class="row__b"><div class="row__t">${esc(au.period)} audit</div><div class="row__s">${au.id} · ${rel(l.at)}${l.note ? ' · ' + esc(l.note) : ''}</div></div>${pill(AUDIT_OUT[l.outcome], OTONE[l.outcome])}</div>`)),
      sec('Disposal', disposals.map(d => `<div class="row" data-go="#/disposals/${d.id}"><div class="row__b"><div class="row__t">${esc(d.reason)}</div><div class="row__s">${d.id} · ${rel(d.at)}</div></div>${dPill(d)}</div>`)),
    ].join('') || empty('layers', 'No linked work', '', true);
  }
  const counts = { work: [...(r ? [r] : []), ...(it.repairs || [])].length + transfers.length + auditLines.length + wtasks.length + disposals.length };
  const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(it.name)}</h2><div class="hero__s"><span class="num">${esc(it.id)}</span>·<span>${esc(c.code)} · ${it.mode === 'batch' ? 'Group' : 'Individual'}</span></div><div class="hero__p">${stPill(it, true)}${cdPill(it, true)}</div></div></div>
    ${seg('itab', [{ v: 'overview', t: 'Overview' }, { v: 'history', t: `History` }, { v: 'work', t: `Linked${counts.work ? ' · ' + counts.work : ''}` }], tab, 'itemTab', 'seg--block seg--lg tabs')}
    <div style="margin-top:16px">${body}</div>`;
  return { title: it.name, html, right: more, key: tab };
}
DO.itemTab = t => { UI.tab.item = t; render(); };
DO.itemMore = (id, el) => popover(el, menu(itemMenu(itemOf(id)).slice(1)), { w: 250 });

/* ============ Receipts ============ */
VIEWS.receipts = {
  label: 'Receipts', icon: 'receipts', layout: 'split', allow: R('sup', 'afm', 'admin'),
  count: () => { const n = D.tickets.filter(t => t.status === 'dispatched' && inSiteT(t) && canSeeT(t)).length; return n ? { n } : 0; },
  list(r) {
    const q = UI.q.receipts || '', tab = UI.tab.receipts || 'waiting';
    const all = D.tickets.filter(t => inSiteT(t) && canSeeT(t) && match(q, t.id, t.name, t.mt, t.ws, secName(t.section)));
    const list = tab === 'waiting' ? all.filter(t => t.status === 'dispatched').sort((a, b) => a.dispatched.localeCompare(b.dispatched)) : all.filter(t => t.status !== 'dispatched').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const rows = list.map(t => lrow({ href: '#/receipts/' + t.id, on: r.id === t.id, t: esc(t.name), s: `${t.id} · ${t.qty} × ${by('categories', t.cat).code} · ${esc(secName(t.section))}`, right: t.status === 'dispatched' ? dueChip(addDays(t.dispatched, D.config.receiptDays).slice(0, 10)) : `<span class="row__m">${fs(t.receivedAt)}</span>` })).join('');
    return { title: 'Receipts', search: 'Search deliveries', tabs: `${seg('rcp', [{ v: 'rcp|waiting', t: 'Waiting' }, { v: 'rcp|received', t: 'Received' }], 'rcp|' + tab, 'tabSet', 'seg--block')}`, rows: `<div class="rows">${rows || empty('receipts', tab === 'waiting' ? 'Nothing waiting' : 'Nothing received', '', true)}</div>` };
  },
  detail(r) {
    const t = by('tickets', r.id);
    if (!t) return { html: empty('receipts', 'No delivery selected') };
    const c = by('categories', t.cat), waiting = t.status === 'dispatched', due = addDays(t.dispatched, D.config.receiptDays).slice(0, 10);
    const st = (cls, icon, tt, s) => `<div class="step ${cls}"><div class="step__dot">${ic(icon)}</div><div class="step__b"><div class="step__t">${tt}</div>${s ? `<div class="step__s">${s}</div>` : ''}</div></div>`;
    const created = (t.items || []).map(itemOf).filter(Boolean);
    const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(t.name)}</h2><div class="hero__s">${t.id}</div><div class="hero__p">${waiting ? pill('Waiting', 'info', '', true) + (dueChip(due)) : pill(t.excluded ? 'Received · not tracked' : 'Received', 'ok', '', true)}</div></div></div>
      ${waiting && can(UI.me, 'receive', { section: t.section, site: sectionOf(t.section).site }) ? `<button class="btn btn--fill btn--lg btn--block" data-do="actReceive" data-arg="${t.id}">${ic('receive', 20)}Receive</button>` : ''}
      ${card('Request', kv([['Item', esc(t.name)], ['Quantity', `<span class="num">${t.qty}</span>`], ['Category', `${c.code} · ${esc(c.name)}`], ['Tracking', { individual: 'Individual · one record per unit', batch: 'Group / quantity · one record', excluded: 'Excluded · no record' }[c.mode]], ['Section', esc(secName(t.section))], ['Requested by', personRow(t.requestedBy)], t.ws && ['Workshop order', esc(t.ws)], ['Material transfer', esc(t.mt)]]))}
      ${card('Progress', `<div class="steps">${st('done', 'newitem', 'Requested', esc(nm(t.requestedBy)))}${st('done', 'truck', 'Dispatched', ft2(t.dispatched))}${st(waiting ? 'now' : 'done', 'receive', 'Received', waiting ? '' : `${esc(nm(t.receivedBy))} · ${ft2(t.receivedAt)}${t.discrepancy ? ' · ' + esc(t.discrepancy) : ''}`)}${st(waiting ? '' : t.excluded ? 'skip' : 'done', 'register', t.excluded ? 'Not registered' : 'Registered', created.length ? plural(created.length, 'record') : '')}</div>`)}
      ${created.length ? card('Records', `<div class="cardlist">${created.map(it => itemRow(it, false, { noSwipe: true })).join('')}</div>`) : ''}`;
    return { title: t.name, html };
  },
};
const ft2 = t => t ? `${fd(t)}${tm(t) ? ', ' + tm(t) : ''}` : '';
const inSiteT = t => UI.site === 'all' || sectionOf(t.section).site === UI.site;
const canSeeT = t => role() === 'admin' || can(UI.me, 'receive', { section: t.section, site: sectionOf(t.section).site });

/* ============ Repairs & Issues (board + slide-over) ============ */
const LANES = [['assessment', 'Assessment', 'warn'], ['approved', 'Approved', 'info'], ['repair', 'In repair', 'attn'], ['beyond', 'Beyond repair', 'bad']];
VIEWS.repairs = {
  label: 'Repairs & Issues', icon: 'repairs', layout: 'full',
  count: () => siteItems().filter(i => i.repair).length,
  full(r) {
    const tab = UI.tab.repairs || 'board', open = siteItems().filter(i => i.repair);
    const chk = (need, v, icon, name) => need ? `<span class="chk ${v === 'pending' ? 'wait' : ['suitable', 'repairable'].includes(v) ? 'ok' : 'bad'}">${ic(icon)}${name}</span>` : '';
    const kc = it => { const x = it.repair, age = daysBetween(x.opened, nowIs()), late = x.state === 'repair' ? daysBetween(x.started, nowIs()) > D.config.repairDays : x.state === 'assessment' && age > D.config.assessDays;
      const wait = [x.bio === 'pending' && 'Biologist', x.tech === 'pending' && 'Workshop'].filter(Boolean);
      const line = x.state === 'assessment' ? (wait.length === 2 ? 'Waiting for biologist and workshop' : wait.length ? `Waiting for ${wait[0].toLowerCase()}` : 'Ready to decide') : x.state === 'repair' ? x.team : x.state === 'approved' ? 'Ready to start' : (it.disposal ? 'Disposal requested' : 'Needs disposal');
      return `<div class="kcard ${r.id === it.id ? 'on' : ''}" data-go="#/repairs/${it.id}" data-ctx="item:${it.id}"><div class="kcard__top"><div class="kcard__t">${esc(it.name)}</div><span class="due ${late ? 'late' : ''}">${age}d</span></div><div class="kcard__s">${it.id} · ${esc(locName(it.loc))}</div>
        <div class="kcard__i">${esc(x.issue)}</div><div class="kcard__st">${esc(line)}</div></div>`; };
    let html;
    if (tab === 'board') html = `<div class="board">${LANES.map(([k, t, tone]) => { const its = open.filter(i => i.repair.state === k); return `<div class="lane ${its.length ? '' : 'lane--empty'}"><div class="lane__h"><i style="background:${SOLID[tone]}"></i>${t}<b>${its.length}</b></div><div class="lane__c">${its.map(kc).join('')}</div></div>`; }).join('')}</div>`;
    else {
      const done = siteItems().flatMap(it => (it.repairs || []).map(x => ({ it, x }))).sort((a, b) => (b.x.done?.at || '').localeCompare(a.x.done?.at || ''));
      html = card('', done.length ? `<div class="cardlist">${done.map(({ it, x }) => `<div class="row" data-go="#/repairs/${it.id}"><div class="row__b"><div class="row__t">${esc(it.name)} · ${esc(x.issue)}</div><div class="row__s">${x.id} · ${esc(x.done?.notes || '')}</div></div><div class="row__e">${pill(x.state === 'cleared' ? 'Cleared' : x.state === 'closed' ? 'Closed' : 'Repaired', x.state === 'closed' ? '' : 'ok')}<span class="row__m">${fs(x.done?.at)}</span></div></div>`).join('')}</div>` : empty('repairs', 'No completed repairs', '', true));
    }
    return { title: 'Repairs & Issues', key: tab, html: `<div style="margin-bottom:16px">${seg('rtab', [{ v: 'board', t: 'Open' }, { v: 'done', t: 'Completed' }], tab, 'repTab')}</div>${html}` };
  },
  slide(r) { if (!r.id) return null; const d = itemDetail(r.id, '#/repairs/' + r.id, true); return { close: '#/repairs', title: d.title, html: d.html, right: d.right, key: r.id + '/' + (UI.tab.item || 'overview') }; },
};
DO.repTab = t => { UI.tab.repairs = t; render(); };

/* ============ Transfers ============ */
function allTransfers() { return siteItemsAny().flatMap(it => [...(it.transfer ? [it.transfer] : []), ...(it.transfers || [])].map(t => ({ t, it }))); }
const siteItemsAny = () => D.items.filter(it => { if (UI.site === 'all') return true; return it.site === UI.site || (it.transfer && (it.transfer.to.site === UI.site || it.transfer.from.site === UI.site)); });
VIEWS.transfers = {
  label: 'Transfers', icon: 'transfers', layout: 'split', allow: R('sup', 'afm', 'admin', 'mgmt'),
  count: () => { const n = siteItemsAny().filter(i => i.status === 'transit').length; return n; },
  list(r) {
    const q = UI.q.transfers || '', tab = UI.tab.transfers || 'transit';
    const all = allTransfers().filter(({ t, it }) => match(q, it.name, it.id, t.id, t.ref, secName(t.from.section), secName(t.to.section)));
    const list = tab === 'transit' ? all.filter(x => !x.t.ack).sort((a, b) => a.t.dispatched.localeCompare(b.t.dispatched)) : all.filter(x => x.t.ack).sort((a, b) => b.t.ack.at.localeCompare(a.t.ack.at));
    const rows = list.map(({ t, it }) => { const days = daysBetween(t.dispatched, t.ack ? t.ack.at : nowIs());
      return lrow({ href: '#/transfers/' + t.id, on: r.id === t.id, t: esc(it.name), s: `${esc(secName(t.from.section))} → ${esc(secName(t.to.section))}`, right: t.ack ? `<span class="row__m">${fs(t.ack.at)}</span>` : `<span class="due ${days > 2 ? 'late' : ''}">${plural(days, 'day')}</span>` }); }).join('');
    return { title: 'Transfers', search: 'Search transfers', tabs: `${seg('trf', [{ v: 'trf|transit', t: 'In transit' }, { v: 'trf|done', t: 'Completed' }], 'trf|' + tab, 'tabSet', 'seg--block')}`, rows: `<div class="rows">${rows || empty('transfers', 'No transfers', '', true)}</div>` };
  },
  detail(r) {
    const x = D.items.map(it => ({ it, t: [...(it.transfer ? [it.transfer] : []), ...(it.transfers || [])].find(t => t.id === r.id) })).find(y => y.t);
    if (!x) return { html: empty('transfers', 'No transfer selected') };
    const { it, t } = x, n0 = !t.ack && nextStep(it), n = n0 && !n0.wait ? n0 : null;
    const end = (k, sec, site, who, loc) => `<div class="route__end"><div class="route__k">${k}</div><div class="route__t">${esc(secName(sec))}</div><div class="route__s">${esc(siteName(site))}${loc ? ' · ' + esc(locName(loc)) : ''}</div><div class="route__p">${av(who, 22)}${esc(nm(who))}</div></div>`;
    const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(it.name)}</h2><div class="hero__s"><span class="link" data-go="#/register/${it.id}">${it.id}</span><span>·</span><span>${t.id}</span></div><div class="hero__p">${t.ack ? pill(t.exception ? 'Completed by exception' : 'Received', t.exception ? 'attn' : 'ok', '', true) : pill('In transit', 'info', '', true)}</div></div></div>
      ${n ? nextCard(n) : ''}
      ${card('', `<div class="route ${t.ack ? 'done' : ''}">${end('From', t.from.section, t.from.site, t.from.custodian, t.from.loc)}<div class="route__line"><span class="route__truck">${ic(t.ack ? 'check' : 'truck', 19)}</span></div>${end('To', t.to.section, t.to.site, t.to.custodian, t.ack?.loc)}</div>`)}
      ${card('Details', kv([['Reference', esc(t.ref || '—')], ['Dispatched', `${ft2(t.dispatched)} · ${esc(nm(t.by))}`], t.note && ['Note', esc(t.note)], t.ack && ['Received', `${ft2(t.ack.at)} · ${esc(nm(t.ack.by))}`], t.ack && ['Arrival condition', pill(COND[t.ack.cond], CTONE[t.ack.cond])], t.exception && ['Exception reason', esc(t.exception)], !t.ack && ['In transit', plural(daysBetween(t.dispatched, nowIs()), 'day')]]))}
      ${!t.ack && can(UI.me, 'transferException') ? `<div style="margin-top:14px"><button class="btn btn--plain btn--block" data-do="actException" data-arg="${it.id}">Complete by exception</button></div>` : ''}`;
    return { title: it.name, html };
  },
};

/* ============ Disposal & Approvals ============ */
VIEWS.disposals = {
  label: 'Disposal & Approvals', icon: 'disposals', layout: 'split',
  count: () => { const n = D.disposals.filter(d => ['validation', 'approval', 'approved'].includes(d.state) && inSite(itemOf(d.item))).length; return n; },
  list(r) {
    const q = UI.q.disposals || '', tab = UI.tab.disposals || 'open';
    const open = d => ['validation', 'approval', 'approved'].includes(d.state);
    const list = D.disposals.filter(d => inSite(itemOf(d.item)) && match(q, d.id, itemOf(d.item).name, d.reason) && (tab === 'open' ? open(d) : !open(d))).sort((a, b) => b.at.localeCompare(a.at));
    const rows = list.map(d => lrow({ href: '#/disposals/' + d.id, on: r.id === d.id, t: esc(itemOf(d.item).name), s: `${d.id} · ${esc(d.reason)}`, badge: dPill(d) })).join('');
    return { title: 'Disposal & Approvals', search: 'Search requests', tabs: `${seg('dsp', [{ v: 'dsp|open', t: 'Open' }, { v: 'dsp|closed', t: 'Closed' }], 'dsp|' + tab, 'tabSet', 'seg--block')}`, rows: `<div class="rows">${rows || empty('disposals', 'No requests', '', true)}</div>` };
  },
  detail(r) {
    const d = disposalOf(r.id);
    if (!d) return { html: empty('disposals', 'No request selected') };
    const it = itemOf(d.item), n0 = ['validation', 'approval', 'approved'].includes(d.state) ? nextStep(it) : null, n = n0 && !n0.wait ? n0 : null;
    const st = (cls, icon, t, s, note) => `<div class="step ${cls}"><div class="step__dot">${ic(icon)}</div><div class="step__b"><div class="step__t">${t}</div>${s ? `<div class="step__s">${s}</div>` : ''}${note ? `<div class="step__n note">${esc(note)}</div>` : ''}</div></div>`;
    const val = (need, v, t, icon) => !need ? st('skip', icon, t, 'Not required') : v ? st(v.agree ? 'done' : 'bad', v.agree ? 'check' : 'x', t, `${v.agree ? 'Agrees' : 'Does not agree'} · ${esc(nm(v.by))} · ${rel(v.at)}`, v.note) : st(d.state === 'validation' ? 'now' : 'skip', icon, t, d.state === 'rejected' ? '—' : 'Waiting');
    const dec = d.decision;
    const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(it.name)}</h2><div class="hero__s"><span class="link" data-go="#/register/${it.id}">${it.id}</span><span>·</span><span>${d.id}${d.expedited ? ' · Expedited' : ''}</span></div><div class="hero__p">${dPill(d, true)}</div></div></div>
      ${n ? nextCard(n) : ''}
      ${card('Approval path', `<div class="steps">${st('done', 'flag', 'Requested', `${esc(nm(d.by))} · ${rel(d.at)}`)}${val(d.needBio, d.bio, 'Animal-use validation', 'paw')}${val(d.needTech, d.tech, 'Repairability validation', 'repairs')}
        ${dec ? st(dec.approved ? 'done' : 'bad', dec.approved ? 'shield' : 'x', dec.approved ? 'Approved' : 'Rejected', `${esc(nm(dec.by))} · ${rel(dec.at)}`, dec.note) : st(d.state === 'approval' ? 'now' : '', 'shield', 'Approval', esc(nm(d.approver)))}
        ${d.state === 'rejected' ? '' : st(d.completed ? 'done' : d.state === 'approved' ? 'now' : '', 'disposals', d.completed ? DISPOSITION[d.outcome] : 'Final disposition', d.completed ? `${esc(nm(d.completed.by))} · ${rel(d.completed.at)}` : '', d.completed?.note)}</div>`)}
      ${card('Request', kv([['Reason', esc(d.reason)], ['Condition', pill(COND[d.cond], CTONE[d.cond])], d.notes && ['Notes', esc(d.notes)], ['Approver', personRow(d.approver)]]))}
      ${d.photos.length ? card('Evidence', photos(d.photos)) : ''}`;
    return { title: it.name, html };
  },
};

/* ============ Inspections & Audits ============ */
VIEWS.audits = {
  label: 'Inspections & Audits', icon: 'audits', layout: 'split', allow: R('sup', 'afm', 'admin', 'mgmt'),
  count: () => D.audits.filter(a => a.state !== 'closed' && inSite(a)).length,
  list(r) {
    const tab = UI.tab.audits || (r.id.startsWith('SCH') ? 'schedules' : r.id.startsWith('TPL') ? 'templates' : 'sessions');
    let rows;
    if (tab === 'sessions') {
      const list = D.audits.filter(inSite).slice().sort((a, b) => b.created.localeCompare(a.created));
      rows = list.map(a => { const s = auditStats(a); return lrow({ href: '#/audits/' + a.id, on: r.id === a.id, t: `${esc(a.period)} · ${esc(siteName(a.site))}`, s: `${s.checked} of ${s.n} checked · ${esc(nm(a.auditor))}`, right: a.state === 'closed' ? pill('Closed', 'ok') : dueChip(a.due) }); }).join('');
    } else if (tab === 'schedules') {
      rows = W().schedules.filter(inSite).map(s => { const nx = nextOccurrence(s); return `<div class="row ${r.id === s.id ? 'on' : ''}" data-go="#/audits/${s.id}"><div class="row__b"><div class="row__t">${esc(templateOf(s.template).name)}</div><div class="row__s">${esc(siteName(s.site))} · ${FREQ[s.freq].t}</div></div><div class="row__e"><span class="row__m">Next ${esc(nx?.period || '—')}</span></div></div>`; }).join('');
    } else rows = W().templates.map(t => `<div class="row ${r.id === t.id ? 'on' : ''}" data-go="#/audits/${t.id}"><div class="row__b"><div class="row__t">${esc(t.name)}</div><div class="row__s">${TPL_KIND[t.kind]} · ${plural(t.checks.length, 'check')}</div></div></div>`).join('');
    return { title: 'Inspections & Audits', tabs: `${seg('atab', [{ v: 'sessions', t: 'Sessions' }, { v: 'schedules', t: 'Schedules' }, { v: 'templates', t: 'Templates' }], tab, 'audTab', 'seg--block')}`, rows: `<div class="rows">${rows || empty('audits', 'Nothing here', '', true)}</div>`,
      right: can(UI.me, 'auditCreate') ? `<button class="icon-btn" data-do="actSchedule" aria-label="Schedule audit">${ic('plus', 23)}</button>` : '' };
  },
  detail(r) {
    if (r.id.startsWith('SCH')) return scheduleDetail(r.id);
    if (r.id.startsWith('TPL')) return templateDetail(r.id);
    const a = auditOf(r.id);
    if (!a) return { html: empty('audits', 'No audit selected') };
    const s = auditStats(a), tab = UI.tab.aline || 'todo', closed = a.state === 'closed', task = a.task && taskOf(a.task), sch = a.schedule && scheduleOf(a.schedule);
    const canRec = l => !closed && can(UI.me, 'auditRecord', itemOf(l.item));
    const todo = a.lines.filter(l => !l.outcome), finds = a.lines.filter(l => l.outcome && l.outcome !== 'verified'), ver = a.lines.filter(l => l.outcome === 'verified');
    const line = l => {
      const it = itemOf(l.item);
      let act = '';
      if (!l.outcome && canRec(l)) act = `<button class="vbtn" data-do="audVerify" data-arg="${a.id}|${it.id}">${ic('check', 18)}Verified</button><button class="obtn" data-do="audMore" data-arg="${a.id}|${it.id}" aria-label="Other outcome">${ic('more', 20)}</button>`;
      else if (l.outcome && l.outcome !== 'verified') {
        if (!l.exc && can(UI.me, 'auditAssign') && !closed) act = `<button class="btn btn--tint btn--sm" data-do="actAssign" data-arg="${a.id}|${it.id}">Assign</button>`;
        else if (l.exc && !l.exc.resolved && (l.exc.to === UI.me || CAN.auditAssign.includes(role()))) act = `<button class="btn btn--tint btn--sm" data-do="actResolve" data-arg="${a.id}|${it.id}">Resolve</button>`;
      }
      const sub = !l.outcome ? `${it.id} · ${esc(locName(l.expected.loc))}` : l.outcome === 'verified' ? `${it.id} · ${esc(nm(l.by))} · ${rel(l.at)}`
        : `${l.foundLoc ? 'Found at ' + esc(locName(l.foundLoc)) + ' · ' : ''}${esc(l.note || '')}${l.exc ? ` · ${esc(nm(l.exc.to))} · ${l.exc.resolved ? 'Resolved ' + fs(l.exc.resolved.at) : 'due ' + fs(l.exc.due)}` : ''}`;
      return `<div class="line" id="ln-${it.id}"><div class="line__b"><div class="row__t">${esc(it.name)}</div><div class="row__s">${sub}</div></div>${l.outcome && l.outcome !== 'verified' ? `<div class="row__e">${pill(AUDIT_OUT[l.outcome], OTONE[l.outcome])}${l.exc ? pill(l.exc.resolved ? 'Resolved' : 'Assigned', l.exc.resolved ? 'ok' : 'warn') : ''}</div>` : ''}<div class="line__a">${act}</div></div>`;
    };
    const q = (UI.q.aline || '').trim();
    const pick = { todo, finds, ver }[tab].filter(l => match(q, itemOf(l.item).name, l.item, locName(l.expected.loc)));
    const ready = !closed && !todo.length && !finds.some(l => !l.exc);
    const html = `<div class="hero" style="padding-bottom:12px"><div class="hero__b"><h2 class="hero__t">${esc(a.period)} audit</h2><div class="hero__s">${a.id} · ${esc(siteName(a.site))} · ${esc(nm(a.auditor))}</div><div class="hero__p">${closed ? pill('Closed', 'ok', '', true) : pill(a.state === 'scheduled' ? 'Scheduled' : 'In progress', 'info', '', true) + dueChip(a.due)}</div></div></div>
      ${card('', `<div class="aud-h">${ring(s.pct, 84, 8, closed ? 'ok' : 'info', `<div>${s.pct}%<small>${s.checked} of ${s.n}</small></div>`)}<div class="aud-stats"><div><span>Verified</span><b>${s.verified}</b></div><div><span>Findings</span><b>${s.exceptions}</b></div><div><span>Unassigned</span><b>${s.unassigned}</b></div></div></div>` + kv([task && ['Execution task', `<span class="num">${task.id}</span> ${pill(task.state === 'done' ? 'Done' : 'Open', task.state === 'done' ? 'ok' : 'warn')}`], sch && ['Schedule', `<span class="link" data-go="#/audits/${sch.id}">${esc(templateOf(sch.template).name)} · ${FREQ[sch.freq].t}</span>`], closed && ['Closed', `${ft2(a.closed.at)} · ${esc(nm(a.closed.by))}`]]))}
      ${ready && can(UI.me, 'auditClose') ? `<div style="margin-top:14px"><button class="btn btn--go btn--lg btn--block" data-do="actCloseAudit" data-arg="${a.id}">${ic('ok', 20)}Close audit</button></div>` : ''}
      <div style="display:flex;gap:10px;align-items:center;margin:20px 0 12px">${seg('aline', [{ v: 'todo', t: `To check · ${todo.length}` }, { v: 'finds', t: `Findings · ${finds.length}` }, { v: 'ver', t: `Verified · ${ver.length}` }], tab, 'audLine', 'seg--block seg--lg')}</div>
      <label class="search" style="margin-bottom:12px">${ic('search', 18)}<input type="search" placeholder="Find an item" value="${esc(UI.q.aline || '')}" data-in="aq" autocomplete="off"></label>
      <div class="lines" id="audlines">${pick.map(line).join('') || empty(tab === 'todo' ? 'ok' : 'audits', tab === 'todo' ? 'Everything checked' : 'None', '', true)}</div>`;
    return { title: `${a.period} audit`, html, key: tab };
  },
};
DO.audTab = t => { UI.tab.audits = t; const first = t === 'sessions' ? D.audits.filter(inSite).slice(-1)[0]?.id : t === 'schedules' ? W().schedules.filter(inSite)[0]?.id : W().templates[0]?.id; go('#/audits/' + (first || '')); };
DO.audLine = t => { UI.tab.aline = t; render(); };
IN.aq = v => { UI.q.aline = v; const r = route(), d = VIEWS.audits.detail(r); const tmp = document.createElement('div'); tmp.innerHTML = d.html; $('#audlines').innerHTML = $('#audlines', tmp).innerHTML; };
function scheduleDetail(id) {
  const s = scheduleOf(id); if (!s) return { html: empty('calendar', 'Schedule not found') };
  const t = templateOf(s.template), nx = nextOccurrence(s), mng = can(UI.me, 'auditCreate');
  const occ = s.occurrences.slice().reverse().map(o => { const a = auditOf(o.audit), tk = taskOf(o.task); return `<div class="row" data-go="#/audits/${o.audit}"><div class="row__b"><div class="row__t">${esc(o.period)}</div><div class="row__s">${a.id} · ${tk.id} · ${esc(nm(a.auditor))}</div></div><div class="row__e">${pill(a.state === 'closed' ? 'Closed' : 'Open', a.state === 'closed' ? 'ok' : 'info')}</div></div>`; }).join('');
  const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(t.name)}</h2><div class="hero__s">${s.id} · ${esc(siteName(s.site))}</div><div class="hero__p">${pill(FREQ[s.freq].t, 'info', '', true)}</div></div></div>
    ${nx ? `<div class="next next--wait"><div class="next__i">${ic('calendar', 22)}</div><div class="next__b"><div class="next__t">Next · ${esc(nx.period)}</div><div class="next__s">${fd(nx.start)} – ${fd(nx.due)}</div></div>${mng ? `<button class="btn btn--fill btn--sm" data-do="genOcc" data-arg="${s.id}">Generate</button>` : ''}</div>` : ''}
    ${card('Schedule', kv([['Template', `<span class="link" data-go="#/audits/${t.id}">${esc(t.name)}</span>`], ['Site', esc(siteName(s.site))], ['Scope', 'All active items'], ['Frequency', FREQ[s.freq].t], ['Start', fd(s.start)], ['Assignee', personRow(s.assignee)], s.edited && ['Edited', `${ft2(s.edited.at)} · ${esc(nm(s.edited.by))}`]]), mng ? `<button class="link" style="margin-left:auto;font-size:13px" data-do="actSchedule" data-arg="${s.id}">Edit</button>` : '')}
    ${card('Occurrences', occ ? `<div class="cardlist">${occ}</div>` : empty('calendar', 'None yet', '', true))}`;
  return { title: t.name, html };
}
function templateDetail(id) {
  const t = templateOf(id); if (!t) return { html: empty('audits', 'Template not found') };
  const used = W().schedules.filter(s => s.template === id);
  const html = `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(t.name)}</h2><div class="hero__s">${t.id}</div><div class="hero__p">${pill(TPL_KIND[t.kind], 'info', '', true)}</div></div></div>
    ${card('Checks', `<div class="kv">${t.checks.map((c, i) => `<div class="kv__r"><div class="kv__k" style="width:28px">${i + 1}</div><div class="kv__v">${esc(c)}</div></div>`).join('')}</div>`)}
    ${used.length ? card('Schedules', `<div class="cardlist">${used.map(s => `<div class="row" data-go="#/audits/${s.id}"><div class="row__b"><div class="row__t">${esc(siteName(s.site))}</div><div class="row__s">${FREQ[s.freq].t} · ${esc(nm(s.assignee))}</div></div></div>`).join('')}</div>`) : ''}`;
  return { title: t.name, html };
}

/* ============ Reports ============ */
const REPORTS = [['register', 'Site item register', 'register'], ['status', 'Items by status', 'overview'], ['storage', 'Storage inventory', 'layers'], ['repairs', 'Repair backlog and ageing', 'repairs'], ['transfers', 'Transfer history', 'transfers'],
  ['missing', 'Missing items and exceptions', 'notfound'], ['disposals', 'Disposal and scrap history', 'disposals'], ['reuse', 'Repair, reuse and rotation', 'reset'], ['audit', 'Audit compliance', 'audits']];
VIEWS.reports = {
  label: 'Reports', icon: 'reports', layout: 'split', allow: R('sup', 'afm', 'admin', 'mgmt'),
  list(r) {
    const rep = report({ site: UI.site === 'all' ? '' : UI.site }), cur = r.id || 'register';
    const val = { register: rep.total, status: rep.active, storage: rep.storage.length, repairs: rep.repairs.length, transfers: rep.transfers.length, missing: rep.missing.length + rep.exceptions.length, disposals: rep.disposals.length, reuse: rep.moves, audit: rep.accuracy == null ? '—' : rep.accuracy + '%' };
    return { title: 'Reports', rows: `<div class="rows">${REPORTS.map(([k, t]) => lrow({ href: '#/reports/' + k, on: cur === k, t, right: `<span class="row__v">${val[k]}</span>` })).join('')}</div>` };
  },
  detail(r) {
    const k = r.id || 'register', [, title, icon] = REPORTS.find(x => x[0] === k) || REPORTS[0];
    const rep = report({ site: UI.site === 'all' ? '' : UI.site }), items = siteItems();
    // report rows: first column is the title (name + id), the middle columns form the detail line, the last column sits on the right
    const tbl = (head, rows, go) => rows.length ? `<div class="dlist">${rows.map(rw => `<div class="drow" ${go ? `data-go="${go(rw)}"` : ''}><div class="drow__b">${rw.c[0].replace('<div class="row__s">', '<div class="drow__id">')}<div class="drow__s">${rw.c.slice(1, -1).filter(x => x !== '' && x != null).join(' · ')}</div></div><div class="drow__e">${rw.c[rw.c.length - 1]}</div></div>`).join('')}</div>` : empty(icon, 'No records', '', true);
    const itemRows = list => list.map(i => ({ id: i.id, c: [`<b>${esc(i.name)}${i.mode === 'batch' ? ` × ${i.qty}` : ''}</b><div class="row__s">${i.id}</div>`, esc(i.status === 'transit' ? 'In transit' : locName(i.loc)), esc(nm(i.custodian)), quiet(i) ? `<span class="row__m">${STATUS[i.status]}</span>` : stPill(i)] }));
    const ih = ['Item', 'Section', 'Location', 'Custodian', 'Status', 'Qty'];
    let body = '';
    if (k === 'register') body = card('', `${tbl(ih, itemRows(items.filter(isActive)), x => '#/register/' + x.id)}`);
    if (k === 'status') {
      const max = Math.max(...rep.byStatus.map(s => s.n), 1);
      const byCat = D.categories.filter(c => c.mode !== 'excluded').map(c => ({ c, n: items.filter(i => i.cat === c.id && isActive(i)).length }));
      const byCust = [...new Set(items.filter(isActive).map(i => i.custodian))].map(p => ({ p, n: items.filter(i => isActive(i) && i.custodian === p).length })).sort((a, b) => b.n - a.n);
      body = `${card('Status', `<div class="bars" style="padding:8px 20px 20px">${rep.byStatus.map(s => `<div class="bar-r"><span>${s.label}</span><div class="bar-r__t"><i style="width:${s.n / max * 100}%;background:${SOLID[STONE[s.key] || '']}"></i></div><b>${s.n}</b></div>`).join('')}</div>`)}
        <div class="grid grid--2">${card('Category', mlist(byCat.map(x => [`${x.c.code} · ${x.c.name}`, x.n])))}${card('Custodian', mlist(byCust.map(x => [nm(x.p), x.n])))}</div>`;
    }
    if (k === 'storage') body = card('', `${tbl(ih, itemRows(rep.storage), x => '#/register/' + x.id)}`);
    if (k === 'repairs') {
      const b = [['0–7 days', 0, 7], ['8–14 days', 8, 14], ['15–30 days', 15, 30], ['30+ days', 31, 1e9]].map(([l, lo, hi]) => ({ l, n: rep.repairs.filter(x => x.age >= lo && x.age <= hi).length })), max = Math.max(...b.map(x => x.n), 1);
      body = `${card('Ageing', `<div class="bars" style="padding:8px 20px 20px">${b.map(x => `<div class="bar-r"><span>${x.l}</span><div class="bar-r__t"><i style="width:${x.n / max * 100}%;background:var(--t-warn-solid)"></i></div><b>${x.n}</b></div>`).join('')}</div>`)}
        <div style="margin-top:16px">${card('Backlog', `${tbl(['Item', 'Issue', 'Stage', 'Age'], rep.repairs.sort((a, b) => b.age - a.age).map(x => ({ id: x.id, c: [`<b>${esc(x.name)}</b><div class="row__s">${x.id}</div>`, esc(x.issue), { assessment: 'Assessment', approved: 'Approved', repair: 'In repair', beyond: 'Beyond repair' }[x.state] || x.state, plural(x.age, 'day')] })), x => '#/repairs/' + x.id)}`)}</div>`;
    }
    if (k === 'transfers') body = card('', `${tbl(['Item', 'From', 'To', 'Dispatched', 'Status'], rep.transfers.sort((a, b) => b.dispatched.localeCompare(a.dispatched)).map(t => ({ id: t.id, c: [`<b>${esc(t.name)}</b><div class="row__s">${t.id}</div>`, esc(secName(t.from.section)), esc(secName(t.to.section)), fs(t.dispatched), t.ack ? (t.exception ? 'Exception' : 'Received') : 'In transit'] })), x => '#/transfers/' + x.id)}`);
    if (k === 'missing') body = `${card('Missing items', `${tbl(ih, itemRows(rep.missing), x => '#/register/' + x.id)}`)}<div style="margin-top:16px">${card('Unresolved exceptions', `${tbl(['Item', 'Finding', 'Audit', 'Owner'], rep.exceptions.filter(e => inSite(itemOf(e.item))).map(e => ({ id: e.audit, c: [`<b>${esc(itemOf(e.item).name)}</b><div class="row__s">${e.item}</div>`, AUDIT_OUT[e.outcome], esc(auditOf(e.audit).period), e.exc ? esc(nm(e.exc.to)) : '—'] })), x => '#/audits/' + x.id)}`)}</div>`;
    if (k === 'disposals') body = card('', `${tbl(['Item', 'Reason', 'Requested', 'Outcome'], rep.disposals.slice().sort((a, b) => b.at.localeCompare(a.at)).map(d => ({ id: d.id, c: [`<b>${esc(itemOf(d.item).name)}</b><div class="row__s">${d.id}</div>`, esc(d.reason), fs(d.at), d.outcome ? DISPOSITION[d.outcome] : DSTATE[d.state][0]] })), x => '#/disposals/' + x.id)}`);
    if (k === 'reuse') body = `<div class="grid">${[['Repairs completed', rep.repaired, 'repairs'], ['Transfers reused', rep.reused, 'transfers'], ['Rotations', rep.moves, 'move'], ['Disposal compliance', rep.compliance == null ? '—' : rep.compliance + '%', 'shield']].map(([l, v, i]) => `<div class="w kpi"><div class="w__h"><span class="tile tile--k">${ic(i)}</span>${l}</div><div class="kpi__n">${v}</div></div>`).join('')}</div>`;
    if (k === 'audit') { const list = D.audits.filter(inSite); body = card('', `${tbl(['Audit', 'Site', 'Checked', 'Accuracy', 'State'], list.map(a => { const s = auditStats(a); return { id: a.id, c: [`<b>${esc(a.period)}</b><div class="row__s">${a.id}</div>`, esc(siteName(a.site)), `${s.checked}/${s.n}`, s.accuracy == null ? '—' : s.accuracy + '%', a.state === 'closed' ? 'Closed' : 'Open'] }; }), x => '#/audits/' + x.id)}`); }
    return { title, html: `<div class="hero" style="padding-bottom:18px"><div class="hero__b"><h2 class="hero__t">${title}</h2><div class="hero__s">${esc(siteLabel())} · ${fd(nowIs())}</div></div></div>${body}`, right: `<button class="icon-btn" data-do="exportCsv" data-arg="${k}" aria-label="Export">${ic('download', 21)}</button>` };
  },
};
DO.exportCsv = k => {
  const tbl = $('#dbody .tbl'); if (!tbl) return toast('Nothing to export', { bad: true });
  const csv = $$('tr', tbl).map(tr => $$('th,td', tr).map(c => `"${c.innerText.replace(/\n/g, ' ').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `enrichment-${k}-${day(nowIs())}.csv`; a.click();
  toast('CSV downloaded', { icon: 'download' });
};

/* ============ Labels ============ */
VIEWS.labels = {
  label: 'Labels', icon: 'labels', layout: 'split', allow: R('sup', 'afm', 'admin'),
  list() {
    const q = UI.q.labels || '', list = siteItems().filter(it => labelable(it) && can(UI.me, 'labels', it) && match(q, it.id, it.name, locName(it.loc)));
    const sel = new Set(UI.labels.filter(id => list.some(i => i.id === id)));
    const rows = list.map(it => lrow({ do: 'labTog', arg: it.id, on: sel.has(it.id), lead: `<span class="check ${sel.has(it.id) ? 'on' : ''}">${ic('check')}</span>`, t: esc(it.name), s: `${it.id} · ${esc(locName(it.loc))}`, right: it.labelled ? `<span class="row__m">Printed ${fs(it.labelled)}</span>` : '' })).join('');
    return { title: 'Labels', search: 'Search items', rows: `<div class="chips"><button class="chip" data-do="labAll" data-arg="none">Unlabelled</button><button class="chip" data-do="labAll" data-arg="all">All</button>${sel.size ? `<button class="chip" data-do="labAll" data-arg="clear">Clear ${sel.size}</button>` : ''}</div><div class="rows">${rows || empty('labels', 'No items', '', true)}</div>` };
  },
  detail() {
    const sel = UI.labels.map(itemOf).filter(Boolean);
    if (!sel.length) return { html: empty('labels', 'No labels selected') };
    return { title: 'Labels', html: `<div class="hero" style="padding-bottom:18px"><div class="hero__b"><h2 class="hero__t">${plural(sel.length, 'label')}</h2></div><button class="btn btn--fill" data-do="labPrint">${ic('printer', 18)}Print</button></div><div class="labels">${sel.map(it => `<div class="label">${qr(it.id)}<div style="min-width:0"><div class="label__t">${esc(it.name)}</div><div class="label__id">${it.id}</div><div class="label__s">${esc(secName(it.section))} · ${esc(siteName(it.site))}</div></div></div>`).join('')}</div>`, key: sel.length };
  },
};
DO.labTog = id => { UI.labels = UI.labels.includes(id) ? UI.labels.filter(x => x !== id) : [...UI.labels, id]; render(); };
DO.labAll = m => { const list = siteItems().filter(it => labelable(it) && can(UI.me, 'labels', it)); UI.labels = m === 'clear' ? [] : list.filter(i => m === 'all' || !i.labelled).map(i => i.id); render(); };
DO.labPrint = () => { const ids = UI.labels.slice(); act(() => printLabels(UI.me, ids), n => `${plural(n, 'label')} printed`, { icon: 'printer' }); UI.labels = []; render(); };
DO.printOne = id => { closePop(); act(() => printLabels(UI.me, [id]), 'Label printed', { icon: 'printer' }); };
function qr(text, size = 76) {
  let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = 21, cell = size / n; let s = '';
  const finder = (x, y) => `<rect x="${x * cell}" y="${y * cell}" width="${7 * cell}" height="${7 * cell}" fill="none" stroke="currentColor" stroke-width="${cell}" transform="translate(${cell / 2} ${cell / 2})" style="transform-box:fill-box"/><rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    h = (h * 1103515245 + 12345) >>> 0; if ((h >>> 16) & 1) s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
  }
  return `<svg class="qr" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="currentColor" style="color:var(--c-text)">${s}${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}</svg>`;
}

/* ============ Setup ============ */
VIEWS.setup = {
  label: 'Setup', icon: 'setup', layout: 'split', allow: R('admin'),
  list(r) {
    return { title: 'Setup', rows: `<div class="sec-h">Categories</div><div class="rows">${D.categories.map(c => `<div class="row ${r.id === c.id ? 'on' : ''}" data-go="#/setup/${c.id}"><span class="code-tile tile--${c.code}">${c.code}</span><div class="row__b"><div class="row__t">${esc(c.name)}</div><div class="row__s">${{ individual: 'Individual', batch: 'Group / quantity', excluded: 'Excluded' }[c.mode]}</div></div></div>`).join('')}</div>
      <div class="sec-h">General</div><div class="rows"><div class="row ${r.id === 'reminders' ? 'on' : ''}" data-go="#/setup/reminders"><div class="row__b"><div class="row__t">Reminders</div></div></div></div>` };
  },
  detail(r) {
    if (r.id === 'reminders') {
      const c = D.config, row = (k, l) => `<div class="cell"><span class="cell__k">${l}</span><span class="cell__v"></span><span class="stepper"><button data-do="cfgStep" data-arg="${k}|-1">${ic('minus', 18)}</button><b>${c[k]}</b><button data-do="cfgStep" data-arg="${k}|1">${ic('plus', 18)}</button></span></div>`;
      return { title: 'Reminders', html: `<div class="hero"><div class="hero__b"><h2 class="hero__t">Reminders</h2><div class="hero__s">Days</div></div></div>${fg('', [row('receiptDays', 'Receipt pending'), row('assessDays', 'Assessment'), row('repairDays', 'Repair completion'), row('approveDays', 'Approval')])}` };
    }
    const c = by('categories', r.id);
    if (!c) return { html: empty('setup', 'No category selected') };
    const o = (k, opts) => `<div class="cell">${seg('c-' + k, opts.map(([v, t]) => ({ v: `${c.id}|${k}|${v}`, t })), `${c.id}|${k}|${c[k]}`, 'catSet', 'seg--block')}</div>`;
    const t = (k, list, l) => `<button class="cell" data-do="catReq" data-arg="${c.id}|${k}|${list}"><span class="cell__k">${l}</span><span class="cell__v"></span><span class="toggle ${(c.req[k] || []).includes(list) ? 'on' : ''}"></span></button>`;
    return { title: c.name, html: `<div class="hero"><div class="hero__b"><h2 class="hero__t">${esc(c.name)}</h2><div class="hero__s">${esc(c.about)}</div></div></div>
      <div class="fg"><div class="fg__t">Tracking</div><div class="fg__c">${o('mode', [['individual', 'Individual'], ['batch', 'Group'], ['excluded', 'Excluded']])}</div></div>
      <div class="fg"><div class="fg__t">Animal-use check</div><div class="fg__c">${o('bio', [['always', 'Always'], ['inuse', 'While in use'], ['never', 'Never']])}</div></div>
      <div class="fg"><div class="fg__t">QR label</div><div class="fg__c">${o('qr', [['required', 'Required'], ['optional', 'Optional'], ['none', 'None']])}</div></div>
      ${fg('Routing', [`<button class="cell" data-do="catTech" data-arg="${c.id}"><span class="cell__k">Workshop repairability check</span><span class="cell__v"></span><span class="toggle ${c.tech ? 'on' : ''}"></span></button>`])}
      ${fg('Evidence', [t('repair', 'photo', 'Photo on repair request'), t('disposal', 'photo', 'Photo on disposal request'), t('disposal', 'notes', 'Notes on disposal request'), t('transfer', 'ref', 'Transfer reference')])}` };
  },
};
DO.catSet = a => { const [id, k, v] = a.split('|'); act(() => saveCategory(UI.me, Object.assign({}, by('categories', id), { [k]: v })), 'Category saved', { icon: 'setup' }); };
DO.catTech = id => { const c = by('categories', id); act(() => saveCategory(UI.me, Object.assign({}, c, { tech: !c.tech })), 'Category saved', { icon: 'setup' }); };
DO.catReq = a => { const [id, k, v] = a.split('|'), c = by('categories', id), cur = c.req[k] || []; act(() => saveCategory(UI.me, Object.assign({}, c, { req: Object.assign({}, c.req, { [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }) })), 'Category saved', { icon: 'setup' }); };
DO.cfgStep = a => { const [k, d] = a.split('|'); D.config[k] = Math.max(1, D.config[k] + +d); save(); render(); };

/* ============ permission denied ============ */
VIEWS.denied = { label: '', icon: 'shield', layout: 'full', full: () => ({ title: '', html: `<div style="height:600px">${empty('shield', 'No access', ROLE_SHORT[role()])}</div>` }) };

/* ============ demo guide ============ */
const GUIDE = [
  ['A', 'Receipt and registration', 'P-RAVI', '#/receipts/TK-2051', 'receive'], ['B', 'Move or rotate an item', 'P-RAVI', '#/register/EF-0006', 'move'],
  ['C', 'Damage, checks and repair', 'P-ANJ', '#/repairs', 'repairs'], ['D', 'Transfer and acknowledgement', 'P-RAVI', '#/transfers', 'transfers'],
  ['E', 'Schedule and run an audit', 'P-MEERA', '#/audits', 'audits'], ['F', 'Disposal and approval', 'P-SUR', '#/disposals', 'disposals'],
  ['G', 'Pending action to done', 'P-LAKS', '#/today', 'today'], ['H', 'Configure categories', 'P-NEHA', '#/setup/CAT-A', 'setup'],
];
DO.guide = () => {
  closePop(true);
  sheet({ title: 'Demo guide', body: () => `<div class="guide">${GUIDE.map(([k, t, p, href, i]) => `<button class="gcard" data-do="guideGo" data-arg="${p}|${href}"><div class="gcard__h"><div class="gcard__t">${k} · ${t}</div></div><div class="gcard__w">${av(p, 22)}${esc(nm(p))}<span class="link">${ic('right', 16)}</span></div></button>`).join('')}</div>` }, {}, { wide: true });
};
DO.guideGo = a => { const [p, href] = a.split('|'); closeSheet(); UI.me = p; UI.site = person(p).sites[0]; save(); go(href); toast(`Signed in as ${nm(p)}`, { icon: 'user' }); };
