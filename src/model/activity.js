// src/model/activity.js — PROPOSED: the enrichment activity module from the Figma flows (5iizWNcFdePpGJpenKpaTG, 44:374 and 553:801),
// joined to the item register of model.js at four points: the inventory check reads the register, a material request reuses a
// stored item before anything is bought, the materials used in a session are logged on each item, and a safety incident in a
// session flags the item into the PRD repair flow. No DOM; loaded after model.js and work.js.
// Names: "Activity type" (social, cognitive …) never "category" (the PRD's A–D); "Observation" (how the animal responded) never "assessment".

const ACT_TYPE = { social: 'Social', cognitive: 'Cognitive', environmental: 'Environmental', food: 'Food-based', sensory: 'Sensory' };
const ACT_STATE = { pending: 'Awaiting approval', approved: 'Approved', changes: 'Changes requested', retired: 'Retired' };
const PLAN_FREQ = { daily: 'Daily', alt: 'Alternate days', weekly: 'Weekly', once: 'Once' };
const SLOT = { '09:00': 'Morning', '12:00': 'Midday', '15:00': 'Afternoon' };
const ENGAGE = { none: 'No interest', low: 'Brief interest', medium: 'Engaged', high: 'Highly engaged' };
const BEHAVIOURS = ['Foraging', 'Manipulation', 'Play', 'Exploration', 'Social', 'Avoidance', 'Stereotypic'];
const SUCCESS = { yes: 'Successful', partly: 'Partly', no: 'Not successful' };
const SKIP_REASONS = ['Materials not available', 'Animal unwell', 'Weather', 'Staff shortage', 'Other'];
const MREQ_STATE = { review: 'To review', issued: 'Issued from store', requested: 'Sent to request module', declined: 'Declined' };

// keepers run sessions and ask for materials; the biologist approves activities; the custodian (supervisor) owns the inventory decision
Object.assign(CAN, {
  actCreate: ['keeper', 'sup', 'bio', 'afm', 'admin'], actApprove: ['bio'], actAssign: ['sup', 'afm', 'admin'],
  sessionRecord: ['keeper', 'sup', 'afm', 'admin'], matRequest: ['keeper', 'sup'], matReview: ['sup', 'afm', 'admin'],
});

const A = () => D.act || (D.act = { species: [], animals: [], activities: [], plans: [], sessions: [], requests: [] });
const speciesOf = id => A().species.find(x => x.id === id);
const animalOf = id => A().animals.find(x => x.id === id);
const activityOf = id => A().activities.find(x => x.id === id);
const planOf = id => A().plans.find(x => x.id === id);
const sessionOf = id => A().sessions.find(x => x.id === id);
const mreqOf = id => A().requests.find(x => x.id === id);
const animalsOf = spId => A().animals.filter(a => a.species === spId);
// the enclosures where a species (or one animal) lives
const homesOf = (kind, id) => [...new Set(kind === 'animal' ? [animalOf(id)?.loc].filter(Boolean) : animalsOf(id).map(a => a.loc))];
const planSpecies = p => p.kind === 'animal' ? animalOf(p.target).species : p.target;
const planName = p => p.kind === 'animal' ? `${animalOf(p.target).name} · ${speciesOf(animalOf(p.target).species).name}` : speciesOf(p.target).name;

/* ---------- activities: create → biologist approval ---------- */
// saveActivity(by, {name, type, sub, goal, species[], mins, materials[], safety, additives}) — every new activity waits for the biologist
function saveActivity(byId, o) {
  must(byId, 'actCreate');
  need(o.name, 'Write the activity name.');
  if (!ACT_TYPE[o.type]) fail('Pick the activity type.');
  need(o.goal, 'Write the goal.');
  need(o.species, 'Pick at least one species.');
  (o.species || []).forEach(s => speciesOf(s) || fail('Species not found.'));
  if (A().activities.some(a => a.name.trim().toLowerCase() === o.name.trim().toLowerCase() && a.state !== 'retired')) fail('An activity with this name already exists.');
  const a = { id: nextId('ACT'), name: o.name.trim(), type: o.type, sub: o.sub || '', goal: o.goal, species: o.species.slice(), mins: +o.mins || 30,
    materials: (o.materials || []).slice(), safety: o.safety || '', additives: o.additives || '', state: 'pending', by: byId, at: NOW, review: null, log: [] };
  a.log.unshift({ at: NOW, by: byId, act: 'Created' });
  A().activities.push(a);
  return a.id;
}
// reviewActivity(id, by, ok, note) — approve, or send back with a note; only an approved activity can be assigned
function reviewActivity(id, byId, ok, note = '') {
  const a = activityOf(id) || fail('Activity not found.');
  must(byId, 'actApprove');
  if (a.state !== 'pending') fail('This activity is not waiting for approval.');
  if (!ok) need(note, 'Write what needs to change.');
  a.state = ok ? 'approved' : 'changes';
  a.review = { ok, by: byId, at: NOW, note };
  a.log.unshift({ at: NOW, by: byId, act: ok ? 'Approved' : 'Changes requested', note });
  return a.id;
}
// resubmit(id, by, changes) — the author edits an activity sent back and it waits for approval again
function resubmitActivity(id, byId, o = {}) {
  const a = activityOf(id) || fail('Activity not found.');
  must(byId, 'actCreate');
  if (a.state !== 'changes') fail('Only an activity sent back can be resubmitted.');
  Object.assign(a, Object.fromEntries(Object.entries(o).filter(([k]) => ['goal', 'sub', 'mins', 'materials', 'safety', 'additives', 'species'].includes(k))));
  a.state = 'pending';
  a.log.unshift({ at: NOW, by: byId, act: 'Resubmitted' });
  return a.id;
}

