// src/ipad/register-views.js — the item register inside Enrichments: product definition panel, deliveries waiting for receipt
// (Requests › To receive), and the sheets for receipt, assignment for use, life review, usable life and product edit.
// Built with the Antz kit (antz-kit.js) and the sheet cells of core.js. Every action calls one rule of src/model/register.js.

const MODE = { individual: 'Individual', batch: 'Group', excluded: 'Not tracked' };
const LIFE_UNITS = Object.entries(LIFE_UNIT);
const inCharge = it => it.custodian ? nm(it.custodian) : 'Awaiting assignment';
const placeOf = it => (it.status === 'transit' ? 'In transit' : locName(it.loc)) + (UI.site === 'all' ? ' · ' + siteName(it.site) : '');
const trackText = p => MODE[(by('categories', p.cat) || {}).mode] || '';
const REVIEW_TONE = { soon: 'wait', due: 'bad', replace: 'bad' };
const REVIEW_SHORT = { soon: 'Review soon', due: 'Review overdue', replace: 'Replace' };
const reviewTag = (it, short) => { const s = reviewState(it); return REVIEW_TONE[s] ? Tag((short ? REVIEW_SHORT : REVIEW)[s], REVIEW_TONE[s]) : ''; };
// availability order: available for use, then other available places, in use, unavailable, retired
const avRank = it => availableForUse(it) ? 0 : ['available', 'storage'].includes(it.status) ? 1 : it.status === 'inuse' ? 2 : isActive(it) ? 3 : 4;
const byAvail = (x, y) => avRank(x) - avRank(y) || x.id.localeCompare(y.id);
const custodianCell = it => it.custodian ? personRow(it.custodian) : Tag('Awaiting assignment', 'wait');

// one physical item as a row: the product name is in the group or panel header, so the row leads with the ID
const enrItemRow = it => `<button class="ak-row" data-go="#/enrichments/${it.id}"><span class="ak-row__b"><span class="ak-row__t">${it.id}${it.mode === 'batch' ? ` × ${it.qty}` : ''}</span><span class="ak-row__s">${esc(placeOf(it))} • ${esc(inCharge(it))}</span></span><span class="ak-row__e">${reviewTag(it)}${statusTag(it)}</span><span class="ak-row__chev">${ic('right', 18)}</span></button>`;

/* ============ Product definition: full-screen panel ============ */
function productDefPanel(pid) {
  const p = prodOf(pid);
  if (!p) return { close: '#/enrichments', title: 'Product', html: Card(EmptyState('Product not found', '', 'layers')), key: pid };
  const cat = by('categories', p.cat), items = enrItems().filter(it => it.product === p.id && inSite(it)).sort(byAvail), avail = items.filter(availableForUse).length;
  const head = `<div class="ak-head">${IconTile(glyphOf(p.name), { size: 56, tone: 'brand' })}<div class="ak-head__b"><div class="ak-head__t">${esc(p.name)}</div><div class="ak-head__x">${esc(p.material)}</div></div></div>`;
  const def = Section({ title: 'Definition' }, KV([['Usable life', p.life ? lifeText(p.life) : '<span class="t-mute">Not set</span>'], ['Tracking', `${esc(cat.code)} · ${MODE[cat.mode]}`], p.description && ['Description', esc(p.description)]]));
  const list = Section({ title: 'Items', count: items.length }, items.length ? items.map(enrItemRow).join('') : EmptyState('No items', '', 'layers'));
  const history = Section({ title: 'History', count: p.log.length }, Timeline(p.log.map(l => ({ title: l.act, who: nm(l.by), at: ft2(l.at), text: esc(l.note) }))));
  const foot = StatusFoot({ label: `${avail} of ${plural(items.length, 'item')} available` }, can(UI.me, 'prodDefine') ? Btn('Edit', { kind: 'pri', do: 'enrProdEdit', arg: p.id }) : '');
  return { close: '#/enrichments', title: p.id, sub: esc(ACT_TYPE[p.type]), key: p.id, html: head + Cols(def + list, history), foot };
}

