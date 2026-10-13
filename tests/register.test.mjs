// The enrichment item register (src/model/register.js) on the app's full data: product definitions vs physical items, receipt
// from the existing ticket in each tracking mode, custodian assignment, expected usable life and reviews, assignment for use.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../src/model/', import.meta.url).pathname;
function full() {
  const c = vm.createContext({ console });
  for (const f of ['model.js', 'seed.js', 'seed-demo.js', 'work.js', 'activity.js', 'products.js', 'register.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), c, { filename: f });
  vm.runInContext(`boot(); workSeed(); activitySeed(); productSeed(); registerSeed(); setNow(NOW_DEFAULT)`, c);
  return c;
}
const run = (c, js) => vm.runInContext(js, c);
const val = (c, js) => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, c));
const refuses = (c, js, re) => assert.throws(() => run(c, js), re);
const chairs = (c, extra = '') => val(c, `D.items.filter(i => productOf(i)?.name === 'Metal chair' ${extra}).map(i => i.id)`);

test('R-1 one product definition, one record per physical item; IDs are unique', () => {
  const c = full();
  assert.equal(run(c, `D.products.filter(p => p.name === 'Metal chair').length`), 1);
  assert.equal(chairs(c).length, 3);
  assert.ok(chairs(c).every(id => /^EF-\d{4}$/.test(id)));
  assert.equal(run(c, `new Set(D.items.map(i => i.id)).size`), run(c, `D.items.length`));
  assert.equal(run(c, `new Set(D.products.map(p => p.name.toLowerCase())).size`), run(c, `D.products.length`));
  assert.ok(run(c, `enrItems().every(i => productOf(i) && productOf(i).cat === i.cat)`));            // tracking follows the product's category
  assert.equal(run(c, `enrItems().some(i => i.name === 'Small transport cage')`), false);            // equipment has no definition
});

test('R-2 receipt, individual tracking: one record per unit, linked to the ticket, transfer and product; no new definition', () => {
  const c = full(), np = run(c, `D.products.length`);
  const ids = val(c, `receiveDelivery('TK-2064', 'P-RAVI', { qty: 4, loc: 'L-SST', custodian: 'P-RAVI' })`);
  assert.equal(ids.length, 4);
  assert.equal(run(c, `D.products.length`), np);
  const it = val(c, `itemOf('${ids[0]}')`);
  assert.deepEqual([it.product, it.ticket, it.mt, it.status, it.custodian, it.cond, it.lifeStart], [run(c, `D.products.find(p => p.name === 'Metal chair').id`), 'TK-2064', 'MT-7755', 'storage', 'P-RAVI', 'good', '2026-10-10']);
  assert.equal(run(c, `reviewDue(itemOf('${ids[0]}'))`), '2027-10-10');                             // 12 months from the received date
  assert.equal(run(c, `itemOf('${ids[0]}').history[0].act`), 'Received');
  refuses(c, `receiveDelivery('TK-2064', 'P-RAVI', { qty: 4, loc: 'L-SST' })`, /already received/);
});

test('R-3 receipt, group tracking: the product is defined once at receipt and one group record holds the quantity', () => {
  const c = full(), np = run(c, `D.products.length`);
  refuses(c, `receiveDelivery('TK-2053', 'P-LAKS', { qty: 40, loc: 'L-BST', custodian: 'P-LAKS' })`, /define the product/);
  refuses(c, `receiveDelivery('TK-2053', 'P-LAKS', { qty: 40, loc: 'L-BST', custodian: 'P-LAKS', define: { name: 'Natural perches', type: 'environmental' } })`, /material/);
  const ids = val(c, `receiveDelivery('TK-2053', 'P-LAKS', { qty: 40, loc: 'L-BST', custodian: 'P-LAKS', define: { name: 'Natural perches', type: 'environmental', material: 'Wood', life: { n: 3, unit: 'months' } } })`);
  assert.equal(ids.length, 1);
  assert.deepEqual(val(c, `[itemOf('${ids[0]}').mode, itemOf('${ids[0]}').qty, productOf(itemOf('${ids[0]}')).cat]`), ['batch', 40, 'CAT-C']);
  assert.equal(run(c, `D.products.length`), np + 1);
  refuses(c, `saveProduct('P-LAKS', { name: 'natural perches', type: 'environmental', cat: 'CAT-C', material: 'Wood' })`, /already defined/);
});

