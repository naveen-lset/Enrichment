// src/app/screens/phase-3-disposal-audit.js — PRD Phase 3 · Disposal & audit.
// Request disposal (task page) · Disposal request (validate, approve, reject, complete) · Disposal requests · Audits · New audit (task page)
// · Audit workspace (check, assign exception, resolve, close).
// Confirmed components: C-07 page header + tabs · C-15 card · C-59 key-value · C-46 thumbs · C-47 timeline · C-18 list card · C-26 stat strip
// · C-61 compliance overview (C-24 ring + C-60 bar rows in a card) · C-48 / C-51 / C-52 / C-53 / C-54 sheets · C-62 empty · C-05 FAB · C-63 toast.

/* ---------- Request disposal (PRD §5.5, FR-08) ---------- */
const D_REASONS = ['Beyond repair', 'Unsafe', 'Worn out', 'Damaged in use', 'Obsolete', 'Lost / write-off'];
const D_COND = ['needsrepair', 'damaged', 'unsafe', 'beyond'].map(k => ({ key: k, label: COND[k] }));
route('dispose/([\\w-]+)', id => {
  const it = itemOf(id);
  if (!it || !isActive(it) || it.status === 'transit' || it.disposal || !can(A.me, 'dispose', it)) return notHere('Request disposal', 'This item cannot be sent for disposal now.', '#/item/' + id);
  const c = catOf(it);
  const f = F({ reason: it.repair && it.repair.state === 'beyond' ? 'Beyond repair' : '', cond: it.cond === 'good' ? '' : it.cond, notes: it.repair ? it.repair.techNote || '' : '', route: 'standard', approver: '' });
  const main = page({ title: 'Request disposal', sub: `${it.id} · ${it.name} · ${where(it)}`, back: '#/item/' + id, actions: [{ label: 'Review', kind: 'primary', onclick: `reviewDispose('${id}')` }] })
    + part('Request', [['Reason', f.reason], ['Condition', f.cond ? COND[f.cond] : ''], ['Condition details', f.notes]], { label: 'Edit', onclick: "edit('Request', () => [chc('Reason', 'reason', D_REASONS), chc('Condition', 'cond', D_COND), fld('Condition details', 'notes', { type: 'textarea' })])" })
    + photosPart('Evidence')
    + part('Route', [['Route', f.route === 'expedited' ? 'Expedited' : 'Standard']], { label: 'Edit', onclick: "edit('Route', () => [chc('Route', 'route', [{ key: 'standard', label: 'Standard' }, { key: 'expedited', label: 'Expedited' }])])" })
    + part('Approver', [['Approver', nm(f.approver)]], { label: f.approver ? 'Change' : 'Pick', onclick: `pickPerson('approver', p => CAN.approve.includes(p.role) && p.sites.includes('${it.site}'), 'Approver')` })
    + part('Validations', [['Animal use', c.bio !== 'never' ? 'Biologist' : 'Not required'], ['Repairability', c.tech ? 'Workshop / VIC' : 'Not required']]);
  return { main, title: 'Request disposal' };
});
function reviewDispose(id) {
  const it = itemOf(id), f = A.form, c = catOf(it), req = c.req.disposal;
  review({ title: 'Submit disposal request', sub: `${it.id} · ${it.name}`, ok: 'Submit request', fn: () => doDispose(id),
    strip: [{ label: 'Photos', value: f.photos.length }, { label: 'Validations', value: (c.bio !== 'never') + !!c.tech }, { label: 'Route', value: f.route === 'expedited' ? 'Expedited' : 'Standard' }],
    rows: [['Reason', f.reason], ['Condition', f.cond ? COND[f.cond] : ''], ['Condition details', f.notes], ['Approver', nm(f.approver)]],
    missing: [!f.reason ? 'Reason' : '', !f.cond ? 'Condition' : '', req.includes('notes') && !String(f.notes).trim() ? 'Condition details' : '', (req.includes('photo') || f.route === 'expedited') && !f.photos.length ? 'Photo' : '', !f.approver ? 'Approver' : ''].filter(Boolean) });
}
function doDispose(id) {
  const f = A.form; let d;
  if (act(() => { d = requestDisposal(id, A.me, { reason: f.reason, cond: f.cond, notes: String(f.notes).trim(), photos: f.photos, approver: f.approver, expedited: f.route === 'expedited' }); })) { go('#/disposal/' + d); say('Disposal requested · ' + d); }
}