/* ============ Deliveries: tickets dispatched by the existing request / material-transfer flow, waiting for receipt ============ */
const deliveries = () => D.tickets.filter(t => t.status === 'dispatched' && can(UI.me, 'receive', { section: t.section, site: sectionOf(t.section).site }) && inSite({ site: sectionOf(t.section).site }));
const deliveryCard = t => RecordCard({ icon: 'receive', heading: `${t.name} × ${t.qty}`, meta: `${t.id} • ${esc(t.mt)} • ${esc(secName(t.section))}`, chips: prodOf(t.product) || by('categories', t.cat).mode === 'excluded' ? '' : Tag('New product', 'wait'),
  band: 'yours', label: 'Awaiting receipt', when: rel(t.dispatched), go: '#/enrappr/' + t.id });
function deliveryPanel(id) {
  const t = by('tickets', id);
  if (!t) return { close: '#/enrappr', title: 'Delivery', html: Card(EmptyState('Delivery not found', '', 'receive')), key: id };
  const cat = by('categories', t.cat), p = prodOf(t.product), sec = sectionOf(t.section), waiting = t.status === 'dispatched';
  const head = `<div class="ak-head">${IconTile('receive', { size: 56, tone: 'brand' })}<div class="ak-head__b"><div class="ak-head__t">${esc(p ? p.name : t.name)}</div><div class="ak-head__x">${esc(sec.name)} · ${esc(siteName(sec.site))}</div></div></div>`;
  const main = Section({ title: 'Delivery' }, KV([['Quantity', String(t.qty)], ['Product', p ? LinkBtn(p.id, { go: '#/enrichments/' + p.id }) : Tag('Not defined', 'wait')], ['Tracking', `${esc(cat.code)} · ${MODE[cat.mode]}`],
    ['Material transfer', esc(t.mt)], t.ws && ['Workshop', esc(t.ws)], ['Dispatched', ft2(t.dispatched)], ['Requested by', personRow(t.requestedBy)]]));
  const its = (t.items || []).map(itemOf).filter(Boolean);
  const side = its.length ? Section({ title: 'Items', count: its.length }, its.map(enrItemRow).join('')) : '';
  const foot = waiting ? StatusFoot({ ago: rel(t.dispatched), label: 'Awaiting receipt' }, Btn('Receive', { kind: 'pri', icon: 'receive', do: 'enrReceive', arg: t.id }))
    : StatusFoot({ ago: rel(t.receivedAt), label: 'Received' });
  return { close: '#/enrappr', title: t.id, sub: 'Delivery', key: t.id + t.status, html: head + (side ? Cols(main, side) : main), foot };
}

/* ============ sheets ============ */
const lifeCells = (f, nKey, unitKey, label, r) => [cText(label, nKey, f, r, 'number'), cOpts('Unit', unitKey, f, LIFE_UNITS, r)];
const lifeFrom = (n, unit) => +n ? { n: +n, unit } : null;
const materialPicker = key => () => pickerPage({ title: 'Material', key, options: (D.config.materials || []).map(m => ({ v: m, t: m })) });

