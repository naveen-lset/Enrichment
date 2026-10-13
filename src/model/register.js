// src/model/register.js — the enrichment item register, on the PRD rules of model.js and the Enrichments module of products.js. No DOM.
//   · product definitions (D.products): name, enrichment type, category (so its tracking mode), material, description, default
//     usable life. One definition per kind of product; the physical items point to it (item.product).
//   · receipt of a delivery from its existing ticket: the product is confirmed (or defined once), then receive() of model.js
//     creates the records: one per unit for individual tracking, one group record otherwise, none for a category not tracked.
//     The custodian may be left for later: the item is Awaiting assignment and cannot go into use until someone is assigned.
//   · expected usable life: the product's default or an item override with a reason; the review date runs from the received
//     date. Passing the date never changes status or condition: a person records the review (still fit, or replace).
//   · assignment for use: an available item into an enclosure through move() of model.js, optionally to animals living there.
// Loaded after products.js. Owner decisions and open points: docs/WORKFLOWS.md §16.

CAN.prodDefine = ['sup', 'afm', 'admin'];
const LIFE_UNIT = { days: 'Days', weeks: 'Weeks', months: 'Months', years: 'Years' };
const REVIEW = { ok: 'In life', soon: 'Review due soon', due: 'Review overdue', replace: 'Replacement needed', none: 'No usable life set' };

/* ---------- usable life ---------- */
function monthsLater(s, n) {
  const d = new Date(day(s) + 'T00:00:00Z'), dd = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(dd, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));   // 31 Jan + 1 month = 28/29 Feb
  return d.toISOString().slice(0, 10);
}
const addLife = (start, l) => l.unit === 'days' ? addDays(day(start), l.n) : l.unit === 'weeks' ? addDays(day(start), l.n * 7) : monthsLater(start, l.unit === 'years' ? l.n * 12 : l.n);
const lifeText = l => l ? `${l.n} ${l.n === 1 ? l.unit.replace(/s$/, '') : l.unit}` : '';
function checkLife(l) {
  if (!l || l.n === '' || l.n == null) return null;
  const n = +l.n;
  if (!Number.isInteger(n) || n < 1 || n > 600) fail('Enter the usable life as a whole number.');
  if (!LIFE_UNIT[l.unit]) fail('Pick the unit of the usable life.');
  return { n, unit: l.unit };
}
const materialOf = it => it.material || (productOf(it) || {}).material || '';
const lifeOf = it => it.life || (productOf(it) || {}).life || null;
// the agreed start date: the received date (owner's decision, 13 Oct)
const lifeStart = it => day(it.lifeStart || it.received);
// the next review: the date set at the last review, otherwise start + usable life
function reviewDue(it) { if (it.nextReview) return it.nextReview; const l = lifeOf(it); return l ? addLife(lifeStart(it), l) : ''; }
function reviewState(it) {
  if (!isActive(it)) return 'none';
  if (it.replace) return 'replace';
  const due = reviewDue(it);
  if (!due) return 'none';
  const n = daysBetween(NOW, due);
  return n < 0 ? 'due' : n <= (D.config.reviewSoonDays ?? 30) ? 'soon' : 'ok';
}
// who reviews an item and sets its life: its custodian, or the supervisor / site manager of its section or site
const canLife = (byId, it) => it.custodian === byId || can(byId, 'decide', it);

/* ---------- product definitions ---------- */
// saveProduct(by, {id?, name, type, cat, material, description, life: {n, unit} | null}) — the category is fixed once items exist
function saveProduct(byId, o = {}) {
  must(byId, 'prodDefine');
  const name = need(trimmed(o.name), 'Write the product name.');
  if (!ACT_TYPE[o.type]) fail('Pick the enrichment type.');
  const cat = by('categories', need(o.cat, 'Pick the category.')) || fail('Pick the category.');
  const material = need(trimmed(o.material), 'Pick the material.');
  const life = checkLife(o.life);
  if (D.products.some(p => p.id !== o.id && p.name.toLowerCase() === name.toLowerCase())) fail('A product with this name is already defined.');
  const f = { name, type: o.type, cat: cat.id, material, description: trimmed(o.description), life };
  const cur = o.id && (prodOf(o.id) || fail('Product not found.'));
  if (!cur) {
    const p = Object.assign({ id: nextId('EP') }, f, { log: [{ at: NOW, by: byId, act: 'Defined', note: '' }] });
    D.products.push(p);
    return p.id;
  }
  const items = D.items.filter(it => it.product === cur.id);
  if (f.cat !== cur.cat && items.length) fail('The category of a product with items cannot change.');
  const said = [['Name', cur.name, f.name], ['Type', ACT_TYPE[cur.type], ACT_TYPE[f.type]], ['Material', cur.material, f.material], ['Usable life', lifeText(cur.life) || 'Not set', lifeText(f.life) || 'Not set'], ['Description', cur.description, f.description]]
    .filter(([, a, b]) => a !== b).map(([k, a, b]) => k === 'Description' ? 'Description' : `${k}: ${a} → ${b}`);
  if (!said.length) fail('Nothing has changed.');
  Object.assign(cur, f);
  if (cur.name !== items[0]?.name) items.forEach(it => { it.name = cur.name; });
  cur.log.unshift({ at: NOW, by: byId, act: 'Edited', note: said.join(' · ') });
  return cur.id;
}