/* ---------- Disposal request ---------- */
route('disposal/([\\w-]+)', did => {
  const d = disposalOf(did);
  if (!d) return notHere('Disposal request', 'This request does not exist.', '#/disposals');
  const it = itemOf(d.item), r = role();
  const v = (need, x, who) => !need ? 'Not required' : x ? `${x.agree ? 'Agrees' : 'Does not agree'} · ${nm(x.by)} · ${fs(x.at)}` + (x.note ? ' · ' + x.note : '') : 'Pending · ' + who;
  const open = ['validation', 'approved'].includes(d.state), actions = [];
  if (open && d.needBio && !d.bio && r === 'bio') actions.push({ label: 'Validate', kind: 'primary', onclick: `openSheet('dval', { id: '${d.id}', k: 'bio' })` });
  if (open && d.needTech && !d.tech && r === 'ws') actions.push({ label: 'Validate', kind: 'primary', onclick: `openSheet('dval', { id: '${d.id}', k: 'tech' })` });
  if ((d.state === 'approval' || (d.state === 'validation' && d.expedited)) && can(A.me, 'approve'))
    actions.push({ label: 'Reject', onclick: `openSheet('dreject', { id: '${d.id}', decision: true })` }, { label: 'Approve', kind: 'primary', onclick: `confirmSheet('Approve disposal?', '${kEsc(it.name)} · ${it.id} · ${kEsc(d.reason)}', 'Approve', () => act(() => approveDisposal('${d.id}', A.me), 'Disposal approved'))` });
  if (d.state === 'approved' && can(A.me, 'completeDisposal', it)) actions.push({ label: 'Complete disposal', kind: 'primary', disabled: (d.needBio && !d.bio) || (d.needTech && !d.tech), onclick: `openSheet('dcomplete', { id: '${d.id}' })` });
  const main = page({ title: it.name, sub: `${d.id} · ${DSTATE[d.state][0]}${d.expedited ? ' · Expedited' : ''}`, back: '#/disposals', actions })
    + part('Request', [['Item', `${it.name} · ${it.id}`], ['Category', `${catCode(it)} · ${catOf(it).name}`], ['Location', where(it)], ['Reason', d.reason], ['Condition', COND[d.cond]], ['Condition details', d.notes], ['Requested', `${ft(d.at)} · ${nm(d.by)}`], ['Approver', nm(d.approver)]], { label: 'Open item', kind: 'ghost', href: '#/item/' + it.id })
    + evidence(d.photos)
    + part('Validations', [['Animal use', v(d.needBio, d.bio, 'Biologist')], ['Repairability', v(d.needTech, d.tech, 'Workshop / VIC')]])
    + part('Decision', [['Decision', d.decision ? (d.decision.approved ? 'Approved' : 'Rejected') + ` · ${nm(d.decision.by)} · ${ft(d.decision.at)}` : 'Pending'], ['Comments', d.decision ? d.decision.note : ''],
      ['Final disposition', d.outcome ? DISPOSITION[d.outcome] : ''], ['Completed', d.completed ? `${fd(d.completed.date)} · ${nm(d.completed.by)}` : ''], ['Completion note', d.completed ? d.completed.note : '']])
    + kCard({ title: 'History', body: kTimeline(it.history.filter(h => h.ref === d.id).map((h, i) => ({ title: `${h.act} · ${ft(h.at)} · ${nm(h.by)}`, text: [h.to, h.note].filter(Boolean).join(' · '), current: i === 0 }))) });
  return { main, title: d.id };
});
SHEETS.dval = s => { s.valid = x => !!x.v && (x.v === 'yes' || !!String(x.note || '').trim()); const d = disposalOf(s.id);
  return kSheet({ title: s.k === 'bio' ? 'Animal-use validation' : 'Repairability validation', sub: `${itemOf(d.item).name} · ${d.id}`, close: 'closeSheet()',
    body: kFormSection('', [lbl('Validation', kChoice([{ key: 'yes', label: 'Agree' }, { key: 'no', label: 'Do not agree' }], s.v, { onpick: "setSh('v')" })), shNote('Note')]), foot: foot('Save validation', s.valid(s)) }); };
