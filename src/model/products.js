// src/model/products.js — Enrichments Phase 1: the site's enrichment products and the request workflow around them. No DOM.
// A physical item is a record of the item register (model.js); this file adds no second inventory. It adds:
//   · product definitions (D.products): one per kind of product, with its enrichment type (ACT_TYPE in activity.js), category
//     (and so its tracking mode), material and default usable life; each item points to its product (item.product);
//   · requests: existing product · new product proposal · same-site movement · inter-site transfer,
//     with the agreed statuses Draft → Pending approval → Approved | Rejected → Completed;
//   · custodian reassignment (direct, no approval), written to the item history;
//   · in-app notifications, merged into notifications() of model.js.
// Approval of a movement calls move() of model.js as the approver. A transfer has three steps (Phase 2): approval records the
// decision, dispatch calls transfer() (In transit), and the receiver's acknowledge() completes the request. Every PRD rule applies.
// Loaded after model.js, work.js and activity.js. Rules that need confirmation are listed in docs/WORKFLOWS.md §12.

const REQ_STATE = { draft: 'Draft', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' };
const REQ_KIND = { existing: 'Product request', proposal: 'New product', move: 'Movement', transfer: 'Transfer' };

// biologists request; the supervisor of the section or the site manager (the site-scoped AFM role) reviews; custodian change is direct
Object.assign(CAN, { prodRequest: ['bio'], prodReview: ['sup', 'afm', 'admin'], prodCustodian: ['bio', 'sup', 'afm', 'admin'] });

const EN = () => D.enr || (D.enr = { requests: [], events: [] });
const prodOf = id => (D.products || []).find(p => p.id === id);
const productOf = it => (it && it.product && prodOf(it.product)) || null;
const productType = it => (productOf(it) || {}).type || '';
// the enrichment items: every record that belongs to a product definition (active only; enrItems(true) adds retired ones)
const enrItems = (all = false) => D.items.filter(it => (all || isActive(it)) && productOf(it));
const enrProducts = () => enrItems();
const ereqOf = id => EN().requests.find(r => r.id === id);
const reqTitle = r => r.kind === 'proposal' ? r.name : (itemOf(r.item) || {}).name || '';

/* ---------- associations: the enclosure a product is in, and the animals (and so the species) living there ---------- */
function productAssoc(it) {
  const loc = it.status !== 'transit' && locOf(it.loc)?.kind === 'enclosure' ? it.loc : '';
  // the animals the item was assigned to (assignForUse, register.js) while it stays in that enclosure; otherwise all that live there
  const use = it.use && it.use.loc === loc && it.use.animals.length ? it.use.animals : null;
  const animals = loc ? use || A().animals.filter(a => a.loc === loc).map(a => a.id) : [];
  return { loc, animals, species: [...new Set(animals.map(a => animalOf(a).species))] };
}
// the activities that use a product (by name), with their type-specific details
const productActivities = it => A().activities.filter(a => a.state !== 'retired' && a.materials.includes(it.name));

/* ---------- routing: who reviews a request ---------- */
function reviewScope(p, r) {
  if (p.role === 'admin') return true;
  if (p.role === 'afm') return p.sites.includes(r.site);
  if (p.role === 'sup') return !!r.section && p.sections.includes(r.section);
  return false;
}
const reviewersOf = r => D.people.filter(p => ['sup', 'afm'].includes(p.role) && reviewScope(p, r) && p.id !== r.by);
const canReviewReq = (byId, r) => { const p = person(byId); return !!p && CAN.prodReview.includes(p.role) && reviewScope(p, r) && r.by !== byId; };
// people who can hold a product at its site
const custodianChoices = it => D.people.filter(p => ['bio', 'sup', 'afm'].includes(p.role) && p.sites.includes(it.site));
// receivers of a transfer: the rule of transfer() in model.js
const receiversOf = secId => { const s = sectionOf(secId); return s ? D.people.filter(p => (p.role === 'sup' && p.sections.includes(secId)) || (p.role === 'afm' && p.sites.includes(s.site))) : []; };

/* ---------- request fields ---------- */
const trimmed = v => String(v || '').trim();
function shapeRequest(byId, o) {
  if (!REQ_KIND[o.kind]) fail('Pick the request type.');
  const f = { kind: o.kind, reason: trimmed(o.reason), notes: trimmed(o.notes), species: [...(o.species || [])], animals: [...(o.animals || [])], loc: o.loc || '', custodian: o.custodian || byId };
  if (o.kind === 'proposal') {
    const l = f.loc && locOf(f.loc);
    Object.assign(f, { item: '', name: trimmed(o.name), type: o.type || '', description: trimmed(o.description), justification: trimmed(o.justification), details: trimmed(o.details), photos: [...(o.photos || [])],
      site: l ? l.site : o.site || '', section: l ? l.section : '' });
    return f;
  }
  const it = itemOf(need(o.item, 'Pick the product.')) || fail('Product not found.');
  Object.assign(f, { item: it.id, site: it.site, section: it.section });
  if (o.kind === 'existing') f.qty = it.mode === 'individual' ? 1 : +o.qty || 1;
  if (o.kind === 'move') Object.assign(f, { from: it.loc, to: o.to || '', qty: it.mode === 'individual' ? 1 : +o.qty || it.qty });
  if (o.kind === 'transfer') Object.assign(f, { from: it.loc, toSite: o.toSite || '', toSection: o.toSection || '', toLoc: o.toLoc || '', receiver: o.receiver || '', ref: trimmed(o.ref) });
  return f;
}
// a copy of the data for a rule check: the change is thrown away
function dryRun(fn) { const keep = D, now = NOW; useData(JSON.parse(JSON.stringify(D)), now); try { return fn(); } finally { useData(keep, now); } }
function firstReviewer(f) { return (reviewersOf(f)[0] || fail('No supervisor or site manager can review this request.')).id; }

// an open movement or transfer of a product: waiting for approval, or an approved transfer not yet received
const openMoveOf = (itemId, selfId) => EN().requests.find(r => r.id !== selfId && r.item === itemId && ['move', 'transfer'].includes(r.kind) && (r.state === 'pending' || (r.kind === 'transfer' && r.state === 'approved')));
// checkRequest — every rule a request must meet before it goes for approval; selfId: the request being edited or submitted
function checkRequest(byId, f, selfId = '') {
  const p = person(byId);
  if (p.role !== 'admin' && !p.sites.includes(f.site)) fail('Pick a product or location at one of your sites.');
  f.species.forEach(s => speciesOf(s) || fail('Species not found.'));
  f.animals.forEach(a => animalOf(a) || fail('Animal not found.'));
  if (f.loc) { const l = locOf(f.loc); if (!l || l.kind !== 'enclosure') fail('Pick an enclosure.'); if (l.site !== f.site) fail('Pick an enclosure at this site.'); }
  if (!person(f.custodian)) fail('Pick the custodian.');
  if (f.kind === 'proposal') {
    need(f.name, 'Write the product name.');
    if (!ACT_TYPE[f.type]) fail('Pick the enrichment type.');
    need(f.description, 'Write the product description.');
    need(f.justification, 'Write why the product is needed.');
    need(f.site, 'Pick the site.');
    if ((D.products || []).some(p => p.name.toLowerCase() === f.name.toLowerCase())) fail('This product is already in the listing. Request it instead.');
    reviewersOf(f).length || fail('No supervisor or site manager can review this request.');
    return;
  }
  const it = itemOf(f.item);
  if (!isActive(it)) fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be requested.`);
  if (['move', 'transfer'].includes(f.kind) && openMoveOf(it.id, selfId)) fail(`${it.id} already has an open ${REQ_KIND[openMoveOf(it.id, selfId).kind].toLowerCase()} request.`);
  if (f.kind === 'existing' && EN().requests.some(r => r.id !== selfId && r.kind === 'existing' && r.item === it.id && r.by === byId && r.state === 'pending')) fail('You already have a pending request for this product.');
  need(f.reason, f.kind === 'existing' ? 'Write the reason for the request.' : `Write the reason for the ${f.kind === 'move' ? 'movement' : 'transfer'}.`);
  if (f.kind === 'existing') {
    if (['transit', 'missing'].includes(it.status)) fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be requested.`);
    if (it.mode !== 'individual' && (!Number.isInteger(f.qty) || f.qty < 1 || f.qty > it.qty)) fail(`Enter a quantity from 1 to ${it.qty}.`);
    reviewersOf(f).length || fail('No supervisor or site manager can review this request.');
  }
  if (f.kind === 'move') {
    need(f.to, 'Pick the destination.');
    if (locOf(f.to)?.site !== it.site) fail('Pick a destination at this site. Use a transfer for another site.');
    const rv = firstReviewer(f);
    dryRun(() => move(it.id, rv, { to: f.to, reason: f.reason, qty: f.qty }));          // the PRD movement rules decide
  }
  if (f.kind === 'transfer') {
    need(f.toSite, 'Pick the destination site.');
    if (f.toSite === it.site) fail('Pick another site. Use a movement request within this site.');
    const sec = sectionOf(need(f.toSection, 'Pick the destination section.'));
    if (!sec || sec.site !== f.toSite) fail('Pick a section at the destination site.');
    if (f.toLoc && locOf(f.toLoc)?.section !== sec.id) fail('Pick a location in the destination section.');
    need(f.receiver, 'Pick the receiving custodian.');
    const rv = firstReviewer(f);
    dryRun(() => transfer(it.id, rv, { section: f.toSection, receiver: f.receiver, ref: f.ref, note: f.reason }));   // the PRD transfer rules decide
  }
}

