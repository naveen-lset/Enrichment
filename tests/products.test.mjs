// Checks the Enrichments Phase 1 rules (src/model/products.js): request statuses, routing, approval, rejection,
// movement and transfer through model.js, custodian reassignment and notifications. Loads the app's full data, as the page does.
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

test('P-1 types: products take the five existing activity types; untyped equipment is not listed', () => {
  const c = full();
  assert.deepEqual(val(c, `Object.keys(ACT_TYPE)`), ['social', 'cognitive', 'environmental', 'food', 'sensory']);
  assert.equal(run(c, `productType(D.items.find(i => i.name === 'Puzzle feeder ball'))`), 'food');      // from the activity that uses it
  assert.equal(run(c, `enrProducts().some(i => i.name === 'Small transport cage')`), false);
  assert.equal(run(c, `enrProducts().every(isActive)`), true);
  assert.ok(run(c, `Object.keys(ACT_TYPE).every(t => enrProducts().some(i => productType(i) === t))`));
});

test('P-2 associations: an enclosure gives its animals and species; a store gives none', () => {
  const c = full();
  const a = val(c, `productAssoc(D.items.find(i => i.loc === 'L-PE1' && isActive(i)))`);
  assert.equal(a.loc, 'L-PE1');
  assert.deepEqual(a.species, ['SP-BMQ']);
  assert.equal(a.animals.length, 4);
  assert.deepEqual(val(c, `productAssoc(D.items.find(i => i.loc === 'L-PST' && isActive(i)))`), { loc: '', animals: [], species: [] });
});

test('P-3 only a biologist requests; the request is Pending approval; the requester is the default custodian', () => {
  const c = full();
  const item = run(c, `D.items.find(i => i.name === 'Forage box' && isActive(i)).id`);
  refuses(c, `createRequest('P-RAVI', { kind: 'existing', item: '${item}', reason: 'x' })`, /permission/);
  refuses(c, `createRequest('P-ANJ', { kind: 'existing', item: '${item}', reason: '' })`, /reason/);
  const id = run(c, `createRequest('P-ANJ', { kind: 'existing', item: '${item}', reason: 'For the gibbons' })`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'pending');
  assert.equal(run(c, `ereqOf('${id}').custodian`), 'P-ANJ');
  refuses(c, `createRequest('P-ANJ', { kind: 'existing', item: '${item}', reason: 'Again' })`, /already have a pending request/);   // no duplicate
});

test('P-4 routing: the section supervisor or the site manager reviews; nobody reviews their own request; another section is refused', () => {
  const c = full();
  const id = run(c, `EN().requests.find(r => r.kind === 'existing' && r.state === 'pending').id`);   // Primates
  assert.deepEqual(val(c, `reviewersOf(ereqOf('${id}')).map(p => p.id).sort()`), ['P-MEERA', 'P-RAVI']);
  refuses(c, `approveRequest('${id}', 'P-LAKS')`, /another reviewer/);
  refuses(c, `approveRequest('${id}', 'P-ANJ')`, /own request/);
  refuses(c, `approveRequest('${id}', 'P-PRIYA')`, /permission/);
  run(c, `approveRequest('${id}', 'P-MEERA')`);                                                     // site manager: one approval is enough
  assert.equal(run(c, `ereqOf('${id}').state`), 'approved');                                       // fulfilment rule not defined: stays Approved
});

