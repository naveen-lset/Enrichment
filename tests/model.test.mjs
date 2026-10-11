// Checks the PRD rules against src/model/model.js + seed.js, loaded exactly as the page loads them.
// Run: npm test   (node --test tests/model.test.mjs, Node 20 or later). Each test name gives the PRD section and the acceptance criterion (AC-*) it proves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../src/model/', import.meta.url).pathname;
function full(now) {
  const c = vm.createContext({ console });
  for (const f of ['model.js', 'seed.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), c, { filename: f });
  vm.runInContext(`boot(${now ? `'${now}'` : ''})`, c);
  return c;
}
const run = (c, js) => vm.runInContext(js, c);
// val(): a plain copy of a value from the model's context, so deepEqual compares data, not realms
const val = (c, js) => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, c));
const refuses = (c, js, re) => assert.throws(() => run(c, js), re);

/* ---------- Phase 1 · configure and register ---------- */
test('P1-1 §4 categories: tracking modes; only the admin configures; a category needs a name (FR-01)', () => {
  const c = full();
  assert.deepEqual(val(c, `D.categories.map(x => x.mode)`), ['individual', 'individual', 'batch', 'excluded']);
  refuses(c, `saveCategory('P-RAVI', { id: 'CAT-A', name: 'X', mode: 'individual' })`, /permission/);
  refuses(c, `saveCategory('P-NEHA', { id: 'CAT-A', name: ' ', mode: 'individual' })`, /needs a name/);
  run(c, `saveCategory('P-NEHA', Object.assign({}, by('categories','CAT-B'), { qr: 'required' }))`);
  assert.equal(run(c, `by('categories','CAT-B').qr`), 'required');
});

test('P1-2 §5.1 receipt: Category A makes one record per unit, linked to the ticket and transfer reference (AC-2, FR-02, FR-03)', () => {
  const c = full();
  const ids = run(c, `receive('TK-2051', 'P-RAVI', { qty: 3, loc: 'L-PST', custodian: 'P-RAVI' })`);
  assert.equal(ids.length, 3);
  const it = run(c, `itemOf('${ids[0]}')`);
  assert.equal(it.ticket, 'TK-2051'); assert.equal(it.mt, 'MT-7741'); assert.equal(it.ws, 'WS-322');
  assert.equal(it.status, 'storage'); assert.equal(it.custodian, 'P-RAVI'); assert.equal(it.site, 'S-MAIN');
  assert.equal(it.history[0].act, 'Received'); assert.equal(it.history[0].by, 'P-RAVI');
  refuses(c, `receive('TK-2051', 'P-RAVI', { qty: 3, loc: 'L-PST', custodian: 'P-RAVI' })`, /already received/);
});

test('P1-3 §5.1 receipt: a batch is one record with its quantity; a short quantity needs a discrepancy note', () => {
  const c = full();
  refuses(c, `receive('TK-2053', 'P-LAKS', { qty: 38, loc: 'L-BST', custodian: 'P-LAKS' })`, /discrepancy/);
  const ids = run(c, `receive('TK-2053', 'P-LAKS', { qty: 38, loc: 'L-BST', custodian: 'P-LAKS', discrepancy: '2 broken' })`);
  assert.equal(ids.length, 1);
  assert.equal(run(c, `itemOf('${ids[0]}').qty`), 38);
  assert.match(run(c, `itemOf('${ids[0]}').history[0].note`), /2 broken/);
});

test('P1-4 §5.1 receipt: an item not fit on receipt goes to assessment, never Available; location and permission are checked', () => {
  const c = full();
  refuses(c, `receive('TK-2047', 'P-RAVI', { qty: 2, loc: 'L-CST', custodian: 'P-LAKS' })`, /permission/);
  refuses(c, `receive('TK-2047', 'P-LAKS', { qty: 2, loc: 'L-PST', custodian: 'P-LAKS' })`, /ticket section/);
  const ids = run(c, `receive('TK-2047', 'P-LAKS', { qty: 2, loc: 'L-CST', custodian: 'P-LAKS', fit: false, cond: 'damaged', notes: 'Torn rope' })`);
  ids.forEach(id => { assert.equal(run(c, `itemOf('${id}').status`), 'assessment'); assert.equal(run(c, `usableForAnimals(itemOf('${id}'))`), false); });
});