/* ---------- lifecycle ---------- */
const mustOwn = (r, byId) => r.by === byId || fail('Only the requester can change this request.');
// createRequest(by, {kind, item | name…, …}, draft) — the requester is the custodian unless another person is picked
function createRequest(byId, o, draft = false) {
  must(byId, 'prodRequest');
  const f = shapeRequest(byId, o);
  if (draft) { if (f.kind === 'proposal') need(f.name, 'Write the product name.'); }
  else checkRequest(byId, f);
  const r = Object.assign({ id: nextId('ER'), state: draft ? 'draft' : 'pending', by: byId, at: NOW, submitted: draft ? '' : NOW, decision: null, completed: null, result: '', log: [] }, f);
  r.log.unshift({ at: NOW, by: byId, act: draft ? 'Draft saved' : 'Submitted' });
  EN().requests.push(r);
  return r.id;
}
// updateRequest — edit a draft, or a request that is still pending (it stays pending)
function updateRequest(id, byId, o) {
  const r = ereqOf(id) || fail('Request not found.');
  mustOwn(r, byId);
  if (!['draft', 'pending'].includes(r.state)) fail('Only a draft or a pending request can be edited.');
  const f = shapeRequest(byId, Object.assign({}, o, { kind: r.kind, item: r.item }));
  if (r.state === 'pending') checkRequest(byId, f, r.id);
  Object.assign(r, f);
  r.log.unshift({ at: NOW, by: byId, act: 'Edited' });
  return r.id;
}
function submitRequest(id, byId) {
  const r = ereqOf(id) || fail('Request not found.');
  mustOwn(r, byId);
  if (r.state !== 'draft') fail('Only a draft can be submitted.');
  const f = shapeRequest(byId, r);
  checkRequest(byId, f, r.id);
  Object.assign(r, f, { state: 'pending', submitted: NOW });
  r.log.unshift({ at: NOW, by: byId, act: 'Submitted' });
  return r.id;
}
// withdraw — a pending request goes back to Draft (no extra status), so it can be edited and sent again
function withdrawRequest(id, byId) {
  const r = ereqOf(id) || fail('Request not found.');
  mustOwn(r, byId);
  if (r.state !== 'pending') fail('Only a pending request can be withdrawn.');
  r.state = 'draft'; r.submitted = '';
  r.log.unshift({ at: NOW, by: byId, act: 'Withdrawn' });
  return r.id;
}
function deleteDraft(id, byId) {
  const r = ereqOf(id) || fail('Request not found.');
  mustOwn(r, byId);
  if (r.state !== 'draft') fail('Only a draft can be deleted.');
  EN().requests.splice(EN().requests.indexOf(r), 1);
}
// revise — a rejected request stays rejected; a new draft starts from it
function reviseRequest(id, byId) {
  const r = ereqOf(id) || fail('Request not found.');
  mustOwn(r, byId);
  if (r.state !== 'rejected') fail('Only a rejected request can be revised.');
  const copy = JSON.parse(JSON.stringify(r));
  Object.assign(copy, { id: nextId('ER'), state: 'draft', at: NOW, submitted: '', decision: null, completed: null, result: '', from: r.id, log: [{ at: NOW, by: byId, act: 'Draft saved', note: 'Revised from ' + r.id }] });
  EN().requests.push(copy);
  return copy.id;
}

