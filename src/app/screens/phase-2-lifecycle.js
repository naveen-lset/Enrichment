// src/app/screens/phase-2-lifecycle.js — PRD Phase 2 · Lifecycle controls.
// Move / rotate · Mark for repair · Complete repair · Initiate transfer (task pages: one card per topic, C-54 / C-51 sheets, C-53 review)
// · Animal-use check · Repairability check · Decide outcome · Start repair · Acknowledge receipt · Complete by exception (C-54 sheets).
// Confirmed components: C-07 page header · C-15 card · C-59 key-value · C-46 thumbs · C-48 / C-51 / C-53 / C-54 sheets · C-62 empty · C-63 toast.

const setSh = k => v => { A.sheet[k] = v; drawSheet(); };
const shNote = (label, key = 'note') => kField({ label, type: 'textarea', value: A.sheet[key] || '', attrs: `oninput="A.sheet['${key}']=this.value;sheetSync()"` });

/* ---------- Move / rotate (PRD §5.2, FR-05) ---------- */
const MOVE_REASONS = ['Rotation', 'Storage', 'Cleaning', 'Rest from use', 'Enclosure change'];
route('move/([\\w-]+)', id => {
  const it = itemOf(id);
  if (!it || !MOVABLE.includes(it.status) || it.disposal || !can(A.me, 'move', it)) return notHere('Move / rotate', 'This item cannot be moved now.', '#/item/' + id);
  const f = F({ to: '', date: day(NOW), reason: '', notes: '', qty: String(it.qty) }), batch = it.mode === 'batch', ok = usableForAnimals(it);
  const main = page({ title: 'Move / rotate', sub: `${it.id} · ${it.name}`, back: '#/item/' + id, actions: [{ label: 'Review', kind: 'primary', onclick: `reviewMove('${id}')` }] })
    + part('From', [['Location', where(it)], ['Status', STATUS[it.status]], ['Condition', COND[it.cond]]].concat(batch ? [['Quantity', String(it.qty)]] : []))
    + part('Destination', [['Location', locLabel(f.to)]], { label: f.to ? 'Change' : 'Pick', onclick: `pickLocation('to', l => l.section === '${it.section}' && l.id !== '${it.loc}' && (l.kind !== 'enclosure' || ${ok}), 'Destination')` })
    + (batch ? part('Quantity', [['Quantity to move', f.qty]], { label: 'Edit', onclick: `edit('Quantity', () => [fld('Quantity to move', 'qty', { type: 'number' })], () => +A.form.qty >= 1 && +A.form.qty <= ${it.qty})` }) : '')
    + part('Details', [['Date', fd(f.date)], ['Reason', f.reason], ['Notes', f.notes]], { label: 'Edit', onclick: "edit('Details', () => [fld('Date', 'date', { type: 'date' }), chc('Reason', 'reason', MOVE_REASONS), fld('Notes', 'notes', { type: 'textarea' })])" });
  return { main, title: 'Move / rotate' };
});
function reviewMove(id) {
  const it = itemOf(id), f = A.form, to = locOf(f.to);
  review({ title: 'Save movement', sub: `${it.id} · ${it.name}`, ok: 'Save movement', fn: () => doMove(id),
    rows: [['From', where(it)], ['To', to ? `${to.name} · ${secName(to.section)}` : ''], ['Status after', to ? STATUS[to.kind === 'enclosure' ? 'inuse' : 'storage'] : ''], ['Quantity', it.mode === 'batch' ? f.qty : ''], ['Date', fd(f.date)], ['Reason', f.reason], ['Notes', f.notes]],
    missing: [!f.to ? 'Destination' : '', !f.reason ? 'Reason' : ''].filter(Boolean) });
}
function doMove(id) {
  const f = A.form; let nid;
  if (act(() => { nid = move(id, A.me, { to: f.to, date: f.date, reason: [f.reason, String(f.notes).trim()].filter(Boolean).join(' · '), qty: +f.qty }); })) { go('#/item/' + nid); say(nid === id ? 'Movement saved' : `Moved ${f.qty} as ${nid}`); }
}