// receipt: confirm the quantity, product, condition, location, custodian and usable life; the review page shows what is created
DO.enrReceive = id => {
  closePop(true);
  const t = by('tickets', id); if (!t) return;
  const cat = by('categories', t.cat), excluded = cat.mode === 'excluded', site = sectionOf(t.section).site, fixed = prodOf(t.product);
  const prodName = f => fixed ? fixed.name : f.product === '__new' ? f.name.trim() : prodOf(f.product)?.name || '';
  const defLife = f => fixed ? fixed.life : f.product === '__new' ? lifeFrom(f.lifeN, f.lifeUnit) : prodOf(f.product)?.life || null;
  const life = f => f.own ? lifeFrom(f.ownN, f.ownUnit) : defLife(f);
  const status = f => !f.fit || f.cond !== 'good' ? STATUS.assessment : locOf(f.loc)?.kind === 'store' ? STATUS.storage : locOf(f.loc)?.kind === 'enclosure' ? STATUS.inuse : STATUS.available;
  const prodOk = f => fixed || (f.product && f.product !== '__new') || (f.product === '__new' && f.name.trim() && f.type && f.material);
  const sum = `<div class="ak-sum">${IconTile('receive', { size: 40 })}<div class="ak-sum__b"><div class="ak-sum__t">${esc(t.name)} × ${t.qty}</div><div class="ak-sum__s">${esc([t.id, t.mt, t.ws].filter(Boolean).join(' · '))}</div></div></div>`;
  const productG = f => fixed ? fg('Product', [cInfo('Product', `${esc(fixed.name)} · ${fixed.id}`)])
    : fg('Product', [cNav('Product', f.product === '__new' ? 'New product' : prodOf(f.product)?.name || '', 'prod', true),
      ...(f.product === '__new' ? [cText('Name', 'name', f, true), cOpts('Enrichment type', 'type', f, ENR_TYPES.map(k => [k, ACT_TYPE[k]]), true), cNav('Material', f.material, 'material', true), ...lifeCells(f, 'lifeN', 'lifeUnit', 'Usable life'), cArea('Description', 'description', f)] : [])]);
  const payload = f => ({ product: f.product === '__new' ? '' : f.product, define: f.product === '__new' ? { name: f.name, type: f.type, material: f.material, description: f.description, life: lifeFrom(f.lifeN, f.lifeUnit) } : null,
    qty: f.qty, cond: f.cond, fit: f.fit && f.cond === 'good', loc: f.loc, custodian: f.custodian, discrepancy: f.discrepancy, notes: f.notes || (f.cond !== 'good' ? COND[f.cond] + ' on receipt' : ''),
    life: f.own ? lifeFrom(f.ownN, f.ownUnit) : null, lifeWhy: f.ownWhy });
  sheet({
    title: 'Receive delivery',
    body: f => sum + (excluded ? '' : productG(f))
      + fg('Delivery', [cStep('Received', 'qty', f, 1, t.qty * 3), f.qty !== t.qty && cArea(f.qty < t.qty ? 'Shortage reason' : 'Excess reason', 'discrepancy', f, true), cInfo('Creates', excluded ? 'No record' : cat.mode === 'individual' ? plural(f.qty, 'record') : '1 group record')])
      + (excluded ? '' : fg('Condition', [cSeg('cond', f, COND_ARRIVE), cToggle('Fit for use', 'fit', f), !f.fit && cArea('Issue', 'notes', f)])
        + fg('Assign', [cNav('Location', locName(f.loc), 'loc', true), cNav('Custodian', f.custodian ? nm(f.custodian) : 'Assign later', 'custodian')])
        + fg('Usable life', [cInfo('Product', lifeText(defLife(f)) || 'Not set'), cToggle('Different usable life', 'own', f), ...(f.own ? [...lifeCells(f, 'ownN', 'ownUnit', 'Usable life', true), cArea('Reason', 'ownWhy', f, true)] : [])])),
    pickers: {
      prod: () => pickerPage({ title: 'Product', key: 'prod', search: true, after: g => { g.product = g.prod; if (g.product === '__new' && !g.name) g.name = t.name; },
        options: [{ v: '__new', t: 'New product' }, ...D.products.filter(p => p.cat === t.cat).sort((x, y) => x.name.localeCompare(y.name)).map(p => ({ v: p.id, t: p.name, s: [p.id, p.material, lifeText(p.life)].filter(Boolean).join(' · '), group: ACT_TYPE[p.type] }))] }),
      material: materialPicker('material'),
      loc: () => pickerPage({ title: 'Location', key: 'loc', options: locOpts(l => l.section === t.section) }),
      custodian: () => pickerPage({ title: 'Custodian', key: 'custodian', options: [{ v: '', t: 'Assign later' }, ...peopleOpts(p => custodianChoices({ site }).some(x => x.id === p.id))] }),
    },
    done: {
      label: 'Next', confirm: 'Receive',
      ok: f => f.qty > 0 && (f.qty === t.qty || f.discrepancy.trim()) && (excluded || (f.loc && prodOk(f) && (!f.own || (+f.ownN && f.ownWhy.trim())))),
      review: f => sum + reviewOf([['Received', `${f.qty} of ${t.qty}`], f.discrepancy.trim() && ['Discrepancy', esc(f.discrepancy)],
        !excluded && ['Product', esc(prodName(f))], !excluded && ['Condition', COND[f.cond] + (f.fit ? '' : ' · not fit')], !excluded && ['Location', esc(locName(f.loc))],
        !excluded && ['Custodian', f.custodian ? esc(nm(f.custodian)) : 'Awaiting assignment'], ['Creates', excluded ? 'No record' : cat.mode === 'individual' ? plural(f.qty, 'record') : '1 group record'],
        !excluded && ['Status', status(f)], !excluded && life(f) && ['Review by', fd(addLife(day(nowIs()), life(f)))]]),
      run: f => { const ids = receiveDelivery(t.id, UI.me, payload(f)); return ids.length ? { msg: `${plural(ids.length, 'record')} registered`, go: '#/enrichments/' + ids[0] } : { msg: 'Delivery confirmed', go: '#/enrappr' }; },
    },
  }, { product: t.product || '', prod: '', name: '', type: '', material: '', lifeN: '', lifeUnit: 'months', description: '', qty: t.qty, discrepancy: '', cond: 'good', fit: true, notes: '', loc: '',
    custodian: role() === 'sup' ? UI.me : '', own: false, ownN: '', ownUnit: 'months', ownWhy: '' });
};