/* ---------- review ---------- */
function mustReview(byId, r) {
  if (r.state !== 'pending') fail('This request is not waiting for approval.');
  if (r.by === byId) fail('You cannot review your own request.');
  must(byId, 'prodReview');
  if (!reviewScope(person(byId), r)) fail('This request is routed to another reviewer.');
}
// approveRequest — a movement is done by the approver through move() and the request is Completed at once (Phase 1 rule).
// A transfer is only Approved: the rules of transfer() are checked on a copy, nothing moves until dispatch (Phase 2 decision).
// A product request or a proposal stays Approved: its fulfilment rule is not defined yet.
function approveRequest(id, byId, note = '') {
  const r = ereqOf(id) || fail('Request not found.');
  mustReview(byId, r);
  let result = '';
  if (r.kind === 'move') result = move(r.item, byId, { to: r.to, reason: `${r.reason} · ${r.id}`, qty: r.qty });
  if (r.kind === 'transfer') dryRun(() => transfer(r.item, byId, { section: r.toSection, receiver: r.receiver, ref: r.ref, note: r.reason }));
  r.decision = { approved: true, by: byId, at: NOW, note: trimmed(note) };
  r.state = 'approved'; r.result = result;
  r.log.unshift({ at: NOW, by: byId, act: 'Approved', note: trimmed(note) });
  if (r.kind === 'move') { r.state = 'completed'; r.completed = { at: NOW, by: byId }; r.log.unshift({ at: NOW, by: byId, act: 'Completed', note: '' }); }
  return r.id;
}

