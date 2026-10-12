// src/model/model.js — the rules of the Enrichment & Furnishing Management module (PRD v1.0, 10 Oct 2026). No DOM.
// The page and tests/model.test.mjs both load this file. Every action takes the acting person `by`, checks the role
// (PRD §11), changes the record and writes one history event with actor, time, prior and new value (PRD §10).
// Actions throw an Error with a plain message when a rule refuses them; the app shows that message.

const NOW_DEFAULT = '2026-10-10T10:00';
let D = null, NOW = NOW_DEFAULT;
function useData(d, now) { D = d; NOW = now || NOW_DEFAULT; }
function setNow(t) { NOW = t; }
const nowIs = () => NOW;

/* ---------- time: 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM', compared as strings ---------- */
const day = t => String(t || '').slice(0, 10);
function addDays(s, n) { const d = new Date(s.slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + s.slice(10); }
const daysBetween = (a, b) => Math.round((Date.parse(day(b) + 'T00:00:00Z') - Date.parse(day(a) + 'T00:00:00Z')) / 864e5);

/* ---------- vocabularies (PRD §7, §8) ---------- */
const STATUS = {
  available: 'Available', inuse: 'In use', storage: 'In storage', assessment: 'Under assessment', repair: 'Under repair',
  transit: 'In transit', missing: 'Missing', retired: 'Retired / disposed', scrapped: 'Scrapped',
};
const COND = { good: 'Good', needsrepair: 'Needs repair', damaged: 'Damaged', unsafe: 'Unsafe / unusable', beyond: 'Beyond repair', na: 'Not assessed' };
const ROLE = { sup: 'Supervisor / custodian', afm: 'AFM / facility manager', bio: 'Biologist', ws: 'Workshop / VIC', mgmt: 'Management approver', admin: 'ANTZ admin', keeper: 'Keeper' };
const AUDIT_OUT = { verified: 'Verified', locmismatch: 'Location mismatch', condmismatch: 'Condition mismatch', notfound: 'Not found', action: 'Action required' };
const DISPOSITION = { disposed: 'Disposed', scrapped: 'Scrapped', donated: 'Donated / transferred', decommissioned: 'Decommissioned' };
const ACTIVE = ['available', 'inuse', 'storage', 'assessment', 'repair', 'transit', 'missing'];
const MOVABLE = ['available', 'inuse', 'storage'];

/* ---------- lookups ---------- */
const by = (k, id) => D[k].find(x => x.id === id);
const person = id => by('people', id);
const itemOf = id => by('items', id);
const catOf = it => by('categories', it.cat);
const locOf = id => by('locations', id);
const sectionOf = id => by('sections', id);
const siteOf = id => by('sites', id);
const isActive = it => ACTIVE.includes(it.status);
const fail = msg => { throw new Error(msg); };
const need = (v, msg) => { if (v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) fail(msg); return v; };

/* ---------- history: one event per significant change (PRD §8, §10) ---------- */
function log(it, byId, act, o = {}) {
  it.history.unshift({ at: NOW, by: byId, act, from: o.from ?? null, to: o.to ?? null, note: o.note || '', ref: o.ref || '' });
}
const where = it => it.status === 'transit' ? 'In transit' : [locOf(it.loc)?.name, sectionOf(it.section)?.name].filter(Boolean).join(' · ');

/* ---------- permissions (PRD §11; configurable, this is the proposed starting point) ---------- */
// sup and keeper act on items of their own sections; afm on its own sites; the others by role. Nobody can delete a tracked item.
const CAN = {
  receive: ['sup', 'afm', 'admin'], move: ['sup', 'afm', 'admin'], flag: ['sup', 'afm', 'bio', 'ws', 'admin', 'keeper'],
  verifyBio: ['bio'], assessTech: ['ws'], decide: ['sup', 'afm', 'admin'], repairStart: ['sup', 'ws', 'afm', 'admin'], repairDone: ['sup', 'ws', 'afm', 'admin'],
  transfer: ['sup', 'afm', 'admin'], ack: ['sup', 'afm', 'admin'], transferException: ['afm', 'admin'],
  dispose: ['sup', 'afm', 'admin'], validateBio: ['bio'], validateTech: ['ws'], approve: ['mgmt', 'afm'], completeDisposal: ['sup', 'afm', 'admin'],
  auditCreate: ['afm', 'admin'], auditRecord: ['sup', 'afm', 'admin'], auditAssign: ['afm', 'admin'], auditResolve: ['sup', 'afm', 'admin'], auditClose: ['afm', 'admin'],
  configure: ['admin'], labels: ['sup', 'afm', 'admin'],
};
function scoped(p, it) {
  if (!it) return true;
  if (p.role === 'sup' || p.role === 'keeper') return p.sections.includes(it.section);
  if (p.role === 'afm') return p.sites.includes(it.site);
  return true;
}
function can(byId, action, it) { const p = person(byId); return !!p && (CAN[action] || []).includes(p.role) && scoped(p, it); }
function must(byId, action, it) { if (!can(byId, action, it)) fail('You do not have permission for this action.'); }

/* ---------- configuration (PRD §4, FR-01) ---------- */
// category: {id, code, name, about, mode: individual|batch|excluded, bio: always|inuse|never, tech: bool, qr: required|optional|none, req: {repair, transfer, disposal}}
function saveCategory(byId, c) {
  must(byId, 'configure');
  need(c.name, 'A category needs a name.');
  if (!['individual', 'batch', 'excluded'].includes(c.mode)) fail('Pick a tracking mode.');
  const cur = by('categories', c.id);
  if (cur) Object.assign(cur, c); else D.categories.push(Object.assign({ id: 'CAT-' + (D.categories.length + 1) }, c));
  return c.id;
}

/* ---------- IDs ---------- */
function nextId(prefix) { D.seq[prefix] = (D.seq[prefix] || 0) + 1; return prefix + '-' + String(D.seq[prefix]).padStart(4, '0'); }

/* ---------- 5.1 receipt and registration (FR-02, FR-03) ---------- */
// receive(ticketId, by, {qty, cond, loc, custodian, discrepancy, fit}) — Category A makes one record per unit; batch makes one record with the quantity.
// An item not fit on receipt goes to Under assessment, never Available.
function receive(ticketId, byId, o = {}) {
  const t = by('tickets', ticketId) || fail('Ticket not found.');
  if (t.status !== 'dispatched') fail('This ticket is already received.');
  const sec = sectionOf(t.section);
  must(byId, 'receive', { section: t.section, site: sec.site });
  const qty = +o.qty;
  if (!Number.isInteger(qty) || qty < 1) fail('Enter the quantity received.');
  const loc = locOf(need(o.loc, 'Pick the receiving location.')) || fail('Pick the receiving location.');
  if (loc.section !== t.section) fail('The location must be in the ticket section.');
  need(o.custodian, 'Pick the custodian.');
  if (qty !== t.qty) need(o.discrepancy, 'The quantity differs from the ticket. Write the discrepancy.');
  const cat = by('categories', t.cat);
  if (cat.mode === 'excluded') fail('This category is not tracked.');
  const fit = o.fit !== false;
  const status = !fit ? 'assessment' : loc.kind === 'enclosure' ? 'inuse' : loc.kind === 'store' ? 'storage' : 'available';
  const units = cat.mode === 'individual' ? Array.from({ length: qty }, () => 1) : [qty];
  const ids = units.map(q => {
    const it = {
      id: nextId(cat.mode === 'individual' ? 'EF' : 'EB'), name: t.name, cat: cat.id, mode: cat.mode, qty: q,
      site: sec.site, section: t.section, loc: loc.id, custodian: o.custodian, status, cond: fit ? (o.cond || 'good') : (o.cond && o.cond !== 'good' ? o.cond : 'damaged'),
      ticket: t.id, ws: t.ws || '', mt: t.mt || '', received: NOW, lastVerified: day(NOW), photos: [], history: [], repair: null, transfer: null, disposal: null,
    };
    D.items.push(it);
    log(it, byId, 'Received', { to: where(it), ref: t.id, note: [o.discrepancy ? 'Discrepancy: ' + o.discrepancy : '', !fit ? 'Not fit on receipt' : ''].filter(Boolean).join(' · ') });
    if (!fit) openRepair(it, byId, { issue: 'Not fit on receipt', notes: o.notes || '', photos: [], prev: loc.kind === 'store' ? 'storage' : 'available' });
    return it.id;
  });
  t.status = 'received'; t.receivedAt = NOW; t.receivedBy = byId; t.items = ids; t.discrepancy = o.discrepancy || '';
  return ids;
}
// register(by, {...}) — register an item that is already on site (backfill at pilot start), without a ticket.
function register(byId, o = {}) {
  const loc = locOf(need(o.loc, 'Pick the location.')) || fail('Pick the location.');
  const sec = sectionOf(loc.section);
  must(byId, 'receive', { section: sec.id, site: sec.site });
  need(o.name, 'Enter the item name.');
  const cat = by('categories', need(o.cat, 'Pick the category.'));
  if (cat.mode === 'excluded') fail('This category is not tracked.');
  const qty = cat.mode === 'individual' ? 1 : +o.qty;
  if (!Number.isInteger(qty) || qty < 1) fail('Enter the quantity.');
  const it = {
    id: nextId(cat.mode === 'individual' ? 'EF' : 'EB'), name: o.name.trim(), cat: cat.id, mode: cat.mode, qty, site: sec.site, section: sec.id, loc: loc.id,
    custodian: need(o.custodian, 'Pick the custodian.'), status: loc.kind === 'enclosure' ? 'inuse' : loc.kind === 'store' ? 'storage' : 'available',
    cond: o.cond || 'good', ticket: o.ticket || '', ws: '', mt: '', received: NOW, lastVerified: day(NOW), photos: [], history: [], repair: null, transfer: null, disposal: null,
  };
  D.items.push(it);
  log(it, byId, 'Registered', { to: where(it), note: o.note || '' });
  return it.id;
}

/* ---------- 5.2 use, storage and rotation (FR-05) ---------- */
// usableForAnimals(item) — an unsafe, unsuitable or beyond-repair item, or one under repair, is never offered for animal use (PRD §8).
function usableForAnimals(it) {
  return isActive(it) && !['unsafe', 'beyond'].includes(it.cond) && !['assessment', 'repair', 'transit', 'missing'].includes(it.status)
    && !(it.repair && it.repair.bio === 'unsuitable');
}
// move(itemId, by, {to, date, reason, qty}) — a rotation is a movement of the same record, never a new item. A part of a batch splits off.
function move(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'move', it);
  if (!MOVABLE.includes(it.status)) fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be moved.`);
  if (it.disposal) fail('This item has an open disposal request.');
  const to = locOf(need(o.to, 'Pick where the item goes.')) || fail('Pick where the item goes.');
  if (to.section !== it.section) fail('Use a transfer to send an item to another section or site.');
  if (to.id === it.loc) fail('The item is already at this location.');
  need(o.reason, 'Write the reason for the move.');
  if (to.kind === 'enclosure' && !usableForAnimals(it)) fail('This item is not cleared for animal use.');
  let target = it;
  const qty = it.mode === 'individual' ? 1 : +(o.qty ?? it.qty);
  if (it.mode !== 'individual') {
    if (!Number.isInteger(qty) || qty < 1 || qty > it.qty) fail(`Enter a quantity from 1 to ${it.qty}.`);
    if (qty < it.qty) {
      target = JSON.parse(JSON.stringify(it)); target.id = nextId('EB'); target.qty = qty; target.history = []; target.parent = it.id;
      it.qty -= qty; D.items.push(target);
      log(it, byId, 'Quantity split', { from: String(it.qty + qty), to: String(it.qty), note: `${qty} moved as ${target.id}` });
      log(target, byId, 'Split from batch', { ref: it.id, note: `${qty} of ${it.qty + qty}` });
    }
  }
  const from = where(target), fromStatus = target.status;
  target.loc = to.id; target.section = to.section;
  target.status = to.kind === 'enclosure' ? 'inuse' : to.kind === 'store' ? 'storage' : 'available';
  log(target, byId, 'Moved', { from, to: where(target), note: [o.reason, o.date && o.date !== day(NOW) ? 'Moved on ' + o.date : ''].filter(Boolean).join(' · ') });
  if (fromStatus !== target.status) log(target, byId, 'Status changed', { from: STATUS[fromStatus], to: STATUS[target.status] });
  return target.id;
}

/* ---------- 5.3 condition issue and repair (FR-09, FR-10) ---------- */
// The routing comes from the category: biologist when animal welfare can be affected (always, or only while in use), workshop/VIC when configured.
function routingFor(it) {
  const c = catOf(it), inUse = it.status === 'inuse' || locOf(it.loc)?.kind === 'enclosure';
  return { bio: c.bio === 'always' || (c.bio === 'inuse' && inUse), tech: !!c.tech };
}
function openRepair(it, byId, o) {
  const r = routingFor(it);
  it.repair = { id: nextId('RP'), issue: o.issue, notes: o.notes || '', photos: o.photos || [], opened: NOW, by: byId, prev: o.prev || it.status,
    needBio: r.bio, needTech: r.tech, bio: r.bio ? 'pending' : 'notreq', bioBy: '', bioAt: '', bioNote: '', tech: r.tech ? 'pending' : 'notreq', techBy: '', techAt: '', techNote: '',
    state: 'assessment', started: '', done: null };
  it.status = 'assessment';
  log(it, byId, 'Assessment requested', { note: [r.bio ? 'Animal-use check: biologist' : '', r.tech ? 'Repairability: workshop / VIC' : ''].filter(Boolean).join(' · ') || 'Custodian decides' });
}
// flagIssue(itemId, by, {issue, cond, notes, photos})
function flagIssue(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'flag', ['bio', 'ws'].includes(person(byId).role) ? null : it);
  if (!MOVABLE.includes(it.status)) fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be flagged.`);
  need(o.issue, 'Pick the issue type.');
  if (!['needsrepair', 'damaged', 'unsafe'].includes(o.cond)) fail('Pick the condition.');
  const cats = catOf(it).req?.repair || [];
  if (cats.includes('photo')) need(o.photos, 'Add a photo of the issue.');
  if (cats.includes('notes')) need(o.notes, 'Write notes about the issue.');
  const prev = it.status, prevCond = it.cond;
  it.cond = o.cond;
  log(it, byId, 'Condition flagged', { from: COND[prevCond], to: COND[it.cond], note: o.issue + (o.notes ? ' · ' + o.notes : '') });
  openRepair(it, byId, { issue: o.issue, notes: o.notes, photos: o.photos, prev });
  (o.photos || []).forEach(p => it.photos.push(p));
  return it.repair.id;
}
function verifyAnimalUse(itemId, byId, result, note) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'verifyBio');
  const r = it.repair; if (!r || r.state !== 'assessment' || r.bio !== 'pending') fail('No animal-use check is waiting for this item.');
  if (!['suitable', 'unsuitable'].includes(result)) fail('Pick suitable or unsuitable.');
  if (result === 'unsuitable') need(note, 'Write why the item is unsuitable.');
  Object.assign(r, { bio: result, bioBy: byId, bioAt: NOW, bioNote: note || '' });
  if (result === 'unsuitable' && it.cond !== 'beyond') { const p = it.cond; it.cond = 'unsafe'; if (p !== 'unsafe') log(it, byId, 'Condition changed', { from: COND[p], to: COND.unsafe }); }
  log(it, byId, 'Animal use verified', { to: result === 'suitable' ? 'Suitable' : 'Unsuitable', note });
  settle(it, byId);
}
function assessRepair(itemId, byId, result, note) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'assessTech');
  const r = it.repair; if (!r || r.state !== 'assessment' || r.tech !== 'pending') fail('No repairability check is waiting for this item.');
  if (!['repairable', 'beyond'].includes(result)) fail('Pick repairable or beyond repair.');
  need(note, 'Write the assessment.');
  Object.assign(r, { tech: result, techBy: byId, techAt: NOW, techNote: note });
  if (result === 'beyond') { const p = it.cond; it.cond = 'beyond'; log(it, byId, 'Condition changed', { from: COND[p], to: COND.beyond }); }
  log(it, byId, 'Repairability assessed', { to: result === 'repairable' ? 'Repairable' : 'Beyond repair', note });
  settle(it, byId);
}
// settle — when every routed check is in: beyond repair waits for a disposal request; repairable (or unsuitable) waits for repair; suitable alone clears the item.
function settle(it, byId) {
  const r = it.repair;
  if (r.bio === 'pending' || r.tech === 'pending') return;
  if (!r.needBio && !r.needTech) return;
  if (r.tech === 'beyond') { r.state = 'beyond'; return; }
  if (r.tech === 'repairable' || r.bio === 'unsuitable') { r.state = 'approved'; return; }
  clearItem(it, byId, 'Cleared after verification');
}
function clearItem(it, byId, note) {
  const r = it.repair; r.state = 'cleared'; r.done = { at: NOW, by: byId, notes: note };
  const p = it.cond; it.cond = 'good';
  it.status = r.prev; it.lastVerified = day(NOW);
  if (p !== 'good') log(it, byId, 'Condition changed', { from: COND[p], to: COND.good });
  log(it, byId, 'Status changed', { from: STATUS.assessment, to: STATUS[it.status], note });
  it.repair = null; (it.repairs = it.repairs || []).unshift(r);
}
// decide(itemId, by, outcome) — when the category routes to nobody, the custodian decides: repair · clear · beyond.
function decide(itemId, byId, outcome, note) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'decide', it);
  const r = it.repair; if (!r || r.state !== 'assessment') fail('Nothing to decide for this item.');
  if (r.bio === 'pending' || r.tech === 'pending') fail('Wait for the routed checks.');
  if (outcome === 'clear') { if (it.cond === 'unsafe') fail('An unsafe item cannot be cleared without repair.'); clearItem(it, byId, note || 'Cleared by custodian'); return; }
  if (outcome === 'repair') { r.state = 'approved'; log(it, byId, 'Repair approved', { note }); return; }
  if (outcome === 'beyond') { r.state = 'beyond'; const p = it.cond; it.cond = 'beyond'; log(it, byId, 'Condition changed', { from: COND[p], to: COND.beyond, note }); return; }
  fail('Pick an outcome.');
}
function startRepair(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'repairStart', person(byId).role === 'ws' ? null : it);
  const r = it.repair; if (!r || r.state !== 'approved') fail('The repair is not approved.');
  r.state = 'repair'; r.started = NOW; r.team = o.team || 'Workshop';
  it.status = 'repair';
  log(it, byId, 'Status changed', { from: STATUS.assessment, to: STATUS.repair, note: 'Repair started · ' + r.team });
}
// completeRepair(itemId, by, {date, notes, team, to, photos}) — the item returns to a valid location and status.
function completeRepair(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'repairDone', person(byId).role === 'ws' ? null : it);
  const r = it.repair; if (!r || r.state !== 'repair') fail('The item is not under repair.');
  need(o.notes, 'Write what was repaired.'); need(o.team, 'Pick the responsible team.');
  const to = locOf(need(o.to, 'Pick where the item returns.')) || fail('Pick where the item returns.');
  if (to.site !== it.site) fail('Pick a location at this site.');
  const from = where(it);
  r.state = 'done'; r.done = { at: NOW, by: byId, date: o.date || day(NOW), notes: o.notes, team: o.team, photos: o.photos || [] };
  const p = it.cond; it.cond = 'good'; it.loc = to.id; it.section = to.section; it.lastVerified = day(NOW);
  it.status = to.kind === 'enclosure' ? 'inuse' : to.kind === 'store' ? 'storage' : 'available';
  (o.photos || []).forEach(x => it.photos.push(x));
  log(it, byId, 'Repair completed', { note: o.team + ' · ' + o.notes });
  if (p !== 'good') log(it, byId, 'Condition changed', { from: COND[p], to: COND.good });
  if (from !== where(it)) log(it, byId, 'Moved', { from, to: where(it), note: 'Returned after repair' });
  log(it, byId, 'Status changed', { from: STATUS.repair, to: STATUS[it.status] });
  it.repair = null; (it.repairs = it.repairs || []).unshift(r);
}

