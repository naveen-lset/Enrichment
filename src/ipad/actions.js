// src/ipad/actions.js — every workflow action as a form sheet. Each sheet calls one model.js / work.js function;
// the model is the judge: a refused rule comes back as the message at the top of the sheet. Key actions show a review page first.

const COND_ISSUE = [['needsrepair', 'Needs repair'], ['damaged', 'Damaged'], ['unsafe', 'Unsafe']];
const COND_ARRIVE = [['good', 'Good'], ['needsrepair', 'Needs repair'], ['damaged', 'Damaged']];
const reviewOf = rows => fg('', rows.filter(Boolean).map(([k, v]) => cInfo(k, v)));

/* ---------- A · receipt and registration ---------- */
DO.newReceipt = () => {
  closePop(true);
  const list = D.tickets.filter(t => t.status === 'dispatched' && can(UI.me, 'receive', { section: t.section, site: sectionOf(t.section).site }));
  if (!list.length) return toast('No deliveries waiting', { icon: 'receipts' });
  sheet({ title: 'Receive delivery', body: () => fg('', list.map(t => `<button class="cell choice" data-do="pickTicket" data-arg="${t.id}"><span class="choice__b"><span class="choice__t">${esc(t.name)}</span><span class="choice__s" style="display:block">${t.id} · ${t.qty} × ${by('categories', t.cat).code} · ${esc(secName(t.section))}</span></span>${ic('right', 18)}</button>`)) });
};
DO.pickTicket = id => { closeSheet(); go('#/receipts/' + id); setTimeout(() => DO.actReceive(id), 260); };
DO.actReceive = id => {
  const t = by('tickets', id); if (!t) return;
  const c = by('categories', t.cat), excluded = c.mode === 'excluded', sec = sectionOf(t.section);
  const f = { qty: t.qty, cond: 'good', fit: true, loc: '', custodian: me().role === 'sup' ? UI.me : '', discrepancy: '', notes: '' };
  sheet({
    title: 'Receive',
    body: f => {
      const diff = f.qty !== t.qty, unit = c.mode === 'individual';
      return `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(t.name)}</div><div class="row__s">${t.id} · ${t.mt}${t.ws ? ' · ' + t.ws : ''}</div></div>${pill(`${t.qty} expected`, 'info')}</div>
        ${fg('Delivery', [cStep('Received', 'qty', f, 0, t.qty * 3), diff && cArea(f.qty < t.qty ? 'Shortage reason' : 'Excess reason', 'discrepancy', f, true), cInfo('Tracking', excluded ? 'Excluded' : unit ? `Individual · ${plural(f.qty, 'record')}` : 'Group · 1 record')])}
        ${excluded ? '' : fg('Condition', [cSeg('cond', f, COND_ARRIVE), cToggle('Fit for use', 'fit', f), !f.fit && cArea('Issue', 'notes', f)])}
        ${excluded ? '' : fg('Assign', [cNav('Location', locName(f.loc), 'loc', true), cNav('Custodian', f.custodian ? nm(f.custodian) : '', 'cust', true)])}`;
    },
    pickers: {
      loc: () => pickerPage({ title: 'Location', key: 'loc', options: locOpts(l => l.section === t.section) }),
      cust: () => pickerPage({ title: 'Custodian', key: 'custodian', options: peopleOpts(custodiansOf(t.section)) }),
    },
    done: {
      label: 'Receive', ok: f => f.qty > 0 && (excluded || (f.loc && f.custodian)) && (f.qty === t.qty || f.discrepancy.trim()),
      review: f => reviewOf([['Request', t.id], ['Received', `${f.qty} of ${t.qty}`], f.discrepancy && ['Discrepancy', esc(f.discrepancy)], !excluded && ['Condition', COND[f.cond] + (f.fit ? '' : ' · not fit')], !excluded && ['Location', esc(locName(f.loc))], !excluded && ['Custodian', esc(nm(f.custodian))], ['Creates', excluded ? 'No record' : c.mode === 'individual' ? plural(f.qty, 'record') : '1 group record'], !excluded && ['Status', !f.fit || f.cond !== 'good' ? STATUS.assessment : locOf(f.loc)?.kind === 'store' ? STATUS.storage : STATUS.inuse]]),
      run: f => {
        if (excluded) { receiveExcluded(t.id, UI.me, { discrepancy: f.discrepancy }); return 'Delivery confirmed'; }
        const fit = f.fit && f.cond === 'good';
        const ids = receive(t.id, UI.me, { qty: f.qty, loc: f.loc, custodian: f.custodian, cond: f.cond, fit, discrepancy: f.discrepancy, notes: f.notes || (f.cond !== 'good' ? COND[f.cond] + ' on receipt' : '') });
        return { msg: `${plural(ids.length, 'record')} registered`, go: '#/register/' + ids[0] };
      },
    },
  }, f);
};
DO.actRegister = () => {
  closePop(true);
  const f = { name: '', cat: '', qty: 1, loc: '', custodian: me().role === 'sup' ? UI.me : '', cond: 'good' };
  sheet({
    title: 'Register existing item',
    body: f => { const c = f.cat && by('categories', f.cat); return fg('Item', [cText('Name', 'name', f, true), cNav('Category', c ? `${c.code} · ${c.name}` : '', 'cat', true), c && c.mode === 'batch' && cStep('Quantity', 'qty', f, 1, 999)])
      + fg('Condition', [cSeg('cond', f, COND_ARRIVE)]) + fg('Assign', [cNav('Location', locName(f.loc), 'loc', true), cNav('Custodian', f.custodian ? nm(f.custodian) : '', 'cust', true)]); },
    pickers: {
      cat: () => pickerPage({ title: 'Category', key: 'cat', options: D.categories.filter(c => c.mode !== 'excluded').map(c => ({ v: c.id, t: `${c.code} · ${c.name}`, s: c.about })) }),
      loc: () => pickerPage({ title: 'Location', key: 'loc', search: true, options: locOpts(l => can(UI.me, 'receive', { section: l.section, site: l.site })) }),
      cust: f => pickerPage({ title: 'Custodian', key: 'custodian', options: peopleOpts(f.loc ? custodiansOf(locOf(f.loc).section) : p => ['sup', 'afm'].includes(p.role)) }),
    },
    done: { label: 'Register', ok: f => f.name.trim() && f.cat && f.loc && f.custodian, run: f => { const id = register(UI.me, { name: f.name, cat: f.cat, qty: f.qty, loc: f.loc, custodian: f.custodian, cond: f.cond }); return { msg: `${id} registered`, go: '#/register/' + id }; } },
  }, f);
};