/* ---------- transfer: approved → dispatched (In transit) → received (Completed) ---------- */
const transferStage = r => r.kind !== 'transfer' ? '' : r.state === 'completed' ? 'received' : r.state === 'approved' ? (r.result ? 'transit' : 'dispatch') : r.state;
// the sending custodian dispatches: the supervisor of the item's section or the site manager (transfer() permission of model.js)
const canDispatch = (byId, r) => r.kind === 'transfer' && r.state === 'approved' && !r.result && can(byId, 'transfer', itemOf(r.item));
function dispatchTransfer(id, byId, o = {}) {
  const r = ereqOf(id) || fail('Request not found.');
  if (r.kind !== 'transfer') fail('Only a transfer is dispatched.');
  if (r.state !== 'approved') fail(r.state === 'completed' ? 'This transfer is already received.' : 'The transfer is not approved.');
  if (r.result) fail('This transfer is already dispatched.');
  if (o.date && o.date > day(NOW)) fail('The dispatch date cannot be in the future.');
  const ref = trimmed(o.ref) || r.ref;
  r.result = transfer(r.item, byId, { section: r.toSection, receiver: r.receiver, ref, date: o.date || '', note: [trimmed(o.note), r.id].filter(Boolean).join(' · ') });
  r.ref = ref; r.dispatched = { at: NOW, by: byId, date: o.date || day(NOW) };
  r.log.unshift({ at: NOW, by: byId, act: 'Dispatched', note: [r.result, ref, trimmed(o.note)].filter(Boolean).join(' · ') });
  return r.result;
}
// receipt: acknowledge() and completeWithoutAck() of model.js stay the only way an item arrives; any path that completes the
// transfer record (Transfers screen or Enrichments) also completes the request that dispatched it
function closeTransferRequest(trId, byId, exception) {
  const r = EN().requests.find(x => x.kind === 'transfer' && x.state === 'approved' && x.result === trId);
  if (!r) return;
  const it = itemOf(r.item);
  r.state = 'completed'; r.completed = { at: NOW, by: byId };
  r.log.unshift({ at: NOW, by: byId, act: exception ? 'Completed by exception' : 'Received', note: [where(it), exception].filter(Boolean).join(' · ') });
}
const baseAcknowledge = acknowledge, baseCompleteWithoutAck = completeWithoutAck;
acknowledge = function (itemId, byId, o) { const tr = itemOf(itemId)?.transfer; baseAcknowledge(itemId, byId, o); if (tr) closeTransferRequest(tr.id, byId, null); };
completeWithoutAck = function (itemId, byId, reason, o) { const tr = itemOf(itemId)?.transfer; baseCompleteWithoutAck(itemId, byId, reason, o); if (tr) closeTransferRequest(tr.id, byId, reason); };
// rejectRequest — the comment is required and goes back to the requester
function rejectRequest(id, byId, note) {
  const r = ereqOf(id) || fail('Request not found.');
  mustReview(byId, r);
  need(note, 'Write the reason for the rejection.');
  r.decision = { approved: false, by: byId, at: NOW, note: trimmed(note) };
  r.state = 'rejected';
  r.log.unshift({ at: NOW, by: byId, act: 'Rejected', note: trimmed(note) });
  return r.id;
}

