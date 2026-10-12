// Checks the PROPOSED enrichment activity rules (src/model/activity.js) and how they join the PRD item register.
// Loads the app's full data: model.js + seed.js + seed-demo.js + work.js + activity.js, as the page does. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../src/model/', import.meta.url).pathname;
function full() {
  const c = vm.createContext({ console });
  for (const f of ['model.js', 'seed.js', 'seed-demo.js', 'work.js', 'activity.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), c, { filename: f });
  vm.runInContext(`boot(); workSeed(); activitySeed(); setNow(NOW_DEFAULT)`, c);
  return c;
}
const run = (c, js) => vm.runInContext(js, c);
const val = (c, js) => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, c));
const refuses = (c, js, re) => assert.throws(() => run(c, js), re);

test('A-1 keeper: acts only in own sections; can flag an item but cannot move it', () => {
  const c = full();
  assert.equal(run(c, `can('P-PRIYA', 'flag', itemOf('EF-0006'))`), true);           // Primates: Priya's section
  assert.equal(run(c, `can('P-PRIYA', 'flag', itemOf('EF-0011'))`), false);          // Carnivores: not hers
  refuses(c, `move('EF-0025', 'P-PRIYA', { to: 'L-PE2', reason: 'Rotation' })`, /permission/);
});

test('A-2 activity: waits for the biologist; only the biologist approves; changes need a note; only approved is assigned', () => {
  const c = full();
  const id = run(c, `saveActivity('P-PRIYA', { name: 'Leaf parcel', type: 'food', goal: 'Unwrapping', species: ['SP-BMQ'] })`);
  assert.equal(run(c, `activityOf('${id}').state`), 'pending');
  refuses(c, `saveActivity('P-PRIYA', { name: 'leaf parcel', type: 'food', goal: 'x', species: ['SP-BMQ'] })`, /already exists/);
  refuses(c, `saveActivity('P-PRIYA', { name: 'No species', type: 'food', goal: 'x', species: [] })`, /species/);
  refuses(c, `assignActivity('P-RAVI', { activity: '${id}', kind: 'species', target: 'SP-BMQ', loc: 'L-PE1', freq: 'daily', start: '2026-10-11', keeper: 'P-PRIYA' })`, /approved/);
  refuses(c, `reviewActivity('${id}', 'P-RAVI', true)`, /permission/);
  refuses(c, `reviewActivity('${id}', 'P-ANJ', false, ' ')`, /what needs to change/);
  run(c, `reviewActivity('${id}', 'P-ANJ', false, 'Add the leaf species')`);
  assert.equal(run(c, `activityOf('${id}').state`), 'changes');
  run(c, `resubmitActivity('${id}', 'P-PRIYA', { goal: 'Unwrapping banana-leaf parcels' })`);
  run(c, `reviewActivity('${id}', 'P-ANJ', true)`);
  assert.equal(run(c, `activityOf('${id}').state`), 'approved');
});

test('A-3 assignment: the enclosure must house the species, the keeper must belong to the section, a supervisor assigns only in own sections', () => {
  const c = full();
  const base = `{ activity: 'ACT-0002', kind: 'species', target: 'SP-LTM', loc: 'L-PE2', freq: 'weekly', start: '2026-10-12', keeper: 'P-PRIYA' }`;
  refuses(c, `assignActivity('P-RAVI', Object.assign(${base}, { loc: 'L-PE1' }))`, /where the animals live/);
  refuses(c, `assignActivity('P-RAVI', Object.assign(${base}, { keeper: 'P-IMRAN' }))`, /keeper of this section/);
  refuses(c, `assignActivity('P-LAKS', ${base})`, /permission/);
  refuses(c, `assignActivity('P-RAVI', Object.assign(${base}, { target: 'SP-TIG', loc: 'L-TG1' }))`, /not approved for this species/);
  const p = run(c, `assignActivity('P-RAVI', ${base})`);
  assert.deepEqual(val(c, `planDates(planOf('${p}'), '2026-10-10', '2026-10-26')`), ['2026-10-12', '2026-10-19', '2026-10-26']);
  refuses(c, `assignActivity('P-RAVI', ${base})`, /already assigned/);
});

test('A-4 inventory check reads the register: ready, in store, blocked (unsafe or under repair), not in the register', () => {
  const c = full();
  assert.deepEqual(val(c, `inventoryCheck('ACT-0001', 'L-PE1').map(m => m.state)`), ['ready']);
  assert.deepEqual(val(c, `inventoryCheck('ACT-0001', 'L-GIB').map(m => m.state)`), ['none']);
  assert.deepEqual(val(c, `inventoryCheck('ACT-0005', 'L-OTP').map(m => m.state)`), ['blocked']);     // the boomer ball flagged in a session
  assert.deepEqual(val(c, `inventoryCheck('ACT-0002', 'L-PE2').map(m => m.state)`), ['store']);       // bamboo tubes in the Primate Store
});