/* ---------- 5.4 transfer (FR-11) ---------- */
// transfer(itemId, by, {site, section, receiver, ref, date, note}) — In transit until the receiving custodian acknowledges.
function transfer(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'transfer', it);
  if (!MOVABLE.includes(it.status)) fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be transferred.`);
  if (it.disposal) fail('This item has an open disposal request.');
  const sec = sectionOf(need(o.section, 'Pick the receiving section.')) || fail('Pick the receiving section.');
  if (sec.id === it.section) fail('Pick a different section. Use Move inside a section.');
  const rec = person(need(o.receiver, 'Pick the receiving custodian.'));
  if (!rec || !(rec.role === 'sup' ? rec.sections.includes(sec.id) : rec.role === 'afm' && rec.sites.includes(sec.site))) fail('The receiver must be a custodian of the receiving section.');
  if ((catOf(it).req?.transfer || []).includes('ref')) need(o.ref, 'Enter the material-transfer reference.');
  const tr = { id: nextId('TR'), from: { site: it.site, section: it.section, loc: it.loc, custodian: it.custodian, status: it.status },
    to: { site: sec.site, section: sec.id, custodian: rec.id }, ref: o.ref || '', dispatched: o.date ? o.date + NOW.slice(10) : NOW, by: byId, note: o.note || '', ack: null, exception: null };
  const from = where(it);
  it.transfer = tr; it.status = 'transit';
  if (o.ref) it.mt = o.ref;
  log(it, byId, 'Transfer dispatched', { from, to: `${sec.name}, ${siteOf(sec.site).name} · ${rec.name}`, ref: tr.ref, note: o.note });
  return tr.id;
}
// acknowledge(itemId, by, {loc, cond}) — only the intended receiver (or the AFM of the receiving site) completes a transfer.
function acknowledge(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  const tr = it.transfer; if (!tr || it.status !== 'transit') fail('This item is not in transit.');
  const p = person(byId);
  if (!(p.id === tr.to.custodian || (p.role === 'afm' && p.sites.includes(tr.to.site)))) fail('Only the receiving custodian can acknowledge receipt.');
  arrive(it, byId, o, null);
}
// completeWithoutAck(itemId, by, reason, {loc}) — an authorised exception, recorded with its reason (PRD §8).
function completeWithoutAck(itemId, byId, reason, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'transferException');
  if (!it.transfer || it.status !== 'transit') fail('This item is not in transit.');
  need(reason, 'Write the reason for the exception.');
  arrive(it, byId, o, reason);
}
function arrive(it, byId, o, exception) {
  const tr = it.transfer;
  const loc = locOf(need(o.loc, 'Pick the receiving location.')) || fail('Pick the receiving location.');
  if (loc.section !== tr.to.section) fail('Pick a location in the receiving section.');
  const cond = o.cond || 'good';
  tr.ack = { at: NOW, by: byId, loc: loc.id, cond }; tr.exception = exception;
  it.site = tr.to.site; it.section = tr.to.section; it.loc = loc.id; it.custodian = tr.to.custodian;
  it.status = loc.kind === 'enclosure' ? 'inuse' : loc.kind === 'store' ? 'storage' : 'available';
  const pc = it.cond; it.cond = cond; it.lastVerified = day(NOW);
  log(it, byId, exception ? 'Transfer completed by exception' : 'Transfer received', { from: 'In transit', to: where(it), ref: tr.ref, note: exception || '' });
  if (pc !== cond) log(it, byId, 'Condition changed', { from: COND[pc], to: COND[cond], note: 'On arrival' });
  log(it, byId, 'Custodian changed', { from: person(tr.from.custodian).name, to: person(tr.to.custodian).name });
  (it.transfers = it.transfers || []).unshift(tr); it.transfer = null;
  if (cond !== 'good') { it.status = 'available'; openRepair(it, byId, { issue: 'Damaged on arrival', prev: loc.kind === 'store' ? 'storage' : 'available' }); }
}

/* ---------- 5.5 retirement, disposal and scrap (FR-07, FR-08) ---------- */
function deleteItem(itemId) { fail('A tracked item cannot be deleted. Request disposal instead.'); }
// requestDisposal(itemId, by, {reason, cond, notes, photos, approver, expedited})
function requestDisposal(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'dispose', it);
  if (!isActive(it) || it.status === 'transit') fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be disposed of.`);
  if (it.disposal) fail('This item already has an open disposal request.');
  need(o.reason, 'Pick the reason.');
  if (!COND[o.cond]) fail('Pick the condition.');
  const req = catOf(it).req?.disposal || [];
  if (req.includes('photo') || o.expedited) need(o.photos, 'Add a photo as evidence.');
  if (req.includes('notes')) need(o.notes, 'Write the condition details.');
  const ap = person(need(o.approver, 'Pick the approver.'));
  if (!ap || !CAN.approve.includes(ap.role)) fail('The approver must be an authorised approver.');
  const c = catOf(it);
  const d = { id: nextId('DR'), item: it.id, reason: o.reason, cond: o.cond, notes: o.notes || '', photos: o.photos || [], approver: ap.id, expedited: !!o.expedited,
    needBio: c.bio !== 'never', needTech: !!c.tech, bio: null, tech: null, state: 'validation', by: byId, at: NOW, decision: null, outcome: '', completed: null, history: [] };
  if (!d.needBio && !d.needTech) d.state = 'approval';
  D.disposals.push(d); it.disposal = d.id;
  if (it.cond !== o.cond) { const p = it.cond; it.cond = o.cond; log(it, byId, 'Condition changed', { from: COND[p], to: COND[o.cond] }); }
  (o.photos || []).forEach(x => it.photos.push(x));
  log(it, byId, 'Disposal requested', { ref: d.id, note: o.reason + (o.expedited ? ' · Expedited' : '') });
  return d.id;
}
const disposalOf = id => by('disposals', id);
// validateDisposal(dId, by, kind 'bio'|'tech', agree, note) — validation only; the approver decides.
function validateDisposal(dId, byId, kind, agree, note) {
  const d = disposalOf(dId) || fail('Request not found.');
  if (d.state !== 'validation' && !(d.expedited && d.state === 'approved')) fail('This request is not waiting for validation.');
  must(byId, kind === 'bio' ? 'validateBio' : 'validateTech');
  if (kind === 'bio' ? !d.needBio : !d.needTech) fail('This validation is not required.');
  if (d[kind]) fail('This validation is already recorded.');
  if (!agree) need(note, 'Write why you do not agree.');
  d[kind] = { agree: !!agree, by: byId, at: NOW, note: note || '' };
  const it = itemOf(d.item);
  log(it, byId, kind === 'bio' ? 'Disposal validated (animal use)' : 'Disposal validated (repairability)', { to: agree ? 'Agrees' : 'Does not agree', ref: d.id, note });
  if ((!d.needBio || d.bio) && (!d.needTech || d.tech) && d.state === 'validation') d.state = 'approval';
}
// approveDisposal — waits for every required validation, except on the expedited route, which needs photo evidence (PRD §14).
function approveDisposal(dId, byId, note) {
  const d = disposalOf(dId) || fail('Request not found.');
  must(byId, 'approve');
  if (!['validation', 'approval'].includes(d.state)) fail('This request is not waiting for approval.');
  if (d.state === 'validation' && !d.expedited) fail('Wait for the required validations.');
  d.state = 'approved'; d.decision = { by: byId, at: NOW, note: note || '', approved: true };
  log(itemOf(d.item), byId, 'Disposal approved', { ref: d.id, note: [note, d.expedited && (d.needBio && !d.bio || d.needTech && !d.tech) ? 'Expedited before validation' : ''].filter(Boolean).join(' · ') });
}
// rejectDisposal — back to the custodian with comments; the item stays in the active register.
function rejectDisposal(dId, byId, note) {
  const d = disposalOf(dId) || fail('Request not found.');
  must(byId, 'approve');
  if (!['validation', 'approval'].includes(d.state)) fail('This request is not waiting for approval.');
  need(note, 'Write the comments for the custodian.');
  d.state = 'rejected'; d.decision = { by: byId, at: NOW, note, approved: false };
  const it = itemOf(d.item); it.disposal = null;
  log(it, byId, 'Disposal rejected', { ref: d.id, note });
}
// completeDisposal(dId, by, {outcome, date, note}) — the record is kept as Retired / disposed or Scrapped, never deleted.
function completeDisposal(dId, byId, o = {}) {
  const d = disposalOf(dId) || fail('Request not found.');
  const it = itemOf(d.item);
  must(byId, 'completeDisposal', it);
  if (d.state !== 'approved') fail('The request is not approved.');
  if (d.needBio && !d.bio || d.needTech && !d.tech) fail('Record the required validations first.');
  if (!DISPOSITION[o.outcome]) fail('Pick the final disposition.');
  d.state = 'completed'; d.outcome = o.outcome; d.completed = { at: NOW, by: byId, date: o.date || day(NOW), note: o.note || '' };
  const from = STATUS[it.status];
  it.status = o.outcome === 'scrapped' ? 'scrapped' : 'retired'; it.final = o.outcome; it.disposal = null;
  if (it.repair) { it.repair.state = 'closed'; (it.repairs = it.repairs || []).unshift(it.repair); it.repair = null; }
  log(it, byId, 'Disposal completed', { from, to: DISPOSITION[o.outcome], ref: d.id, note: o.note });
}