/* ---------- assignment: an approved activity → a species or one animal, in one enclosure, on a schedule ---------- */
// assignActivity(by, {activity, kind: species|animal, target, loc, freq, start, time, keeper})
function assignActivity(byId, o) {
  const a = activityOf(need(o.activity, 'Pick the activity.')) || fail('Activity not found.');
  if (a.state !== 'approved') fail('Only an approved activity can be assigned.');
  const kind = o.kind === 'animal' ? 'animal' : 'species';
  need(o.target, kind === 'animal' ? 'Pick the animal.' : 'Pick the species.');
  const sp = kind === 'animal' ? animalOf(o.target)?.species : o.target;
  if (!sp || !speciesOf(sp)) fail(kind === 'animal' ? 'Animal not found.' : 'Species not found.');
  if (!a.species.includes(sp)) fail('This activity is not approved for this species.');
  const loc = locOf(need(o.loc, 'Pick the enclosure.')) || fail('Pick the enclosure.');
  if (loc.kind !== 'enclosure' || !homesOf(kind, o.target).includes(loc.id)) fail('Pick an enclosure where the animals live.');
  must(byId, 'actAssign', { section: loc.section, site: loc.site });
  if (!PLAN_FREQ[o.freq]) fail('Pick how often.');
  need(o.start, 'Pick the start date.');
  const k = person(need(o.keeper, 'Pick the keeper.'));
  if (!k || k.role !== 'keeper' || !k.sections.includes(loc.section)) fail('Pick a keeper of this section.');
  if (A().plans.some(p => p.active && p.activity === a.id && p.target === o.target && p.loc === loc.id)) fail('This activity is already assigned here.');
  const p = { id: nextId('PL'), activity: a.id, kind, target: o.target, loc: loc.id, section: loc.section, site: loc.site, freq: o.freq, start: o.start,
    time: SLOT[o.time] ? o.time : '09:00', keeper: k.id, active: true, by: byId, at: NOW };
  A().plans.push(p);
  return p.id;
}
function endPlan(id, byId) {
  const p = planOf(id) || fail('Plan not found.');
  must(byId, 'actAssign', p);
  p.active = false; p.ended = { at: NOW, by: byId };
}
// the dates a plan runs between two days (inclusive)
function planDates(p, from, to) {
  const out = [];
  for (let d = p.start < from ? from : p.start; d <= to; d = addDays(d, 1)) {
    const n = daysBetween(p.start, d);
    if (p.freq === 'daily' || (p.freq === 'alt' && n % 2 === 0) || (p.freq === 'weekly' && n % 7 === 0) || (p.freq === 'once' && n === 0)) out.push(d);
    if (p.freq === 'once') break;
  }
  return out.filter(d => !p.ended || d <= day(p.ended.at));
}
const sessionFor = (planId, date) => A().sessions.find(s => s.plan === planId && s.date === date);
// occurrences(from, to) — every planned session in a period, with the session record when there is one
function occurrences(from, to) {
  return A().plans.flatMap(p => planDates(p, from, to).map(date => ({ key: p.id + '@' + date, plan: p, date, s: sessionFor(p.id, date) })));
}

