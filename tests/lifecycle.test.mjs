// Phase 2 lifecycle controls, on the app's full data: movement and rotation, storage and retrieval, condition issues, repair,
// transfer dispatch and receipt, permissions, duplicate-submission refusals and the lifecycle timeline (src/model/products.js
// on top of the PRD rules of src/model/model.js). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../src/model/', import.meta.url).pathname;
function full() {
  const c = vm.createContext({ console });
  for (const f of ['model.js', 'seed.js', 'seed-demo.js', 'work.js', 'activity.js', 'products.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), c, { filename: f });
  vm.runInContext(`boot(); workSeed(); activitySeed(); productSeed(); setNow(NOW_DEFAULT)`, c);
  return c;
}
const run = (c, js) => vm.runInContext(js, c);
const val = (c, js) => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, c));
const refuses = (c, js, re) => assert.throws(() => run(c, js), re);
const tick = c => run(c, `setNow(addDays(nowIs(), 0).slice(0, 11) + String(+nowIs().slice(11, 13) + 1).padStart(2, '0') + ':00')`);

test('L-1 rotation: the same record moves between enclosures and back; each move is in the history', () => {
  const c = full(), n = run(c, `D.items.length`), h = run(c, `itemOf('EF-0001').history.length`);
  run(c, `move('EF-0001', 'P-RAVI', { to: 'L-PE2', reason: 'Rotation' })`); tick(c);
  run(c, `move('EF-0001', 'P-RAVI', { to: 'L-PE1', reason: 'Rotation' })`);
  assert.equal(run(c, `itemOf('EF-0001').loc`), 'L-PE1');
  assert.equal(run(c, `D.items.length`), n);                                                        // no duplicate record
  assert.deepEqual(val(c, `itemOf('EF-0001').history.slice(0, 2).map(e => e.act + ' ' + e.to)`), ['Moved Primate Enclosure 1 · Primates', 'Moved Primate Enclosure 2 · Primates']);
  assert.equal(run(c, `itemOf('EF-0001').history.length`), h + 2);
});

test('L-2 storage and retrieval: status follows the location kind and both steps show in the timeline', () => {
  const c = full();
  run(c, `move('EF-0001', 'P-RAVI', { to: 'L-PST', reason: 'Storage' })`);
  assert.equal(run(c, `itemOf('EF-0001').status`), 'storage');
  assert.equal(run(c, `lifecycleEvents(itemOf('EF-0001'))[0].title`), 'Moved to storage');
  tick(c);
  run(c, `move('EF-0001', 'P-RAVI', { to: 'L-PE1', reason: 'Rotation' })`);
  assert.equal(run(c, `itemOf('EF-0001').status`), 'inuse');
  assert.deepEqual(val(c, `lifecycleEvents(itemOf('EF-0001')).filter(e => e.type === 'storage').map(e => e.title)`), ['Returned to use', 'Moved to storage']);
});