/* ---------- custodian: direct reassignment, recorded in the item history ---------- */
function reassignCustodian(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'prodCustodian', it);
  if (!isActive(it) || it.status === 'transit') fail(`The custodian of an item that is ${STATUS[it.status].toLowerCase()} cannot be changed here.`);
  const to = person(need(o.to, 'Pick the new custodian.'));
  if (!to || !custodianChoices(it).some(p => p.id === to.id)) fail('Pick a biologist, supervisor or site manager of this site.');
  if (to.id === it.custodian) fail('This person is already the custodian.');
  const from = it.custodian, act = from ? 'Custodian changed' : 'Custodian assigned';   // '' = awaiting assignment since receipt
  it.custodian = to.id;
  log(it, byId, act, { from: from ? person(from).name : '', to: to.name, note: trimmed(o.note) });
  notifyPeople([to.id, from].filter(x => x && x !== byId), act, `${it.name} · ${it.id} · ${from ? person(from).name + ' → ' : ''}${to.name}`, '#/enrichments/' + it.id);
  return it.id;
}

/* ---------- notifications: pending reviews are worked out from the requests; decisions and custodian changes are stored ---------- */
function notifyPeople(to, title, text, href) { const ids = [...new Set(to)].filter(Boolean); if (ids.length) EN().events.unshift({ at: NOW, to: ids, title, text, href }); }
function requestEvents() {
  // decision events, played from each request's log so an undo of the decision also removes its notification
  // a movement is Completed in the same step as its approval: one notification, not two
  const TITLE = { Approved: 'Request approved', Rejected: 'Request rejected', Completed: 'Movement completed', Dispatched: 'Transfer dispatched', Received: 'Transfer received', 'Completed by exception': 'Transfer completed by exception' };
  return EN().requests.flatMap(r => r.log.filter(l => TITLE[l.act] && !(l.act === 'Approved' && r.kind === 'move')).map(l => ({
    at: l.at, to: [r.by], title: TITLE[l.act],
    text: `${reqTitle(r)} · ${r.id}${l.act === 'Rejected' && l.note ? ' · ' + l.note : ''}`, href: '#/enrreq/' + r.id })));
}
function productNotifications(byId) {
  const since = addDays(day(NOW), -14);
  const waiting = EN().requests.filter(r => r.state === 'pending' && canReviewReq(byId, r)).map(r => ({ kind: 'enr', title: 'Request awaiting approval', text: `${reqTitle(r)} · ${r.id} · ${person(r.by).name}`, href: '#/enrappr/' + r.id, at: r.submitted }));
  const stored = requestEvents().concat(EN().events).filter(e => e.to.includes(byId) && day(e.at) >= since)
    .map(e => ({ kind: 'enr', title: e.title, text: e.text, href: e.href, at: e.at }));
  const dispatch = EN().requests.filter(r => canDispatch(byId, r) && r.by !== byId).map(r => ({ kind: 'enr', title: 'Transfer awaiting dispatch', text: `${reqTitle(r)} · ${r.id} · ${siteNm(r.toSite)}`, href: '#/enrappr/' + r.id, at: r.decision.at }));
  return waiting.concat(dispatch, stored);
}
const siteNm = id => (siteOf(id) || {}).name || '';
const baseNotifications = notifications;
notifications = function (byId) { return baseNotifications(byId).concat(productNotifications(byId)).sort((x, y) => String(y.at).localeCompare(String(x.at))); };