/* ---------- Mark for repair (PRD §5.3) ---------- */
const ISSUES = ['Structural damage', 'Wear', 'Corrosion', 'Hygiene', 'Missing part', 'Other'];
const FLAG_COND = [{ key: 'needsrepair', label: 'Needs repair' }, { key: 'damaged', label: 'Damaged' }, { key: 'unsafe', label: 'Unsafe / unusable' }];
route('repair/([\\w-]+)', id => {
  const it = itemOf(id);
  if (!it || !MOVABLE.includes(it.status) || it.disposal) return notHere('Mark for repair', 'This item cannot be flagged now.', '#/item/' + id);
  const f = F({ issue: '', cond: '', notes: '' }), rt = routingFor(it);
  const main = page({ title: 'Mark for repair', sub: `${it.id} · ${it.name} · ${where(it)}`, back: '#/item/' + id, actions: [{ label: 'Review', kind: 'primary', onclick: `reviewFlag('${id}')` }] })
    + part('Issue', [['Issue type', f.issue], ['Condition', f.cond ? COND[f.cond] : ''], ['Notes', f.notes]], { label: 'Edit', onclick: "edit('Issue', () => [chc('Issue type', 'issue', ISSUES), chc('Condition', 'cond', FLAG_COND), fld('Notes', 'notes', { type: 'textarea' })])" })
    + photosPart()
    + part('Routing', [['Animal-use check', rt.bio ? 'Biologist' : 'Not required'], ['Repairability', rt.tech ? 'Workshop / VIC' : 'Not required'], ['Decision', !rt.bio && !rt.tech ? 'Custodian' : 'After the checks']]);
  return { main, title: 'Mark for repair' };
});
function reviewFlag(id) {
  const it = itemOf(id), f = A.form, req = catOf(it).req.repair, rt = routingFor(it);
  review({ title: 'Send for assessment', sub: `${it.id} · ${it.name}`, ok: 'Send for assessment', fn: () => act(() => flagIssue(id, A.me, { issue: f.issue, cond: f.cond, notes: String(f.notes).trim(), photos: f.photos }), 'Sent for assessment', '#/item/' + id),
    strip: [{ label: 'Photos', value: f.photos.length }, { label: 'Biologist', value: rt.bio ? 'Yes' : 'No' }, { label: 'Workshop', value: rt.tech ? 'Yes' : 'No' }],
    rows: [['Issue type', f.issue], ['Condition', f.cond ? COND[f.cond] : ''], ['Notes', f.notes], ['Status after', STATUS.assessment]],
    missing: [!f.issue ? 'Issue type' : '', !f.cond ? 'Condition' : '', req.includes('photo') && !f.photos.length ? 'Photo' : '', req.includes('notes') && !String(f.notes).trim() ? 'Notes' : ''].filter(Boolean) });
}

/* ---------- one decision each: C-54 sheets ---------- */
function decision(s, title, items, noteLabel, ok, needNote) {
  s.valid = x => !!x.v && (!needNote(x) || !!String(x.note || '').trim());
  return kSheet({ title, sub: `${itemOf(s.id).name} · ${s.id}`, close: 'closeSheet()', body: kFormSection('', [lbl('Result', kChoice(items, s.v, { onpick: "setSh('v')" })), shNote(noteLabel)]), foot: foot(ok, s.valid(s)) });
}
SHEETS.bio = s => decision(s, 'Animal-use check', [{ key: 'suitable', label: 'Suitable' }, { key: 'unsuitable', label: 'Unsuitable' }], 'Note', 'Save check', x => x.v === 'unsuitable');
SHEET_OK.bio = s => act(() => verifyAnimalUse(s.id, A.me, s.v, String(s.note || '').trim()), 'Animal-use check saved');
SHEETS.tech = s => decision(s, 'Repairability', [{ key: 'repairable', label: 'Repairable' }, { key: 'beyond', label: 'Beyond repair' }], 'Assessment', 'Save assessment', () => true);
SHEET_OK.tech = s => act(() => assessRepair(s.id, A.me, s.v, String(s.note || '').trim()), 'Assessment saved');
SHEETS.decide = s => decision(s, 'Decide outcome', [{ key: 'repair', label: 'Send for repair' }, { key: 'clear', label: 'Clear for use' }, { key: 'beyond', label: 'Beyond repair' }], 'Note', 'Save decision', () => false);
SHEET_OK.decide = s => act(() => decide(s.id, A.me, s.v, String(s.note || '').trim()), 'Decision saved');
const TEAMS = ['Workshop', 'Carpentry', 'VIC', 'Keepers'];
SHEETS.start = s => { s.v = s.v || 'Workshop'; return kSheet({ title: 'Start repair', sub: `${itemOf(s.id).name} · ${s.id}`, close: 'closeSheet()', body: kFormSection('', [lbl('Team', kChoice(TEAMS, s.v, { onpick: "setSh('v')" }))]), foot: foot('Start repair') }); };
SHEET_OK.start = s => act(() => startRepair(s.id, A.me, { team: s.v }), 'Repair started');