test('L-3 condition issue: linked to the record, on the existing condition list; a second report while open is refused', () => {
  const c = full();
  refuses(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Wear', cond: 'worn' })`, /condition/);         // no invented scale
  refuses(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Wear', cond: 'damaged' })`, /photo/);          // category A asks for a photo
  run(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Wear', cond: 'damaged', notes: 'Hinge loose', photos: [photo('Hinge')] })`);
  assert.deepEqual(val(c, `[itemOf('EF-0001').status, itemOf('EF-0001').cond, itemOf('EF-0001').repair.issue, itemOf('EF-0001').repair.by]`), ['assessment', 'damaged', 'Wear', 'P-ANJ']);
  refuses(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Wear', cond: 'damaged', photos: [photo('x')] })`, /cannot be flagged/);
  assert.ok(run(c, `lifecycleEvents(itemOf('EF-0001')).some(e => e.type === 'condition' && e.title === 'Condition flagged')`));
});

test('L-4 repair: biologist check, then the custodian decides, starts and completes it; the item returns to use and the record is kept', () => {
  const c = full();
  run(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Wear', cond: 'damaged', photos: [photo('Hinge')] })`); tick(c);
  assert.deepEqual(val(c, `[itemOf('EF-0001').repair.needBio, itemOf('EF-0001').repair.needTech]`), [true, false]);   // no repairability check
  refuses(c, `decide('EF-0001', 'P-RAVI', 'repair')`, /routed checks/);                             // waits for the biologist
  run(c, `verifyAnimalUse('EF-0001', 'P-ANJ', 'suitable')`);
  assert.equal(run(c, `itemOf('EF-0001').repair.state`), 'assessment');                            // suitable: the custodian decides
  refuses(c, `startRepair('EF-0001', 'P-RAVI')`, /not approved/);
  refuses(c, `decide('EF-0001', 'P-ANJ', 'repair')`, /permission/);                                // biologist does not decide
  run(c, `decide('EF-0001', 'P-RAVI', 'repair', 'Replace the hinge')`); tick(c);
  refuses(c, `startRepair('EF-0001', 'P-ANJ')`, /permission/);                                      // biologist does not run repairs
  run(c, `startRepair('EF-0001', 'P-RAVI', { team: 'Workshop' })`);
  refuses(c, `startRepair('EF-0001', 'P-RAVI', { team: 'Workshop' })`, /not approved/);              // no double start
  assert.equal(run(c, `itemOf('EF-0001').status`), 'repair'); tick(c);
  refuses(c, `completeRepair('EF-0001', 'P-RAVI', { team: 'Workshop', to: 'L-PE1' })`, /what was repaired/);
  run(c, `completeRepair('EF-0001', 'P-RAVI', { notes: 'Hinge replaced', team: 'Workshop', to: 'L-PE1' })`);
  assert.deepEqual(val(c, `[itemOf('EF-0001').status, itemOf('EF-0001').cond, itemOf('EF-0001').repair, itemOf('EF-0001').repairs[0].state, itemOf('EF-0001').repairs[0].done.notes]`), ['inuse', 'good', null, 'done', 'Hinge replaced']);
  tick(c);
  run(c, `flagIssue('EF-0001', 'P-ANJ', { issue: 'Corrosion', cond: 'needsrepair', photos: [photo('Rust')] })`);   // a new issue keeps the old repair
  assert.deepEqual(val(c, `[itemOf('EF-0001').repair.issue, itemOf('EF-0001').repairs[0].issue]`), ['Corrosion', 'Wear']);
  assert.equal(run(c, `D.items.some(i => i.repair && i.repair.tech === 'pending')`), false);         // no open repair waits for a workshop
});

test('L-5 repair without routed checks (category C): the custodian decides; the outcome is in the timeline', () => {
  const c = full();
  run(c, `flagIssue('EB-0001', 'P-RAVI', { issue: 'Wear', cond: 'needsrepair' })`);
  assert.deepEqual(val(c, `[itemOf('EB-0001').repair.needBio, itemOf('EB-0001').repair.needTech]`), [false, false]);
  refuses(c, `decide('EB-0001', 'P-LAKS', 'repair')`, /permission/);                                 // not the custodian's section
  run(c, `decide('EB-0001', 'P-RAVI', 'repair', 'Re-tie the bundle')`); tick(c);
  run(c, `startRepair('EB-0001', 'P-RAVI', { team: 'Carpentry' })`); tick(c);
  run(c, `completeRepair('EB-0001', 'P-RAVI', { notes: 'Bundle re-tied', team: 'Carpentry', to: 'L-SST' })`);
  assert.equal(run(c, `itemOf('EB-0001').status`), 'storage');
  assert.deepEqual(val(c, `lifecycleEvents(itemOf('EB-0001')).filter(e => e.type === 'repair').map(e => e.title)`), ['Status changed', 'Repair completed', 'Status changed', 'Repair approved']);
});

test('L-6 transfer through Transfers screen still completes the Enrichments request; exception path too', () => {
  const c = full();
  const id = run(c, `EN().requests.find(r => r.kind === 'transfer' && r.state === 'approved' && !r.result).id`);   // seeded: approved, not dispatched
  const item = run(c, `ereqOf('${id}').item`);
  refuses(c, `approveRequest('${id}', 'P-LAKS')`, /not waiting/);                                     // no second approval
  run(c, `dispatchTransfer('${id}', 'P-LAKS', { ref: 'MT-7118' })`);
  run(c, `completeWithoutAck('${item}', 'P-MEERA', 'Receiver on leave', { loc: 'L-RW1' })`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'completed');
  assert.equal(run(c, `ereqOf('${id}').log[0].act`), 'Completed by exception');
  assert.equal(run(c, `itemOf('${item}').site`), 'S-RESC');
});

test('L-7 permissions: keeper and biologist cannot move directly; another section cannot review; dispatch needs the sender', () => {
  const c = full();
  refuses(c, `move('EF-0001', 'P-PRIYA', { to: 'L-PE2', reason: 'Rotation' })`, /permission/);
  refuses(c, `move('EF-0001', 'P-ANJ', { to: 'L-PE2', reason: 'Rotation' })`, /permission/);         // biologist goes through a movement request
  const t = run(c, `EN().requests.find(r => r.kind === 'transfer' && r.state === 'approved' && !r.result).id`);
  refuses(c, `dispatchTransfer('${t}', 'P-RAVI')`, /permission/);                                    // Carnivores item: Lakshmi or the site manager
  refuses(c, `dispatchTransfer('${t}', 'P-ARUN')`, /permission/);                                    // the receiver cannot dispatch
  const m = run(c, `createRequest('P-ANJ', { kind: 'move', item: 'EF-0001', to: 'L-PE2', reason: 'Rotation' })`);
  refuses(c, `approveRequest('${m}', 'P-LAKS')`, /another reviewer/);
});

test('L-8 duplicate submissions are refused by the rules, not only by the button', () => {
  const c = full();
  const m = run(c, `createRequest('P-ANJ', { kind: 'move', item: 'EF-0001', to: 'L-PE2', reason: 'Rotation' })`);
  refuses(c, `createRequest('P-ANJ', { kind: 'transfer', item: 'EF-0001', toSite: 'S-RESC', toSection: 'SEC-RCW', receiver: 'P-ARUN', ref: 'MT-1', reason: 'x' })`, /already has an open movement/);
  run(c, `approveRequest('${m}', 'P-RAVI')`);
  refuses(c, `approveRequest('${m}', 'P-RAVI')`, /not waiting/);
  refuses(c, `rejectRequest('${m}', 'P-RAVI', 'late')`, /not waiting/);
  const d = run(c, `EN().requests.find(r => r.state === 'draft').id`);
  run(c, `deleteDraft('${d}', 'P-ANJ')`);
  refuses(c, `deleteDraft('${d}', 'P-ANJ')`, /not found/);
});

test('L-9 timeline: one event per stored record, newest first, nothing invented', () => {
  const c = full();
  const items = val(c, `D.items.filter(i => EN().requests.some(r => r.item === i.id)).map(i => i.id).concat(['EF-0012', 'EF-0001'])`);
  for (const id of items) {
    const ev = val(c, `lifecycleEvents(itemOf('${id}'))`);
    const logs = run(c, `EN().requests.filter(r => r.item === '${id}').reduce((n, r) => n + r.log.filter(l => ['Submitted', 'Approved', 'Rejected', 'Withdrawn'].includes(l.act)).length, 0)`);
    assert.equal(ev.length, run(c, `itemOf('${id}').history.length`) + logs, id);
    assert.ok(ev.every((e, i) => !i || ev[i - 1].at >= e.at), id + ' order');
    assert.ok(ev.every(e => e.by && e.at && e.type && e.title), id + ' fields');
  }
  assert.ok(val(c, `D.items.every(i => lifecycleEvents(i).every(e => LC_TYPE[e.type]))`));
  const t = run(c, `EN().requests.find(r => r.kind === 'transfer' && r.result).item`);
  assert.deepEqual(val(c, `lifecycleEvents(itemOf('${t}')).filter(e => e.type === 'transfer').map(e => e.title)`), ['Transfer dispatched', 'Transfer request approved', 'Transfer request submitted']);
});