test('P-5 rejection needs a comment and is never Completed; the comment reaches the biologist', () => {
  const c = full();
  const id = run(c, `EN().requests.find(r => r.kind === 'proposal' && r.state === 'pending').id`);
  refuses(c, `rejectRequest('${id}', 'P-RAVI', '  ')`, /reason for the rejection/);
  run(c, `rejectRequest('${id}', 'P-RAVI', 'Use the existing scatter tray')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'rejected');
  refuses(c, `approveRequest('${id}', 'P-RAVI')`, /not waiting/);
  assert.ok(run(c, `notifications('P-ANJ').some(n => n.title === 'Request rejected' && n.text.includes('Use the existing scatter tray'))`));
});

test('P-6 movement: approval moves the item through move() and the request is Completed at once', () => {
  const c = full();
  const item = 'EB-0001';                                                                            // Bamboo poles, Small Mammal Store
  refuses(c, `createRequest('P-ANJ', { kind: 'move', item: '${item}', to: 'L-TG1', reason: 'Rotation' })`, /Use a transfer/);    // another section: PRD rule
  const id = run(c, `createRequest('P-ANJ', { kind: 'move', item: '${item}', to: 'L-MGE', reason: 'Rotation', qty: 10 })`);
  refuses(c, `createRequest('P-ANJ', { kind: 'move', item: '${item}', to: 'L-OTP', reason: 'Rotation' })`, /already has an open movement/);
  run(c, `approveRequest('${id}', 'P-RAVI')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'completed');
  const moved = run(c, `ereqOf('${id}').result`);                                                    // 10 of the batch split off and moved
  assert.equal(run(c, `itemOf('${moved}').loc`), 'L-MGE');
  assert.equal(run(c, `itemOf('${moved}').qty`), 10);
  assert.ok(run(c, `itemOf('${moved}').history.some(h => h.act === 'Moved' && h.note.includes('${id}'))`));
});