/* ---------- Complete repair (PRD §5.3) ---------- */
route('repair-done/([\\w-]+)', id => {
  const it = itemOf(id);
  if (!it || !it.repair || it.repair.state !== 'repair') return notHere('Complete repair', 'This item is not under repair.', '#/item/' + id);
  const R = it.repair, f = F({ date: day(NOW), team: R.team || 'Workshop', notes: '', to: it.loc });
  const main = page({ title: 'Complete repair', sub: `${it.id} · ${it.name}`, back: '#/item/' + id, actions: [{ label: 'Review', kind: 'primary', onclick: `reviewRepairDone('${id}')` }] })
    + part('Repair', [['Issue', R.issue], ['Opened', ft(R.opened)], ['Started', ft(R.started)], ['Technical assessment', R.techNote], ['Animal use', R.bioNote]])
    + part('Completion', [['Completed on', fd(f.date)], ['Responsible team', f.team], ['What was repaired', f.notes]], { label: 'Edit', onclick: "edit('Completion', () => [fld('Completed on', 'date', { type: 'date' }), chc('Responsible team', 'team', TEAMS), fld('What was repaired', 'notes', { type: 'textarea' })])" })
    + photosPart()
    + part('Return to', [['Location', locLabel(f.to)]], { label: 'Change', onclick: `pickLocation('to', l => l.section === '${it.section}', 'Return to')` });
  return { main, title: 'Complete repair' };
});
function reviewRepairDone(id) {
  const it = itemOf(id), f = A.form, to = locOf(f.to);
  review({ title: 'Complete repair', sub: `${it.id} · ${it.name}`, ok: 'Complete repair', fn: () => act(() => completeRepair(id, A.me, { date: f.date, team: f.team, notes: String(f.notes).trim(), to: f.to, photos: f.photos }), 'Repair completed', '#/item/' + id),
    rows: [['Completed on', fd(f.date)], ['Responsible team', f.team], ['What was repaired', f.notes], ['Photos', String(f.photos.length)], ['Returns to', locLabel(f.to)], ['Status after', to ? STATUS[to.kind === 'enclosure' ? 'inuse' : 'storage'] : ''], ['Condition after', COND.good]],
    missing: [!String(f.notes).trim() ? 'What was repaired' : '', !f.to ? 'Return location' : ''].filter(Boolean) });
}