/* ---------- B · move / rotate ---------- */
const REASONS = ['Rotation', 'Storage', 'Cleaning', 'Rest from use', 'Enclosure change'];
DO.actMove = id => {
  closePop(true);
  const it = itemOf(id), ok = usableForAnimals(it);
  sheet({
    title: 'Move',
    body: f => sumItem(it) + fg('Destination', [cNav('To', locName(f.to), 'to', true), cOpts('Reason', 'reason', f, REASONS, true), it.mode === 'batch' && cStep('Quantity', 'qty', f, 1, it.qty)]),
    pickers: { to: () => pickerPage({ title: 'Destination', key: 'to', options: locOpts(l => l.section === it.section && l.id !== it.loc).map(o => Object.assign(o, { dis: locOf(o.v).kind === 'enclosure' && !ok })) }) },
    done: {
      label: 'Next', confirm: 'Move', ok: f => f.to && f.reason,
      review: f => sumItem(it) + reviewOf([['From', esc(where(it))], ['To', esc(locName(f.to))], ['Reason', esc(f.reason)], it.mode === 'batch' && ['Quantity', `${f.qty} of ${it.qty}${f.qty < it.qty ? ` · ${it.qty - f.qty} stay` : ''}`], ['Status', locOf(f.to).kind === 'enclosure' ? STATUS.inuse : STATUS.storage]]),
      run: f => { move(id, UI.me, { to: f.to, reason: f.reason, qty: f.qty }); return `Moved to ${locName(f.to)}`; },
    },
  }, { to: '', reason: '', qty: it.qty });
};