test('A-5 session: one record per plan and day; only cleared items in the enclosure; each item used gets a history event', () => {
  const c = full();
  const o = `{ plan: 'PL-0002', date: '2026-10-10', engage: 'medium', success: 'yes', rating: 4, materials: ['EF-0007'] }`;
  refuses(c, `recordSession('P-IMRAN', ${o})`, /permission|another keeper/);
  refuses(c, `recordSession('P-PRIYA', Object.assign(${o}, { materials: ['EF-0006'] }))`, /not cleared for use in this enclosure/);
  refuses(c, `recordSession('P-PRIYA', Object.assign(${o}, { rating: 0 }))`, /rating/);
  refuses(c, `recordSession('P-PRIYA', Object.assign(${o}, { date: '2026-10-11' }))`, /before its day/);
  const s = run(c, `recordSession('P-PRIYA', ${o})`);
  assert.equal(run(c, `itemOf('EF-0007').history[0].act`), 'Used in activity');
  assert.equal(run(c, `itemOf('EF-0007').history[0].ref`), s);
  refuses(c, `recordSession('P-PRIYA', ${o})`, /already recorded/);
});

test('A-6 safety incident: flags the item unsafe into the PRD checks; it is no longer offered for the activity', () => {
  const c = full();
  run(c, `recordSession('P-PRIYA', { plan: 'PL-0005', date: '2026-10-10', engage: 'low', success: 'no', rating: 2, materials: ['EF-0027'], photos: [{ kind: 'photo', caption: 'x' }], safety: { item: 'EF-0027', issue: 'Structural damage', notes: 'Loose board' } })`);
  assert.equal(run(c, `itemOf('EF-0027').cond`), 'unsafe');
  assert.equal(run(c, `itemOf('EF-0027').status`), 'assessment');
  assert.equal(run(c, `itemOf('EF-0027').repair.bio`), 'pending');                    // the biologist checks animal use (Category A)
  assert.equal(run(c, `usableForAnimals(itemOf('EF-0027'))`), false);
  assert.deepEqual(val(c, `inventoryCheck('ACT-0008', 'L-MGE').map(m => m.state)`), ['ready']);   // the second dig box is still fine
  refuses(c, `recordSession('P-PRIYA', { plan: 'PL-0006', date: '2026-10-10', engage: 'low', success: 'no', rating: 2, materials: ['EF-0030'], safety: { item: 'EF-0031', issue: 'Wear' } })`, /item used in this session/);
});

test('A-7 material request: the custodian reuses a stored item first; buying needs a reason when one is in store', () => {
  const c = full();
  refuses(c, `reviewMaterial('MR-0005', 'P-PRIYA', { decision: 'issue', item: 'EB-0006' })`, /permission/);  // a keeper does not decide inventory
  refuses(c, `reviewMaterial('MR-0005', 'P-RAVI', { decision: 'request' })`, /usable item is in the store/);
  run(c, `reviewMaterial('MR-0005', 'P-RAVI', { decision: 'issue', item: 'EB-0006' })`);
  const moved = run(c, `mreqOf('MR-0005').decision.item`);
  assert.equal(run(c, `itemOf('${moved}').loc`), 'L-PE2');
  assert.equal(run(c, `itemOf('${moved}').qty`), 4);
  assert.equal(run(c, `itemOf('EB-0006').qty`), 8);                                  // the rest stays in the store
  refuses(c, `reviewMaterial('MR-0005', 'P-RAVI', { decision: 'decline', note: 'x' })`, /already decided/);
  run(c, `reviewMaterial('MR-0004', 'P-RAVI', { decision: 'request' })`);              // nothing stored: no reason needed
  assert.equal(run(c, `mreqOf('MR-0004').state`), 'requested');
  refuses(c, `reviewMaterial('MR-0006', 'P-RAVI', { decision: 'decline', note: '' })`, /reason/);
});

test('A-8 work lists: keeper sessions, biologist approvals, custodian material reviews', () => {
  const c = full();
  assert.ok(val(c, `activityTasks('P-PRIYA').map(t => t.kind)`).includes('session'));
  assert.deepEqual(val(c, `activityTasks('P-ANJ').map(t => t.kind)`), ['actApprove', 'actApprove']);
  assert.deepEqual(val(c, `activityTasks('P-RAVI').filter(t => t.kind === 'matReview').map(t => t.ref)`), ['MR-0004', 'MR-0005', 'MR-0006']);
  assert.deepEqual(val(c, `unusedActivities().map(x => x.a.id)`), ['ACT-0011']);
});