/* ---------- inventory check: reads the item register ---------- */
// for each material of the activity, at the plan's enclosure: ready (a usable item is there) · store (usable in a store of the
// section, so it can be issued) · blocked (items there, none usable: under assessment, repair, unsafe) · none (nothing in the section)
function inventoryCheck(actId, locId) {
  const a = activityOf(actId), loc = locOf(locId);
  return (a.materials || []).map(name => {
    const same = D.items.filter(it => isActive(it) && it.name === name && it.section === loc.section);
    const here = same.filter(it => it.loc === loc.id), ok = here.filter(usableForAnimals);
    if (ok.length) return { name, state: 'ready', items: ok };
    const stored = same.filter(it => locOf(it.loc)?.kind === 'store' && usableForAnimals(it));
    if (stored.length) return { name, state: 'store', items: stored };
    if (here.length) return { name, state: 'blocked', items: here };
    return { name, state: 'none', items: [] };
  });
}
const checkReady = list => list.every(m => m.state === 'ready');

/* ---------- sessions: run, observe, rate ---------- */
// recordSession(by, {plan, date, mins, materials[], engage, behaviours[], success, rating, comment, photos, safety: {item, issue, notes}})
function recordSession(byId, o) {
  const p = planOf(need(o.plan, 'Pick the session.')) || fail('Plan not found.');
  must(byId, 'sessionRecord', p);
  if (person(byId).role === 'keeper' && p.keeper !== byId && !person(byId).sections.includes(p.section)) fail('This session belongs to another keeper.');
  const date = o.date || day(NOW);
  if (date > day(NOW)) fail('A session cannot be recorded before its day.');
  if (!planDates(p, date, date).length) fail('This plan has no session on this day.');
  if (sessionFor(p.id, date)) fail('This session is already recorded.');
  if (!ENGAGE[o.engage]) fail('Pick how the animal engaged.');
  if (!SUCCESS[o.success]) fail('Pick whether it was successful.');
  const rating = +o.rating; if (!(rating >= 1 && rating <= 5)) fail('Give a rating from 1 to 5.');
  const used = (o.materials || []).map(id => itemOf(id) || fail('Item not found.'));
  used.forEach(it => { if (it.loc !== p.loc || !usableForAnimals(it)) fail(`${it.name} (${it.id}) is not cleared for use in this enclosure.`); });
  const a = activityOf(p.activity);
  const s = { id: nextId('SES'), plan: p.id, activity: p.activity, date, at: NOW, by: byId, state: 'done', mins: +o.mins || a.mins, materials: used.map(it => it.id),
    engage: o.engage, behaviours: (o.behaviours || []).slice(), success: o.success, rating, comment: o.comment || '', photos: o.photos || [], safety: null };
  // a safety incident with an item used in the session flags that item unsafe: it leaves animal use and goes to the PRD checks
  if (o.safety && o.safety.item) {
    if (!s.materials.includes(o.safety.item)) fail('Pick an item used in this session.');
    need(o.safety.issue, 'Pick the issue type.');
    const rp = flagIssue(o.safety.item, byId, { issue: o.safety.issue, cond: 'unsafe', notes: [o.safety.notes, `Safety incident in ${a.name} (${s.id})`].filter(Boolean).join(' · '), photos: o.safety.photos || s.photos });
    s.safety = { item: o.safety.item, issue: o.safety.issue, notes: o.safety.notes || '', repair: rp };
  }
  used.forEach(it => log(it, byId, 'Used in activity', { note: a.name, ref: s.id }));
  A().sessions.push(s);
  return s.id;
}
function skipSession(byId, o) {
  const p = planOf(need(o.plan, 'Pick the session.')) || fail('Plan not found.');
  must(byId, 'sessionRecord', p);
  const date = o.date || day(NOW);
  if (!planDates(p, date, date).length) fail('This plan has no session on this day.');
  if (sessionFor(p.id, date)) fail('This session is already recorded.');
  need(o.reason, 'Pick the reason.');
  const s = { id: nextId('SES'), plan: p.id, activity: p.activity, date, at: NOW, by: byId, state: 'skipped', reason: o.reason, comment: o.comment || '', materials: [], behaviours: [], photos: [], safety: null };
  A().sessions.push(s);
  return s.id;
}