/* ---------- receipt: the existing ticket → the product → receive() of model.js ---------- */
// every receipt keeps the condition seen on arrival; item.cond moves on with later reports and repairs
const baseReceive = receive;
receive = function (ticketId, byId, o) { const ids = baseReceive(ticketId, byId, o); ids.forEach(id => { itemOf(id).receivedCond = itemOf(id).cond; }); return ids; };
// receiveDelivery(ticketId, by, {product | define: {name, type, material, description, life}, qty, cond, fit, loc, custodian,
//   discrepancy, notes, life: {n, unit}, lifeWhy}) → the new item IDs ([] for a category that is not tracked)
function receiveDelivery(ticketId, byId, o = {}) {
  const t = by('tickets', ticketId) || fail('Delivery not found.');
  if (t.status !== 'dispatched') fail('This delivery is already received.');
  const cat = by('categories', t.cat), site = sectionOf(t.section).site;
  must(byId, 'receive', { section: t.section, site });
  if (cat.mode === 'excluded') { receiveExcluded(ticketId, byId, { discrepancy: o.discrepancy }); notifyPeople([t.requestedBy].filter(x => x !== byId), 'Delivery received', `${t.name} · ${t.id}`, '#/enrappr/' + t.id); return []; }
  const pid = t.product || o.product || (o.define ? saveProduct(byId, Object.assign({}, o.define, { cat: t.cat })) : '');
  const p = prodOf(need(pid, 'Pick or define the product.')) || fail('Product not found.');
  if (p.cat !== t.cat) fail('This product is tracked in another category.');
  const life = checkLife(o.life);
  if (life) need(o.lifeWhy, 'Write why these items have a different usable life.');
  if (o.custodian && !custodianChoices({ site }).some(x => x.id === o.custodian)) fail('Pick a biologist, supervisor or site manager of this site.');
  // receive() needs a custodian; with none picked the receiver stands in for this call only and the records are left unassigned
  const ids = receive(ticketId, byId, Object.assign({}, o, { custodian: o.custodian || byId }));
  ids.forEach(id => {
    const it = itemOf(id);
    Object.assign(it, { product: p.id, name: p.name, lifeStart: day(it.received) });
    if (life) Object.assign(it, { life, lifeWhy: trimmed(o.lifeWhy) });
    if (!o.custodian) it.custodian = '';
  });
  t.product = p.id;
  const first = itemOf(ids[0]), what = `${p.name} · ${ids.length === 1 ? ids[0] : `${ids[0]} – ${ids[ids.length - 1]}`}`;
  if (o.custodian && o.custodian !== byId) notifyPeople([o.custodian], 'Custodian assigned', what, '#/enrichments/' + first.id);
  notifyPeople([t.requestedBy].filter(x => x !== byId), 'Delivery received', `${what} · ${t.id}`, '#/enrichments/' + first.id);
  return ids;
}