/* ---------- 5.6 periodic audit (FR-12) ---------- */
function createAudit(byId, o = {}) {
  must(byId, 'auditCreate');
  const site = siteOf(need(o.site, 'Pick the site.')) || fail('Pick the site.');
  need(o.period, 'Pick the period.'); need(o.due, 'Pick the due date.');
  if (D.audits.some(a => a.site === site.id && a.state !== 'closed')) fail('This site already has an open audit.');
  const a = { id: nextId('AU'), site: site.id, period: o.period, due: o.due, auditor: o.auditor || byId, state: 'scheduled', created: NOW, by: byId,
    lines: D.items.filter(i => i.site === site.id && isActive(i) && i.status !== 'transit').map(i => ({ item: i.id,
      expected: { loc: i.loc, custodian: i.custodian, status: i.status, cond: i.cond }, outcome: null, at: '', by: '', note: '', foundLoc: '', exc: null })),
    closed: null };
  D.audits.push(a);
  return a.id;
}
const auditOf = id => by('audits', id);
const lineOf = (a, itemId) => a.lines.find(l => l.item === itemId) || fail('This item is not on the audit list.');
// recordAudit(aId, itemId, by, outcome, {loc, note}) — changes made during an audit update the item history.
function recordAudit(aId, itemId, byId, outcome, o = {}) {
  const a = auditOf(aId) || fail('Audit not found.');
  if (a.state === 'closed') fail('This audit is closed.');
  const it = itemOf(itemId);
  must(byId, 'auditRecord', it);
  if (!AUDIT_OUT[outcome]) fail('Pick an outcome.');
  const l = lineOf(a, itemId);
  if (l.outcome) fail('This item is already checked.');
  if (outcome === 'locmismatch') { const f = locOf(need(o.loc, 'Pick where the item was found.')); if (!f || f.site !== a.site) fail('Pick a location at this site.'); if (f.id === it.loc) fail('This is the recorded location.'); }
  if (['condmismatch', 'action'].includes(outcome)) need(o.note, 'Write what you found.');
  Object.assign(l, { outcome, at: NOW, by: byId, note: o.note || '', foundLoc: o.loc || '' });
  a.state = 'open';
  if (outcome === 'verified') { it.lastVerified = day(NOW); log(it, byId, 'Audit verified', { ref: a.id }); }
  if (outcome === 'locmismatch') {
    const from = where(it), f = locOf(o.loc); it.loc = f.id; it.section = f.section; it.lastVerified = day(NOW);
    if (MOVABLE.includes(it.status)) it.status = f.kind === 'enclosure' ? 'inuse' : f.kind === 'store' ? 'storage' : 'available';
    log(it, byId, 'Location corrected in audit', { from, to: where(it), ref: a.id, note: o.note });
  }
  if (outcome === 'notfound') { l.prevStatus = it.status; const p = it.status; it.status = 'missing'; log(it, byId, 'Marked missing', { from: STATUS[p], to: STATUS.missing, ref: a.id, note: o.note }); }
  if (outcome === 'condmismatch' || outcome === 'action') log(it, byId, 'Audit exception', { to: AUDIT_OUT[outcome], ref: a.id, note: o.note });
}
// assignException(aId, itemId, by, {to, due}) — every exception has a responsible custodian and a due date.
function assignException(aId, itemId, byId, o = {}) {
  const a = auditOf(aId) || fail('Audit not found.');
  must(byId, 'auditAssign');
  const l = lineOf(a, itemId);
  if (!l.outcome || l.outcome === 'verified') fail('Only an exception can be assigned.');
  need(o.to, 'Pick the responsible custodian.'); need(o.due, 'Pick the due date.');
  l.exc = { to: o.to, due: o.due, by: byId, at: NOW, resolved: null };
  log(itemOf(itemId), byId, 'Exception assigned', { to: person(o.to).name, ref: a.id, note: 'Due ' + o.due });
}
// resolveException(aId, itemId, by, {note, loc}) — a missing item found again returns to its status at a location.
function resolveException(aId, itemId, byId, o = {}) {
  const a = auditOf(aId) || fail('Audit not found.');
  const l = lineOf(a, itemId);
  if (!l.exc) fail('Assign the exception first.');
  if (l.exc.resolved) fail('This exception is already resolved.');
  const p = person(byId);
  if (!(p.id === l.exc.to || CAN.auditAssign.includes(p.role))) fail('Only the assigned custodian can resolve this exception.');
  need(o.note, 'Write the resolution.');
  const it = itemOf(itemId);
  if (it.status === 'missing' && o.loc) {
    const f = locOf(o.loc); if (!f || f.site !== it.site) fail('Pick a location at this site.');
    it.loc = f.id; it.section = f.section; it.status = f.kind === 'enclosure' ? 'inuse' : f.kind === 'store' ? 'storage' : 'available'; it.lastVerified = day(NOW);
    log(it, byId, 'Found', { from: STATUS.missing, to: where(it), ref: a.id, note: o.note });
  } else log(it, byId, 'Exception resolved', { ref: a.id, note: o.note });
  l.exc.resolved = { at: NOW, by: byId, note: o.note };
}
// closeAudit — every item checked and every exception assigned; only an authorised role closes.
function closeAudit(aId, byId) {
  const a = auditOf(aId) || fail('Audit not found.');
  must(byId, 'auditClose');
  if (a.state === 'closed') fail('This audit is already closed.');
  const left = a.lines.filter(l => !l.outcome).length;
  if (left) fail(`${left} item${left === 1 ? ' is' : 's are'} not checked yet.`);
  const un = a.lines.filter(l => l.outcome !== 'verified' && !l.exc).length;
  if (un) fail(`${un} exception${un === 1 ? ' is' : 's are'} not assigned yet.`);
  a.state = 'closed'; a.closed = { at: NOW, by: byId };
}
function auditStats(a) {
  const n = a.lines.length, checked = a.lines.filter(l => l.outcome).length, exc = a.lines.filter(l => l.outcome && l.outcome !== 'verified');
  return { n, checked, verified: checked - exc.length, exceptions: exc.length, unassigned: exc.filter(l => !l.exc).length, open: exc.filter(l => l.exc && !l.exc.resolved).length,
    pct: n ? Math.round(checked / n * 100) : 0, accuracy: checked ? Math.round((checked - exc.length) / checked * 100) : null };
}