// assignment for use: an enclosure of the item's section, and optionally the animals living there
DO.enrAssign = id => {
  closePop(true);
  const it = itemOf(id);
  sheet({
    title: 'Assign for use',
    body: f => sumItem(it) + fg('', [cNav('Enclosure', locName(f.to), 'to', true), f.to && cNav('Animals', more(anNames(f.animals), 2), 'animals'), it.mode === 'batch' && cStep('Quantity', 'qty', f, 1, it.qty), cArea('Note', 'note', f)]),
    pickers: {
      to: () => pickerPage({ title: 'Enclosure', key: 'to', after: g => { g.animals = []; }, options: locOpts(l => l.section === it.section && l.kind === 'enclosure') }),
      animals: f => multiPage({ title: 'Animals', key: 'animals', options: A().animals.filter(a => a.loc === f.to).map(a => ({ v: a.id, t: a.name, s: `${a.id} · ${esc(speciesOf(a.species).name)}` })) }),
    },
    done: { label: 'Next', confirm: 'Assign', ok: f => f.to,
      review: f => sumItem(it) + reviewOf([['To', esc(locName(f.to))], f.animals.length && ['Animals', esc(anNames(f.animals).join(', '))], it.mode === 'batch' && ['Quantity', `${f.qty} of ${it.qty}`], f.note.trim() && ['Note', esc(f.note)], ['Status', STATUS.inuse]]),
      run: f => { assignForUse(id, UI.me, f); return `Assigned to ${locName(f.to)}`; } },
  }, { to: '', animals: [], qty: it.qty, note: '' });
};

