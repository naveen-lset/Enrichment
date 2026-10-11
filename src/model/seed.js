// src/model/seed.js — demo data for the Enrichment & Furnishing module. Configuration here; the history is PLAYED through model.js
// (receive / move / flag / transfer / dispose / audit …) so every state follows the rules. The page and the tests both call boot().

function SEED() {
  const P = (id, name, role, sites, sections = []) => ({ id, name, role, sites, sections });
  const L = (id, name, kind, section, site) => ({ id, name, kind, section, site });
  return {
    config: { receiptDays: 3, assessDays: 5, repairDays: 14, approveDays: 5, target: 24 },
    seq: {},
    sites: [{ id: 'S-MAIN', name: 'Main Campus' }, { id: 'S-RESC', name: 'Rescue Centre' }],
    sections: [
      { id: 'SEC-PRI', name: 'Primates', site: 'S-MAIN' }, { id: 'SEC-CAR', name: 'Carnivores', site: 'S-MAIN' },
      { id: 'SEC-BRD', name: 'Birds', site: 'S-MAIN' }, { id: 'SEC-SML', name: 'Small Mammals', site: 'S-MAIN' },
      { id: 'SEC-RCW', name: 'Rescue Wards', site: 'S-RESC' },
    ],
    locations: [
      L('L-PE1', 'Primate Enclosure 1', 'enclosure', 'SEC-PRI', 'S-MAIN'), L('L-PE2', 'Primate Enclosure 2', 'enclosure', 'SEC-PRI', 'S-MAIN'), L('L-PST', 'Primate Store', 'store', 'SEC-PRI', 'S-MAIN'),
      L('L-TG1', 'Tiger Moat 1', 'enclosure', 'SEC-CAR', 'S-MAIN'), L('L-LP2', 'Leopard Enclosure 2', 'enclosure', 'SEC-CAR', 'S-MAIN'), L('L-CST', 'Carnivore Store', 'store', 'SEC-CAR', 'S-MAIN'),
      L('L-AV3', 'Aviary 3', 'enclosure', 'SEC-BRD', 'S-MAIN'), L('L-AV5', 'Aviary 5', 'enclosure', 'SEC-BRD', 'S-MAIN'), L('L-BST', 'Bird Store', 'store', 'SEC-BRD', 'S-MAIN'),
      L('L-OTP', 'Otter Pool', 'enclosure', 'SEC-SML', 'S-MAIN'), L('L-MGE', 'Mongoose Enclosure', 'enclosure', 'SEC-SML', 'S-MAIN'), L('L-SST', 'Small Mammal Store', 'store', 'SEC-SML', 'S-MAIN'),
      L('L-RW1', 'Rescue Ward 1', 'enclosure', 'SEC-RCW', 'S-RESC'), L('L-RW2', 'Rescue Ward 2', 'enclosure', 'SEC-RCW', 'S-RESC'), L('L-RST', 'Rescue Store', 'store', 'SEC-RCW', 'S-RESC'),
    ],
    people: [
      P('P-RAVI', 'Ravi Kumar', 'sup', ['S-MAIN'], ['SEC-PRI', 'SEC-SML']), P('P-LAKS', 'Lakshmi Menon', 'sup', ['S-MAIN'], ['SEC-CAR', 'SEC-BRD']),
      P('P-ARUN', 'Arun Das', 'sup', ['S-RESC'], ['SEC-RCW']), P('P-MEERA', 'Meera Iyer', 'afm', ['S-MAIN', 'S-RESC']),
      P('P-ANJ', 'Dr. Anjali Rao', 'bio', ['S-MAIN', 'S-RESC']), P('P-JOS', 'Joseph Thomas', 'ws', ['S-MAIN', 'S-RESC']),
      P('P-KAV', 'Kavya Nair', 'ws', ['S-MAIN', 'S-RESC']), P('P-SUR', 'Suresh Pillai', 'mgmt', ['S-MAIN', 'S-RESC']),
      P('P-NEHA', 'Neha Shah', 'admin', ['S-MAIN', 'S-RESC']),
    ],
    categories: [
      { id: 'CAT-A', code: 'A', name: 'Individually trackable', about: 'Small cages, metal feeders, durable toys, nest boxes, specialised equipment', mode: 'individual', bio: 'always', tech: true, qr: 'required', owner: 'sup', req: { repair: ['photo'], transfer: ['ref'], disposal: ['photo', 'notes'] } },
      { id: 'CAT-B', code: 'B', name: 'Conditionally trackable', about: 'Large furnishings, heavy wooden structures, rotational-use items', mode: 'individual', bio: 'inuse', tech: true, qr: 'optional', owner: 'sup', req: { repair: ['photo'], transfer: [], disposal: ['photo'] } },
      { id: 'CAT-C', code: 'C', name: 'Group / quantity tracked', about: 'Standard perches, loose logs, similar natural materials', mode: 'batch', bio: 'never', tech: false, qr: 'none', owner: 'sup', req: { repair: [], transfer: [], disposal: [] } },
      { id: 'CAT-D', code: 'D', name: 'Consumable / out of scope', about: 'Short-life materials for routine consumption', mode: 'excluded', bio: 'never', tech: false, qr: 'none', owner: 'sup', req: { repair: [], transfer: [], disposal: [] } },
    ],
    tickets: [],
    items: [], disposals: [], audits: [],
  };
}