/* ---------- labels (FR-14, Phase 4): individual records of a labelled category ---------- */
function labelable(it) { return isActive(it) && it.mode === 'individual' && catOf(it).qr !== 'none'; }
function printLabels(byId, ids) {
  need(ids, 'Add one item or more.');
  const its = ids.map(id => itemOf(id) || fail('Item not found.'));
  its.forEach(it => { must(byId, 'labels', it); if (!labelable(it)) fail(`${it.id} does not take a label.`); });
  its.forEach(it => { it.labelled = NOW; log(it, byId, 'Label printed', { ref: it.id }); });
  return its.length;
}

/* ---------- tasks: My work (what each role has to act on) ---------- */
function tasks(byId) {
  const p = person(byId), all = p.role === 'admin', out = [];
  const add = (t) => out.push(Object.assign({ late: !!(t.due && day(NOW) > t.due) }, t));
  const mine = it => all || scoped(p, it) && (p.role !== 'sup' || it.custodian === p.id || p.sections.includes(it.section));
  if (all || ['sup', 'afm'].includes(p.role)) D.tickets.filter(t => t.status === 'dispatched').forEach(t => {
    const sec = sectionOf(t.section); if (all || scoped(p, { section: t.section, site: sec.site })) add({ kind: 'receipt', label: 'Confirm receipt', title: t.name, ref: t.id, due: addDays(t.dispatched, D.config.receiptDays), href: '#/receive/' + t.id, meta: [`${t.qty} × ${by('categories', t.cat).code}`, sec.name] });
  });
  D.items.forEach(it => {
    const r = it.repair, d = it.disposal && disposalOf(it.disposal);
    if (it.status === 'transit' && (all || it.transfer.to.custodian === p.id || p.role === 'afm' && p.sites.includes(it.transfer.to.site)))
      add({ kind: 'transfer', label: 'Acknowledge', title: it.name, ref: it.id, due: addDays(it.transfer.dispatched, 2), href: '#/item/' + it.id, meta: ['From ' + sectionOf(it.transfer.from.section).name, it.transfer.ref] });
    if (r && r.state === 'assessment') {
      if (r.bio === 'pending' && (all || p.role === 'bio')) add({ kind: 'bio', label: 'Verify animal use', title: it.name, ref: it.id, due: addDays(r.opened, D.config.assessDays), href: '#/item/' + it.id, meta: [r.issue, where(it)] });
      if (r.tech === 'pending' && (all || p.role === 'ws')) add({ kind: 'tech', label: 'Assess repair', title: it.name, ref: it.id, due: addDays(r.opened, D.config.assessDays), href: '#/item/' + it.id, meta: [r.issue, where(it)] });
      if (!r.needBio && !r.needTech && mine(it) && ['sup', 'afm', 'admin'].includes(p.role)) add({ kind: 'decide', label: 'Decide outcome', title: it.name, ref: it.id, due: addDays(r.opened, D.config.assessDays), href: '#/item/' + it.id, meta: [r.issue, where(it)] });
    }
    if (r && r.state === 'approved' && (mine(it) && ['sup', 'afm', 'admin'].includes(p.role) || p.role === 'ws')) add({ kind: 'repair', label: 'Start repair', title: it.name, ref: it.id, href: '#/item/' + it.id, meta: [r.issue, where(it)] });
    if (r && r.state === 'repair' && (mine(it) && ['sup', 'admin'].includes(p.role) || p.role === 'ws')) add({ kind: 'repair', label: 'Complete repair', title: it.name, ref: it.id, due: addDays(r.started, D.config.repairDays), href: '#/repair-done/' + it.id, meta: [r.team, where(it)] });
    if (r && r.state === 'beyond' && !it.disposal && mine(it) && ['sup', 'afm', 'admin'].includes(p.role)) add({ kind: 'dispose', label: 'Request disposal', title: it.name, ref: it.id, href: '#/dispose/' + it.id, meta: ['Beyond repair', where(it)] });
    if (d) {
      if (['validation', 'approved'].includes(d.state) && d.needBio && !d.bio && (all || p.role === 'bio')) add({ kind: 'dbio', label: 'Validate', title: it.name, ref: d.id, due: addDays(d.at, D.config.assessDays), href: '#/disposal/' + d.id, meta: ['Disposal', d.reason] });
      if (['validation', 'approved'].includes(d.state) && d.needTech && !d.tech && (all || p.role === 'ws')) add({ kind: 'dtech', label: 'Validate', title: it.name, ref: d.id, due: addDays(d.at, D.config.assessDays), href: '#/disposal/' + d.id, meta: ['Disposal', d.reason] });
      if ((d.state === 'approval' || d.state === 'validation' && d.expedited) && (all || d.approver === p.id)) add({ kind: 'approve', label: 'Review', title: it.name, ref: d.id, due: addDays(d.at, D.config.approveDays), href: '#/disposal/' + d.id, meta: ['Disposal', d.reason] });
      if (d.state === 'approved' && mine(it) && ['sup', 'afm', 'admin'].includes(p.role)) add({ kind: 'complete', label: 'Complete disposal', title: it.name, ref: d.id, href: '#/disposal/' + d.id, meta: ['Approved', d.reason] });
    }
  });
  D.audits.filter(a => a.state !== 'closed').forEach(a => {
    a.lines.filter(l => l.exc && !l.exc.resolved && (all || l.exc.to === p.id)).forEach(l => add({ kind: 'exception', label: 'Resolve', title: itemOf(l.item).name, ref: l.item, due: l.exc.due, href: '#/audit/' + a.id, meta: [AUDIT_OUT[l.outcome], a.period] }));
    const s = auditStats(a);
    if ((all || a.auditor === p.id) && s.checked < s.n) add({ kind: 'audit', label: 'Continue', title: `${a.period} audit`, ref: a.id, due: a.due, href: '#/audit/' + a.id, meta: [siteOf(a.site).name, `${s.checked} of ${s.n} checked`] });
    if ((all || p.role === 'afm' && p.sites.includes(a.site)) && s.unassigned) add({ kind: 'assign', label: 'Assign', title: `${s.unassigned} exception${s.unassigned === 1 ? '' : 's'}`, ref: a.id, due: a.due, href: '#/audit/' + a.id, meta: [a.period, siteOf(a.site).name] });
  });
  return out.sort((x, y) => (y.late - x.late) || String(x.due || '9').localeCompare(String(y.due || '9')));
}