/* ---------- usable life of one item, and its reviews ---------- */
// setItemLife(item, by, {life: {n, unit} | null, why}) — null goes back to the product's default
function setItemLife(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  if (!isActive(it)) fail(`The usable life of an item that is ${STATUS[it.status].toLowerCase()} cannot change.`);
  if (!canLife(byId, it)) fail('You do not have permission for this action.');
  const life = checkLife(o.life), before = lifeOf(it);
  need(o.why, 'Write the reason for the change.');
  if (lifeText(life || productOf(it).life) === lifeText(before)) fail('This is already the usable life.');
  if (life) Object.assign(it, { life, lifeWhy: trimmed(o.why) }); else { delete it.life; delete it.lifeWhy; }
  delete it.nextReview;   // the review date follows the new life
  log(it, byId, 'Usable life changed', { from: lifeText(before) || 'Not set', to: lifeText(lifeOf(it)) || 'Not set', note: trimmed(o.why) });
  return it.id;
}
// recordReview(item, by, {outcome: 'fit' | 'replace', next, note}) — fit sets the next review date; replace marks it for replacement.
// Neither changes status or condition: damage goes through Report issue (flagIssue), removal through disposal.
function recordReview(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  if (!isActive(it) || it.status === 'transit') fail(`An item that is ${STATUS[it.status].toLowerCase()} cannot be reviewed.`);
  if (!canLife(byId, it)) fail('You do not have permission for this action.');
  if (!['fit', 'replace'].includes(o.outcome)) fail('Pick the outcome.');
  const note = trimmed(o.note);
  if (o.outcome === 'fit') {
    need(o.next, 'Pick the next review date.');
    if (o.next <= day(NOW)) fail('The next review date must be after today.');
    it.nextReview = o.next; it.replace = null;
  } else {
    need(note, 'Write why the item needs replacing.');
    it.replace = { at: NOW, by: byId, note };
  }
  (it.reviews = it.reviews || []).unshift({ at: NOW, by: byId, outcome: o.outcome, next: o.next || '', note });
  log(it, byId, 'Life reviewed', { to: o.outcome === 'fit' ? 'Still fit · next review ' + o.next : 'Replacement needed', note });
  return it.id;
}

/* ---------- availability and assignment for use ---------- */
// available for use: in an available place or a store, cleared for animals, with a custodian, nothing open on it
const availableForUse = it => ['available', 'storage'].includes(it.status) && !!it.custodian && usableForAnimals(it) && !it.disposal && !openMoveOf(it.id);
// an item still awaiting a custodian never goes into an enclosure (owner's decision, 13 Oct); every other rule stays in move()
const baseMove = move;
move = function (itemId, byId, o = {}) {
  const it = itemOf(itemId), to = o.to && locOf(o.to);
  if (it && !it.custodian && to && to.kind === 'enclosure') fail('Assign a custodian before the item goes into use.');
  return baseMove(itemId, byId, o);
};
// assignForUse(item, by, {to, animals[], qty, note}) — supervisor / site manager directly; a biologist uses a movement request
function assignForUse(itemId, byId, o = {}) {
  const it = itemOf(itemId) || fail('Item not found.');
  must(byId, 'move', it);
  if (!it.custodian) fail('Assign a custodian before the item goes into use.');
  if (!MOVABLE.includes(it.status) || it.disposal) fail(`An item that is ${it.disposal ? 'waiting for disposal' : STATUS[it.status].toLowerCase()} cannot be assigned.`);
  const to = locOf(need(o.to, 'Pick the enclosure.'));
  if (!to || to.kind !== 'enclosure') fail('Pick an enclosure.');
  const animals = [...new Set(o.animals || [])];
  animals.forEach(a => { const an = animalOf(a); if (!an || an.loc !== to.id) fail('Pick animals that live in this enclosure.'); });
  const names = animals.map(a => animalOf(a).name).join(', '), note = trimmed(o.note);
  let id = it.id;
  if (to.id === it.loc) {
    if (!animals.length) fail('The item is already in this enclosure.');
    log(it, byId, 'Assigned for use', { to: names, note });
  } else id = move(it.id, byId, { to: to.id, qty: o.qty, reason: ['Assigned for use', names, note].filter(Boolean).join(' · ') });
  itemOf(id).use = { loc: to.id, animals, at: NOW, by: byId };
  return id;
}