test('R-4 receipt, not tracked: the delivery is confirmed and no record is created', () => {
  const c = full(), n = run(c, `D.items.length`);
  assert.deepEqual(val(c, `receiveDelivery('TK-2062', 'P-RAVI', { qty: 50 })`), []);
  assert.equal(run(c, `D.items.length`), n);
  assert.equal(run(c, `by('tickets', 'TK-2062').status`), 'received');
});

test('R-5 damaged on arrival goes to assessment, never Available', () => {
  const c = full();
  const [id] = val(c, `receiveDelivery('TK-2064', 'P-RAVI', { qty: 4, loc: 'L-SST', custodian: 'P-RAVI', cond: 'damaged', fit: false, notes: 'Bent leg' })`);
  assert.deepEqual(val(c, `[itemOf('${id}').status, itemOf('${id}').cond, availableForUse(itemOf('${id}'))]`), ['assessment', 'damaged', false]);
  assert.equal(run(c, `itemOf('${id}').repair.issue`), 'Not fit on receipt');
});

test('R-6 awaiting assignment: no one is picked silently; the item cannot go into use until a custodian is assigned', () => {
  const c = full(), id = val(c, `D.items.find(i => i.ticket === 'TK-2049').id`);
  assert.equal(run(c, `itemOf('${id}').custodian`), '');
  assert.equal(run(c, `availableForUse(itemOf('${id}'))`), false);
  assert.ok(val(c, `registerTasks('P-LAKS')`).some(t => t.kind === 'assign' && t.ref === id));
  refuses(c, `assignForUse('${id}', 'P-LAKS', { to: 'L-AV3' })`, /Assign a custodian/);
  refuses(c, `move('${id}', 'P-LAKS', { to: 'L-AV3', reason: 'Rotation' })`, /Assign a custodian/);
  refuses(c, `createRequest('P-ANJ', { kind: 'move', item: '${id}', to: 'L-AV3', reason: 'Rotation' })`, /Assign a custodian/);
  refuses(c, `receiveDelivery('TK-2064', 'P-RAVI', { qty: 4, loc: 'L-SST', custodian: 'P-ARUN' })`, /of this site/);
  run(c, `reassignCustodian('${id}', 'P-LAKS', { to: 'P-LAKS' })`);
  assert.deepEqual(val(c, `[itemOf('${id}').history[0].act, itemOf('${id}').history[0].to]`), ['Custodian assigned', 'Lakshmi Menon']);
  run(c, `assignForUse('${id}', 'P-LAKS', { to: 'L-AV3' })`);
  assert.equal(run(c, `itemOf('${id}').status`), 'inuse');
});

test('R-7 usable life: product default, item override with a reason, calendar months, product edits flow to items', () => {
  const c = full();
  assert.equal(run(c, `monthsLater('2026-01-31', 1)`), '2026-02-28');
  assert.equal(run(c, `addLife('2026-03-01', { n: 2, unit: 'weeks' })`), '2026-03-15');
  const [a, b] = chairs(c);
  assert.equal(run(c, `lifeText(lifeOf(itemOf('${a}')))`), '12 months');
  refuses(c, `setItemLife('${a}', 'P-RAVI', { life: { n: 18, unit: 'months' } })`, /reason/);
  refuses(c, `setItemLife('${a}', 'P-ANJ', { life: { n: 18, unit: 'months' }, why: 'x' })`, /permission/);
  run(c, `setItemLife('${a}', 'P-RAVI', { life: { n: 18, unit: 'months' }, why: 'Indoor use only' })`);
  assert.equal(run(c, `reviewDue(itemOf('${a}'))`), '2028-01-22');
  assert.deepEqual(val(c, `[itemOf('${a}').history[0].act, itemOf('${a}').history[0].from, itemOf('${a}').history[0].to]`), ['Usable life changed', '12 months', '18 months']);
  const pid = run(c, `itemOf('${b}').product`);
  run(c, `saveProduct('P-MEERA', Object.assign({}, prodOf('${pid}'), { life: { n: 24, unit: 'months' } }))`);
  assert.equal(run(c, `reviewDue(itemOf('${b}'))`), '2028-07-22');                                   // follows the product
  assert.equal(run(c, `reviewDue(itemOf('${a}'))`), '2028-01-22');                                   // the override stays
  refuses(c, `saveProduct('P-MEERA', Object.assign({}, prodOf('${pid}'), { cat: 'CAT-A' }))`, /category/);
  refuses(c, `saveProduct('P-ANJ', { name: 'Ladder', type: 'environmental', cat: 'CAT-B', material: 'Wood' })`, /permission/);
  assert.match(run(c, `prodOf('${pid}').log[0].note`), /Usable life: 12 months → 24 months/);
});