test('P1-5 §9 register: a supervisor sees the items of their sections with location, condition and status (AC-1)', () => {
  const c = full();
  const mine = run(c, `D.items.filter(i => scoped(person('P-RAVI'), i) && isActive(i)).map(i => i.section)`);
  assert.ok(mine.length > 0);
  assert.ok(mine.every(s => ['SEC-PRI', 'SEC-SML'].includes(s)));
  const it = run(c, `itemOf('EF-0008')`);
  assert.equal(run(c, `where(itemOf('EF-0008'))`), 'Primate Enclosure 2 · Primates');
  assert.equal(it.cond, 'good'); assert.equal(it.status, 'inuse');
});

/* ---------- Phase 2 · lifecycle controls ---------- */
test('P2-1 §5.2 move: a rotation moves the same record; history keeps from, to, user and time (AC-3, FR-05)', () => {
  const c = full();
  const n = run(c, `D.items.length`);
  const id = run(c, `move('EF-0001', 'P-RAVI', { to: 'L-PST', reason: 'Rest from use' })`);
  assert.equal(id, 'EF-0001'); assert.equal(run(c, `D.items.length`), n);
  const h = run(c, `itemOf('EF-0001').history`);
  assert.equal(h[1].act, 'Moved'); assert.equal(h[1].from, 'Primate Enclosure 1 · Primates'); assert.equal(h[1].to, 'Primate Store · Primates');
  assert.equal(h[1].by, 'P-RAVI'); assert.equal(h[0].act, 'Status changed'); assert.equal(h[0].to, 'In storage');
  refuses(c, `move('EF-0001', 'P-RAVI', { to: 'L-PST', reason: 'x' })`, /already at this location/);
  refuses(c, `move('EF-0001', 'P-RAVI', { to: 'L-PE1' })`, /reason/);
  refuses(c, `move('EF-0001', 'P-RAVI', { to: 'L-RW1', reason: 'x' })`, /transfer/);
  refuses(c, `move('EF-0001', 'P-RAVI', { to: 'L-OTP', reason: 'x' })`, /another section/);
});

test('P2-2 §5.2 move: part of a batch splits into a linked batch record', () => {
  const c = full();
  refuses(c, `move('EB-0001', 'P-RAVI', { to: 'L-MGE', reason: 'Rotation', qty: 31 })`, /from 1 to 30/);
  const id = run(c, `move('EB-0001', 'P-RAVI', { to: 'L-MGE', reason: 'Rotation', qty: 12 })`);
  assert.notEqual(id, 'EB-0001');
  assert.equal(run(c, `itemOf('EB-0001').qty`), 18); assert.equal(run(c, `itemOf('${id}').qty`), 12);
  assert.equal(run(c, `itemOf('${id}').parent`), 'EB-0001'); assert.equal(run(c, `itemOf('${id}').status`), 'inuse');
});

test('P2-3 §8 an unsafe or unsuitable item is never placed for animal use; an item under repair cannot move', () => {
  const c = full();
  assert.equal(run(c, `usableForAnimals(itemOf('EF-0016'))`), false);
  refuses(c, `move('EF-0016', 'P-LAKS', { to: 'L-AV3', reason: 'x' })`, /under repair cannot be moved/);
  run(c, `register('P-RAVI', { name: 'Old crate', cat: 'CAT-A', loc: 'L-PST', custodian: 'P-RAVI', cond: 'unsafe' })`);
  const id = run(c, `D.items[D.items.length - 1].id`);
  refuses(c, `move('${id}', 'P-RAVI', { to: 'L-PE1', reason: 'x' })`, /not cleared for animal use/);
});