/* ---------- C · condition issue and repair ---------- */
const ISSUES = ['Structural damage', 'Wear', 'Corrosion', 'Contamination', 'Missing part', 'Other'];
DO.actFlag = id => {
  closePop(true);
  const it = itemOf(id), route = routingFor(it), reqs = catOf(it).req?.repair || [];
  sheet({
    title: 'Report issue',
    body: f => sumItem(it) + fg('Issue', [cOpts('Type', 'issue', f, ISSUES, true), cSeg('cond', f, COND_ISSUE), cArea('Description', 'notes', f, reqs.includes('notes'))])
      + fg('Evidence', [cPhotos('photos', f, reqs.includes('photo'))]) + fg('Checks', [cInfo('Animal use', route.bio ? 'Biologist' : 'Not required'), cInfo('Repairability', route.tech ? 'Workshop / VIC' : 'Not required')]),
    done: { label: 'Submit', ok: f => f.issue && f.cond, run: f => { flagIssue(id, UI.me, f); return 'Issue reported'; } },
  }, { issue: '', cond: 'damaged', notes: '', photos: [] });
};
DO.actBio = id => {
  const it = itemOf(id), r = it.repair;
  sheet({
    title: 'Animal-use check',
    body: f => sumItem(it) + fg('Issue', [cInfo('Reported', `${esc(r.issue)} · ${esc(nm(r.by))}`), r.notes && cInfo('Notes', esc(r.notes))]) + (r.photos.length ? card('', photos(r.photos)) : '')
      + fg('Result', [cSeg('res', f, [['suitable', 'Suitable'], ['unsuitable', 'Unsuitable']]), cArea('Note', 'note', f, f.res === 'unsuitable')]),
    done: { label: 'Save', ok: f => f.res && (f.res === 'suitable' || f.note.trim()), run: f => { verifyAnimalUse(id, UI.me, f.res, f.note); return 'Check recorded'; } },
  }, { res: '', note: '' });
};
DO.actTech = id => {
  const it = itemOf(id), r = it.repair;
  sheet({
    title: 'Repairability check',
    body: f => sumItem(it) + fg('Issue', [cInfo('Reported', `${esc(r.issue)} · ${esc(nm(r.by))}`), r.notes && cInfo('Notes', esc(r.notes)), r.needBio && cInfo('Animal use', r.bio === 'pending' ? 'Waiting' : r.bio === 'suitable' ? 'Suitable' : 'Unsuitable')])
      + fg('Result', [cSeg('res', f, [['repairable', 'Repairable'], ['beyond', 'Beyond repair']]), cArea('Assessment', 'note', f, true)]),
    done: { label: 'Save', ok: f => f.res && f.note.trim(), run: f => { assessRepair(id, UI.me, f.res, f.note); return 'Assessment recorded'; } },
  }, { res: '', note: '' });
};
DO.actDecide = id => {
  const it = itemOf(id);
  sheet({
    title: 'Decide outcome',
    body: f => sumItem(it) + fg('Outcome', [cChoices('out', f, [{ v: 'clear', t: 'Clear for use', dis: it.cond === 'unsafe' }, { v: 'repair', t: 'Send for repair' }, { v: 'beyond', t: 'Beyond repair' }])]) + fg('', [cArea('Note', 'note', f)]),
    done: { label: 'Save', ok: f => f.out, run: f => { decide(id, UI.me, f.out, f.note); return 'Outcome recorded'; } },
  }, { out: '', note: '' });
};
const TEAMS = ['Workshop', 'Carpentry', 'Welding', 'VIC'];
DO.actStartRepair = id => {
  const it = itemOf(id);
  sheet({ title: 'Start repair', body: f => sumItem(it) + fg('Team', [cOpts('', 'team', f, TEAMS)]), done: { label: 'Start', ok: f => f.team, run: f => { startRepair(id, UI.me, f); return 'Repair started'; } } }, { team: 'Workshop' });
};
DO.actCompleteRepair = id => {
  const it = itemOf(id), r = it.repair;
  sheet({
    title: 'Complete repair',
    body: f => sumItem(it) + fg('Repair', [cArea('Work done', 'notes', f, true, true), cOpts('Team', 'team', f, TEAMS, true)]) + fg('Return', [cNav('Location', locName(f.to), 'to', true), cInfo('Condition', COND.good)]) + fg('Evidence', [cPhotos('photos', f)]),
    pickers: { to: () => pickerPage({ title: 'Return to', key: 'to', options: locOpts(l => l.site === it.site && l.section === it.section) }) },
    done: { label: 'Complete', ok: f => f.notes.trim() && f.team && f.to, run: f => { completeRepair(id, UI.me, f); return 'Repair completed'; } },
  }, { notes: '', team: r.team || 'Workshop', to: it.loc, photos: [] });
};