SHEET_OK.dval = s => act(() => validateDisposal(s.id, A.me, s.k, s.v === 'yes', String(s.note || '').trim()), 'Validation saved');
// C-52: reject is a big change; the reason is required and there is no ✕
SHEETS.dreject = s => { s.valid = x => !!String(x.note || '').trim();
  return kSheet({ title: 'Reject this request?', sub: `${itemOf(disposalOf(s.id).item).name} · ${s.id}`, body: kFormSection('', [shNote('Comments for the custodian')]),
    foot: kButton({ label: 'Keep request', onclick: 'closeSheet()' }) + kButton({ label: 'Reject request', kind: 'primary', disabled: !s.valid(s), onclick: 'sheetOk()' }) }); };
SHEET_OK.dreject = s => act(() => rejectDisposal(s.id, A.me, String(s.note).trim()), 'Request returned to the custodian');
SHEETS.dcomplete = s => { s.valid = x => !!x.v; s.date = s.date || day(NOW);
  return kSheet({ title: 'Complete disposal', sub: disposalOf(s.id).id, close: 'closeSheet()',
    body: kFormSection('', [lbl('Final disposition', kChoice(Object.keys(DISPOSITION).map(k => ({ key: k, label: DISPOSITION[k] })), s.v, { onpick: "setSh('v')" })),
      kField({ label: 'Completion date', type: 'date', value: s.date, attrs: 'oninput="A.sheet.date=this.value"' }), shNote('Note')]),
    foot: foot('Complete', s.valid(s)) }); };
SHEET_OK.dcomplete = s => act(() => completeDisposal(s.id, A.me, { outcome: s.v, date: s.date, note: String(s.note || '').trim() }), 'Disposal completed · record retained');

/* ---------- Disposal requests ---------- */
const disposalCard = d => { const it = itemOf(d.item); return card({ name: it.name, about: [d.id, it.id, d.reason], status: dPill(d), href: '#/disposal/' + d.id,
  facts: [{ label: 'Requested', value: fs(d.at) }, { label: 'By', value: nm(d.by) }, { label: 'Approver', value: nm(d.approver) }, { label: d.outcome ? 'Outcome' : 'Route', value: d.outcome ? DISPOSITION[d.outcome] : d.expedited ? 'Expedited' : 'Standard' }] }); };
route('disposals', () => {
  const all = D.disposals.filter(d => inSite(itemOf(d.item))), openSt = ['validation', 'approval', 'approved'], isOpen = d => openSt.includes(d.state);
  const list = all.filter(d => A.dsp === 'open' ? isOpen(d) : !isOpen(d)).sort((a, b) => b.at.localeCompare(a.at));
  const main = page({ title: 'Disposal requests', sub: plural(all.length, 'request'), back: '#/overview' })
    + kStatStrip([{ key: 'open', label: 'Open', value: all.filter(isOpen).length }, { key: 'closed', label: 'Closed', value: all.filter(d => !isOpen(d)).length }], { current: A.dsp, onpick: 'setDsp' })
    + (list.length ? cards(list.map(disposalCard)) : kEmpty({ kind: 'none', icon: 'trash', text: A.dsp === 'open' ? 'No open requests.' : 'No closed requests.' }));
  return { main, title: 'Disposal requests' };
});
function setDsp(k) { A.dsp = k; redraw(); }