test('P2-4 §5.3 repair: flag → routed checks → repair → completion returns the item to a valid location (AC-5, FR-10)', () => {
  const c = full();
  refuses(c, `flagIssue('EF-0001', 'P-RAVI', { issue: 'Wear', cond: 'damaged' })`, /photo/);
  run(c, `flagIssue('EF-0001', 'P-RAVI', { issue: 'Wear', cond: 'damaged', photos: [{ kind: 'photo', caption: 'Dent' }] })`);
  const r = run(c, `itemOf('EF-0001').repair`);
  assert.equal(r.bio, 'pending'); assert.equal(r.tech, 'pending'); assert.equal(run(c, `itemOf('EF-0001').status`), 'assessment');
  refuses(c, `verifyAnimalUse('EF-0001', 'P-RAVI', 'suitable')`, /permission/);
  refuses(c, `assessRepair('EF-0001', 'P-ANJ', 'repairable', 'x')`, /permission/);
  run(c, `verifyAnimalUse('EF-0001', 'P-ANJ', 'suitable', '')`);
  run(c, `assessRepair('EF-0001', 'P-JOS', 'repairable', 'Hammer out the dent')`);
  assert.equal(run(c, `itemOf('EF-0001').repair.state`), 'approved');
  run(c, `startRepair('EF-0001', 'P-JOS', { team: 'Workshop' })`);
  assert.equal(run(c, `itemOf('EF-0001').status`), 'repair');
  refuses(c, `completeRepair('EF-0001', 'P-JOS', { team: 'Workshop', to: 'L-PE1' })`, /what was repaired/);
  run(c, `completeRepair('EF-0001', 'P-JOS', { notes: 'Dent removed', team: 'Workshop', to: 'L-PE1' })`);
  const it = run(c, `itemOf('EF-0001')`);
  assert.equal(it.status, 'inuse'); assert.equal(it.cond, 'good'); assert.equal(it.repair, null); assert.equal(it.repairs[0].done.notes, 'Dent removed');
});

test('P2-5 §5.3 biologist verification is requested only where configured or by animal-use context (AC-9)', () => {
  const c = full();
  // Category B: only while in use. In a store → no biologist.
  run(c, `register('P-RAVI', { name: 'Spare frame', cat: 'CAT-B', loc: 'L-PST', custodian: 'P-RAVI' })`);
  const b = run(c, `D.items[D.items.length - 1].id`);
  run(c, `flagIssue('${b}', 'P-RAVI', { issue: 'Wear', cond: 'damaged', photos: [{ kind: 'photo' }] })`);
  assert.equal(run(c, `itemOf('${b}').repair.bio`), 'notreq');
  // Category B in an enclosure → biologist.
  run(c, `flagIssue('EF-0008', 'P-RAVI', { issue: 'Wear', cond: 'damaged', photos: [{ kind: 'photo' }] })`);
  assert.equal(run(c, `itemOf('EF-0008').repair.bio`), 'pending');
  // Category C: never; no routing → the custodian decides.
  run(c, `flagIssue('EB-0002', 'P-LAKS', { issue: 'Rot', cond: 'needsrepair' })`);
  const r = run(c, `itemOf('EB-0002').repair`);
  assert.equal(r.bio, 'notreq'); assert.equal(r.tech, 'notreq');
  run(c, `decide('EB-0002', 'P-LAKS', 'clear')`);
  assert.equal(run(c, `itemOf('EB-0002').status`), 'inuse');
});

test('P2-6 §5.4 transfer: in transit until the receiving custodian acknowledges; history keeps both ends (AC-4, FR-11)', () => {
  const c = full();
  refuses(c, `transfer('EF-0014', 'P-RAVI', { section: 'SEC-RCW', receiver: 'P-LAKS' })`, /custodian of the receiving section/);
  refuses(c, `transfer('EF-0014', 'P-RAVI', { section: 'SEC-RCW', receiver: 'P-ARUN' })`, /material-transfer reference/);
  run(c, `transfer('EF-0014', 'P-RAVI', { section: 'SEC-RCW', receiver: 'P-ARUN', ref: 'MT-8001' })`);
  assert.equal(run(c, `itemOf('EF-0014').status`), 'transit'); assert.equal(run(c, `where(itemOf('EF-0014'))`), 'In transit');
  refuses(c, `acknowledge('EF-0014', 'P-RAVI', { loc: 'L-RW1' })`, /Only the receiving custodian/);
  run(c, `setNow('2026-10-11T09:00'); acknowledge('EF-0014', 'P-ARUN', { loc: 'L-RW1' })`);
  const it = run(c, `itemOf('EF-0014')`);
  assert.equal(it.site, 'S-RESC'); assert.equal(it.custodian, 'P-ARUN'); assert.equal(it.status, 'inuse');
  const tr = it.transfers[0];
  assert.equal(tr.by, 'P-RAVI'); assert.equal(tr.ack.by, 'P-ARUN'); assert.equal(tr.ref, 'MT-8001');
  assert.equal(tr.from.site, 'S-MAIN'); assert.equal(tr.ack.at, '2026-10-11T09:00');
});