/* ---------- work for a person (merged into My tasks) ---------- */
function productTasks(byId) {
  return EN().requests.filter(r => r.state === 'pending' && canReviewReq(byId, r))
    .map(r => ({ kind: 'prodReview', ref: r.id, due: addDays(day(r.submitted), D.config.approveDays), title: reqTitle(r), meta: [REQ_KIND[r.kind], person(r.by).name] }))
    .concat(EN().requests.filter(r => canDispatch(byId, r)).map(r => ({ kind: 'prodDispatch', ref: r.id, due: addDays(day(r.decision.at), 2), title: reqTitle(r), meta: ['Dispatch transfer', siteNm(r.toSite)] })));
}

/* ---------- lifecycle timeline: the item's own history and the requests about it, nothing else ---------- */
const LC_TYPE = { receipt: 'Receipt', movement: 'Movement', storage: 'Storage', condition: 'Condition', repair: 'Repair', transfer: 'Transfer', custodian: 'Custodian', life: 'Usable life', request: 'Request', other: 'Other' };
const LC_ACT = { Moved: 'movement', 'Quantity split': 'movement', 'Split from batch': 'movement', 'Condition flagged': 'condition', 'Condition changed': 'condition', 'Assessment requested': 'condition',
  'Animal use verified': 'condition', 'Repairability assessed': 'repair', 'Repair approved': 'repair', 'Repair completed': 'repair', 'Transfer dispatched': 'transfer', 'Transfer received': 'transfer',
  'Transfer completed by exception': 'transfer', 'Custodian changed': 'custodian', 'Custodian assigned': 'custodian', Received: 'receipt', Registered: 'receipt',
  'Life reviewed': 'life', 'Usable life changed': 'life' };
function historyType(h) {
  if (h.act !== 'Status changed') return [LC_ACT[h.act] || 'other', h.act];
  if ([h.from, h.to].some(x => x === STATUS.assessment || x === STATUS.repair)) return ['repair', h.act];   // repair steps first: a repair can end in a store
  if (h.to === STATUS.storage) return ['storage', 'Moved to storage'];        // the status change move() writes when an item enters a store
  if (h.from === STATUS.storage) return ['storage', 'Returned to use'];
  return ['other', h.act];
}
// lifecycleEvents(item) — newest first; each event is one stored history entry or one request log entry (submitted, approved,
// rejected, withdrawn). Request steps that also write item history (movement done, dispatch, receipt) appear once, from the history.
function lifecycleEvents(it) {
  const hist = it.history.map((h, i) => { const [type, title] = historyType(h); return { at: h.at, by: h.by, type, title, from: h.from || '', to: h.to || '', note: h.note || '', ref: h.ref || '', k: i }; });
  const reqs = EN().requests.filter(r => r.item === it.id).flatMap((r, j) => r.log.filter(l => ['Submitted', 'Approved', 'Rejected', 'Withdrawn'].includes(l.act)).map((l, i) => ({
    at: l.at, by: l.by, type: r.kind === 'move' ? 'movement' : r.kind === 'transfer' ? 'transfer' : 'request', title: `${r.kind === 'existing' ? 'Product request' : REQ_KIND[r.kind] + ' request'} ${l.act.toLowerCase()}`,
    from: '', to: '', note: l.note || (l.act === 'Submitted' ? r.reason : ''), ref: r.id, k: 1e6 + j * 100 + i })));
  return hist.concat(reqs).sort((x, y) => y.at.localeCompare(x.at) || x.k - y.k);
}

/* ---------- repairs with three roles (owner's decision, 12 Oct): no repairability check ---------- */
// The workshop / VIC role is not in this product. After the biologist's animal-use check (when the category asks for one) the
// custodian decides: repair, clear or beyond repair (decide() of model.js). An item unsuitable for animals still goes to repair.
// D.config.techCheck === false switches this on; it is set after the sample history is played, so the PRD seed is unchanged.
const baseSettle = settle;
settle = function (it, byId) {
  if (D.config.techCheck !== false) return baseSettle(it, byId);
  const r = it.repair;
  if (r.bio === 'pending') return;
  if (r.bio === 'unsuitable') r.state = 'approved';
};
function noRepairCheck() {
  D.config.techCheck = false;
  D.categories.forEach(c => { c.tech = false; });
  // open repairs still waiting for the check go to the custodian instead
  D.items.forEach(it => { const r = it.repair; if (r && r.needTech && r.tech === 'pending') { r.needTech = false; r.tech = 'notreq'; } });
}