/* ---------- material requests: reuse a stored item first, else the existing request module ---------- */
// requestMaterial(by, {activity, loc, name, qty, note}) — the custodian of the section reviews it
function requestMaterial(byId, o) {
  const a = activityOf(need(o.activity, 'Pick the activity.')) || fail('Activity not found.');
  if (a.state !== 'approved') fail('Only an approved activity can have materials requested.');
  const loc = locOf(need(o.loc, 'Pick the enclosure.')) || fail('Pick the enclosure.');
  if (loc.kind !== 'enclosure') fail('Pick an enclosure.');
  must(byId, 'matRequest', { section: loc.section, site: loc.site });
  need(o.name, 'Pick the material.');
  const qty = +o.qty || 1; if (qty < 1) fail('Enter a quantity of 1 or more.');
  if (A().requests.some(r => r.state === 'review' && r.activity === a.id && r.loc === loc.id && r.name === o.name)) fail('This material is already requested for this enclosure.');
  const r = { id: nextId('MR'), activity: a.id, loc: loc.id, section: loc.section, site: loc.site, name: o.name, qty, note: o.note || '', by: byId, at: NOW, state: 'review', decision: null };
  A().requests.push(r);
  return r.id;
}
// usable items of that name in the stores of the section: offered before buying (PRD: reuse and rotation)
const storedFor = r => D.items.filter(it => isActive(it) && it.name === r.name && it.section === r.section && locOf(it.loc)?.kind === 'store' && usableForAnimals(it));
// reviewMaterial(id, by, {decision: issue|request|decline, item, note})
function reviewMaterial(id, byId, o) {
  const r = mreqOf(id) || fail('Request not found.');
  must(byId, 'matReview', r);
  if (r.state !== 'review') fail('This request is already decided.');
  const stored = storedFor(r);
  if (o.decision === 'issue') {
    const it = itemOf(need(o.item, 'Pick the stored item.'));
    if (!it || !stored.includes(it)) fail('Pick a usable item from the store.');
    const moved = move(it.id, byId, { to: r.loc, reason: `Issued for ${activityOf(r.activity).name} (${r.id})`, qty: it.mode === 'individual' ? 1 : Math.min(r.qty, it.qty) });
    r.state = 'issued'; r.decision = { by: byId, at: NOW, item: moved, note: o.note || '' };
  } else if (o.decision === 'request') {
    if (stored.length) need(o.note, 'A usable item is in the store. Write why a new one is needed.');
    r.state = 'requested'; r.decision = { by: byId, at: NOW, ref: 'REQ-' + String(4100 + A().requests.indexOf(r)), note: o.note || '' };
  } else if (o.decision === 'decline') {
    need(o.note, 'Write the reason.');
    r.state = 'declined'; r.decision = { by: byId, at: NOW, note: o.note };
  } else fail('Pick a decision.');
  return r.id;
}

/* ---------- results ---------- */
const SCORE = { yes: 1, partly: .5, no: 0 };
function sessionStats(list) {
  const done = list.filter(s => s.state === 'done');
  return { n: done.length, skipped: list.length - done.length, success: done.length ? Math.round(done.reduce((t, s) => t + SCORE[s.success], 0) / done.length * 100) : null,
    rating: done.length ? Math.round(done.reduce((t, s) => t + s.rating, 0) / done.length * 10) / 10 : null, safety: done.filter(s => s.safety).length,
    last: done.map(s => s.date).sort().pop() || '' };
}
const activityStats = id => sessionStats(A().sessions.filter(s => s.activity === id));
const speciesStats = spId => sessionStats(A().sessions.filter(s => planSpecies(planOf(s.plan)) === spId));
// approved activities with no active plan, or no session in the last 30 days
function unusedActivities() {
  const since = addDays(day(NOW), -30);
  return A().activities.filter(a => a.state === 'approved').map(a => {
    const plans = A().plans.filter(p => p.activity === a.id && p.active), last = activityStats(a.id).last;
    return { a, plans: plans.length, last, unused: !plans.length || !last || last < since };
  }).filter(x => x.unused);
}

/* ---------- work for a person (merged into My tasks) ---------- */
function activityTasks(byId) {
  const p = person(byId), out = [], today = day(NOW);
  if (['keeper', 'sup'].includes(p.role)) occurrences(addDays(today, -2), today).filter(o => !o.s && o.plan.active && (o.plan.keeper === p.id || (p.role === 'sup' && p.sections.includes(o.plan.section) && o.date < today)))
    .forEach(o => out.push({ kind: 'session', ref: o.key, due: o.date, title: activityOf(o.plan.activity).name, meta: [planName(o.plan), locOf(o.plan.loc).name] }));
  if (p.role === 'bio' || p.role === 'admin') A().activities.filter(a => a.state === 'pending').forEach(a => out.push({ kind: 'actApprove', ref: a.id, due: addDays(day(a.at), D.config.assessDays), title: a.name, meta: ['Approve activity', ACT_TYPE[a.type]] }));
  A().requests.filter(r => r.state === 'review' && can(byId, 'matReview', r)).forEach(r => out.push({ kind: 'matReview', ref: r.id, due: addDays(day(r.at), 2), title: `${r.name}${r.qty > 1 ? ' × ' + r.qty : ''}`, meta: ['Material request', locOf(r.loc).name] }));
  A().activities.filter(a => a.state === 'changes' && a.by === byId).forEach(a => out.push({ kind: 'actChanges', ref: a.id, due: '', title: a.name, meta: ['Changes requested', a.review.note] }));
  return out;
}