// T(id, name, cat, qty, section, dispatched, refs) — a ticket from the existing request / workshop / material-transfer flow.
function ticket(id, name, cat, qty, section, dispatched, ws, mt, requestedBy = 'P-ANJ') {
  D.tickets.push({ id, name, cat, qty, section, dispatched, ws, mt, requestedBy, status: 'dispatched' });
  return id;
}
const photo = caption => ({ kind: 'photo', caption });

function boot(now) {
  useData(SEED(), '2026-06-01T09:00');
  const at = t => setNow(t);
  const rec = (tk, t, who, o) => { at(t); return receive(tk, who, o); };

  // Pilot start: an existing batch registered without a ticket (backfill).
  at('2026-06-01T10:00');
  register('P-RAVI', { name: 'Bamboo poles', cat: 'CAT-C', qty: 30, loc: 'L-SST', custodian: 'P-RAVI', note: 'Registered at pilot start' });

  // 5.1 receipts through the existing ticket and material-transfer flow
  ticket('TK-1931', 'Stainless steel feeder', 'CAT-A', 2, 'SEC-PRI', '2026-06-01T15:00', 'WS-201', 'MT-6610');
  const [feeder1, feeder2] = rec('TK-1931', '2026-06-02T10:00', 'P-RAVI', { qty: 2, loc: 'L-PE1', custodian: 'P-RAVI' });
  ticket('TK-1932', 'Wooden nest box', 'CAT-A', 3, 'SEC-BRD', '2026-06-01T16:00', 'WS-202', 'MT-6611');
  const [nest1, nest2, nest3] = rec('TK-1932', '2026-06-02T11:30', 'P-LAKS', { qty: 3, loc: 'L-AV3', custodian: 'P-LAKS' });
  ticket('TK-1940', 'Puzzle feeder ball', 'CAT-A', 2, 'SEC-PRI', '2026-06-09T12:00', '', 'MT-6650');
  const [puzzle1, puzzle2] = rec('TK-1940', '2026-06-10T09:30', 'P-RAVI', { qty: 2, loc: 'L-PST', custodian: 'P-RAVI' });
  ticket('TK-1944', 'Climbing frame', 'CAT-B', 1, 'SEC-PRI', '2026-06-14T12:00', 'WS-215', 'MT-6671');
  const [frame] = rec('TK-1944', '2026-06-15T10:00', 'P-RAVI', { qty: 1, loc: 'L-PE2', custodian: 'P-RAVI' });
  ticket('TK-1950', 'Small transport cage', 'CAT-A', 2, 'SEC-SML', '2026-06-19T12:00', 'WS-220', 'MT-6702');
  const [cage1, cage2] = rec('TK-1950', '2026-06-20T10:00', 'P-RAVI', { qty: 2, loc: 'L-SST', custodian: 'P-RAVI' });
  ticket('TK-1958', 'Boomer ball', 'CAT-A', 2, 'SEC-CAR', '2026-06-30T12:00', '', 'MT-6740');
  const [ball1, ball2] = rec('TK-1958', '2026-07-01T10:00', 'P-LAKS', { qty: 2, loc: 'L-TG1', custodian: 'P-LAKS' });
  ticket('TK-1960', 'Log pile', 'CAT-C', 25, 'SEC-CAR', '2026-07-04T12:00', '', 'MT-6752');
  const [logs] = rec('TK-1960', '2026-07-05T10:00', 'P-LAKS', { qty: 25, loc: 'L-LP2', custodian: 'P-LAKS' });
  ticket('TK-1962', 'Standard perches', 'CAT-C', 60, 'SEC-BRD', '2026-07-07T12:00', '', 'MT-6760');
  const [perches] = rec('TK-1962', '2026-07-08T10:00', 'P-LAKS', { qty: 58, loc: 'L-BST', custodian: 'P-LAKS', discrepancy: '2 perches split in transit' });
  ticket('TK-1965', 'Scent box', 'CAT-A', 2, 'SEC-SML', '2026-07-11T12:00', 'WS-231', 'MT-6771');
  const [scent1, scent2] = rec('TK-1965', '2026-07-12T10:00', 'P-RAVI', { qty: 2, loc: 'L-MGE', custodian: 'P-RAVI' });
  ticket('TK-1970', 'Fire-hose hammock', 'CAT-B', 1, 'SEC-CAR', '2026-07-19T12:00', 'WS-240', 'MT-6790');
  const [hammock] = rec('TK-1970', '2026-07-20T10:00', 'P-LAKS', { qty: 1, loc: 'L-LP2', custodian: 'P-LAKS' });
  ticket('TK-1975', 'Wooden platform', 'CAT-B', 1, 'SEC-BRD', '2026-07-24T12:00', 'WS-244', 'MT-6801');
  const [platform] = rec('TK-1975', '2026-07-25T10:00', 'P-LAKS', { qty: 1, loc: 'L-AV5', custodian: 'P-LAKS' });
  ticket('TK-1978', 'Hanging tyre swing', 'CAT-B', 1, 'SEC-PRI', '2026-07-27T12:00', 'WS-247', 'MT-6812');
  const [swing] = rec('TK-1978', '2026-07-28T10:00', 'P-RAVI', { qty: 1, loc: 'L-PE1', custodian: 'P-RAVI' });
  ticket('TK-1981', 'Recovery crate', 'CAT-A', 2, 'SEC-RCW', '2026-07-31T12:00', 'WS-250', 'MT-6820');
  rec('TK-1981', '2026-08-01T10:00', 'P-ARUN', { qty: 2, loc: 'L-RST', custodian: 'P-ARUN' });

  // 5.2 rotation and storage: the same record moves, a part of a batch splits off
  at('2026-08-05T09:00'); move(puzzle1, 'P-RAVI', { to: 'L-PE2', reason: 'Rotation' });
  at('2026-08-20T09:00'); move(puzzle1, 'P-RAVI', { to: 'L-PE1', reason: 'Rotation' });
  at('2026-09-01T09:00'); move(logs, 'P-LAKS', { to: 'L-TG1', reason: 'Rotation', qty: 10 });
  at('2026-09-03T09:00'); const perchesAv5 = move(perches, 'P-LAKS', { to: 'L-AV5', reason: 'New perching layout', qty: 15 });
  at('2026-09-10T09:00'); move(ball1, 'P-LAKS', { to: 'L-CST', reason: 'Rest from use' });

  // 5.3 a finished repair: flagged → biologist + workshop → repaired → back in use
  at('2026-08-12T10:00'); flagIssue(frame, 'P-RAVI', { issue: 'Structural damage', cond: 'damaged', notes: 'Loose joint on the upper rung', photos: [photo('Loose joint')] });
  at('2026-08-13T11:00'); verifyAnimalUse(frame, 'P-ANJ', 'suitable', 'Safe once the joint is fixed');
  at('2026-08-13T15:00'); assessRepair(frame, 'P-JOS', 'repairable', 'Replace two bolts and a bracket');
  at('2026-08-14T09:00'); startRepair(frame, 'P-JOS', { team: 'Workshop' });
  at('2026-08-20T16:00'); completeRepair(frame, 'P-JOS', { notes: 'Bracket and bolts replaced', team: 'Workshop', to: 'L-PE2', photos: [photo('After repair')] });

  // 5.4 a finished transfer between sections, acknowledged by the receiver
  at('2026-09-05T10:00'); transfer(ball2, 'P-LAKS', { section: 'SEC-SML', receiver: 'P-RAVI', ref: 'MT-7010', note: 'Rotation to otters' });
  at('2026-09-06T09:30'); acknowledge(ball2, 'P-RAVI', { loc: 'L-OTP', cond: 'good' });

  // 5.5 a scrapped feeder with the full trail, and a disposed batch of perches
  at('2026-08-25T10:00'); flagIssue(feeder2, 'P-RAVI', { issue: 'Corrosion', cond: 'unsafe', notes: 'Rusted base, sharp edge', photos: [photo('Rusted base')] });
  at('2026-08-26T10:00'); verifyAnimalUse(feeder2, 'P-ANJ', 'unsuitable', 'Sharp edge, injury risk');
  at('2026-08-26T14:00'); assessRepair(feeder2, 'P-JOS', 'beyond', 'Base corroded through');
  at('2026-08-28T10:00'); const d1 = requestDisposal(feeder2, 'P-RAVI', { reason: 'Beyond repair', cond: 'beyond', notes: 'Base corroded through', photos: [photo('Rusted base')], approver: 'P-SUR' });
  at('2026-08-29T10:00'); validateDisposal(d1, 'P-ANJ', 'bio', true, 'Not safe for animal use');
  at('2026-08-29T12:00'); validateDisposal(d1, 'P-JOS', 'tech', true, 'Cannot be repaired');
  at('2026-09-02T10:00'); approveDisposal(d1, 'P-SUR', 'Approved for scrap');
  at('2026-09-04T11:00'); completeDisposal(d1, 'P-RAVI', { outcome: 'scrapped', note: 'Sent to metal scrap yard' });
  at('2026-09-20T10:00'); const d2 = requestDisposal(perchesAv5, 'P-LAKS', { reason: 'Worn out', cond: 'damaged', approver: 'P-MEERA' });
  at('2026-09-21T10:00'); approveDisposal(d2, 'P-MEERA');
  at('2026-09-22T10:00'); completeDisposal(d2, 'P-LAKS', { outcome: 'disposed', note: 'Composted' });

  // a rejected request: the workshop does not agree, the approver sends it back, the item stays active
  at('2026-09-12T10:00'); const d3 = requestDisposal(nest2, 'P-LAKS', { reason: 'Damaged in use', cond: 'damaged', notes: 'Entrance hole chewed', photos: [photo('Entrance hole')], approver: 'P-SUR' });
  at('2026-09-13T10:00'); validateDisposal(d3, 'P-ANJ', 'bio', true, '');
  at('2026-09-13T15:00'); validateDisposal(d3, 'P-JOS', 'tech', false, 'Repairable: replace the front panel');
  at('2026-09-15T10:00'); rejectDisposal(d3, 'P-SUR', 'Workshop says repairable. Send for repair.');

  // a repair still open: the biologist finds it unsuitable until the plank is replaced
  at('2026-09-18T10:00'); flagIssue(platform, 'P-LAKS', { issue: 'Structural damage', cond: 'damaged', notes: 'Split plank near the edge', photos: [photo('Split plank')] });
  at('2026-09-19T10:00'); verifyAnimalUse(platform, 'P-ANJ', 'unsuitable', 'Splinter risk until repaired');
  at('2026-09-19T15:00'); assessRepair(platform, 'P-JOS', 'repairable', 'Replace the split plank');
  at('2026-09-22T09:00'); startRepair(platform, 'P-JOS', { team: 'Carpentry' });

  // Q3 audit: run and closed, one location corrected
  at('2026-09-24T09:00'); const q3 = createAudit('P-MEERA', { site: 'S-MAIN', period: 'Q3 2026', due: '2026-09-30', auditor: 'P-MEERA' });
  auditOf(q3).lines.forEach(l => { if (l.item !== puzzle2) recordAudit(q3, l.item, 'P-MEERA', 'verified'); });
  recordAudit(q3, puzzle2, 'P-MEERA', 'locmismatch', { loc: 'L-PE2', note: 'Found in enclosure, not in store' });
  assignException(q3, puzzle2, 'P-MEERA', { to: 'P-RAVI', due: '2026-09-30' });
  at('2026-09-25T10:00'); resolveException(q3, puzzle2, 'P-RAVI', { note: 'Rotation was not recorded. Location now correct.' });
  at('2026-09-28T16:00'); closeAudit(q3, 'P-MEERA');

  // open work on 10 Oct 2026

  at('2026-10-01T10:00'); flagIssue(cage2, 'P-RAVI', { issue: 'Structural damage', cond: 'unsafe', notes: 'Door frame bent, latch fails', photos: [photo('Bent door')] });
  at('2026-10-02T10:00'); verifyAnimalUse(cage2, 'P-ANJ', 'unsuitable', 'Latch fails, escape risk');
  at('2026-10-02T15:00'); assessRepair(cage2, 'P-JOS', 'beyond', 'Frame cannot be straightened');

  at('2026-10-06T10:00'); const d4 = requestDisposal(scent1, 'P-RAVI', { reason: 'Damaged in use', cond: 'damaged', notes: 'Lid hinge broken, wood soaked', photos: [photo('Broken hinge')], approver: 'P-SUR' });
  at('2026-10-07T10:00'); validateDisposal(d4, 'P-ANJ', 'bio', true, 'No longer useful for enrichment');
  at('2026-10-07T14:00'); validateDisposal(d4, 'P-KAV', 'tech', true, 'Replacement is cheaper than repair');

  at('2026-10-07T11:00'); transfer(cage1, 'P-RAVI', { section: 'SEC-RCW', receiver: 'P-ARUN', ref: 'MT-7702', note: 'Needed for rescue intake' });

  at('2026-10-08T09:00'); flagIssue(nest3, 'P-LAKS', { issue: 'Wear', cond: 'damaged', notes: 'Cracked roof panel', photos: [photo('Cracked roof')] });
  at('2026-10-08T15:00'); const d5 = requestDisposal(hammock, 'P-LAKS', { reason: 'Worn out', cond: 'damaged', photos: [photo('Frayed weave')], approver: 'P-SUR' });

  if (typeof extendDemo === 'function') extendDemo('early');   // the iPad app adds more demo records here (src/model/seed-demo.js); tests do not load it

  // Q4 audit: in progress, one item not found (assigned), one location mismatch (not assigned yet)
  at('2026-10-08T16:00'); const q4 = createAudit('P-MEERA', { site: 'S-MAIN', period: 'Q4 2026', due: '2026-10-31', auditor: 'P-MEERA' });
  at('2026-10-09T09:00');
  [feeder1, puzzle1, puzzle2, frame, nest1].forEach(id => recordAudit(q4, id, 'P-MEERA', 'verified'));
  recordAudit(q4, swing, 'P-MEERA', 'notfound', { note: 'Not in Primate Enclosure 1' });
  assignException(q4, swing, 'P-MEERA', { to: 'P-RAVI', due: '2026-10-15' });
  recordAudit(q4, ball1, 'P-MEERA', 'locmismatch', { loc: 'L-TG1', note: 'Back in Tiger Moat 1' });

  at('2026-10-09T10:00'); assessRepair(nest3, 'P-JOS', 'repairable', 'New roof panel');
  at('2026-10-09T11:00'); validateDisposal(d5, 'P-KAV', 'tech', true, 'Fabric frayed through');

  // tickets dispatched and not yet received
  ticket('TK-2047', 'Rope hammock', 'CAT-B', 2, 'SEC-CAR', '2026-10-05T15:00', 'WS-318', 'MT-7731', 'P-ANJ');
  ticket('TK-2051', 'Stainless steel feeder', 'CAT-A', 3, 'SEC-PRI', '2026-10-09T15:00', 'WS-322', 'MT-7741', 'P-ANJ');
  ticket('TK-2053', 'Natural perches', 'CAT-C', 40, 'SEC-BRD', '2026-10-10T08:00', '', 'MT-7745', 'P-ANJ');

  if (typeof extendDemo === 'function') extendDemo('late');
  setNow(now || NOW_DEFAULT);
  return D;
}