/* ---------- D · transfer ---------- */
DO.actTransfer = id => {
  closePop(true);
  const it = itemOf(id), needRef = (catOf(it).req?.transfer || []).includes('ref');
  sheet({
    title: 'Transfer',
    body: f => sumItem(it) + fg('Destination', [cNav('Section', f.section ? `${secName(f.section)} · ${siteName(sectionOf(f.section).site)}` : '', 'sec', true), cNav('Receiver', f.receiver ? nm(f.receiver) : '', 'rec', true)])
      + fg('Dispatch', [cText('Transfer reference', 'ref', f, needRef), cArea('Note', 'note', f)]),
    pickers: {
      sec: () => pickerPage({ title: 'Section', key: 'section', after: f => { f.receiver = ''; }, options: D.sections.filter(s => s.id !== it.section).map(s => ({ v: s.id, t: s.name, s: siteName(s.site), group: siteName(s.site) })) }),
      rec: f => pickerPage({ title: 'Receiver', key: 'receiver', options: f.section ? peopleOpts(custodiansOf(f.section)) : [] }),
    },
    done: {
      label: 'Next', confirm: 'Dispatch', ok: f => f.section && f.receiver && (!needRef || f.ref.trim()),
      review: f => sumItem(it) + reviewOf([['From', esc(where(it))], ['To', `${esc(secName(f.section))} · ${esc(siteName(sectionOf(f.section).site))}`], ['Receiver', esc(nm(f.receiver))], f.ref && ['Reference', esc(f.ref)], ['Status', STATUS.transit]]),
      run: f => { transfer(id, UI.me, f); return 'Dispatched · in transit'; },
    },
  }, { section: '', receiver: '', ref: '', note: '' });
};
DO.actAck = id => {
  const it = itemOf(id), tr = it.transfer;
  sheet({
    title: 'Acknowledge receipt',
    body: f => sumItem(it) + fg('Transfer', [cInfo('From', `${esc(secName(tr.from.section))} · ${esc(nm(tr.from.custodian))}`), cInfo('Dispatched', ft2(tr.dispatched)), tr.ref && cInfo('Reference', esc(tr.ref))])
      + fg('Arrival', [cSeg('cond', f, COND_ARRIVE), cNav('Location', locName(f.loc), 'loc', true)]),
    pickers: { loc: () => pickerPage({ title: 'Location', key: 'loc', options: locOpts(l => l.section === tr.to.section) }) },
    done: { label: 'Confirm', ok: f => f.loc, run: f => { acknowledge(id, UI.me, f); return f.cond === 'good' ? 'Transfer received' : 'Received · sent for assessment'; } },
  }, { cond: 'good', loc: '' });
};
DO.actException = id => {
  const it = itemOf(id), tr = it.transfer;
  sheet({
    title: 'Complete by exception',
    body: f => sumItem(it) + fg('Exception', [cArea('Reason', 'reason', f, true, true)]) + fg('Arrival', [cSeg('cond', f, COND_ARRIVE), cNav('Location', locName(f.loc), 'loc', true)]),
    pickers: { loc: () => pickerPage({ title: 'Location', key: 'loc', options: locOpts(l => l.section === tr.to.section) }) },
    done: { label: 'Next', confirm: 'Complete', ok: f => f.reason.trim() && f.loc, review: f => sumItem(it) + reviewOf([['Reason', esc(f.reason)], ['Location', esc(locName(f.loc))], ['Receiver', esc(nm(tr.to.custodian))]]), run: f => { completeWithoutAck(id, UI.me, f.reason, f); return 'Completed by exception'; } },
  }, { reason: '', cond: 'good', loc: '' });
};