/* ---------- Audits (PRD §5.6, FR-12) ---------- */
const AST = { scheduled: ['Scheduled', ''], open: ['In progress', 'info'], closed: ['Closed', 'ok'] };
function auditCard(a) {
  const s = auditStats(a), late = a.state !== 'closed' && day(NOW) > a.due;
  return card({ name: `${a.period} audit`, about: [siteName(a.site), nm(a.auditor)], status: late ? kPill('Overdue', 'bad') : kPill(AST[a.state][0], AST[a.state][1]), href: '#/audit/' + a.id,
    facts: [{ label: 'Items', value: s.n }, { label: 'Checked', value: s.pct + '%' }, { label: 'Exceptions', value: s.exceptions }, { label: a.state === 'closed' ? 'Closed' : 'Due', value: fs(a.state === 'closed' ? a.closed.at : a.due) }] });
}
route('audits', () => {
  const list = D.audits.filter(inSite).sort((a, b) => (a.state === 'closed') - (b.state === 'closed') || b.due.localeCompare(a.due));
  const main = header('audits')
    + (list.length ? cards(list.map(auditCard)) : kEmpty({ kind: 'none', icon: 'checkc', text: 'No audits yet.', action: can(A.me, 'auditCreate') ? kButton({ label: 'New audit', kind: 'primary', href: '#/audit-new' }) : '' }));
  return { main, fab: true, title: 'Audits' };
});

route('audit-new', () => {
  if (!can(A.me, 'auditCreate')) return notHere('New audit', 'Only an AFM or the admin can start an audit.', '#/audits');
  const f = F({ site: A.site === 'all' ? me().sites[0] : A.site, period: 'Q4 2026', due: addDays(day(NOW), 21), auditor: A.me });
  const n = D.items.filter(i => i.site === f.site && isActive(i) && i.status !== 'transit').length;
  const main = page({ title: 'New audit', sub: siteName(f.site), back: '#/audits', actions: [{ label: 'Review', kind: 'primary', onclick: 'reviewAuditNew()' }] })
    + part('Site', [['Site', siteName(f.site)], ['Active tracked items', String(n)]], { label: 'Change', onclick: "pick('Site', D.sites.filter(s => me().sites.includes(s.id)).map(s => ({ key: s.id, title: s.name })), A.form.site, k => { A.form.site = k; })" })
    + part('Schedule', [['Period', f.period], ['Due date', fd(f.due)]], { label: 'Edit', onclick: "edit('Schedule', () => [chc('Period', 'period', ['Q4 2026', 'H2 2026', 'Q1 2027']), fld('Due date', 'due', { type: 'date' })], () => !!A.form.due)" })
    + part('Auditor', [['Auditor', nm(f.auditor)]], { label: 'Change', onclick: "pickPerson('auditor', p => ['sup', 'afm'].includes(p.role) && p.sites.includes(A.form.site), 'Auditor')" });
  return { main, title: 'New audit' };
});
function reviewAuditNew() {
  const f = A.form, n = D.items.filter(i => i.site === f.site && isActive(i) && i.status !== 'transit').length, busy = D.audits.some(a => a.site === f.site && a.state !== 'closed');
  review({ title: 'Create audit list', sub: `${f.period} · ${siteName(f.site)}`, ok: 'Create audit list', fn: doAuditNew,
    strip: [{ label: 'Items', value: n }, { label: 'Due', value: fs(f.due) }],
    rows: [['Site', siteName(f.site)], ['Period', f.period], ['Auditor', nm(f.auditor)], ['Open audit at this site', busy ? 'Yes' : 'No']],
    missing: [busy ? 'Close the open audit of this site' : '', !f.auditor ? 'Auditor' : ''].filter(Boolean) });
}
function doAuditNew() { const f = A.form; let id; if (act(() => { id = createAudit(A.me, f); })) { go('#/audit/' + id); say('Audit list created'); } }