test('P2-7 §8 a transfer completes without acknowledgement only by an authorised exception with a reason', () => {
  const c = full();
  refuses(c, `completeWithoutAck('EF-0009', 'P-RAVI', 'x', { loc: 'L-RST' })`, /permission/);
  refuses(c, `completeWithoutAck('EF-0009', 'P-MEERA', ' ', { loc: 'L-RST' })`, /reason/);
  run(c, `completeWithoutAck('EF-0009', 'P-MEERA', 'Receiver on leave', { loc: 'L-RST' })`);
  assert.equal(run(c, `itemOf('EF-0009').transfers[0].exception`), 'Receiver on leave');
  assert.equal(run(c, `itemOf('EF-0009').history.find(h => h.act.startsWith('Transfer')).act`), 'Transfer completed by exception');
});

test('P2-8 §7 lifecycle timeline: every event has actor, time and action, newest first (FR-15)', () => {
  const c = full();
  const h = run(c, `itemOf('EF-0008').history`);
  assert.ok(h.length >= 8);
  assert.ok(h.every(e => e.at && e.by && e.act));
  for (let i = 1; i < h.length; i++) assert.ok(h[i - 1].at >= h[i].at, 'newest first');
  assert.ok(h.some(e => e.act === 'Repair completed'));
});

/* ---------- Phase 3 · disposal and audit ---------- */
test('P3-1 §8 no tracked item can be deleted (AC-7, FR-07)', () => {
  const c = full();
  refuses(c, `deleteItem('EF-0001')`, /cannot be deleted/);
  assert.ok(run(c, `!!itemOf('EF-0002')`), 'a scrapped record stays');
  assert.equal(run(c, `itemOf('EF-0002').status`), 'scrapped');
});

test('P3-2 §5.5 disposal: reason, evidence and approver are needed; validations are routed by category (FR-08)', () => {
  const c = full();
  refuses(c, `requestDisposal('EF-0014', 'P-RAVI', { cond: 'damaged', approver: 'P-SUR' })`, /reason/);
  refuses(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'Worn out', cond: 'damaged', notes: 'x', approver: 'P-SUR' })`, /photo/);
  refuses(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'Worn out', cond: 'damaged', notes: 'x', photos: [{ kind: 'photo' }], approver: 'P-RAVI' })`, /authorised approver/);
  const d = run(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'Worn out', cond: 'damaged', notes: 'x', photos: [{ kind: 'photo' }], approver: 'P-SUR' })`);
  const r = run(c, `disposalOf('${d}')`);
  assert.equal(r.needBio, true); assert.equal(r.needTech, true); assert.equal(r.state, 'validation');
  assert.equal(run(c, `isActive(itemOf('EF-0014'))`), true, 'the item stays in the active register');
  refuses(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'x', cond: 'damaged', notes: 'x', photos: [{}], approver: 'P-SUR' })`, /already has an open/);
});

test('P3-3 §5.5 disposal cannot complete until validations and approval are recorded (AC-6)', () => {
  const c = full();
  refuses(c, `approveDisposal('DR-0005', 'P-SUR')`, /Wait for the required validations/);
  refuses(c, `completeDisposal('DR-0005', 'P-LAKS', { outcome: 'disposed' })`, /not approved/);
  refuses(c, `validateDisposal('DR-0005', 'P-JOS', 'bio', true)`, /permission/);
  run(c, `validateDisposal('DR-0005', 'P-ANJ', 'bio', true, '')`);
  assert.equal(run(c, `disposalOf('DR-0005').state`), 'approval');
  refuses(c, `approveDisposal('DR-0005', 'P-LAKS')`, /permission/);
  run(c, `approveDisposal('DR-0005', 'P-SUR')`);
  refuses(c, `completeDisposal('DR-0005', 'P-LAKS', {})`, /final disposition/);
  run(c, `completeDisposal('DR-0005', 'P-LAKS', { outcome: 'donated' })`);
  assert.equal(run(c, `itemOf('EF-0015').status`), 'retired'); assert.equal(run(c, `itemOf('EF-0015').final`), 'donated');
});

test('P3-4 §5.5 a rejected request returns to the custodian with comments; the item stays active', () => {
  const c = full();
  refuses(c, `rejectDisposal('DR-0004', 'P-SUR', '')`, /comments/);
  run(c, `rejectDisposal('DR-0004', 'P-SUR', 'Try repair first')`);
  assert.equal(run(c, `disposalOf('DR-0004').state`), 'rejected');
  assert.equal(run(c, `itemOf('EF-0013').disposal`), null); assert.equal(run(c, `itemOf('EF-0013').status`), 'inuse');
  assert.equal(run(c, `itemOf('EF-0013').history[0].note`), 'Try repair first');
});