/* ---------- demo data (played through the rules above) ---------- */
function activitySeed() {
  const at = setNow, a = A();
  D.people.push(
    { id: 'P-PRIYA', name: 'Priya Shetty', role: 'keeper', sites: ['S-MAIN'], sections: ['SEC-PRI', 'SEC-SML'] },
    { id: 'P-IMRAN', name: 'Imran Sheikh', role: 'keeper', sites: ['S-MAIN'], sections: ['SEC-CAR', 'SEC-BRD', 'SEC-HRB'] },
    { id: 'P-ROSY', name: 'Rosy Mathew', role: 'keeper', sites: ['S-RESC'], sections: ['SEC-RCW'] },
  );
  const SP = (id, name, sci, cls, herd) => { a.species.push({ id, name, sci, cls }); herd.forEach(([loc, names]) => names.forEach(n => { const l = locOf(loc); a.animals.push({ id: 'AN-' + (1001 + a.animals.length), name: n, species: id, loc, section: l.section, site: l.site }); })); };
  SP('SP-BMQ', 'Bonnet macaque', 'Macaca radiata', 'Mammalia', [['L-PE1', ['Raja', 'Chinni', 'Moti', 'Bela']]]);
  SP('SP-LTM', 'Lion-tailed macaque', 'Macaca silenus', 'Mammalia', [['L-PE2', ['Kavi', 'Mira', 'Tara']]]);
  SP('SP-HGB', 'Hoolock gibbon', 'Hoolock hoolock', 'Mammalia', [['L-GIB', ['Bunty', 'Sona']]]);
  SP('SP-TIG', 'Bengal tiger', 'Panthera tigris tigris', 'Mammalia', [['L-TG1', ['Shera', 'Rani']]]);
  SP('SP-LEO', 'Indian leopard', 'Panthera pardus fusca', 'Mammalia', [['L-LP2', ['Chitra', 'Bagha']]]);
  SP('SP-SLB', 'Sloth bear', 'Melursus ursinus', 'Mammalia', [['L-BRD', ['Bhalu', 'Jambo']], ['L-RW1', ['Bholu']]]);
  SP('SP-RRP', 'Rose-ringed parakeet', 'Psittacula krameri', 'Aves', [['L-AV3', ['Group A', 'Group B']]]);
  SP('SP-GHB', 'Great hornbill', 'Buceros bicornis', 'Aves', [['L-AV5', ['Homrai', 'Kaveri']]]);
  SP('SP-PEA', 'Indian peafowl', 'Pavo cristatus', 'Aves', [['L-WLK', ['Mayur', 'Neela', 'Hira']]]);
  SP('SP-SCO', 'Smooth-coated otter', 'Lutrogale perspicillata', 'Mammalia', [['L-OTP', ['Pebble', 'Splash', 'Neer', 'Kai']]]);
  SP('SP-IGM', 'Indian grey mongoose', 'Urva edwardsii', 'Mammalia', [['L-MGE', ['Nakul', 'Rikki', 'Tiki']]]);
  SP('SP-ASE', 'Asian elephant', 'Elephas maximus', 'Mammalia', [['L-ELP', ['Lakshmi', 'Ganga']]]);
  SP('SP-CHT', 'Spotted deer', 'Axis axis', 'Mammalia', [['L-DEE', ['Herd 1', 'Herd 2']]]);
  SP('SP-IST', 'Indian star tortoise', 'Geochelone elegans', 'Reptilia', [['L-RW2', ['T-14', 'T-15', 'T-16']]]);

  // activities: created by keepers and supervisors, approved by the biologist
  const mk = (t, who, o, review) => { at(t); const id = saveActivity(who, o); if (review) { at(addDays(t, 1).slice(0, 10) + 'T11:00'); reviewActivity(id, 'P-ANJ', review === 'ok', review === 'ok' ? '' : review); } return id; };
  const X = {};
  X.puzzle = mk('2026-09-01T10:00', 'P-RAVI', { name: 'Puzzle feeder foraging', type: 'food', sub: 'Puzzle feeder', goal: 'Longer foraging time and problem solving', species: ['SP-BMQ', 'SP-LTM', 'SP-HGB'], mins: 45, materials: ['Puzzle feeder ball'], safety: 'Two feeders at most per enclosure. Remove after two hours.', additives: 'Peanuts, sunflower seeds (unsalted)' }, 'ok');
  X.bamboo = mk('2026-09-01T11:00', 'P-PRIYA', { name: 'Bamboo tube treats', type: 'cognitive', sub: 'Hidden food', goal: 'Manipulation and extraction', species: ['SP-BMQ', 'SP-LTM'], mins: 30, materials: ['Bamboo foraging tube'], safety: 'Check tubes for splinters before use.', additives: 'Dates, chopped fruit' }, 'ok');
  X.scent = mk('2026-09-02T10:00', 'P-LAKS', { name: 'Scent trail', type: 'sensory', sub: 'Olfactory', goal: 'Natural tracking and patrolling', species: ['SP-TIG', 'SP-LEO'], mins: 60, materials: ['Scent sacks'], safety: 'No essential oils. Herbivore hay only from healthy animals.', additives: 'Cinnamon, deer hay' }, 'ok');
  X.bungee = mk('2026-09-02T11:00', 'P-LAKS', { name: 'Meat bungee feed', type: 'food', sub: 'Carcass feeding', goal: 'Pulling and tearing like a kill', species: ['SP-TIG', 'SP-LEO', 'SP-SLB'], mins: 30, materials: ['Meat bungee'], safety: 'Check the bungee anchor before every use.', additives: 'Bone-in meat' }, 'ok');
  X.boomer = mk('2026-09-03T10:00', 'P-RAVI', { name: 'Boomer ball play', type: 'cognitive', sub: 'Object play', goal: 'Play and exercise', species: ['SP-TIG', 'SP-SCO'], mins: 45, materials: ['Boomer ball'], safety: 'Remove a cracked ball at once.', additives: '' }, 'ok');
  X.ice = mk('2026-09-03T11:00', 'P-ROSY', { name: 'Ice block treats', type: 'food', sub: 'Frozen food', goal: 'Cooling and slow feeding', species: ['SP-SCO', 'SP-TIG', 'SP-SLB'], mins: 30, materials: [], safety: 'No added sugar for bears.', additives: 'Fish, honey water (bears only)' }, 'ok');
  X.scatter = mk('2026-09-04T10:00', 'P-PRIYA', { name: 'Scatter feed', type: 'food', sub: 'Scatter feeding', goal: 'Searching and spreading the group', species: ['SP-SCO', 'SP-RRP'], mins: 20, materials: ['Scatter feeder tray'], safety: '', additives: 'Seed mix' }, 'ok');
  X.dig = mk('2026-09-04T11:00', 'P-RAVI', { name: 'Dig box search', type: 'environmental', sub: 'Substrate', goal: 'Digging and searching', species: ['SP-IGM', 'SP-SCO'], mins: 40, materials: ['Dig box'], safety: 'Sand only, no clay.', additives: 'Mealworms' }, 'ok');
  X.cups = mk('2026-09-05T10:00', 'P-LAKS', { name: 'Foraging cups', type: 'food', sub: 'Foraging device', goal: 'Foraging through the day', species: ['SP-RRP', 'SP-GHB', 'SP-PEA'], mins: 30, materials: ['Foraging cup set'], safety: '', additives: 'Seed mix, berries' }, 'ok');
  X.hay = mk('2026-09-05T11:00', 'P-FARH', { name: 'Hay net browse', type: 'food', sub: 'Browse', goal: 'Slower feeding and reaching', species: ['SP-ASE', 'SP-CHT'], mins: 60, materials: ['Hay net'], safety: 'Hang above trunk height for elephants.', additives: '' }, 'ok');
  X.sound = mk('2026-09-08T10:00', 'P-FARH', { name: 'Sound playback', type: 'sensory', sub: 'Auditory', goal: 'Response to wild calls', species: ['SP-ASE'], mins: 20, materials: [], safety: 'Volume below 60 dB.', additives: '' }, 'ok');
  X.hammock = mk('2026-09-20T10:00', 'P-IMRAN', { name: 'Hammock resting', type: 'environmental', sub: 'Furnishing', goal: 'Raised resting place', species: ['SP-LEO'], mins: 30, materials: ['Fire-hose hammock'], safety: '', additives: '' }, 'Add the weight limit and the inspection interval.');
  mk('2026-10-08T15:00', 'P-PRIYA', { name: 'Group grooming time', type: 'social', sub: 'Grooming', goal: 'Strengthen bonds after the new introduction', species: ['SP-BMQ'], mins: 30, materials: [], safety: 'Keeper outside the enclosure.', additives: '' });
  mk('2026-10-09T10:00', 'P-RAVI', { name: 'Novel object rotation', type: 'cognitive', sub: 'Novel objects', goal: 'Curiosity and exploration', species: ['SP-HGB', 'SP-LTM'], mins: 30, materials: ['Mirror panel'], safety: 'No object smaller than a fist.', additives: '' });

  // plans: supervisors assign approved activities to their keepers
  const pl = (t, who, o) => { at(t); return assignActivity(who, o); };
  const P = {};
  P.p1 = pl('2026-09-19T09:00', 'P-RAVI', { activity: X.puzzle, kind: 'species', target: 'SP-BMQ', loc: 'L-PE1', freq: 'daily', start: '2026-09-20', time: '09:00', keeper: 'P-PRIYA' });
  P.p2 = pl('2026-09-19T09:05', 'P-RAVI', { activity: X.puzzle, kind: 'species', target: 'SP-LTM', loc: 'L-PE2', freq: 'alt', start: '2026-09-20', time: '12:00', keeper: 'P-PRIYA' });
  P.p3 = pl('2026-09-19T09:10', 'P-RAVI', { activity: X.bamboo, kind: 'species', target: 'SP-BMQ', loc: 'L-PE1', freq: 'alt', start: '2026-09-21', time: '15:00', keeper: 'P-PRIYA' });
  P.p4 = pl('2026-09-19T09:15', 'P-RAVI', { activity: X.boomer, kind: 'species', target: 'SP-SCO', loc: 'L-OTP', freq: 'daily', start: '2026-09-22', time: '15:00', keeper: 'P-PRIYA' });
  P.p5 = pl('2026-09-19T09:20', 'P-RAVI', { activity: X.dig, kind: 'species', target: 'SP-IGM', loc: 'L-MGE', freq: 'alt', start: '2026-09-22', time: '09:00', keeper: 'P-PRIYA' });
  P.p6 = pl('2026-09-19T09:25', 'P-RAVI', { activity: X.scatter, kind: 'species', target: 'SP-SCO', loc: 'L-OTP', freq: 'weekly', start: '2026-09-19', time: '15:00', keeper: 'P-PRIYA' });
  P.p7 = pl('2026-09-19T10:00', 'P-LAKS', { activity: X.scent, kind: 'species', target: 'SP-TIG', loc: 'L-TG1', freq: 'alt', start: '2026-09-20', time: '09:00', keeper: 'P-IMRAN' });
  P.p8 = pl('2026-09-19T10:05', 'P-LAKS', { activity: X.bungee, kind: 'species', target: 'SP-SLB', loc: 'L-BRD', freq: 'weekly', start: '2026-09-26', time: '12:00', keeper: 'P-IMRAN' });
  P.p9 = pl('2026-09-19T10:10', 'P-LAKS', { activity: X.cups, kind: 'species', target: 'SP-RRP', loc: 'L-AV3', freq: 'daily', start: '2026-09-24', time: '09:00', keeper: 'P-IMRAN' });
  P.p10 = pl('2026-09-19T10:15', 'P-LAKS', { activity: X.scent, kind: 'species', target: 'SP-LEO', loc: 'L-LP2', freq: 'weekly', start: '2026-09-22', time: '15:00', keeper: 'P-IMRAN' });
  P.p11 = pl('2026-09-19T10:20', 'P-FARH', { activity: X.hay, kind: 'species', target: 'SP-ASE', loc: 'L-ELP', freq: 'daily', start: '2026-09-28', time: '15:00', keeper: 'P-IMRAN' });
  P.p12 = pl('2026-09-19T10:25', 'P-ARUN', { activity: X.ice, kind: 'animal', target: a.animals.find(x => x.name === 'Bholu').id, loc: 'L-RW1', freq: 'daily', start: '2026-09-25', time: '12:00', keeper: 'P-ROSY' });
  P.p13 = pl('2026-10-09T16:00', 'P-RAVI', { activity: X.puzzle, kind: 'species', target: 'SP-HGB', loc: 'L-GIB', freq: 'alt', start: '2026-10-10', time: '15:00', keeper: 'P-PRIYA' });

  // stored items issued before the first sessions (reuse before buying)
  at('2026-09-19T10:40'); const m0 = requestMaterial('P-IMRAN', { activity: X.scent, loc: 'L-TG1', name: 'Scent sacks', qty: 3, note: '' });
  at('2026-09-19T11:30'); reviewMaterial(m0, 'P-LAKS', { decision: 'issue', item: 'EB-0008' });
  at('2026-09-24T08:30'); const m1 = requestMaterial('P-IMRAN', { activity: X.cups, loc: 'L-AV3', name: 'Foraging cup set', qty: 6, note: 'For the daily foraging cups' });
  at('2026-09-24T08:50'); reviewMaterial(m1, 'P-LAKS', { decision: 'issue', item: 'EB-0009' });

  // session history up to yesterday: a fixed pattern, so each activity has its own record of results
  const QUAL = { [X.puzzle]: [5, 4, 5, 4, 4], [X.bamboo]: [4, 3, 4, 4, 5], [X.boomer]: [4, 5, 3, 4, 4], [X.dig]: [3, 4, 3, 3, 4], [X.scatter]: [2, 3, 2, 3, 2], [X.scent]: [4, 4, 5, 3, 4], [X.bungee]: [5, 5, 4, 5, 5], [X.cups]: [3, 4, 3, 4, 3], [X.hay]: [4, 4, 3, 4, 4], [X.ice]: [5, 4, 5, 5, 4] };
  const NOTES = { 5: 'Used the whole time, all animals took part', 4: 'Good interest, most animals took part', 3: 'Some interest, lost interest after a while', 2: 'Little interest', 1: 'Ignored' };
  const BEH = { food: ['Foraging', 'Manipulation'], cognitive: ['Manipulation', 'Play', 'Exploration'], sensory: ['Exploration'], environmental: ['Exploration', 'Foraging'], social: ['Social'] };
  const yesterday = addDays(day(NOW_DEFAULT), -1);
  let k = 0;
  occurrences('2026-09-19', yesterday).sort((x, y) => (x.date + x.plan.time).localeCompare(y.date + y.plan.time)).forEach(o => {
    k++;
    const p = o.plan, act = activityOf(p.activity), incident = p.id === P.p4 && o.date === '2026-10-09';
    at(o.date + 'T' + String(+p.time.slice(0, 2) + 1).padStart(2, '0') + ':10');
    const check = inventoryCheck(p.activity, p.loc);
    if (!checkReady(check)) { skipSession(p.keeper, { plan: p.id, date: o.date, reason: 'Materials not available' }); return; }
    if (!incident && k % 11 === 0) return;                               // a few missed sessions stay open
    if (!incident && k % 17 === 0) { skipSession(p.keeper, { plan: p.id, date: o.date, reason: k % 2 ? 'Animal unwell' : 'Weather' }); return; }
    const q = QUAL[p.activity] || [4], r = q[k % q.length];
    recordSession(p.keeper, { plan: p.id, date: o.date, mins: act.mins - (5 - r) * 5, materials: check.map(m => m.items[0].id), engage: r >= 5 ? 'high' : r >= 4 ? 'medium' : r >= 3 ? 'low' : 'none',
      behaviours: (BEH[act.type] || []).slice(0, r >= 4 ? 2 : 1), success: r >= 4 ? 'yes' : r >= 3 ? 'partly' : 'no', rating: r, comment: incident ? 'Ball split along the seam; Pebble chewed the edge' : (k % 3 ? NOTES[r] : ''),
      photos: incident || k % 5 === 0 ? [photo('Session photo')] : [], safety: incident ? { item: 'EF-0012', issue: 'Structural damage', notes: 'Sharp edge on the split seam' } : null });
  });
  // this morning: one session already recorded
  at('2026-10-10T09:40');
  recordSession('P-PRIYA', { plan: P.p1, date: '2026-10-10', mins: 40, materials: inventoryCheck(X.puzzle, 'L-PE1').filter(m => m.state === 'ready').map(m => m.items[0].id), engage: 'high', behaviours: ['Foraging', 'Manipulation'], success: 'yes', rating: 5, comment: 'Chinni solved it first', photos: [] });

  // material requests
  at('2026-10-03T10:00'); const m2 = requestMaterial('P-IMRAN', { activity: X.bungee, loc: 'L-BRD', name: 'Meat bungee', qty: 1, note: 'Second bungee for the pair' });
  at('2026-10-03T12:00'); reviewMaterial(m2, 'P-LAKS', { decision: 'request', note: 'The stored bungee is kept as the spare for the tigers' });
  at('2026-10-09T16:20'); requestMaterial('P-PRIYA', { activity: X.puzzle, loc: 'L-GIB', name: 'Puzzle feeder ball', qty: 2, note: 'The gibbons start puzzle feeders today' });
  at('2026-10-10T08:15'); requestMaterial('P-PRIYA', { activity: X.bamboo, loc: 'L-PE2', name: 'Bamboo foraging tube', qty: 4, note: '' });
  at('2026-10-10T08:20'); requestMaterial('P-PRIYA', { activity: X.boomer, loc: 'L-OTP', name: 'Boomer ball', qty: 1, note: 'Replacement for the split ball' });
  // events were played per record, not in time order: put each item's history back in time order (newest first)
  D.items.forEach(it => it.history.sort((x, y) => y.at.localeCompare(x.at)));
  setNow(NOW_DEFAULT);
}