/* ---------- notifications (PRD §10) ---------- */
function notifications(byId) {
  const p = person(byId), out = [], at = (it) => p.role === 'admin' || ['mgmt', 'bio', 'ws'].includes(p.role) || scoped(p, it);
  D.tickets.filter(t => t.status === 'dispatched' && daysBetween(t.dispatched, NOW) > D.config.receiptDays).forEach(t =>
    at({ section: t.section, site: sectionOf(t.section).site }) && out.push({ kind: 'receipt', title: 'Receipt pending', text: `${t.name} · ${t.id} · ${daysBetween(t.dispatched, NOW)} days`, href: '#/receive/' + t.id, at: t.dispatched }));
  D.items.forEach(it => {
    if (it.status === 'transit' && at(it) || it.status === 'transit' && it.transfer.to.custodian === p.id) out.push({ kind: 'transfer', title: 'Transfer awaiting acknowledgement', text: `${it.name} · ${it.id} · ${daysBetween(it.transfer.dispatched, NOW)} days`, href: '#/item/' + it.id, at: it.transfer.dispatched });
    const r = it.repair;
    if (r && r.state === 'assessment' && daysBetween(r.opened, NOW) > D.config.assessDays && at(it)) out.push({ kind: 'repair', title: 'Assessment overdue', text: `${it.name} · ${it.id} · ${daysBetween(r.opened, NOW)} days`, href: '#/item/' + it.id, at: r.opened });
    if (r && r.state === 'repair' && daysBetween(r.started, NOW) > D.config.repairDays && at(it)) out.push({ kind: 'repair', title: 'Repair completion overdue', text: `${it.name} · ${it.id} · ${daysBetween(r.started, NOW)} days`, href: '#/item/' + it.id, at: r.started });
    if (it.status === 'missing' && at(it)) out.push({ kind: 'missing', title: 'Item missing', text: `${it.name} · ${it.id} · ${where(it)}`, href: '#/item/' + it.id, at: it.history[0].at });
  });
  D.disposals.filter(d => ['validation', 'approval'].includes(d.state)).forEach(d => {
    const it = itemOf(d.item), wait = d.state === 'approval' ? person(d.approver).name : [d.needBio && !d.bio ? 'Biologist' : '', d.needTech && !d.tech ? 'Workshop / VIC' : ''].filter(Boolean).join(' and ');
    if (at(it)) out.push({ kind: 'disposal', title: 'Disposal awaiting ' + (d.state === 'approval' ? 'approval' : 'validation'), text: `${it.name} · ${d.id} · ${wait}`, href: '#/disposal/' + d.id, at: d.at });
  });
  D.audits.forEach(a => {
    if (a.state !== 'closed' && daysBetween(NOW, a.due) <= 14 && (p.role !== 'sup' || p.sites.includes(a.site))) out.push({ kind: 'audit', title: 'Periodic audit due', text: `${a.period} · ${siteOf(a.site).name} · due ${a.due}`, href: '#/audit/' + a.id, at: a.created });
    a.lines.filter(l => l.exc && !l.exc.resolved && day(NOW) > l.exc.due).forEach(l => out.push({ kind: 'exception', title: 'Audit exception unresolved', text: `${itemOf(l.item).name} · due ${l.exc.due}`, href: '#/audit/' + a.id, at: l.exc.at }));
  });
  return out.sort((x, y) => String(y.at).localeCompare(String(x.at)));
}