/* ---------- Audit workspace ---------- */
route('audit/([\\w-]+)', aid => {
  const a = auditOf(aid);
  if (!a) return notHere('Audit', 'This audit does not exist.', '#/audits');
  const s = auditStats(a), closed = a.state === 'closed', seg = A.aud;
  const lines = a.lines.filter(l => seg === 'todo' ? !l.outcome : seg === 'exceptions' ? l.outcome && l.outcome !== 'verified' : l.outcome === 'verified');
  const line = l => {
    const it = itemOf(l.item), e = l.exc, exp = l.expected;
    let onclick = '';
    if (!closed && !l.outcome && can(A.me, 'auditRecord', it)) onclick = `openSheet('acheck', { a: '${a.id}', id: '${it.id}' })`;
    else if (!closed && l.outcome && l.outcome !== 'verified' && !e && can(A.me, 'auditAssign')) onclick = `openSheet('aassign', { a: '${a.id}', id: '${it.id}' })`;
    else if (l.outcome && l.outcome !== 'verified' && e && !e.resolved && (e.to === A.me || can(A.me, 'auditAssign'))) onclick = `openSheet('aresolve', { a: '${a.id}', id: '${it.id}' })`;
    else onclick = `go('#/item/${it.id}')`;
    return card({ name: it.name, about: [it.id, locName(exp.loc), nm(exp.custodian)].concat(l.foundLoc ? ['Found: ' + locName(l.foundLoc)] : []).concat(l.note ? [l.note] : []),
      status: l.outcome ? outPill(l.outcome) : kPill('To check', ''), onclick,
      facts: [{ label: 'Recorded status', value: STATUS[exp.status] }, { label: 'Condition', value: COND[exp.cond] }, { label: 'Assigned to', value: l.outcome && l.outcome !== 'verified' ? (e ? nm(e.to) : 'Not assigned') : '' }, { label: e && e.resolved ? 'Resolved' : 'Due', value: e ? fs(e.resolved ? e.resolved.at : e.due) : '' }] });
  };
  const ready = s.checked === s.n && !s.unassigned;
  const main = page({ title: `${a.period} audit`, sub: `${siteName(a.site)} · ${nm(a.auditor)} · ${closed ? 'Closed ' + fd(a.closed.at) : 'Due ' + fd(a.due)}`, back: '#/audits',
      actions: !closed && can(A.me, 'auditClose') ? [{ label: 'Close audit', kind: 'primary', disabled: !ready, onclick: `confirmSheet('Close this audit?', '${a.period} · ${siteName(a.site)} · ${s.verified} verified · ${s.exceptions} exceptions', 'Close audit', () => act(() => closeAudit('${a.id}', A.me), 'Audit closed'))` }] : [] })
    + kCard({ title: 'Progress', pad: 'lg', body: kRing(s.pct, 120, { sub: `${s.checked} of ${s.n}` })
      + kBarRows([{ label: 'Verified', pct: s.n ? Math.round(s.verified / s.n * 100) : 0, value: String(s.verified) }, { label: 'Exceptions', pct: s.n ? Math.round(s.exceptions / s.n * 100) : 0, value: String(s.exceptions), tone: 'warn' },
        { label: 'Not assigned', pct: s.exceptions ? Math.round(s.unassigned / s.exceptions * 100) : 0, value: String(s.unassigned), tone: 'bad' }, { label: 'Location accuracy', pct: s.accuracy || 0, value: s.accuracy == null ? '—' : s.accuracy + '%' }]) })
    + kStatStrip([{ key: 'todo', label: 'To check', value: s.n - s.checked }, { key: 'exceptions', label: 'Exceptions', value: s.exceptions, tone: s.unassigned ? 'attn' : '' }, { key: 'verified', label: 'Verified', value: s.verified }], { current: seg, onpick: 'setAud' })
    + (lines.length ? cards(lines.map(line)) : kEmpty({ kind: 'filtered', text: seg === 'todo' ? 'Every item is checked.' : seg === 'exceptions' ? 'No exceptions.' : 'No verified items yet.' }));
  return { main, title: `${a.period} audit` };
});
function setAud(k) { A.aud = k; redraw(); }
SHEETS.acheck = s => {
  const a = auditOf(s.a), it = itemOf(s.id), l = a.lines.find(x => x.item === s.id);
  s.valid = x => !!x.v && (x.v !== 'locmismatch' || !!x.loc) && (!['condmismatch', 'action'].includes(x.v) || !!String(x.note || '').trim());
  return kSheet({ title: it.name, sub: `${it.id} · ${locName(l.expected.loc)} · ${nm(l.expected.custodian)}`, close: 'closeSheet()',
    body: kFormSection('', [lbl('Outcome', kOptions(Object.keys(AUDIT_OUT).map(k => kOption({ type: 'radio', title: AUDIT_OUT[k], on: s.v === k, onclick: `A.sheet.v='${k}';drawSheet()` }))))]
      .concat(s.v === 'locmismatch' ? [lbl('Found at', kOptions(D.locations.filter(x => x.site === a.site && x.id !== it.loc).map(x => kOption({ type: 'radio', title: x.name, sub: secName(x.section), on: s.loc === x.id, onclick: `A.sheet.loc='${x.id}';drawSheet()` }))))] : [])
      .concat([shNote('Note')])),
    foot: foot('Save', s.valid(s)) });
};
SHEET_OK.acheck = s => act(() => recordAudit(s.a, s.id, A.me, s.v, { loc: s.loc, note: String(s.note || '').trim() }), AUDIT_OUT[s.v]);
SHEETS.aassign = s => { const a = auditOf(s.a), it = itemOf(s.id); s.due = s.due || addDays(day(NOW), 7); s.valid = x => !!x.to && !!x.due;
  return kSheet({ title: 'Assign exception', sub: `${it.name} · ${AUDIT_OUT[a.lines.find(x => x.item === s.id).outcome]}`, close: 'closeSheet()',
    body: kFormSection('', [lbl('Responsible custodian', kOptions(D.people.filter(custodiansOf(it.section)).map(p => kOption({ type: 'radio', title: p.name, sub: ROLE[p.role], on: s.to === p.id, onclick: `A.sheet.to='${p.id}';drawSheet()` })))),
      kField({ label: 'Due date', type: 'date', value: s.due, attrs: 'oninput="A.sheet.due=this.value;sheetSync()"' })]),
    foot: foot('Assign', s.valid(s)) }); };
SHEET_OK.aassign = s => act(() => assignException(s.a, s.id, A.me, { to: s.to, due: s.due }), 'Exception assigned');
SHEETS.aresolve = s => { const it = itemOf(s.id); s.valid = x => !!String(x.note || '').trim();
  return kSheet({ title: 'Resolve exception', sub: `${it.name} · ${it.id}`, close: 'closeSheet()',
    body: kFormSection('', (it.status === 'missing' ? [lbl('Found at', kOptions([kOption({ type: 'radio', title: 'Still missing', on: !s.loc, onclick: "A.sheet.loc='';drawSheet()" })]
        .concat(D.locations.filter(x => x.section === it.section).map(x => kOption({ type: 'radio', title: x.name, sub: x.kind === 'enclosure' ? 'Enclosure' : 'Store', on: s.loc === x.id, onclick: `A.sheet.loc='${x.id}';drawSheet()` })))))] : [])
      .concat([shNote('Resolution')])),
    foot: foot('Resolve', s.valid(s)) }); };
SHEET_OK.aresolve = s => act(() => resolveException(s.a, s.id, A.me, { note: String(s.note).trim(), loc: s.loc }), 'Exception resolved');