/* ---------- demo data (played through the rules above) ---------- */
// The sample register has no product master. The demo builds one definition per product name: the type of the activities that
// use it (SAMPLE_TYPES fills the rest), the category of its records, and a sample material and usable life (SAMPLE_SPEC).
// These are demonstration values only, never rule defaults. Names with no type (transport cages, crates) are equipment and
// get no definition, so they are not listed in Enrichments.
const SAMPLE_TYPES = {
  social: ['Rope climbing net', 'Hanging tyre swing', 'Swing perch', 'Bathing tray', 'Mirror toy', 'Rubbing post'],
  cognitive: ['Treat dispenser', 'Exercise wheel', 'Pool float drum'],
  environmental: ['Climbing frame', 'Wooden platform', 'Nest platform', 'Wooden nest box', 'Log pile', 'Bamboo poles', 'Standard perches', 'Hide log', 'Scratching post', 'Soft hide', 'Recovery perch', 'Heat lamp guard'],
  food: ['Stainless steel feeder', 'Forage box', 'Feeding pole', 'Tyre feeder', 'Browse frame', 'Lick-block holder'],
  sensory: ['Scent box'],
};
// name: [material, usable life in months (0 = not set)]
const SAMPLE_SPEC = {
  'Bamboo poles': ['Bamboo', 0], 'Stainless steel feeder': ['Metal', 24], 'Wooden nest box': ['Wood', 4], 'Puzzle feeder ball': ['Plastic', 6],
  'Climbing frame': ['Wood', 12], 'Boomer ball': ['Plastic', 12], 'Log pile': ['Wood', 3], 'Standard perches': ['Wood', 4], 'Scent box': ['Wood', 3],
  'Fire-hose hammock': ['Fabric', 6], 'Wooden platform': ['Wood', 6], 'Hanging tyre swing': ['Rubber', 12], 'Rope climbing net': ['Rope', 3],
  'Forage box': ['Wood', 6], 'Mirror panel': ['Metal', 12], 'Bamboo foraging tube': ['Bamboo', 2], 'Treat dispenser': ['Plastic', 12], 'Dig box': ['Wood', 6],
  'Hide log': ['Wood', 6], 'Exercise wheel': ['Metal', 24], 'Scatter feeder tray': ['Metal', 12], 'Scratching post': ['Wood', 6], 'Feeding pole': ['Metal', 12],
  'Meat bungee': ['Rubber', 3], 'Pool float drum': ['Plastic', 12], 'Scent sacks': ['Fabric', 1], 'Mirror toy': ['Metal', 12], 'Swing perch': ['Wood', 6],
  'Foraging cup set': ['Plastic', 6], 'Nest platform': ['Wood', 6], 'Bathing tray': ['Metal', 12], 'Hay net': ['Rope', 3], 'Lick-block holder': ['Metal', 24],
  'Rubbing post': ['Wood', 6], 'Tyre feeder': ['Rubber', 12], 'Browse frame': ['Wood', 6], 'Recovery perch': ['Wood', 6], 'Soft hide': ['Fabric', 3], 'Heat lamp guard': ['Metal', 24],
};
function productSeed() {
  const at = setNow, sample = {};
  Object.entries(SAMPLE_TYPES).forEach(([t, names]) => names.forEach(n => { sample[n] = t; }));
  D.config.materials = ['Wood', 'Metal', 'Bamboo', 'Rope', 'Plastic', 'Rubber', 'Fabric'];   // configuration, editable like the categories
  D.config.reviewSoonDays = 30;                                                              // Reminders: life review due soon
  D.products = [];
  [...new Set(D.items.map(i => i.name))].forEach(n => {
    const a = A().activities.find(x => x.materials.includes(n)), t = a ? a.type : sample[n];
    if (!t) return;
    const [material, months] = SAMPLE_SPEC[n] || ['', 0];
    const p = { id: nextId('EP'), name: n, type: t, cat: D.items.find(i => i.name === n).cat, material, description: '', life: months ? { n: months, unit: 'months' } : null,
      log: [{ at: '2026-06-01T09:00', by: 'P-MEERA', act: 'Defined', note: '' }] };
    D.products.push(p);
    D.items.filter(i => i.name === n).forEach(i => { i.product = p.id; });
    D.tickets.filter(tk => tk.name === n).forEach(tk => { tk.product = p.id; });
  });
  const find = (name, ok = () => true) => (D.items.find(i => i.name === name && isActive(i) && ok(i)) || {}).id;
  const stored = i => i.status === 'storage';
  const req = (t, o, draft) => { at(t); return createRequest('P-ANJ', o, draft); };

  // decided: a proposal approved, a proposal rejected, a movement and a transfer completed on approval
  const p1 = req('2026-10-03T10:00', { kind: 'proposal', name: 'Browse ball', type: 'food', description: 'Hollow rattan ball, 40 cm, stuffed with browse', justification: 'Slower browse feeding for the elephants', details: 'Rattan, food-safe ties', loc: 'L-ELP', species: ['SP-ASE'] });
  at('2026-10-05T11:00'); approveRequest(p1, 'P-FARH', 'Order two through the request module');
  const p2 = req('2026-10-06T09:30', { kind: 'proposal', name: 'Hessian scent sack', type: 'sensory', description: 'Hessian sack filled with hay and spices', justification: 'New scents on the tiger patrol route', loc: 'L-TG1', species: ['SP-TIG'] });
  at('2026-10-07T10:15'); rejectRequest(p2, 'P-LAKS', 'Hessian frays and the fibres are a choking risk. Propose a fire-hose sack instead.');
  const m1 = req('2026-10-06T14:00', { kind: 'move', item: find('Treat dispenser', stored), to: 'L-PE2', reason: 'Rotation', notes: 'Lion-tailed macaques lost interest in the forage boxes', species: ['SP-LTM'] });
  at('2026-10-07T09:00'); approveRequest(m1, 'P-RAVI');
  const t1 = req('2026-10-07T15:00', { kind: 'transfer', item: find('Hide log', stored), toSite: 'S-RESC', toSection: 'SEC-RCW', toLoc: 'L-RW2', receiver: 'P-ARUN', reason: 'Hides for the star tortoises in rehabilitation' });
  at('2026-10-08T10:00'); approveRequest(t1, 'P-MEERA', 'Send with the Thursday van');
  at('2026-10-09T08:30'); dispatchTransfer(t1, 'P-RAVI', { note: 'Thursday van' });
  const t2 = req('2026-10-08T16:00', { kind: 'transfer', item: find('Meat bungee', stored), toSite: 'S-RESC', toSection: 'SEC-RCW', toLoc: 'L-RW1', receiver: 'P-ARUN', ref: 'MT-7118', reason: 'Pulling feed for the sloth bear in rehabilitation' });
  at('2026-10-09T11:00'); approveRequest(t2, 'P-LAKS');

  // pending
  req('2026-10-08T11:00', { kind: 'proposal', name: 'Frozen fish mould', type: 'food', description: 'Silicone mould that freezes fish into a floating block', justification: 'Longer foraging in the water for the otters', details: '2 L, food-grade silicone', loc: 'L-OTP', species: ['SP-SCO'], animals: [] });
  req('2026-10-09T15:00', { kind: 'existing', item: find('Puzzle feeder ball'), reason: 'The gibbons start puzzle feeders this week', notes: 'Second ball while the gibbon one is ordered', loc: 'L-GIB', species: ['SP-HGB'] });
  req('2026-10-10T08:40', { kind: 'move', item: find('Bamboo foraging tube', stored), to: 'L-PE2', qty: 4, reason: 'Rotation', species: ['SP-LTM'] });
  const perch = find('Swing perch', stored);
  if (perch) req('2026-10-10T09:10', { kind: 'transfer', item: perch, toSite: 'S-RESC', toSection: 'SEC-RCW', toLoc: 'L-QRB', receiver: 'P-ARUN', ref: 'MT-7124', reason: 'Perches for the parakeets in quarantine' });
  // a draft, and a custodian change
  req('2026-10-10T09:30', { kind: 'existing', item: find('Scent box'), qty: 1, reason: '', loc: 'L-MGE', species: ['SP-IGM'] }, true);
  at('2026-10-09T12:00'); reassignCustodian(find('Scent sacks', i => i.loc === 'L-TG1') || find('Scent sacks'), 'P-ANJ', { to: 'P-ANJ', note: 'Biologist leads the scent trial' });
  D.items.forEach(it => it.history.sort((x, y) => y.at.localeCompare(x.at)));
  noRepairCheck();
  setNow(NOW_DEFAULT);
}