/* ---------- reports (PRD §10, FR-13) ---------- */
function report(o = {}) {
  const items = D.items.filter(i => (!o.site || i.site === o.site) && (!o.cat || i.cat === o.cat));
  const count = st => items.filter(i => i.status === st).reduce((n, i) => n + (o.units ? i.qty : 1), 0);
  const byStatus = Object.keys(STATUS).map(k => ({ key: k, label: STATUS[k], n: count(k) }));
  const active = items.filter(isActive);
  const repairs = items.filter(i => i.repair).map(i => ({ id: i.id, name: i.name, state: i.repair.state, age: daysBetween(i.repair.opened, NOW), issue: i.repair.issue }));
  const transfers = items.flatMap(i => (i.transfers || []).concat(i.transfer ? [i.transfer] : []).map(t => ({ item: i.id, name: i.name, ...t })));
  const moves = items.reduce((n, i) => n + i.history.filter(h => h.act === 'Moved').length, 0);
  const repaired = items.reduce((n, i) => n + (i.repairs || []).filter(r => r.state === 'done').length, 0);
  const disposals = D.disposals.filter(d => items.some(i => i.id === d.item));
  const lastAudit = D.audits.filter(a => (!o.site || a.site === o.site) && a.state === 'closed').sort((a, b) => b.closed.at.localeCompare(a.closed.at))[0];
  return {
    byStatus, active: active.length, total: items.length,
    storage: items.filter(i => i.status === 'storage' || i.status === 'available'),
    repairs, transfers, moves, repaired, reused: transfers.filter(t => t.ack).length,
    missing: items.filter(i => i.status === 'missing'),
    exceptions: D.audits.flatMap(a => a.lines.filter(l => l.outcome && l.outcome !== 'verified' && (!l.exc || !l.exc.resolved)).map(l => ({ audit: a.id, ...l }))),
    disposals, compliance: disposals.filter(d => d.state === 'completed').length
      ? Math.round(disposals.filter(d => d.state === 'completed' && d.reason && (!d.needBio || d.bio) && (!d.needTech || d.tech) && d.decision?.approved).length / disposals.filter(d => d.state === 'completed').length * 100) : null,
    accuracy: lastAudit ? auditStats(lastAudit).accuracy : null,
    coverage: D.config.target ? Math.round(active.length / D.config.target * 100) : null,
  };
}