test('R-8 a passed review date never changes status or condition; a person records the review', () => {
  const c = full(), id = val(c, `enrItems().find(i => reviewState(i) === 'due' && i.custodian === 'P-LAKS').id`);
  const before = val(c, `[itemOf('${id}').status, itemOf('${id}').cond]`);
  run(c, `setNow('2027-06-01T10:00')`);
  assert.deepEqual(val(c, `[itemOf('${id}').status, itemOf('${id}').cond]`), before);
  run(c, `setNow(NOW_DEFAULT)`);
  assert.ok(val(c, `registerTasks('P-LAKS')`).some(t => t.kind === 'review' && t.ref === id));
  assert.ok(val(c, `notifications('P-LAKS')`).some(n => n.title === 'Life review overdue' && n.text.includes(id)));
  refuses(c, `recordReview('${id}', 'P-LAKS', { outcome: 'fit', next: '2026-10-01' })`, /after today/);
  refuses(c, `recordReview('${id}', 'P-ANJ', { outcome: 'fit', next: '2027-01-01' })`, /permission/);
  run(c, `recordReview('${id}', 'P-LAKS', { outcome: 'fit', next: '2027-01-10', note: 'Sound' })`);
  assert.deepEqual(val(c, `[reviewState(itemOf('${id}')), reviewDue(itemOf('${id}')), itemOf('${id}').history[0].act]`), ['ok', '2027-01-10', 'Life reviewed']);
  refuses(c, `recordReview('${id}', 'P-LAKS', { outcome: 'replace' })`, /why/);
  run(c, `recordReview('${id}', 'P-LAKS', { outcome: 'replace', note: 'Worn through' })`);
  assert.deepEqual(val(c, `[reviewState(itemOf('${id}')), itemOf('${id}').status]`), ['replace', before[0]]);
  assert.equal(run(c, `lifecycleEvents(itemOf('${id}'))[0].type`), 'life');
});

test('R-9 assignment for use: same record, enclosure and optional animals, previous location kept; unavailable items refused', () => {
  const c = full(), id = chairs(c, `&& i.status === 'storage'`)[0], n = run(c, `D.items.length`);
  assert.equal(run(c, `availableForUse(itemOf('${id}'))`), true);
  refuses(c, `assignForUse('${id}', 'P-ANJ', { to: 'L-PE2' })`, /permission/);                          // biologist: movement request
  refuses(c, `assignForUse('${id}', 'P-RAVI', { to: 'L-PST' })`, /enclosure/);
  refuses(c, `assignForUse('${id}', 'P-RAVI', { to: 'L-PE2', animals: ['${run(c, `A().animals.find(a => a.loc !== 'L-PE2').id`)}'] })`, /live in this enclosure/);
  const an = run(c, `A().animals.find(a => a.loc === 'L-PE2').id`);
  assert.equal(run(c, `assignForUse('${id}', 'P-RAVI', { to: 'L-PE2', animals: ['${an}'] })`), id);
  assert.equal(run(c, `D.items.length`), n);
  const h = val(c, `itemOf('${id}').history.find(e => e.act === 'Moved')`);
  assert.deepEqual([h.from, h.to], ['Primate Store · Primates', 'Primate Enclosure 2 · Primates']);
  assert.match(h.note, /Assigned for use/);
  assert.deepEqual(val(c, `[itemOf('${id}').status, productAssoc(itemOf('${id}')).animals]`), ['inuse', [an]]);
  const bad = val(c, `enrItems().filter(i => ['repair', 'transit', 'assessment'].includes(i.status)).map(i => [i.id, i.site === 'S-MAIN' ? 'P-MEERA' : 'P-ARUN'])`);
  assert.ok(bad.length);
  bad.forEach(([x, who]) => refuses(c, `assignForUse('${x}', '${who}', { to: 'L-PE2' })`, /cannot be assigned/));
});