/* ---------- work and notifications of the register ---------- */
// registerTasks(by) → [{kind: receipt | assign | review, ref, title, site, due}]
function registerTasks(byId) {
  const out = [];
  D.tickets.filter(t => t.status === 'dispatched' && can(byId, 'receive', { section: t.section, site: sectionOf(t.section).site }))
    .forEach(t => out.push({ kind: 'receipt', ref: t.id, title: t.name, site: sectionOf(t.section).site, due: addDays(day(t.dispatched), D.config.receiptDays) }));
  enrItems().forEach(it => {
    if (!it.custodian && can(byId, 'move', it)) out.push({ kind: 'assign', ref: it.id, title: it.name, site: it.site, due: '' });
    if (['soon', 'due'].includes(reviewState(it)) && canLife(byId, it) && it.status !== 'transit') out.push({ kind: 'review', ref: it.id, title: it.name, site: it.site, due: reviewDue(it) });
  });
  return out;
}
function registerNotifications(byId) {
  const soon = D.config.reviewSoonDays ?? 30;
  return enrItems().filter(it => ['soon', 'due'].includes(reviewState(it)) && canLife(byId, it)).map(it => {
    const due = reviewDue(it), n = daysBetween(NOW, due);
    return { kind: 'enr', title: n < 0 ? 'Life review overdue' : 'Life review due soon', text: `${it.name} · ${it.id} · ${n < 0 ? plural2(-n, 'day') + ' overdue' : n ? 'in ' + plural2(n, 'day') : 'today'}`,
      href: '#/enrichments/' + it.id, at: n < 0 ? due : addDays(due, -soon) };
  });
}
const plural2 = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
const prodNotifications = notifications;
notifications = function (byId) { return prodNotifications(byId).concat(registerNotifications(byId)).sort((x, y) => String(y.at).localeCompare(String(x.at))); };

/* ---------- demo data: the brief's example products, played through the rules above ---------- */
// "Metal chair 12 months, wooden chair 6 months" are the brief's demonstration values, not defaults.
function registerSeed() {
  const at = setNow;
  at('2026-07-01T09:00');
  const metal = saveProduct('P-MEERA', { name: 'Metal chair', type: 'environmental', cat: 'CAT-B', material: 'Metal', description: 'Powder-coated steel chair for keeper-led sessions and resting', life: { n: 12, unit: 'months' } });
  const wood = saveProduct('P-MEERA', { name: 'Wooden chair', type: 'environmental', cat: 'CAT-B', material: 'Wood', description: 'Untreated hardwood chair', life: { n: 6, unit: 'months' } });
  ticket('TK-1972', 'Metal chair', 'CAT-B', 3, 'SEC-PRI', '2026-07-21T15:00', 'WS-242', 'MT-6795', 'P-ANJ'); by('tickets', 'TK-1972').product = metal;
  at('2026-07-22T10:00'); const [c1, c2] = receiveDelivery('TK-1972', 'P-RAVI', { qty: 3, loc: 'L-PST', custodian: 'P-RAVI' });
  at('2026-07-23T09:00'); assignForUse(c1, 'P-RAVI', { to: 'L-PE1', note: 'Training sessions' });
  ticket('TK-1988', 'Wooden chair', 'CAT-B', 2, 'SEC-HRB', '2026-04-09T15:00', '', 'MT-6588', 'P-ANJ'); by('tickets', 'TK-1988').product = wood;
  at('2026-04-10T10:00'); receiveDelivery('TK-1988', 'P-FARH', { qty: 2, loc: 'L-HST', custodian: 'P-FARH' });
  at('2026-10-09T16:00'); assignForUse(c2, 'P-RAVI', { to: 'L-GIB', animals: A().animals.filter(a => a.loc === 'L-GIB').slice(0, 1).map(a => a.id) });
  // waiting: four more metal chairs (linked to the product), and a delivery received without a custodian
  ticket('TK-2064', 'Metal chair', 'CAT-B', 4, 'SEC-SML', '2026-10-09T15:00', 'WS-325', 'MT-7755', 'P-ANJ'); by('tickets', 'TK-2064').product = metal;
  ticket('TK-2049', 'Wooden chair', 'CAT-B', 2, 'SEC-BRD', '2026-10-07T15:00', '', 'MT-7736', 'P-ANJ'); by('tickets', 'TK-2049').product = wood;
  at('2026-10-08T11:00'); receiveDelivery('TK-2049', 'P-LAKS', { qty: 2, loc: 'L-BST' });
  // a life review already recorded, and one item marked for replacement
  const nest = D.items.find(i => i.name === 'Wooden nest box' && isActive(i) && !i.repair);
  if (nest) { at('2026-10-03T10:00'); recordReview(nest.id, 'P-LAKS', { outcome: 'fit', next: '2026-12-03', note: 'Roof sound, perch worn but usable' }); }
  const sacks = D.items.find(i => i.name === 'Scent sacks' && isActive(i));
  if (sacks) { at('2026-10-06T10:00'); recordReview(sacks.id, sacks.custodian || 'P-LAKS', { outcome: 'replace', note: 'Hessian thinning; replace with the next delivery' }); }
  D.items.forEach(it => it.history.sort((x, y) => y.at.localeCompare(x.at)));
  setNow(NOW_DEFAULT);
}