/* ---------- F · disposal ---------- */
const D_REASONS = ['Beyond repair', 'Worn out', 'Damaged in use', 'Hygiene risk', 'Obsolete', 'Replaced'];
DO.actDispose = id => {
  closePop(true);
  const it = itemOf(id), c = catOf(it), reqs = c.req?.disposal || [];
  sheet({
    title: 'Request disposal',
    body: f => sumItem(it) + fg('Reason', [cOpts('', 'reason', f, D_REASONS)]) + fg('Condition', [cOpts('', 'cond', f, Object.entries(COND).filter(([k]) => k !== 'na'))])
      + fg('Evidence', [cArea('Notes', 'notes', f, reqs.includes('notes')), cPhotos('photos', f, reqs.includes('photo') || f.expedited)])
      + fg('Approval', [cNav('Approver', f.approver ? nm(f.approver) : '', 'ap', true), cToggle('Expedited', 'expedited', f), cInfo('Validation', [c.bio !== 'never' && 'Biologist', c.tech && 'Workshop'].filter(Boolean).join(' · ') || 'Not required')]),
    pickers: { ap: () => pickerPage({ title: 'Approver', key: 'approver', options: peopleOpts(p => CAN.approve.includes(p.role) && p.sites.includes(it.site)) }) },
    done: {
      label: 'Next', confirm: 'Submit', ok: f => f.reason && f.cond && f.approver,
      review: f => sumItem(it) + reviewOf([['Reason', esc(f.reason)], ['Condition', COND[f.cond]], ['Approver', esc(nm(f.approver))], f.expedited && ['Route', 'Expedited'], ['Item', 'Stays in the register until completed']]),
      run: f => { const d = requestDisposal(id, UI.me, f); return { msg: `${d} submitted`, go: '#/disposals/' + d }; },
    },
  }, { reason: it.repair?.state === 'beyond' ? 'Beyond repair' : '', cond: it.cond === 'good' ? 'good' : it.cond, notes: '', photos: [], approver: '', expedited: false });
};
DO.actValidate = a => {
  const [dId, kind] = a.split('|'), d = disposalOf(dId), it = itemOf(d.item);
  sheet({
    title: kind === 'bio' ? 'Animal-use validation' : 'Repairability validation',
    body: f => sumItem(it) + fg('Request', [cInfo('Reason', esc(d.reason)), cInfo('Condition', COND[d.cond]), d.notes && cInfo('Notes', esc(d.notes))]) + (d.photos.length ? card('', photos(d.photos)) : '')
      + fg('Validation', [cSeg('agree', f, [['yes', 'Agree'], ['no', 'Do not agree']]), cArea('Note', 'note', f, f.agree === 'no')]),
    done: { label: 'Save', ok: f => f.agree && (f.agree === 'yes' || f.note.trim()), run: f => { validateDisposal(dId, UI.me, kind, f.agree === 'yes', f.note); return 'Validation recorded'; } },
  }, { agree: '', note: '' });
};
DO.actReview = dId => {
  const d = disposalOf(dId), it = itemOf(d.item);
  const v = (need, x) => !need ? 'Not required' : x ? (x.agree ? 'Agrees' : 'Does not agree') + ' · ' + nm(x.by) : 'Waiting';
  sheet({
    title: 'Disposal decision',
    body: f => sumItem(it) + fg('Request', [cInfo('Reason', esc(d.reason)), cInfo('Condition', COND[d.cond]), cInfo('Requested', `${esc(nm(d.by))} · ${fs(d.at)}`), cInfo('Animal use', esc(v(d.needBio, d.bio))), cInfo('Repairability', esc(v(d.needTech, d.tech)))])
      + fg('Decision', [cSeg('dec', f, [['approve', 'Approve'], ['reject', 'Reject']]), cArea('Comments', 'note', f, f.dec === 'reject')]),
    done: { label: 'Save', ok: f => f.dec && (f.dec === 'approve' || f.note.trim()), run: f => { if (f.dec === 'approve') { approveDisposal(dId, UI.me, f.note); return 'Disposal approved'; } rejectDisposal(dId, UI.me, f.note); return 'Disposal rejected · item stays active'; } },
  }, { dec: '', note: '' });
};
DO.actCompleteDisposal = dId => {
  const d = disposalOf(dId), it = itemOf(d.item);
  sheet({
    title: 'Final disposition',
    body: f => sumItem(it) + fg('Disposition', [cChoices('out', f, Object.entries(DISPOSITION).map(([v, t]) => ({ v, t })))]) + fg('', [cDate('Date', 'date', f), cArea('Note', 'note', f)]),
    done: { label: 'Next', confirm: 'Complete', ok: f => f.out, review: f => sumItem(it) + reviewOf([['Disposition', DISPOSITION[f.out]], ['Date', fd(f.date)], ['Record', 'Kept as history']]), run: f => { completeDisposal(dId, UI.me, { outcome: f.out, date: f.date, note: f.note }); return `${it.id} ${DISPOSITION[f.out].toLowerCase()}`; } },
  }, { out: '', date: day(nowIs()), note: '' });
};