test('P-7 transfer: inter-site only; approved → dispatched (In transit) → received (Completed); the record keeps its ID', () => {
  const c = full();
  refuses(c, `createRequest('P-ANJ', { kind: 'transfer', item: 'EB-0001', toSite: 'S-MAIN', toSection: 'SEC-BRD', receiver: 'P-LAKS', reason: 'x' })`, /another site/);
  const id = run(c, `EN().requests.find(r => r.kind === 'transfer' && r.state === 'pending').id`);
  const item = run(c, `ereqOf('${id}').item`), n = run(c, `D.items.length`);
  run(c, `approveRequest('${id}', 'P-MEERA')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'approved');                                       // approval is not dispatch
  assert.equal(run(c, `transferStage(ereqOf('${id}'))`), 'dispatch');
  assert.equal(run(c, `itemOf('${item}').status`), 'storage');
  refuses(c, `dispatchTransfer('${id}', 'P-ANJ')`, /permission/);                                    // the requester cannot dispatch
  run(c, `dispatchTransfer('${id}', 'P-LAKS', { note: 'Van 2' })`);                                  // sending supervisor
  assert.equal(run(c, `itemOf('${item}').status`), 'transit');
  assert.equal(run(c, `transferStage(ereqOf('${id}'))`), 'transit');
  refuses(c, `dispatchTransfer('${id}', 'P-LAKS')`, /already dispatched/);
  refuses(c, `acknowledge('${item}', 'P-RAVI', { loc: 'L-QRB' })`, /receiving custodian/);
  run(c, `acknowledge('${item}', 'P-ARUN', { loc: 'L-QRB', cond: 'good' })`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'completed');
  assert.deepEqual(val(c, `[itemOf('${item}').site, itemOf('${item}').loc, itemOf('${item}').custodian]`), ['S-RESC', 'L-QRB', 'P-ARUN']);
  assert.equal(run(c, `D.items.length`), n);                                                        // no new record
  refuses(c, `acknowledge('${item}', 'P-ARUN', { loc: 'L-QRB' })`, /not in transit/);
  assert.ok(run(c, `notifications('P-ANJ').some(x => x.title === 'Transfer received' && x.text.includes('${id}'))`));
});

test('P-8 edit and withdraw while pending; withdrawn goes back to Draft; a draft is submitted again or deleted', () => {
  const c = full();
  const id = run(c, `EN().requests.find(r => r.kind === 'existing' && r.state === 'pending').id`);
  run(c, `updateRequest('${id}', 'P-ANJ', Object.assign({}, ereqOf('${id}'), { notes: 'Edited note' }))`);
  assert.equal(run(c, `ereqOf('${id}').notes`), 'Edited note');
  refuses(c, `withdrawRequest('${id}', 'P-RAVI')`, /Only the requester/);
  run(c, `withdrawRequest('${id}', 'P-ANJ')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'draft');
  run(c, `submitRequest('${id}', 'P-ANJ')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'pending');
  const draft = run(c, `EN().requests.find(r => r.state === 'draft').id`);
  refuses(c, `submitRequest('${draft}', 'P-ANJ')`, /reason/);                                       // a draft is checked when it is submitted
  run(c, `deleteDraft('${draft}', 'P-ANJ')`);
  assert.equal(run(c, `!!ereqOf('${draft}')`), false);
  const done = run(c, `EN().requests.find(r => r.state === 'completed').id`);
  refuses(c, `updateRequest('${done}', 'P-ANJ', {})`, /draft or a pending/);
});

test('P-9 proposal: needs name, type, description and justification; a listed name is refused; approval does not create a product', () => {
  const c = full();
  refuses(c, `createRequest('P-ANJ', { kind: 'proposal', name: 'Leaf wrap', type: 'food', description: 'x', justification: '', site: 'S-MAIN' })`, /why/);
  refuses(c, `createRequest('P-ANJ', { kind: 'proposal', name: 'Leaf wrap', type: 'other', description: 'x', justification: 'y', site: 'S-MAIN' })`, /type/);
  refuses(c, `createRequest('P-ANJ', { kind: 'proposal', name: 'hay net', type: 'food', description: 'x', justification: 'y', site: 'S-MAIN' })`, /already in the listing/);
  const n = run(c, `enrProducts().length`);
  const id = run(c, `createRequest('P-ANJ', { kind: 'proposal', name: 'Leaf wrap', type: 'food', description: 'Banana leaf parcel', justification: 'Unwrapping', site: 'S-MAIN' })`);
  run(c, `approveRequest('${id}', 'P-MEERA')`);                                                    // no section: the site manager reviews
  assert.equal(run(c, `ereqOf('${id}').state`), 'approved');
  assert.equal(run(c, `enrProducts().length`), n);
});

test('P-10 custodian: direct reassignment to a person of the site, written to the history and notified; no approval', () => {
  const c = full();
  const item = run(c, `D.items.find(i => i.name === 'Forage box' && isActive(i)).id`);
  refuses(c, `reassignCustodian('${item}', 'P-PRIYA', { to: 'P-ANJ' })`, /permission/);
  refuses(c, `reassignCustodian('${item}', 'P-ANJ', { to: 'P-ROSY' })`, /biologist, supervisor or site manager/);
  refuses(c, `reassignCustodian('${item}', 'P-ANJ', { to: 'P-ARUN' })`, /of this site/);
  run(c, `reassignCustodian('${item}', 'P-ANJ', { to: 'P-ANJ' })`);
  assert.equal(run(c, `itemOf('${item}').custodian`), 'P-ANJ');
  assert.equal(run(c, `itemOf('${item}').history[0].act`), 'Custodian changed');
  assert.ok(run(c, `notifications('P-RAVI').some(n => n.title === 'Custodian changed' && n.text.includes('${item}'))`));
});

test('P-11 reviewers see pending requests in My tasks and notifications; decided requests leave them', () => {
  const c = full();
  const n = run(c, `productTasks('P-RAVI').length`);
  assert.ok(n > 0);
  assert.equal(run(c, `productTasks('P-ANJ').length`), 0);
  const id = run(c, `productTasks('P-RAVI')[0].ref`);
  assert.ok(run(c, `notifications('P-RAVI').some(x => x.href === '#/enrappr/${id}')`));
  run(c, `rejectRequest('${id}', 'P-RAVI', 'Not now')`);
  assert.equal(run(c, `productTasks('P-RAVI').length`), n - 1);
  assert.equal(run(c, `notifications('P-RAVI').some(x => x.href === '#/enrappr/${id}')`), false);
});

test('P-12 a revised rejected request starts a new draft and keeps the rejected one', () => {
  const c = full();
  const id = run(c, `EN().requests.find(r => r.state === 'rejected').id`);
  const copy = run(c, `reviseRequest('${id}', 'P-ANJ')`);
  assert.equal(run(c, `ereqOf('${id}').state`), 'rejected');
  assert.equal(run(c, `ereqOf('${copy}').state`), 'draft');
  assert.equal(run(c, `ereqOf('${copy}').from`), id);
});