// life review: still fit (next review date) or replace; status and condition stay as they are
DO.enrLifeReview = id => {
  closePop(true);
  const it = itemOf(id), l = lifeOf(it), due = reviewDue(it);
  sheet({
    title: 'Life review',
    body: f => sumItem(it) + fg('', [due && cInfo('Review by', `${fd(due)} ${reviewTag(it)}`), cInfo('Usable life', lifeText(l) || 'Not set'), cInfo('Condition', esc(COND[it.cond]))])
      + fg('Outcome', [cSeg('outcome', f, [['fit', 'Still fit for use'], ['replace', 'Replace']]), f.outcome === 'fit' && cDate('Next review', 'next', f, true), cArea(f.outcome === 'replace' ? 'Reason' : 'Note', 'note', f, f.outcome === 'replace')]),
    done: { label: 'Next', confirm: 'Record', ok: f => f.outcome && (f.outcome === 'fit' ? f.next : f.note.trim()),
      review: f => sumItem(it) + reviewOf([['Outcome', f.outcome === 'fit' ? 'Still fit for use' : REVIEW.replace], f.outcome === 'fit' && ['Next review', fd(f.next)], f.note.trim() && ['Note', esc(f.note)], ['Status', STATUS[it.status]]]),
      run: f => { recordReview(id, UI.me, f); return 'Review recorded'; } },
  }, { outcome: '', next: l ? addLife(day(nowIs()), l) : '', note: '' });
};

// usable life of one item: an override with a reason, or back to the product default
DO.enrLife = id => {
  closePop(true);
  const it = itemOf(id), p = productOf(it);
  sheet({
    title: 'Usable life',
    alt: it.life ? [{ label: 'Use product default', do: 'enrLifeDefault', arg: id }] : [],
    body: f => sumItem(it) + fg('', [cInfo('Product', lifeText(p.life) || 'Not set'), ...lifeCells(f, 'n', 'unit', 'Usable life', true), cArea('Reason', 'why', f, true)]),
    done: { label: 'Next', confirm: 'Save', ok: f => +f.n && f.why.trim(),
      review: f => sumItem(it) + reviewOf([['From', lifeText(lifeOf(it)) || 'Not set'], ['To', lifeText(lifeFrom(f.n, f.unit))], ['Review by', fd(addLife(lifeStart(it), lifeFrom(f.n, f.unit)))], ['Reason', esc(f.why)]]),
      run: f => { setItemLife(id, UI.me, { life: lifeFrom(f.n, f.unit), why: f.why }); return 'Usable life saved'; } },
  }, { n: it.life ? it.life.n : '', unit: it.life ? it.life.unit : 'months', why: '' });
};
DO.enrLifeDefault = id => {
  const snap = snapshot();
  try { trial(() => setItemLife(id, UI.me, { life: null, why: SH.f.why })); save(); closeSheet(); render(); toast('Product default restored', { undo: snap }); }
  catch (e) { SH.err = e.message; drawSheet('refresh'); }
};

// product definition: name, type, material, usable life, description; the category stays
DO.enrProdEdit = pid => {
  closePop(true);
  const p = prodOf(pid), cat = by('categories', p.cat);
  sheet({
    title: 'Edit product',
    body: f => fg('Product', [cText('Name', 'name', f, true), cOpts('Enrichment type', 'type', f, ENR_TYPES.map(k => [k, ACT_TYPE[k]]), true), cNav('Material', f.material, 'material', true), cInfo('Tracking', `${esc(cat.code)} · ${MODE[cat.mode]}`)])
      + fg('Usable life', lifeCells(f, 'n', 'unit', 'Usable life')) + fg('', [cArea('Description', 'description', f)]),
    pickers: { material: materialPicker('material') },
    done: { label: 'Save', ok: f => f.name.trim() && f.type && f.material,
      run: f => { saveProduct(UI.me, { id: p.id, name: f.name, type: f.type, cat: p.cat, material: f.material, description: f.description, life: lifeFrom(f.n, f.unit) }); return 'Product saved'; } },
  }, { name: p.name, type: p.type, material: p.material, n: p.life ? p.life.n : '', unit: p.life ? p.life.unit : 'months', description: p.description || '' });
};