/* ---------- Initiate transfer to another section or site (PRD §5.4, FR-11) ---------- */
route('transfer/([\\w-]+)', id => {
  const it = itemOf(id);
  if (!it || !MOVABLE.includes(it.status) || it.disposal || !can(A.me, 'transfer', it)) return notHere('Initiate transfer', 'This item cannot be transferred now.', '#/item/' + id);
  const f = F({ section: '', receiver: '', ref: '', date: day(NOW), note: '' }), sec = f.section && sectionOf(f.section);
  const main = page({ title: 'Initiate transfer', sub: `${it.id} · ${it.name}`, back: '#/item/' + id, actions: [{ label: 'Review', kind: 'primary', onclick: `reviewTransfer('${id}')` }] })
    + part('From', [['Location', where(it)], ['Site', siteName(it.site)], ['Custodian', nm(it.custodian)]])
    + part('Destination', [['Section', sec ? sec.name : ''], ['Site', sec ? siteName(sec.site) : '']], { label: f.section ? 'Change' : 'Pick', onclick: `pickSection('${it.section}')` })
    + part('Receiving custodian', [['Custodian', nm(f.receiver)]], { label: f.receiver ? 'Change' : 'Pick', onclick: f.section ? `pickPerson('receiver', custodiansOf('${f.section}'), 'Receiving custodian')` : "say('Pick the destination first', 'alert')" })
    + part('Details', [['Transfer reference', f.ref], ['Dispatch date', fd(f.date)], ['Notes', f.note]], { label: 'Edit', onclick: "edit('Details', () => [fld('Transfer reference', 'ref'), fld('Dispatch date', 'date', { type: 'date' }), fld('Notes', 'note', { type: 'textarea' })])" });
  return { main, title: 'Initiate transfer' };
});
function pickSection(current) { pick('Destination', D.sections.filter(s => s.id !== current).map(s => ({ key: s.id, title: s.name, sub: siteName(s.site) })), A.form.section, k => { A.form.section = k; A.form.receiver = ''; }); }
function reviewTransfer(id) {
  const it = itemOf(id), f = A.form, sec = f.section && sectionOf(f.section), needRef = catOf(it).req.transfer.includes('ref');
  review({ title: 'Dispatch transfer', sub: `${it.id} · ${it.name}`, ok: 'Dispatch', fn: () => act(() => transfer(id, A.me, { section: f.section, receiver: f.receiver, ref: String(f.ref).trim(), date: f.date, note: String(f.note).trim() }), 'Dispatched · in transit', '#/item/' + id),
    rows: [['From', `${where(it)}, ${siteName(it.site)}`], ['To', sec ? `${sec.name}, ${siteName(sec.site)}` : ''], ['Receiving custodian', nm(f.receiver)], ['Transfer reference', f.ref], ['Dispatch date', fd(f.date)], ['Notes', f.note], ['Status after', STATUS.transit]],
    missing: [!f.section ? 'Destination' : '', !f.receiver ? 'Receiving custodian' : '', needRef && !String(f.ref).trim() ? 'Transfer reference' : ''].filter(Boolean) });
}

/* ---------- Acknowledge receipt (receiving custodian) · Complete by exception (AFM / admin, with a reason) ---------- */
function arrival(s, withReason) {
  const it = itemOf(s.id), tr = it.transfer;
  return kFormSection('', [kKV([['From', `${secName(tr.from.section)}, ${siteName(tr.from.site)} · ${nm(tr.by)}`], ['Dispatched', ft(tr.dispatched)], ['Reference', tr.ref]]),
    lbl('Receiving location', kOptions(D.locations.filter(l => l.section === tr.to.section).map(l => kOption({ type: 'radio', title: l.name, sub: l.kind === 'enclosure' ? 'Enclosure' : 'Store', on: s.loc === l.id, onclick: `A.sheet.loc='${l.id}';drawSheet()` })))),
    lbl('Condition on arrival', kChoice([{ key: 'good', label: 'Good' }, { key: 'damaged', label: 'Damaged' }, { key: 'unsafe', label: 'Unsafe' }], s.cond, { onpick: "setSh('cond')" }))]
    .concat(withReason ? [shNote('Reason for the exception')] : []));
}
SHEETS.ack = s => { s.cond = s.cond || 'good'; s.valid = x => !!x.loc; return kSheet({ title: 'Acknowledge receipt', sub: `${itemOf(s.id).name} · ${s.id}`, close: 'closeSheet()', body: arrival(s, false), foot: foot('Confirm receipt', s.valid(s)) }); };
SHEET_OK.ack = s => act(() => acknowledge(s.id, A.me, { loc: s.loc, cond: s.cond }), 'Transfer received');
SHEETS.ackx = s => { s.cond = s.cond || 'good'; s.valid = x => !!x.loc && !!String(x.note || '').trim(); return kSheet({ title: 'Complete by exception', sub: `${itemOf(s.id).name} · ${s.id}`, close: 'closeSheet()', body: arrival(s, true), foot: foot('Complete transfer', s.valid(s)) }); };
SHEET_OK.ackx = s => act(() => completeWithoutAck(s.id, A.me, String(s.note || '').trim(), { loc: s.loc, cond: s.cond }), 'Transfer completed by exception');