test('P3-5 §14 expedited route: needs photo evidence; the approver can approve before validation, completion still waits for it', () => {
  const c = full();
  refuses(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'Unsafe', cond: 'unsafe', notes: 'x', approver: 'P-MEERA', expedited: true })`, /photo/);
  const d = run(c, `requestDisposal('EF-0014', 'P-RAVI', { reason: 'Unsafe', cond: 'unsafe', notes: 'x', photos: [{}], approver: 'P-MEERA', expedited: true })`);
  run(c, `approveDisposal('${d}', 'P-MEERA')`);
  assert.match(run(c, `itemOf('EF-0014').history[0].note`), /Expedited before validation/);
  refuses(c, `completeDisposal('${d}', 'P-RAVI', { outcome: 'scrapped' })`, /validations first/);
  run(c, `validateDisposal('${d}', 'P-ANJ', 'bio', true); validateDisposal('${d}', 'P-JOS', 'tech', true)`);
  run(c, `completeDisposal('${d}', 'P-RAVI', { outcome: 'scrapped' })`);
  assert.equal(run(c, `itemOf('EF-0014').status`), 'scrapped');
});

test('P3-6 §5.6 audit: outcomes update the item; exceptions need a custodian and a due date (AC-8, FR-12)', () => {
  const c = full();
  const a = run(c, `D.audits.find(a => a.period === 'Q4 2026').id`);
  refuses(c, `recordAudit('${a}', 'EF-0003', 'P-MEERA', 'verified')`, /already checked/);
  refuses(c, `recordAudit('${a}', 'EF-0004', 'P-MEERA', 'locmismatch', {})`, /found/);
  run(c, `recordAudit('${a}', 'EF-0004', 'P-MEERA', 'condmismatch', { note: 'Paint peeling' })`);
  refuses(c, `assignException('${a}', 'EF-0004', 'P-MEERA', { to: 'P-LAKS' })`, /due date/);
  refuses(c, `assignException('${a}', 'EF-0004', 'P-RAVI', { to: 'P-LAKS', due: '2026-10-20' })`, /permission/);
  run(c, `assignException('${a}', 'EF-0004', 'P-MEERA', { to: 'P-LAKS', due: '2026-10-20' })`);
  assert.equal(run(c, `itemOf('EF-0017').status`), 'missing');
  run(c, `resolveException('${a}', 'EF-0017', 'P-RAVI', { note: 'Found behind the night house', loc: 'L-PE2' })`);
  assert.equal(run(c, `itemOf('EF-0017').status`), 'inuse');
  assert.equal(run(c, `itemOf('EF-0017').history[0].act`), 'Found');
});

test('P3-7 §5.6 an audit closes only when every item is checked and every exception assigned, by an authorised role', () => {
  const c = full();
  const a = run(c, `D.audits.find(a => a.period === 'Q4 2026').id`);
  refuses(c, `closeAudit('${a}', 'P-RAVI')`, /permission/);
  refuses(c, `closeAudit('${a}', 'P-MEERA')`, /not checked yet/);
  run(c, `auditOf('${a}').lines.filter(l => !l.outcome).forEach(l => recordAudit('${a}', l.item, 'P-MEERA', 'verified'))`);
  refuses(c, `closeAudit('${a}', 'P-MEERA')`, /1 exception is not assigned/);
  run(c, `assignException('${a}', 'EF-0011', 'P-MEERA', { to: 'P-LAKS', due: '2026-10-20' })`);
  run(c, `closeAudit('${a}', 'P-MEERA')`);
  assert.equal(run(c, `auditOf('${a}').state`), 'closed');
  refuses(c, `recordAudit('${a}', 'EF-0001', 'P-MEERA', 'verified')`, /closed/);
});

test('P3-8 §10 reports: items by site and status, and a traceable disposal / scrap history (AC-10, FR-13)', () => {
  const c = full();
  const r = run(c, `report({ site: 'S-MAIN' })`);
  const n = k => r.byStatus.find(x => x.key === k).n;
  assert.equal(n('scrapped'), 1); assert.equal(n('retired'), 1); assert.equal(n('missing'), 1); assert.equal(n('repair'), 1); assert.equal(n('transit'), 1);
  const done = r.disposals.filter(d => d.state === 'completed');
  assert.equal(done.length, 2);
  assert.ok(done.every(d => d.reason && d.decision && d.decision.by && d.completed.by));
  assert.equal(r.compliance, 100);
  assert.equal(r.accuracy, 95, 'Q3 audit: 1 location mismatch in 20 checked');
});

/* ---------- Phase 4 · optimisation ---------- */
test('P4-1 FR-14 labels: only individual records of a labelled category; printing is logged', () => {
  const c = full();
  refuses(c, `printLabels('P-RAVI', [])`, /one item or more/);
  refuses(c, `printLabels('P-RAVI', ['EB-0001'])`, /does not take a label/);
  refuses(c, `printLabels('P-RAVI', ['EF-0011'])`, /permission/);
  assert.equal(run(c, `printLabels('P-RAVI', ['EF-0001', 'EF-0008'])`), 2);
  assert.equal(run(c, `itemOf('EF-0001').history[0].act`), 'Label printed');
});

/* ---------- tasks, notifications, permissions ---------- */
test('T-1 My work: each role sees only what it must act on; biologists are not asked for routine sign-off', () => {
  const c = full();
  const labels = id => val(c, `tasks('${id}').map(t => t.kind)`);
  assert.deepEqual(labels('P-ANJ').sort(), ['bio', 'dbio']);
  assert.deepEqual(labels('P-SUR'), ['approve']);
  assert.deepEqual(labels('P-ARUN'), ['transfer']);
  assert.ok(labels('P-RAVI').includes('receipt') && labels('P-RAVI').includes('exception') && labels('P-RAVI').includes('dispose'));
  assert.ok(labels('P-MEERA').includes('assign'));
  assert.equal(run(c, `tasks('P-LAKS').find(t => t.kind === 'repair').late`), true);
});

test('T-2 §10 notifications: receipt pending, transfer awaiting, repair overdue, disposal awaiting, item missing', () => {
  const c = full();
  const kinds = run(c, `notifications('P-MEERA').map(n => n.kind)`);
  ['receipt', 'transfer', 'repair', 'disposal', 'missing'].forEach(k => assert.ok(kinds.includes(k), k));
  run(c, `setNow('2026-10-20T09:00')`);
  assert.ok(run(c, `notifications('P-MEERA').some(n => n.kind === 'audit')`), 'audit due within 14 days');
  assert.ok(run(c, `notifications('P-MEERA').some(n => n.kind === 'exception')`), 'exception past its due date');
});

test('T-3 §11 permissions: a supervisor acts only on their own sections; only the receiver acknowledges', () => {
  const c = full();
  refuses(c, `move('EF-0011', 'P-RAVI', { to: 'L-CST', reason: 'x' })`, /permission/);
  assert.equal(run(c, `can('P-RAVI', 'move', itemOf('EF-0001'))`), true);
  assert.equal(run(c, `can('P-ANJ', 'move', itemOf('EF-0001'))`), false);
  assert.equal(run(c, `can('P-ANJ', 'flag', null)`), true);
  assert.equal(run(c, `can('P-SUR', 'approve')`), true);
  assert.equal(run(c, `can('P-RAVI', 'configure')`), false);
});

test('T-4 seed: the demo history lands in the expected states on 10 Oct 2026, 10:00', () => {
  const c = full();
  const st = id => run(c, `itemOf('${id}').status`);
  assert.equal(st('EF-0016'), 'repair'); assert.equal(st('EF-0009'), 'transit'); assert.equal(st('EF-0017'), 'missing');
  assert.equal(st('EF-0005'), 'assessment'); assert.equal(st('EF-0010'), 'assessment'); assert.equal(run(c, `itemOf('EF-0010').repair.state`), 'beyond');
  assert.equal(st('EF-0002'), 'scrapped'); assert.equal(st('EB-0005'), 'retired');
  assert.deepEqual(val(c, `D.disposals.map(d => d.state)`), ['completed', 'completed', 'rejected', 'approval', 'validation']);
  assert.equal(run(c, `D.tickets.filter(t => t.status === 'dispatched').length`), 3);
  assert.deepEqual(val(c, `D.audits.map(a => a.state)`), ['closed', 'open']);
});
