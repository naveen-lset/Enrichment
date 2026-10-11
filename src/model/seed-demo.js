// src/model/seed-demo.js — extra demo records for the iPad app. seed.js calls extendDemo('early') just before the Q4 audit
// is created and extendDemo('late') at the end. Every record is PLAYED through model.js, so each state follows the rules.
// tests/model.test.mjs does not load this file, so the 26 rule tests keep the small seed.

function extendDemo(phase) {
  const at = setNow, pic = c => [photo(c)];
  // R(ticket, name, category, qty, section, received at, by, location, options) — dispatched the day before at 15:00
  const R = (tk, name, cat, qty, sec, t, who, loc, o = {}) => {
    ticket(tk, name, cat, qty, sec, addDays(t, -1).slice(0, 10) + 'T15:00', o.ws || '', o.mt || 'MT-' + (6900 + +tk.slice(3) % 900), 'P-ANJ');
    at(t); return receive(tk, who, Object.assign({ qty: o.got || qty, loc, custodian: who }, o));
  };

  if (phase === 'early') {
    D.config.target = 80;
    D.sections.push({ id: 'SEC-HRB', name: 'Herbivores', site: 'S-MAIN' });
    D.locations.push(
      { id: 'L-GIB', name: 'Gibbon Island', kind: 'enclosure', section: 'SEC-PRI', site: 'S-MAIN' },
      { id: 'L-BRD', name: 'Sloth Bear Den', kind: 'enclosure', section: 'SEC-CAR', site: 'S-MAIN' },
      { id: 'L-WLK', name: 'Walk-through Aviary', kind: 'enclosure', section: 'SEC-BRD', site: 'S-MAIN' },
      { id: 'L-ELP', name: 'Elephant Paddock', kind: 'enclosure', section: 'SEC-HRB', site: 'S-MAIN' },
      { id: 'L-DEE', name: 'Deer Meadow', kind: 'enclosure', section: 'SEC-HRB', site: 'S-MAIN' },
      { id: 'L-HST', name: 'Herbivore Store', kind: 'store', section: 'SEC-HRB', site: 'S-MAIN' },
      { id: 'L-RW3', name: 'Rescue Ward 3', kind: 'enclosure', section: 'SEC-RCW', site: 'S-RESC' },
      { id: 'L-QRB', name: 'Quarantine Block', kind: 'enclosure', section: 'SEC-RCW', site: 'S-RESC' },
    );
    D.people.push({ id: 'P-FARH', name: 'Farhan Ali', role: 'sup', sites: ['S-MAIN'], sections: ['SEC-HRB'] });

    // receipts across every section
    const [net] = R('TK-1983', 'Rope climbing net', 'CAT-B', 1, 'SEC-PRI', '2026-08-03T10:00', 'P-RAVI', 'L-GIB', { ws: 'WS-252' });
    const [, forage2] = R('TK-1986', 'Forage box', 'CAT-A', 3, 'SEC-PRI', '2026-08-06T10:30', 'P-RAVI', 'L-PE1', { ws: 'WS-255' });
    const [mirror] = R('TK-1990', 'Mirror panel', 'CAT-A', 1, 'SEC-PRI', '2026-08-10T11:00', 'P-RAVI', 'L-PE2');
    const [tubes] = R('TK-1994', 'Bamboo foraging tube', 'CAT-C', 20, 'SEC-PRI', '2026-08-14T09:30', 'P-RAVI', 'L-PST');
    const [disp1, disp2] = R('TK-1997', 'Treat dispenser', 'CAT-A', 2, 'SEC-PRI', '2026-08-18T10:00', 'P-RAVI', 'L-GIB', { ws: 'WS-261' });
    R('TK-2001', 'Dig box', 'CAT-A', 2, 'SEC-SML', '2026-08-21T10:00', 'P-RAVI', 'L-MGE', { ws: 'WS-264' });
    const [hide] = R('TK-2004', 'Hide log', 'CAT-C', 12, 'SEC-SML', '2026-08-24T09:00', 'P-RAVI', 'L-SST');
    const [wheel] = R('TK-2006', 'Exercise wheel', 'CAT-A', 1, 'SEC-SML', '2026-08-26T10:00', 'P-RAVI', 'L-MGE', { ws: 'WS-268' });
    R('TK-2009', 'Scatter feeder tray', 'CAT-A', 2, 'SEC-SML', '2026-08-28T10:00', 'P-RAVI', 'L-OTP');
    const [post] = R('TK-2011', 'Scratching post', 'CAT-B', 1, 'SEC-CAR', '2026-08-30T10:00', 'P-LAKS', 'L-LP2', { ws: 'WS-271' });
    R('TK-2013', 'Feeding pole', 'CAT-A', 1, 'SEC-CAR', '2026-09-01T10:00', 'P-LAKS', 'L-TG1', { ws: 'WS-273' });
    const [, bungee2] = R('TK-2015', 'Meat bungee', 'CAT-A', 2, 'SEC-CAR', '2026-09-02T10:00', 'P-LAKS', 'L-BRD');
    const [drum] = R('TK-2017', 'Pool float drum', 'CAT-B', 1, 'SEC-CAR', '2026-09-03T10:00', 'P-LAKS', 'L-TG1', { ws: 'WS-276' });
    const [sacks] = R('TK-2019', 'Scent sacks', 'CAT-C', 15, 'SEC-CAR', '2026-09-04T10:00', 'P-LAKS', 'L-CST');
    const [, mtoy2] = R('TK-2021', 'Mirror toy', 'CAT-A', 2, 'SEC-BRD', '2026-09-05T10:00', 'P-LAKS', 'L-AV3');
    const [swing1, , swing3] = R('TK-2023', 'Swing perch', 'CAT-A', 3, 'SEC-BRD', '2026-09-06T10:00', 'P-LAKS', 'L-WLK', { ws: 'WS-280' });
    R('TK-2025', 'Foraging cup set', 'CAT-C', 30, 'SEC-BRD', '2026-09-07T10:00', 'P-LAKS', 'L-BST', { got: 28, discrepancy: '2 cups cracked in transit' });
    R('TK-2027', 'Nest platform', 'CAT-B', 1, 'SEC-BRD', '2026-09-08T10:00', 'P-LAKS', 'L-AV5', { ws: 'WS-283' });
    R('TK-2029', 'Bathing tray', 'CAT-A', 1, 'SEC-BRD', '2026-09-09T10:00', 'P-LAKS', 'L-WLK');
    const [hay1, , , hay4] = R('TK-2031', 'Hay net', 'CAT-A', 4, 'SEC-HRB', '2026-09-10T10:00', 'P-FARH', 'L-ELP');
    const [, lick2] = R('TK-2033', 'Lick-block holder', 'CAT-A', 2, 'SEC-HRB', '2026-09-11T10:00', 'P-FARH', 'L-DEE', { ws: 'WS-288' });
    R('TK-2035', 'Rubbing post', 'CAT-B', 1, 'SEC-HRB', '2026-09-12T10:00', 'P-FARH', 'L-ELP', { ws: 'WS-290' });
    R('TK-2037', 'Tyre feeder', 'CAT-B', 1, 'SEC-HRB', '2026-09-13T10:00', 'P-FARH', 'L-DEE', { ws: 'WS-291' });
    R('TK-2039', 'Browse frame', 'CAT-B', 1, 'SEC-HRB', '2026-10-06T10:00', 'P-FARH', 'L-HST', { ws: 'WS-301', fit: false, cond: 'damaged', notes: 'Weld cracked at one joint' });
    const [, perch2] = R('TK-2041', 'Recovery perch', 'CAT-A', 2, 'SEC-RCW', '2026-09-15T10:00', 'P-ARUN', 'L-RW1');
    R('TK-2043', 'Soft hide', 'CAT-C', 10, 'SEC-RCW', '2026-09-16T10:00', 'P-ARUN', 'L-RST');
    const [lamp1] = R('TK-2044', 'Heat lamp guard', 'CAT-A', 2, 'SEC-RCW', '2026-09-17T10:00', 'P-ARUN', 'L-RW2', { ws: 'WS-296' });
    R('TK-2045', 'Observation crate', 'CAT-A', 1, 'SEC-RCW', '2026-09-18T10:00', 'P-ARUN', 'L-QRB', { ws: 'WS-297' });

    // rotation and storage
    at('2026-08-20T09:00'); move(forage2, 'P-RAVI', { to: 'L-PE2', reason: 'Rotation' });
    at('2026-09-01T09:30'); move(tubes, 'P-RAVI', { to: 'L-PE1', reason: 'Rotation', qty: 8 });
    at('2026-09-05T09:30'); const hideMge = move(hide, 'P-RAVI', { to: 'L-MGE', reason: 'Enclosure change', qty: 6 });
    at('2026-09-15T09:00'); move(disp1, 'P-RAVI', { to: 'L-PST', reason: 'Rest from use' });
    at('2026-09-20T09:00'); move(bungee2, 'P-LAKS', { to: 'L-CST', reason: 'Cleaning' });
    at('2026-09-20T11:00'); move(hay4, 'P-FARH', { to: 'L-HST', reason: 'Storage' });
    at('2026-09-25T09:00'); move(swing3, 'P-LAKS', { to: 'L-BST', reason: 'Storage' });
    at('2026-09-28T09:00'); move(sacks, 'P-LAKS', { to: 'L-LP2', reason: 'Rotation', qty: 5 });

    // finished repairs
    at('2026-08-25T10:00'); flagIssue(mirror, 'P-RAVI', { issue: 'Wear', cond: 'needsrepair', notes: 'Scratched surface', photos: pic('Scratches') });
    at('2026-08-26T10:00'); verifyAnimalUse(mirror, 'P-ANJ', 'suitable', '');
    at('2026-08-26T15:00'); assessRepair(mirror, 'P-KAV', 'repairable', 'Polish and reseal the frame');
    at('2026-08-27T09:00'); startRepair(mirror, 'P-KAV', { team: 'Workshop' });
    at('2026-09-02T16:00'); completeRepair(mirror, 'P-KAV', { notes: 'Polished, frame resealed', team: 'Workshop', to: 'L-PE2', photos: pic('After polish') });
    at('2026-09-12T10:00'); flagIssue(swing1, 'P-LAKS', { issue: 'Structural damage', cond: 'damaged', notes: 'Cracked dowel', photos: pic('Cracked dowel') });
    at('2026-09-13T10:00'); verifyAnimalUse(swing1, 'P-ANJ', 'suitable', '');
    at('2026-09-13T14:00'); assessRepair(swing1, 'P-JOS', 'repairable', 'New dowel');
    at('2026-09-14T09:00'); startRepair(swing1, 'P-JOS', { team: 'Carpentry' });
    at('2026-09-16T15:00'); completeRepair(swing1, 'P-JOS', { notes: 'Dowel replaced', team: 'Carpentry', to: 'L-WLK' });

    // open repairs at every stage
    at('2026-09-15T10:00'); flagIssue(post, 'P-LAKS', { issue: 'Structural damage', cond: 'damaged', notes: 'Base plate loose', photos: pic('Loose base') });
    at('2026-09-16T10:00'); verifyAnimalUse(post, 'P-ANJ', 'suitable', 'Safe once the base is fixed');
    at('2026-09-16T15:00'); assessRepair(post, 'P-KAV', 'repairable', 'Re-anchor the base plate');
    at('2026-09-18T09:00'); startRepair(post, 'P-KAV', { team: 'Carpentry' });
    at('2026-09-24T10:00'); flagIssue(lamp1, 'P-ARUN', { issue: 'Structural damage', cond: 'unsafe', notes: 'Guard bent towards the bulb', photos: pic('Bent guard') });
    at('2026-09-25T10:00'); verifyAnimalUse(lamp1, 'P-ANJ', 'unsuitable', 'Burn risk');
    at('2026-09-25T15:00'); assessRepair(lamp1, 'P-JOS', 'beyond', 'Mesh fatigue, cannot be reshaped');
    at('2026-09-28T10:00'); flagIssue(hay1, 'P-FARH', { issue: 'Wear', cond: 'damaged', notes: 'Torn mesh on one side', photos: pic('Torn mesh') });
    at('2026-09-29T10:00'); flagIssue(wheel, 'P-RAVI', { issue: 'Wear', cond: 'needsrepair', notes: 'Bearing grinds when turning', photos: pic('Bearing') });
    at('2026-09-30T10:00'); verifyAnimalUse(wheel, 'P-ANJ', 'suitable', '');
    at('2026-10-01T11:00'); assessRepair(wheel, 'P-JOS', 'repairable', 'Replace the bearing');
    at('2026-10-05T10:00'); flagIssue(net, 'P-RAVI', { issue: 'Wear', cond: 'damaged', notes: 'Fraying at two knots', photos: pic('Frayed knots') });
    at('2026-10-06T10:00'); assessRepair(net, 'P-KAV', 'repairable', 'Re-tie two knots');
    at('2026-10-07T10:00'); flagIssue(hideMge, 'P-RAVI', { issue: 'Contamination', cond: 'damaged', notes: 'Mould on two logs' });

    // transfers: two finished, two in transit
    at('2026-09-10T10:00'); transfer(disp2, 'P-RAVI', { section: 'SEC-SML', receiver: 'P-RAVI', ref: 'MT-7650', note: 'Enrichment for otters' });
    at('2026-09-10T15:00'); acknowledge(disp2, 'P-RAVI', { loc: 'L-OTP', cond: 'good' });
    at('2026-09-20T10:00'); transfer(perch2, 'P-ARUN', { section: 'SEC-BRD', receiver: 'P-LAKS', ref: 'MT-7690', note: 'Released bird returned to aviary' });
    at('2026-09-21T09:00'); acknowledge(perch2, 'P-LAKS', { loc: 'L-AV5', cond: 'good' });
    at('2026-10-03T10:00'); transfer(lick2, 'P-FARH', { section: 'SEC-RCW', receiver: 'P-ARUN', ref: 'MT-7712', note: 'For the fawn in quarantine' });

    // labels
    at('2026-09-02T12:00'); printLabels('P-RAVI', [forage2, mirror, wheel].filter(id => labelable(itemOf(id))));
    at('2026-09-10T12:00'); printLabels('P-LAKS', [mtoy2, swing1, swing3]);

    D._demo = { drum, lamp1, mtoy2 };
  }

  if (phase === 'late') {
    const { drum, lamp1, mtoy2 } = D._demo; delete D._demo;
    at('2026-10-09T11:00'); transfer(mtoy2, 'P-LAKS', { section: 'SEC-PRI', receiver: 'P-RAVI', ref: 'MT-7760', note: 'Mirror work for the macaques' });

    // disposals: one waiting for the workshop, one waiting for approval
    at('2026-10-09T14:00'); const dl = requestDisposal(lamp1, 'P-ARUN', { reason: 'Beyond repair', cond: 'beyond', notes: 'Guard cannot be reshaped', photos: pic('Bent guard'), approver: 'P-SUR' });
    at('2026-10-10T09:00'); validateDisposal(dl, 'P-ANJ', 'bio', true, 'Burn risk, agree');
    at('2026-10-09T15:00'); const dd = requestDisposal(drum, 'P-LAKS', { reason: 'Replaced by a larger model', cond: 'good', photos: pic('Drum'), approver: 'P-MEERA' });
    at('2026-10-09T16:00'); validateDisposal(dd, 'P-ANJ', 'bio', true, '');
    at('2026-10-10T08:30'); validateDisposal(dd, 'P-KAV', 'tech', true, 'Shell intact, can go to a partner zoo');

    // Q4 audit: most of the campus checked, one condition finding still to assign, the rest left to do
    const q4 = D.audits.find(a => a.period === 'Q4 2026');
    const left = q4.lines.filter(l => !l.outcome);
    at('2026-10-09T14:30');
    left.slice(0, Math.max(0, left.length - 14)).forEach((l, i) => {
      if (itemOf(l.item).name === 'Forage box' && i % 2) recordAudit(q4.id, l.item, 'P-MEERA', 'condmismatch', { note: 'Lid hinge loose' });
      else recordAudit(q4.id, l.item, 'P-MEERA', 'verified');
    });

    // Rescue Centre: the half-year audit has started
    at('2026-10-10T08:00'); const h2 = createAudit('P-MEERA', { site: 'S-RESC', period: 'H2 2026', due: '2026-11-15', auditor: 'P-ARUN' });
    at('2026-10-10T09:15'); auditOf(h2).lines.slice(0, 3).forEach(l => recordAudit(h2, l.item, 'P-ARUN', 'verified'));

    // tickets dispatched, not yet received
    ticket('TK-2055', 'Hay net', 'CAT-A', 4, 'SEC-HRB', '2026-10-08T12:00', '', 'MT-7748', 'P-ANJ');
    ticket('TK-2058', 'Recovery perch', 'CAT-A', 2, 'SEC-RCW', '2026-10-05T10:00', 'WS-316', 'MT-7726', 'P-ANJ');
    ticket('TK-2060', 'Puzzle feeder ball', 'CAT-A', 2, 'SEC-SML', '2026-10-10T07:30', '', 'MT-7750', 'P-ANJ');
    ticket('TK-2062', 'Hessian sacks', 'CAT-D', 50, 'SEC-PRI', '2026-10-09T12:00', '', 'MT-7752', 'P-ANJ');
  }
}