/* ---------- E · audits: schedule, occurrence, record, assign, resolve, close ---------- */
DO.actSchedule = sid => {
  closePop(true);
  const cur = sid && scheduleOf(sid);
  const f = cur ? { id: cur.id, template: cur.template, site: cur.site, freq: cur.freq, start: cur.start, assignee: cur.assignee } : { template: 'TPL-01', site: UI.site === 'all' ? mySites()[0] : UI.site, freq: 'quarterly', start: '2027-01-01', assignee: '' };
  sheet({
    title: cur ? 'Edit schedule' : 'Schedule audit',
    body: f => fg('Work', [cNav('Template', templateOf(f.template)?.name, 'tpl', true), cur ? cInfo('Site', esc(siteName(f.site))) : cNav('Site', siteName(f.site), 'site', true), cInfo('Scope', 'All active items')])
      + fg('Timing', [cSeg('freq', f, Object.entries(FREQ).map(([k, v]) => [k, v.t])), cur && cur.occurrences.length ? cInfo('Start', fd(f.start)) : cDate('Start', 'start', f, true)])
      + fg('Assign', [cNav('Assignee', f.assignee ? nm(f.assignee) : '', 'who', true)]),
    pickers: {
      tpl: () => pickerPage({ title: 'Template', key: 'template', options: W().templates.filter(t => t.kind === 'audit').map(t => ({ v: t.id, t: t.name, s: plural(t.checks.length, 'check') })) }),
      site: () => pickerPage({ title: 'Site', key: 'site', options: mySites().map(s => ({ v: s, t: siteName(s) })) }),
      who: f => pickerPage({ title: 'Assignee', key: 'assignee', options: peopleOpts(p => ['sup', 'afm', 'admin'].includes(p.role) && p.sites.includes(f.site)) }),
    },
    done: { label: 'Save', ok: f => f.template && f.site && f.assignee && f.start, run: f => { const id = saveSchedule(UI.me, f); UI.tab.audits = 'schedules'; return { msg: cur ? 'Schedule updated' : 'Audit scheduled', go: '#/audits/' + id }; } },
  }, f);
};
DO.genOcc = sid => {
  const s = scheduleOf(sid), nx = nextOccurrence(s);
  popover($(`[data-do="genOcc"][data-arg="${sid}"]`), `<div class="pop__h">${esc(nx.period)} · ${esc(siteName(s.site))}</div>${menu([{ icon: 'audits', t: 'Generate session and task', do: 'genOccGo', arg: sid }, { icon: 'x', t: 'Cancel', do: 'popClose' }])}`, { w: 280 });
};
DO.genOccGo = sid => { closePop(true); const id = act(() => generateOccurrence(sid, UI.me), a => `${a} and its task created`, { icon: 'audits' }); if (id) { UI.tab.audits = 'sessions'; go('#/audits/' + id); } };
DO.audVerify = a => {
  const [aId, itemId] = a.split('|'), el = $('#ln-' + itemId);
  const run = () => act(() => recordAudit(aId, itemId, UI.me, 'verified'), `${itemId} verified`, { icon: 'ok' });
  if (el) { el.classList.add('leaving'); setTimeout(run, 260); } else run();
};
DO.audMore = (a, el) => popover(el, menu([{ icon: 'pin', t: 'Location mismatch', do: 'actAudOut', arg: a + '|locmismatch' }, { icon: 'alert', t: 'Condition mismatch', do: 'actAudOut', arg: a + '|condmismatch' }, { icon: 'notfound', t: 'Not found', do: 'actAudOut', arg: a + '|notfound', danger: true }, { icon: 'flag', t: 'Action required', do: 'actAudOut', arg: a + '|action' }]), { w: 240 });
DO.actAudOut = a => {
  closePop(true);
  const [aId, itemId, out] = a.split('|'), au = auditOf(aId), it = itemOf(itemId);
  sheet({
    title: AUDIT_OUT[out],
    body: f => sumItem(it) + fg('Finding', [out === 'locmismatch' && cNav('Found at', locName(f.loc), 'loc', true), cArea('Note', 'note', f, ['condmismatch', 'action'].includes(out), out !== 'locmismatch')]),
    pickers: { loc: () => pickerPage({ title: 'Found at', key: 'loc', search: true, options: locOpts(l => l.site === au.site && l.id !== it.loc) }) },
    done: { label: 'Save', ok: f => (out !== 'locmismatch' || f.loc) && (!['condmismatch', 'action'].includes(out) || f.note.trim()), run: f => { recordAudit(aId, itemId, UI.me, out, f); return 'Finding recorded'; } },
  }, { loc: '', note: '' });
};
DO.actAssign = a => {
  const [aId, itemId] = a.split('|'), au = auditOf(aId), it = itemOf(itemId), l = au.lines.find(x => x.item === itemId);
  sheet({
    title: 'Corrective action',
    body: f => sumItem(it) + fg('Finding', [cInfo('Outcome', AUDIT_OUT[l.outcome]), l.note && cInfo('Note', esc(l.note))]) + fg('Assign', [cNav('Owner', f.to ? nm(f.to) : '', 'to', true), cDate('Due', 'due', f, true)]),
    pickers: { to: () => pickerPage({ title: 'Owner', key: 'to', options: peopleOpts(custodiansOf(it.section)) }) },
    done: { label: 'Assign', ok: f => f.to && f.due, run: f => { const t = raiseCorrective(aId, itemId, UI.me, f); return `${t} assigned to ${first(f.to)}`; } },
  }, { to: it.custodian, due: addDays(day(nowIs()), 7).slice(0, 10) });
};
DO.actResolve = a => {
  const [aId, itemId] = a.split('|'), au = auditOf(aId), it = itemOf(itemId), l = au.lines.find(x => x.item === itemId);
  sheet({
    title: 'Resolve finding',
    body: f => sumItem(it) + fg('Finding', [cInfo('Outcome', AUDIT_OUT[l.outcome]), l.note && cInfo('Note', esc(l.note)), l.exc?.task && cInfo('Task', l.exc.task)]) + fg('Resolution', [it.status === 'missing' && cNav('Found at', locName(f.loc), 'loc'), cArea('Resolution', 'note', f, true, true)]),
    pickers: { loc: () => pickerPage({ title: 'Found at', key: 'loc', search: true, options: locOpts(x => x.site === it.site) }) },
    done: { label: 'Resolve', ok: f => f.note.trim(), run: f => { resolveCorrective(aId, itemId, UI.me, f); return 'Finding resolved'; } },
  }, { note: '', loc: '' });
};
DO.actCloseAudit = aId => {
  const a = auditOf(aId), s = auditStats(a);
  sheet({ title: 'Close audit', body: () => reviewOf([['Audit', `${esc(a.period)} · ${esc(siteName(a.site))}`], ['Checked', `${s.checked} of ${s.n}`], ['Verified', s.verified], ['Findings', s.exceptions], ['Open corrective actions', s.open]]), done: { label: 'Close', run: () => { closeAuditWork(aId, UI.me); return `${a.period} audit closed`; } } });
};
