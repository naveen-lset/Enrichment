// src/ipad/activity-views.js — the enrichment activity module (PROPOSED, from the Figma activity flows), drawn like the ANTZ diet module:
// one module with an underlined tab bar (Sessions · Activities · Species · Requests), counted segment tabs and filter chips,
// request-style session cards with a tinted action footer, and one-card detail panes. Rules in src/model/activity.js.

/* ============ shared parts ============ */
const stars = n => `<span class="stars" aria-label="${n} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
const ini = (t, size = 48) => `<span class="ini" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .34)}px">${esc(t.split(/[\s-]+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>`;
const tg = (t, tone = '') => `<span class="tg ${tone ? 'tg--' + tone : ''}">${esc(t)}</span>`;
const ACT_TONE = { pending: 'warn', changes: 'bad', retired: '' };
const actPill = (a, lg) => a.state === 'approved' ? '' : pill(ACT_STATE[a.state], ACT_TONE[a.state], '', lg);
const CHK_TONE = { ready: 'ok', store: 'info', blocked: 'warn', none: 'bad' };
const CHK_ICON = { ready: 'check', store: 'pin', blocked: 'alert', none: 'alert' };
function checkText(m) {
  if (m.state === 'ready') return `${m.name} ready`;
  if (m.state === 'store') return `${m.name} in ${locName(m.items[0].loc)}`;
  if (m.state === 'blocked') { const it = m.items[0]; return `${m.name} ${(['assessment', 'repair'].includes(it.status) ? STATUS[it.status] : COND[it.cond]).toLowerCase()}`; }
  return `${m.name} not in the register`;
}
const checkShort = m => checkText(m).slice(m.name.length + 1);
function cbar(list) {
  if (!list.length) return '';
  const bad = list.filter(m => m.state !== 'ready'), m = bad[0];
  return m ? `<div class="cbar cbar--${CHK_TONE[m.state]}">${ic(CHK_ICON[m.state], 16)}<span>${esc(checkText(m))}${bad.length > 1 ? ` · ${bad.length - 1} more` : ''}</span></div>`
    : `<div class="cbar cbar--ok">${ic('check', 16)}<span>Materials ready${list.length > 1 ? ' · ' + plural(list.length, 'item') : ''}</span></div>`;
}
const sitePlan = p => UI.site === 'all' || p.site === UI.site;
const myPlan = p => role() === 'keeper' ? p.keeper === UI.me : role() === 'sup' ? me().sections.includes(p.section) : true;
const canRec = p => can(UI.me, 'sessionRecord', p) && (role() !== 'keeper' || p.keeper === UI.me);
const spInSite = sp => animalsOf(sp.id).some(a => UI.site === 'all' || a.site === UI.site);
const activePlansFor = spId => A().plans.filter(p => p.active && planSpecies(p) === spId && sitePlan(p));
const dateT = d => `${dow(d)}, ${fs(d)}`;
const speciesLine = a => { const n = a.species.map(s => speciesOf(s).name); return n[0] + (n.length > 1 ? ` +${n.length - 1}` : ''); };
// filter chips with counts (diet style); a label in front when the row is one of several
const fchips = (items, cur, act, label) => `<div class="frow">${label ? `<span class="frow__l">${esc(label)}</span>` : ''}<div class="chips">${items.map(([k, t, n]) => `<button class="fch ${cur === k ? 'on' : ''}" data-do="${act}" data-arg="${esc(k)}">${esc(t)}${n != null ? ` <span>${n}</span>` : ''}</button>`).join('')}</div></div>`;
// one white detail card: head, then sections divided by hairlines
const dsec = (title, body, act = '') => `<div class="dsec">${title ? `<div class="dsec__h"><div class="dsec__t">${esc(title)}</div>${act}</div>` : ''}${body}</div>`;
// grid table with a tinted header row (like the diet item table): cols = [[label, width]], rows = [{go, c: [html…]}]
function dtbl(cols, rows, emptyT) {
  if (!rows.length) return `<div class="dtbl__empty">${esc(emptyT || 'None')}</div>`;
  const tpl = cols.map(c => c[1] || 'minmax(0,1fr)').join(' ');
  return `<div class="dtbl" style="--cols:${tpl}"><div class="dtbl__h">${cols.map(c => `<div>${esc(c[0])}</div>`).join('')}</div>${rows.map(r => `<div class="dtbl__r" ${r.go ? `data-go="${r.go}"` : ''}>${r.c.map(x => `<div>${x}</div>`).join('')}</div>`).join('')}</div>`;
}
const hstats = list => `<div class="hstats" style="--n:${list.length}">${list.map(([n, l]) => `<div><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>`;

/* ============ module tab bar ============ */
const seeReq = r => (UI.site === 'all' || r.site === UI.site) && (role() === 'keeper' ? me().sections.includes(r.section) : can(UI.me, 'matReview', r) || role() === 'admin');
const visibleToday = () => occurrences(day(nowIs()), day(nowIs())).filter(o => sitePlan(o.plan) && myPlan(o.plan) && (o.plan.active || o.s));
function enrTabs(cur) {
  const tabs = [['sessions', 'Sessions', visibleToday().length], ['activities', 'Activities', A().activities.filter(a => a.state !== 'retired').length],
    ['species', 'Species', A().species.filter(spInSite).length], VIEWS.matreq.allow() && ['matreq', 'Requests', A().requests.filter(seeReq).length]].filter(Boolean);
  return `<div class="mtabs" style="--n:${tabs.length}">${tabs.map(([k, t, n]) => `<button class="mtab ${k === cur ? 'on' : ''}" data-go="#/${k}">${t} - ${n}</button>`).join('')}</div>`;
}

/* ============ Sessions: the day's cards ============ */
function occState(o) {
  const today = day(nowIs());
  if (o.s) return o.s.state === 'done' ? 'done' : 'skip';
  return o.date < today ? 'late' : o.date === today ? 'todo' : 'plan';
}
function sessionCard(o, on, bySlot) {
  const p = o.plan, a = activityOf(p.activity), st = occState(o), s = o.s, open = st === 'todo' || st === 'late';
  const who = p.kind === 'animal' ? `Animal · ${animalOf(p.target).id} · ${animalOf(p.target).name}` : 'Species-wide';
  const foot = {
    todo: ['clock', 'Record observation', `Due ${p.time}${bySlot ? '' : ' · ' + SLOT[p.time]}`], late: ['alert', 'Missed', `Was due ${dateT(o.date)}`], plan: ['calendar', 'Scheduled', `${dateT(o.date)} · ${p.time}`],
    done: ['check', SUCCESS[s?.success] || 'Recorded', `Recorded ${s?.date === day(s?.at) ? tm(s?.at) : fs(s?.at)}${s?.by !== UI.me ? ' · ' + nm(s?.by) : ''}`], skip: ['x', 'Skipped', s?.reason || ''],
  }[st];
  const btns = open && p.active && canRec(p) ? `<button class="btn btn--plain" data-do="actSkip" data-arg="${o.key}">Skip</button><button class="btn btn--fill" data-do="actRecord" data-arg="${o.key}">Record</button>` : st === 'done' ? stars(s.rating) : '';
  return `<div class="scard ${on ? 'on' : ''}" data-go="#/sessions/${o.key}">
    <div class="scard__h"><div class="scard__hb"><div class="scard__id">${esc(speciesOf(planSpecies(p)).name)}</div><div class="scard__s">${esc(who)}</div><div class="scard__s">${esc(locName(p.loc))}</div></div>${tg(ACT_TYPE[a.type], 'mint')}</div>
    <div class="scard__b"><div class="scard__t">${esc(a.name)}</div><div class="scard__d">${esc(a.goal)}</div>
      <div class="scard__l">${ic('book', 17)}<b>${a.id}${a.sub ? ' · ' + esc(a.sub) : ''}</b></div>
      <div class="scard__l">${ic('calendar', 17)}<span>${PLAN_FREQ[p.freq]} · ${a.mins} min</span></div>
      ${open ? cbar(inventoryCheck(a.id, p.loc)) : ''}
      ${p.keeper !== UI.me ? `<div class="scard__m"><b>${esc(nm(p.keeper))}</b> • Keeper</div>` : ''}</div>
    <div class="scard__f scard__f--${st}">${ic(foot[0], 20)}<div class="scard__fb"><div class="scard__ft">${esc(foot[1])}</div><div class="scard__fs">${esc(foot[2])}</div></div>${btns}</div></div>`;
}
VIEWS.sessions = {
  label: 'Sessions', hdr: 'Enrichment', sbLabel: 'Enrichment', sbIcon: 'sparkle', icon: 'calendar', layout: 'full',
  count: () => {
    const n = occurrences(day(nowIs()), day(nowIs())).filter(o => !o.s && o.plan.active && o.plan.keeper === UI.me).length
      + (role() === 'bio' ? A().activities.filter(a => a.state === 'pending').length : 0) + A().requests.filter(r => r.state === 'review' && sitePlan(r) && can(UI.me, 'matReview', r)).length;
    return n ? { n } : 0;
  },
  full(r) {
    const tab = UI.tab.sessions || 'today', chip = UI.f.sessions?.chip || 'all', today = day(nowIs());
    const span = { today: [today, today], upcoming: [addDays(today, 1), addDays(today, 7)], recent: [addDays(today, -14), addDays(today, -1)] };
    const get = t => occurrences(...span[t]).filter(o => sitePlan(o.plan) && myPlan(o.plan) && (o.plan.active || o.s));
    let list = get(tab);
    const todo = list.filter(o => !o.s), needs = todo.filter(o => !checkReady(inventoryCheck(o.plan.activity, o.plan.loc)));
    const chips = tab === 'today' ? fchips([['all', 'All', list.length], ['todo', 'To record', todo.length], ['done', 'Recorded', list.length - todo.length], ['needs', 'Needs materials', needs.length]], chip, 'sesChip') : '';
    if (tab === 'today' && chip !== 'all') list = chip === 'done' ? list.filter(o => o.s) : chip === 'needs' ? needs : todo;
    list.sort((x, y) => (tab === 'recent' ? y.date.localeCompare(x.date) : x.date.localeCompare(y.date)) || x.plan.time.localeCompare(y.plan.time) || x.plan.id.localeCompare(y.plan.id));
    const miss = needs.map(o => ({ o, m: inventoryCheck(o.plan.activity, o.plan.loc).find(m => ['store', 'none'].includes(m.state)) })).find(x => x.m && can(UI.me, 'matRequest', x.o.plan));
    const sum = tab === 'today' && todo.length ? `<div class="sumbar"><span><b>${todo.length - needs.length} of ${todo.length}</b> sessions to record have their materials ready.</span>${miss ? `<button class="btn btn--fill" data-do="actMat" data-arg="${miss.o.plan.activity}|${miss.o.plan.loc}|${esc(miss.m.name)}">${ic('newitem', 18)}Request materials</button>` : ''}</div>` : '';
    const groups = tab === 'today' ? Object.entries(SLOT).map(([t, l]) => [l, list.filter(o => o.plan.time === t)]) : [...new Set(list.map(o => o.date))].map(d => [dateT(d), list.filter(o => o.date === d)]);
    const body = groups.filter(g => g[1].length).map(([l, os]) => `<div class="glabel">${esc(l)} (${os.length})</div><div class="scards">${os.map(o => sessionCard(o, r.id === o.key, tab === 'today')).join('')}</div>`).join('');
    return { title: 'Sessions', key: tab + chip, top: enrTabs('sessions'),
      tabs: seg('stab', [{ v: 'today', t: 'Today', n: get('today').length }, { v: 'upcoming', t: 'Next 7 days', n: get('upcoming').length }, { v: 'recent', t: 'Last 14 days', n: get('recent').length }], tab, 'sesTab', 'seg--block'),
      html: chips + sum + (body || empty('calendar', chip === 'todo' ? 'All recorded' : 'No sessions', '', true)) };
  },
  slide(r) { if (!r.id) return null; const d = sessionDetail(r.id); return d && { close: '#/sessions', title: d.title, html: d.html, key: r.id }; },
};
DO.sesTab = t => { UI.tab.sessions = t; go('#/sessions'); };
DO.sesChip = c => { UI.f.sessions = { chip: c }; render(); };

function sessionDetail(key) {
  const [pid, date] = key.split('@'), p = planOf(pid);
  if (!p || !date) return null;
  const a = activityOf(p.activity), o = { key, plan: p, date, s: sessionFor(p.id, date) }, s = o.s, st = occState(o);
  const check = inventoryCheck(a.id, p.loc), missing = check.find(m => ['store', 'none'].includes(m.state));
  const STT = { todo: ['To record', 'warn'], late: ['Missed', 'bad'], plan: ['Scheduled', ''], done: ['Recorded', 'mint'], skip: ['Skipped', ''] }[st];
  const acts = (st === 'todo' || st === 'late') && p.active && canRec(p) ? [['Skip', 'actSkip', key], ['Record', 'actRecord', key, true]] : [];
  if (missing && !s && can(UI.me, 'matRequest', p)) acts.unshift(['Request material', 'actMat', `${a.id}|${p.loc}|${missing.name}`]);
  const used = s && s.state === 'done' ? s.materials.map(itemOf).filter(Boolean) : [];
  const html = `<div class="dcard">
    <div class="dhead"><div class="dhead__b"><div class="dhead__t">${esc(a.name)}</div><div class="dhead__s">${esc(speciesOf(planSpecies(p)).name)} · ${esc(locName(p.loc))}</div><div class="tags">${tg(STT[0], STT[1])}</div></div></div>
    ${acts.length ? `<div class="dacts">${acts.map(([t, d, arg, main]) => `<button class="btn ${main ? 'btn--fill' : 'btn--plain'}" data-do="${d}" data-arg="${esc(arg)}">${t}</button>`).join('')}</div>` : ''}
    ${dsec('', kv([['Date', `${dateT(date)} · ${p.time}`], ['Keeper', personRow(p.keeper)], ['Plan', `${PLAN_FREQ[p.freq]} · ${p.kind === 'animal' ? esc(animalOf(p.target).name) : 'Species-wide'}`], ['Activity', `<span class="link" data-go="#/activities/${a.id}">${a.id}${a.sub ? ' · ' + esc(a.sub) : ''}</span>`]]))}
    ${s && s.state === 'done' ? dsec('Observation', `<div class="obs"><div class="obs__r">${stars(s.rating)}<b>${SUCCESS[s.success]}</b></div>${s.comment ? `<div class="obs__c">${esc(s.comment)}</div>` : ''}</div>` + kv([['Engagement', ENGAGE[s.engage]], s.behaviours.length && ['Behaviours', esc(s.behaviours.join(', '))], ['Duration', `${s.mins} min`], ['Recorded', `${esc(nm(s.by))} · ${ft2(s.at)}`]])) : ''}
    ${s && s.state === 'skipped' ? dsec('Skipped', kv([['Reason', esc(s.reason)], s.comment && ['Note', esc(s.comment)], ['By', `${esc(nm(s.by))} · ${ft2(s.at)}`]])) : ''}
    ${s && s.safety ? dsec('Safety incident', `<div class="cbar cbar--bad" style="margin:0 20px 8px">${ic('alert', 16)}<span>${esc(itemOf(s.safety.item).name)} flagged unsafe · ${esc(s.safety.issue)}</span></div>` + kv([['Item', `<span class="link" data-go="#/register/${s.safety.item}">${s.safety.item}</span>`], s.safety.notes && ['Notes', esc(s.safety.notes)], ['Item now', stPill(itemOf(s.safety.item))]])) : ''}
    ${s && s.state === 'done' ? dsec('Materials used', dtbl([['Item'], ['ID', '96px']], used.map(it => ({ go: '#/register/' + it.id, c: [`<b>${esc(it.name)}</b>`, it.id] })), 'None')) : check.length ? dsec('Materials', dtbl([['Material'], ['Status', 'minmax(0,1.1fr)']], check.map(m => ({ go: m.items[0] ? '#/register/' + m.items[0].id : '', c: [`<b>${esc(m.name)}</b>${m.items[0] ? `<small>${m.items[0].id} · ${esc(locName(m.items[0].loc))}</small>` : ''}`, tg(m.state === 'ready' ? 'Ready' : checkShort(m), CHK_TONE[m.state] === 'ok' ? 'mint' : CHK_TONE[m.state])] })))) : ''}
    ${s && s.photos.length ? dsec('Evidence', photos(s.photos)) : ''}</div>`;
  return { title: a.name, html };
}

/* ============ Activities: catalogue and approval ============ */
function actList(tab, type, q) {
  const unused = new Set(unusedActivities().map(x => x.a.id));
  return A().activities.filter(a => (tab === 'all' ? a.state !== 'retired' : tab === 'review' ? ['pending', 'changes'].includes(a.state) : unused.has(a.id))
    && (!type || a.type === type) && match(q, a.id, a.name, a.sub, a.goal, ACT_TYPE[a.type], a.species.map(s => speciesOf(s).name).join(' ')));
}
VIEWS.activities = {
  label: 'Activities', hdr: 'Enrichment', group: 'sessions', icon: 'sparkle', layout: 'split',
  list(r) {
    const tab = UI.tab.activities || 'all', type = UI.f.activities?.type || '', q = UI.q.activities || '', base = actList(tab, '', q), list = base.filter(a => !type || a.type === type);
    const unused = new Set(unusedActivities().map(x => x.a.id));
    const chips = fchips([['', 'All', base.length], ...Object.entries(ACT_TYPE).map(([k, t]) => [k, t, base.filter(a => a.type === k).length]).filter(x => x[2])], type, 'actType');
    const row = a => { const s = activityStats(a.id);
      return `<div class="row ${r.id === a.id ? 'on' : ''}" data-go="#/activities/${a.id}"><div class="row__b"><div class="row__t">${esc(a.name)}</div><div class="row__s">${a.id} · ${esc(speciesLine(a))}</div>
        <div class="tags">${tg(ACT_TYPE[a.type], 'mint')}${a.state !== 'approved' ? tg(ACT_STATE[a.state], ACT_TONE[a.state]) : ''}${unused.has(a.id) && tab !== 'unused' ? tg('Unused') : ''}</div></div>
        ${s.rating != null ? `<div class="row__big"><b>${s.rating.toFixed(1)}</b><span>Rating</span></div>` : ''}<span class="row__chev">${ic('right', 20)}</span></div>`; };
    const all = A().activities;
    return { title: 'Activities', top: enrTabs('activities'), search: 'Search activity, ID or species',
      tabs: seg('atabs', [{ v: 'all', t: 'Catalogue', n: actList('all', '', '').length }, { v: 'review', t: 'Awaiting approval', n: all.filter(a => ['pending', 'changes'].includes(a.state)).length }, { v: 'unused', t: 'Unused', n: unused.size }], tab, 'actTab', 'seg--block'),
      rows: chips + `<div class="lcount"><span>Activities (${list.length})</span></div><div class="rows">${list.map(row).join('') || empty('sparkle', q ? 'No results' : 'No activities', '', true)}</div>` };
  },
  detail(r) { return activityDetail(r.id); },
};
DO.actTab = t => { UI.tab.activities = t; go('#/activities'); };
DO.actType = t => { UI.f.activities = { type: t }; go('#/activities'); };

function activityDetail(id) {
  const a = activityOf(id);
  if (!a) return { html: empty('sparkle', 'No activity selected') };
  const tab = UI.tab.act || 'details', st = activityStats(a.id), plans = A().plans.filter(p => p.activity === a.id && p.active && sitePlan(p));
  const author = a.by === UI.me || role() === 'admin';
  let box = '';
  if (a.state === 'approved') box = `<div class="abox"><span class="abox__i">${ic('check', 16)}</span><div class="abox__b"><div class="abox__t">${esc(nm(a.review.by))}</div><div class="abox__s">Biologist · approved ${fd(a.review.at)}</div></div></div>`;
  else if (a.state === 'pending') box = `<div class="abox abox--warn"><span class="abox__i">${ic('clock', 16)}</span><div class="abox__b"><div class="abox__t">${can(UI.me, 'actApprove') ? 'Waiting for your approval' : 'Waiting for the biologist'}</div><div class="abox__s">Sent by ${esc(nm(a.by))} · ${fd(a.at)}</div></div>${can(UI.me, 'actApprove') ? `<button class="btn btn--fill btn--sm" data-do="actReviewAct" data-arg="${a.id}">Review</button>` : ''}</div>`;
  else if (a.state === 'changes') box = `<div class="abox abox--bad"><span class="abox__i">${ic('alert', 16)}</span><div class="abox__b"><div class="abox__t">${esc(a.review.note)}</div><div class="abox__s">${esc(nm(a.review.by))} · ${fd(a.review.at)}</div></div>${author ? `<button class="btn btn--fill btn--sm" data-do="actResubmit" data-arg="${a.id}">Edit</button>` : ''}</div>`;
  const acts = a.state === 'approved' ? [can(UI.me, 'matRequest') && a.materials.length && ['Request material', 'actMat', a.id], can(UI.me, 'actAssign') && ['Assign', 'actAssign', a.id, true]].filter(Boolean) : [];
  let body = '';
  if (tab === 'details') {
    body = dsec('Plan', kv([['Goal', esc(a.goal)], ['Duration', `${a.mins} min`], a.safety && ['Restrictions and safety', esc(a.safety)], a.additives && ['Additives', esc(a.additives)], a.state === 'approved' && ['Created', `${esc(nm(a.by))} · ${fd(a.at)}`]]))
      + (a.materials.length ? dsec('Materials', dtbl([['Material'], ['In use', '64px'], ['In store', '72px'], ['Repair', '64px']], a.materials.map(m => { const c = regCounts(m); return { do: m, c: [`<span class="link" data-do="findItems" data-arg="${esc(m)}">${esc(m)}</span>`, c.use, c.store, c.rep ? `<b class="t-warn">${c.rep}</b>` : 0] }; }))) : '');
  } else if (tab === 'species') {
    body = dsec('', dtbl([['Species'], ['Enclosure'], ['Plan', 'minmax(0,.9fr)']], a.species.map(speciesOf).flatMap(sp => {
      const ps = plans.filter(p => planSpecies(p) === sp.id);
      return ps.length ? ps.map(p => { const bad = inventoryCheck(a.id, p.loc).find(m => m.state !== 'ready');
        return { go: '#/species/' + sp.id, c: [`<b>${esc(sp.name)}</b><small>${p.kind === 'animal' ? esc(animalOf(p.target).name) : 'Species-wide'}</small>`, `${esc(locName(p.loc))}${bad ? `<small class="t-${CHK_TONE[bad.state]}">${esc(checkShort(bad))}</small>` : ''}`, `${PLAN_FREQ[p.freq]}<small>${esc(first(p.keeper))} · ${p.time}</small>`] }; })
        : [{ go: '#/species/' + sp.id, c: [`<b>${esc(sp.name)}</b><small><i>${esc(sp.sci)}</i></small>`, '<span class="t-mute">Not assigned</span>', ''] }];
    })));
  } else {
    const done = A().sessions.filter(s => s.activity === a.id && s.state === 'done' && sitePlan(planOf(s.plan))).sort((x, y) => y.at.localeCompare(x.at));
    const beh = BEHAVIOURS.map(b => [b, done.filter(s => s.behaviours.includes(b)).length]).filter(x => x[1]);
    body = st.n ? (beh.length ? dsec('Behaviours seen', `<div class="bars" style="padding:0 20px 8px">${beh.map(([b, n]) => `<div class="bar-r"><span>${b}</span><div class="bar-r__t"><i style="width:${n / done.length * 100}%;background:var(--md3-primary)"></i></div><b>${n}</b></div>`).join('')}</div>`) : '')
      + dsec('Recent observations', dtbl([['Session'], ['Rating', '104px']], done.slice(0, 10).map(s => { const p = planOf(s.plan); return { go: `#/sessions/${p.id}@${s.date}`, c: [`<b>${esc(p.kind === 'animal' ? animalOf(p.target).name : speciesOf(p.target).name)} · ${fs(s.date)}</b><small>${esc(s.comment || ENGAGE[s.engage])}</small>`, stars(s.rating)] }; })))
      : `<div class="dtbl__empty">No sessions yet</div>`;
  }
  const html = `<div class="dcard">
    <div class="dhead"><div class="dhead__b"><div class="dhead__t">${esc(a.name)}</div><div class="dhead__s">${a.id} · ${esc(speciesLine(a))}</div><div class="tags">${tg(ACT_TYPE[a.type], 'mint')}${a.sub ? tg(a.sub) : ''}${a.state !== 'approved' ? tg(ACT_STATE[a.state], ACT_TONE[a.state]) : ''}</div></div></div>
    ${box}
    ${a.state === 'approved' ? hstats([[st.n, 'Sessions'], [st.success == null ? '—' : st.success + '%', 'Successful'], [st.rating == null ? '—' : st.rating.toFixed(1), 'Rating'], [plans.length, plans.length === 1 ? 'Plan' : 'Plans']]) : ''}
    ${acts.length ? `<div class="dacts">${acts.map(([t, d, arg, main]) => `<button class="btn ${main ? 'btn--fill' : 'btn--plain'}" data-do="${d}" data-arg="${esc(arg)}">${t}</button>`).join('')}</div>` : ''}
    <div class="dtabs">${[['details', 'Details'], ['species', 'Species'], ['results', 'Results']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-do="actDTab" data-arg="${k}">${t}</button>`).join('')}</div>
    ${body}</div>`;
  return { title: a.name, html, key: tab };
}
DO.actDTab = t => { UI.tab.act = t; render(); };
function regCounts(name) {
  const its = siteItems().filter(it => isActive(it) && it.name === name), n = st => its.filter(i => st.includes(i.status)).length;
  return { use: n(['inuse', 'available']), store: n(['storage']), rep: n(['assessment', 'repair']) };
}
DO.findItems = name => { UI.q.register = name; UI.f.register = { st: 'all' }; go('#/register'); };

/* ============ Species ============ */
VIEWS.species = {
  label: 'Species', hdr: 'Enrichment', group: 'sessions', icon: 'paw', layout: 'split',
  list(r) {
    const tab = UI.tab.species || 'all', q = UI.q.species || '';
    const all = A().species.filter(spInSite).map(sp => ({ sp, n: activePlansFor(sp.id).length, an: animalsOf(sp.id).filter(x => UI.site === 'all' || x.site === UI.site).length }));
    const list = all.filter(x => (tab === 'all' || (tab === 'with' ? x.n : !x.n)) && match(q, x.sp.name, x.sp.sci, x.sp.cls)).sort((x, y) => y.n - x.n || x.sp.name.localeCompare(y.sp.name));
    const rows = list.map(({ sp, n, an }) => `<div class="row row--sp ${r.id === sp.id ? 'on' : ''}" data-go="#/species/${sp.id}">${ini(sp.name)}<div class="row__b"><div class="row__t">${esc(sp.name)}</div><div class="row__sci">${esc(sp.sci)}</div><div class="row__s">${esc(sp.cls)} • ${plural(an, 'animal')}</div></div><div class="row__big"><b>${n}</b><span>${n === 1 ? 'Activity' : 'Activities'}</span></div><span class="row__chev">${ic('right', 20)}</span></div>`).join('');
    return { title: 'Species', top: enrTabs('species'), search: 'Search species or scientific name',
      tabs: seg('sptabs', [{ v: 'all', t: 'All', n: all.length }, { v: 'with', t: 'With activities', n: all.filter(x => x.n).length }, { v: 'without', t: 'Without activities', n: all.filter(x => !x.n).length }], tab, 'spTab', 'seg--block'),
      rows: `<div class="lcount"><span>Species (${list.length})</span></div><div class="rows">${rows || empty('paw', 'No species', '', true)}</div>` };
  },
  detail(r) {
    const sp = speciesOf(r.id);
    if (!sp) return { html: empty('paw', 'No species selected') };
    const animals = animalsOf(sp.id).filter(x => UI.site === 'all' || x.site === UI.site), plans = activePlansFor(sp.id), st = speciesStats(sp.id);
    const encl = [...new Set(animals.map(x => x.loc))], scope = UI.f.spscope || 'all';
    const planned = new Set(plans.map(p => p.activity));
    const rec = A().activities.filter(a => a.state === 'approved' && a.species.includes(sp.id) && !planned.has(a.id)).map(a => ({ a, s: activityStats(a.id) })).sort((x, y) => (y.s.success ?? -1) - (x.s.success ?? -1));
    const canAssign = encl.some(l => can(UI.me, 'actAssign', locOf(l)));
    const needs = plans.filter(p => !checkReady(inventoryCheck(p.activity, p.loc))).length;
    const shown = plans.filter(p => scope === 'all' || p.kind === scope);
    const scopeOpt = (k, t, n, s) => `<button class="sopt ${scope === k ? 'on' : ''}" data-do="spScope" data-arg="${k}"><b>${t}</b><span>${s}</span></button>`;
    const html = `<div class="dcard">
      <div class="dhead dhead--sp"><span class="dhead__i">${ic('paw', 28)}</span><div class="dhead__b"><div class="dhead__t">${esc(sp.name)}</div><div class="dhead__sci">${esc(sp.sci)}</div><div class="tags">${tg(sp.cls, 'mint')}${needs ? `<span class="schip">${ic('clock', 14)}${needs === 1 ? '1 plan needs' : needs + ' plans need'} materials</span>` : ''}</div></div></div>
      ${hstats([[animals.length, 'Animals held'], [encl.length, encl.length === 1 ? 'Enclosure' : 'Enclosures'], [plans.length, plans.length === 1 ? 'Activity' : 'Activities'], [st.success == null ? '—' : st.success + '%', 'Successful']])}</div>
      <div class="dcard"><div class="dsec"><div class="dsec__h"><div class="dsec__k">Scope</div></div><div class="sopts">${scopeOpt('all', 'All', plans.length, plural(plans.length, 'plan'))}${scopeOpt('species', 'Species-wide', 0, plural(plans.filter(p => p.kind === 'species').length, 'plan'))}${scopeOpt('animal', 'Animal-wide', 0, plural(plans.filter(p => p.kind === 'animal').length, 'plan'))}</div></div></div>
      <div class="dcard">${dsec('Activities', dtbl([['Activity'], ['Where'], ['Plan', 'minmax(0,.8fr)']], shown.map(p => { const a = activityOf(p.activity), bad = inventoryCheck(a.id, p.loc).find(m => m.state !== 'ready');
        return { go: '#/activities/' + a.id, c: [`<b>${esc(a.name)}</b><small>${ACT_TYPE[a.type]}</small>`, `${esc(p.kind === 'animal' ? animalOf(p.target).name + ' · ' : '')}${esc(locName(p.loc))}${bad ? `<small class="t-${CHK_TONE[bad.state]}">${esc(checkShort(bad))}</small>` : ''}`, `${PLAN_FREQ[p.freq]}<small>${esc(first(p.keeper))} · ${p.time}</small>`] }; }), 'None assigned'), canAssign ? `<button class="pillbtn" data-do="actAssign" data-arg="|${sp.id}">${ic('plus', 16)}Assign</button>` : '')}</div>
      ${rec.length ? `<div class="dcard">${dsec('Recommended', `<div class="recs">${rec.map(({ a, s }) => `<div class="rec" data-go="#/activities/${a.id}"><div class="rec__b"><div class="rec__t">${esc(a.name)}</div><div class="rec__s">${ACT_TYPE[a.type]} · ${s.n ? `${s.success}% successful in ${plural(s.n, 'session')}` : 'No sessions yet'}</div></div>${canAssign ? `<button class="btn btn--plain btn--sm" data-do="actAssign" data-arg="${a.id}|${sp.id}">Assign</button>` : ''}</div>`).join('')}</div>`)}</div>` : ''}
      <div class="dcard">${dsec('Animals', dtbl([['Name'], ['ID', '90px'], ['Enclosure']], animals.map(x => ({ c: [`<b>${esc(x.name)}</b>`, x.id, esc(locName(x.loc))] }))))}</div>`;
    return { title: sp.name, html, key: scope };
  },
};
DO.spTab = t => { UI.tab.species = t; go('#/species'); };
DO.spScope = k => { UI.f.spscope = k; render(); };

/* ============ Material requests ============ */
const MREQ_TONE = { review: 'warn', issued: 'mint', requested: 'info', declined: '' };
VIEWS.matreq = {
  label: 'Material requests', hdr: 'Enrichment', group: 'sessions', icon: 'newitem', layout: 'split', allow: R('keeper', 'sup', 'afm', 'admin'),
  list(r) {
    const tab = UI.tab.matreq || 'review', q = UI.q.matreq || '';
    const base = A().requests.filter(x => seeReq(x) && match(q, x.id, x.name, locName(x.loc), activityOf(x.activity).name, nm(x.by)));
    const list = base.filter(x => tab === 'review' ? x.state === 'review' : x.state !== 'review').sort((x, y) => y.at.localeCompare(x.at));
    const rows = list.map(x => { const st = storedFor(x).length;
      return `<div class="row ${r.id === x.id ? 'on' : ''}" data-go="#/matreq/${x.id}"><div class="row__b"><div class="row__t">${esc(x.name)}${x.qty > 1 ? ` <span class="row__m">× ${x.qty}</span>` : ''}</div><div class="row__s">${x.id} · ${esc(locName(x.loc))}</div>
        <div class="tags">${x.state === 'review' ? tg(st ? 'In store' : 'Not in store', st ? 'mint' : '') : tg(MREQ_STATE[x.state], MREQ_TONE[x.state])}</div></div><span class="row__m">${fs(x.at)}</span><span class="row__chev">${ic('right', 20)}</span></div>`; }).join('');
    return { title: 'Material requests', top: enrTabs('matreq'), search: 'Search material, ID or enclosure',
      tabs: seg('mrtabs', [{ v: 'review', t: 'To review', n: base.filter(x => x.state === 'review').length }, { v: 'closed', t: 'Decided', n: base.filter(x => x.state !== 'review').length }], tab, 'mrTab', 'seg--block'),
      rows: `<div class="lcount"><span>Requests (${list.length})</span></div><div class="rows">${rows || empty('newitem', 'Nothing to review', '', true)}</div>` };
  },
  detail(r) {
    const x = mreqOf(r.id);
    if (!x) return { html: empty('newitem', 'No request selected') };
    const a = activityOf(x.activity), stored = storedFor(x), canRev = x.state === 'review' && can(UI.me, 'matReview', x), d = x.decision;
    const step = (cls, t, s) => `<div class="step ${cls}"><div class="step__dot">${ic(cls === 'bad' ? 'x' : cls === 'now' ? 'clock' : cls === 'wait' ? 'truck' : 'check')}</div><div class="step__b"><div class="step__t">${t}</div>${s ? `<div class="step__s">${s}</div>` : ''}</div></div>`;
    const end = x.state === 'issued' ? step('done', 'Issued from store', `${esc(nm(d.by))} · ${ft2(d.at)}`) : x.state === 'requested' ? step('done', 'Sent to request module', `${d.ref} · ${esc(nm(d.by))} · ${ft2(d.at)}`) + step('wait', 'Delivery and receipt', 'Receipts') : x.state === 'declined' ? step('bad', 'Declined', `${esc(nm(d.by))} · ${ft2(d.at)}`) : step('now', 'Custodian review', esc(D.people.filter(p => p.role === 'sup' && p.sections.includes(x.section)).map(p => p.name).join(', ')));
    const html = `<div class="dcard">
      <div class="dhead"><div class="dhead__b"><div class="dhead__t">${esc(x.name)}${x.qty > 1 ? ` <span class="dhead__q">× ${x.qty}</span>` : ''}</div><div class="dhead__s">${x.id} · ${esc(locName(x.loc))}</div><div class="tags">${tg(MREQ_STATE[x.state], MREQ_TONE[x.state])}</div></div></div>
      ${canRev ? `<div class="abox ${stored.length ? '' : 'abox--plain'}"><span class="abox__i">${ic(stored.length ? 'check' : 'register', 16)}</span><div class="abox__b"><div class="abox__t">${stored.length ? `${plural(stored.length, 'usable record')} in store` : 'Nothing usable in store'}</div></div></div>
        ${stored.length ? dsec('', dtbl([['Stored item'], ['Qty', '52px'], ['', '92px']], stored.map(it => ({ c: [`<b>${esc(it.name)}</b><small>${it.id} · ${esc(locName(it.loc))}</small>`, it.mode === 'batch' ? it.qty : 1, `<button class="btn btn--fill btn--sm" data-do="mrIssue" data-arg="${x.id}|${it.id}">Issue</button>`] })))) : ''}
        <div class="dacts"><button class="btn btn--plain danger" data-do="mrDecline" data-arg="${x.id}">Decline</button><button class="btn ${stored.length ? 'btn--plain' : 'btn--fill'}" data-do="mrRequest" data-arg="${x.id}">Send to request module</button></div>` : ''}
      ${dsec('Request', kv([['Activity', `<span class="link" data-go="#/activities/${a.id}">${esc(a.name)}</span>`], ['Enclosure', `${esc(locName(x.loc))}<small>${esc(secName(x.section))}</small>`], ['Requested by', personRow(x.by)], x.note && ['Note', esc(x.note)], d?.item && ['Issued item', `<span class="link" data-go="#/register/${d.item}">${d.item}</span>`], d?.note && ['Decision note', esc(d.note)]]))}
      ${dsec('Progress', `<div class="steps" style="padding:0 20px 12px">${step('done', 'Requested', `${esc(nm(x.by))} · ${ft2(x.at)}`)}${end}</div>`)}</div>`;
    return { title: x.name, html };
  },
};
DO.mrTab = t => { UI.tab.matreq = t; go('#/matreq'); };
DO.mrIssue = a => { const [id, item] = a.split('|'); act(() => reviewMaterial(id, UI.me, { decision: 'issue', item }), `Issued to ${locName(mreqOf(id).loc)}`, { icon: 'move' }); };
DO.mrRequest = id => {
  const x = mreqOf(id), stored = storedFor(x);
  sheet({ title: 'Send to request module', body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(x.name)}${x.qty > 1 ? ' × ' + x.qty : ''}</div><div class="row__s">${x.id} · ${esc(locName(x.loc))}</div></div></div>`
      + fg('', [cInfo('In store', stored.length ? plural(stored.length, 'usable record') : 'None'), cArea('Reason', 'note', f, !!stored.length, true)]),
    done: { label: 'Send', ok: f => !stored.length || f.note.trim(), run: f => { reviewMaterial(id, UI.me, { decision: 'request', note: f.note }); return 'Sent to the request module'; } } }, { note: '' });
};
DO.mrDecline = id => {
  const x = mreqOf(id);
  sheet({ title: 'Decline request', body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(x.name)}</div><div class="row__s">${x.id} · ${esc(nm(x.by))}</div></div></div>` + fg('', [cArea('Reason', 'note', f, true, true)]),
    done: { label: 'Decline', ok: f => f.note.trim(), run: f => { reviewMaterial(id, UI.me, { decision: 'decline', note: f.note }); return 'Request declined'; } } }, { note: '' });
};

/* ============ sheets ============ */
// multi-select page: toggles values in a list field; Back returns to the form
function multiPage(o) {
  return { title: o.title, body: f => `<div class="pick-list">${[...new Set(o.options.map(x => x.group || ''))].map(g => fg(g, o.options.filter(x => (x.group || '') === g).map(x => `<button class="cell choice ${f[o.key].includes(x.v) ? 'on' : ''}" data-do="mpick" data-arg="${o.key}|${esc(x.v)}">${x.tile || ''}<span class="choice__b"><span class="choice__t">${esc(x.t)}</span>${x.s ? `<span class="choice__s" style="display:block">${x.s}</span>` : ''}</span><span class="ok-mark">${ic('check', 20)}</span></button>`))).join('')}</div>` };
}
DO.mpick = a => { const i = a.indexOf('|'), k = a.slice(0, i), v = a.slice(i + 1), l = SH.f[k]; SH.f[k] = l.includes(v) ? l.filter(x => x !== v) : [...l, v]; SH.dirty = true; refreshSheet(); };
const cMultiOpts = (k, key, f, opts) => `<div class="cell cell--col"><span class="cell__k">${esc(k)}</span><div class="opts">${opts.map(o => `<button class="opt ${f[key].includes(o) ? 'on' : ''}" data-do="mpick" data-arg="${key}|${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
const cStars = (key, f) => `<div class="cell"><span class="cell__k">Rating<i>*</i></span><span class="cell__v"></span><span class="starpick">${[1, 2, 3, 4, 5].map(n => `<button class="${+f[key] >= n ? 'on' : ''}" data-do="opt" data-arg="${key}|${n}" aria-label="${n} of 5">★</button>`).join('')}</span></div>`;
const namesOf = (ids, fn) => ids.map(fn).join(', ');
const allMaterials = () => [...new Set(D.items.filter(it => isActive(it) && catOf(it).mode !== 'excluded').map(it => it.name))].sort();

DO.actNew = () => {
  closePop(true);
  const page = {
    title: 'New activity',
    body: f => fg('Activity', [cText('Name', 'name', f, true), cOpts('Type', 'type', f, Object.entries(ACT_TYPE), true), cText('Sub-type', 'sub', f), cArea('Goal', 'goal', f, true)])
      + fg('', [cNav('Species', f.species.length ? namesOf(f.species, s => speciesOf(s).name) : '', 'species', true)])
      + fg('Plan', [cOpts('Duration', 'mins', f, ['15', '30', '45', '60', '90'].map(n => [n, n + ' min'])), cNav('Materials', namesOf(f.materials, x => x), 'materials'), cArea('Restrictions and safety', 'safety', f), cText('Additives', 'additives', f)]),
    pickers: {
      species: () => multiPage({ title: 'Species', key: 'species', options: A().species.map(sp => ({ v: sp.id, t: sp.name, s: `<i>${esc(sp.sci)}</i>`, group: sp.cls })) }),
      materials: () => multiPage({ title: 'Materials', key: 'materials', options: allMaterials().map(n => ({ v: n, t: n })) }),
    },
    done: { label: 'Submit', ok: f => f.name.trim() && f.type && f.goal.trim() && f.species.length, run: f => { const id = saveActivity(UI.me, f); return { msg: 'Sent for approval', go: '#/activities/' + id }; } },
  };
  sheet(page, { name: '', type: '', sub: '', goal: '', species: [], mins: '30', materials: [], safety: '', additives: '' });
};
DO.actReviewAct = id => {
  closePop(true);
  const a = activityOf(id);
  sheet({
    title: 'Review activity',
    body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(a.name)}</div><div class="row__s">${a.id} · ${ACT_TYPE[a.type]} · ${esc(nm(a.by))}</div></div></div>`
      + fg('Activity', [cInfo('Goal', esc(a.goal)), cInfo('Species', esc(namesOf(a.species, s => speciesOf(s).name))), a.materials.length && cInfo('Materials', esc(a.materials.join(', '))), a.safety && cInfo('Safety', esc(a.safety)), a.additives && cInfo('Additives', esc(a.additives))])
      + fg('Decision', [cSeg('ok', f, [['yes', 'Approve'], ['no', 'Request changes']]), cArea('Note', 'note', f, f.ok === 'no')]),
    done: { label: 'Save', ok: f => f.ok && (f.ok === 'yes' || f.note.trim()), run: f => { reviewActivity(id, UI.me, f.ok === 'yes', f.note); return f.ok === 'yes' ? 'Activity approved' : 'Sent back for changes'; } },
  }, { ok: '', note: '' });
};
DO.actResubmit = id => {
  const a = activityOf(id);
  sheet({
    title: 'Edit activity',
    body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(a.name)}</div><div class="row__s">${esc(nm(a.review.by))} · ${esc(a.review.note)}</div></div></div>`
      + fg('Activity', [cArea('Goal', 'goal', f, true), cOpts('Duration', 'mins', f, ['15', '30', '45', '60', '90'].map(n => [n, n + ' min'])), cArea('Restrictions and safety', 'safety', f, false, true), cText('Additives', 'additives', f)]),
    done: { label: 'Resubmit', ok: f => f.goal.trim(), run: f => { resubmitActivity(id, UI.me, Object.assign({}, f, { mins: +f.mins })); return 'Sent for approval'; } },
  }, { goal: a.goal, mins: String(a.mins), safety: a.safety, additives: a.additives });
};

// actAssign('ACT-x|SP-y') — either part may be empty
DO.actAssign = arg => {
  closePop(true);
  const [aid = '', spid = ''] = String(arg || '').split('|');
  const canLoc = l => can(UI.me, 'actAssign', l);
  const scopeAnimals = f => A().animals.filter(x => activityOf(f.activity)?.species.includes(x.species) && canLoc(locOf(x.loc)) && (UI.site === 'all' || x.site === UI.site));
  const homes = f => f.target ? homesOf(f.kind, f.target).filter(l => canLoc(locOf(l))) : [];
  const fix = f => { const h = homes(f); if (!h.includes(f.loc)) f.loc = h.length === 1 ? h[0] : ''; const k = f.loc ? D.people.filter(p => p.role === 'keeper' && p.sections.includes(locOf(f.loc).section)) : []; if (!k.some(p => p.id === f.keeper)) f.keeper = k.length === 1 ? k[0].id : ''; };
  sheet({
    title: 'Assign activity',
    body: f => {
      const check = f.activity && f.loc ? inventoryCheck(f.activity, f.loc) : [];
      return fg('', [cNav('Activity', activityOf(f.activity)?.name || '', 'activity', true)])
        + fg('Who', [cSeg('kind', f, [['species', 'Species-wide'], ['animal', 'One animal']]), cNav(f.kind === 'animal' ? 'Animal' : 'Species', f.target ? (f.kind === 'animal' ? animalOf(f.target)?.name : speciesOf(f.target)?.name) || '' : '', 'target', true)])
        + fg('Where and when', [cNav('Enclosure', locName(f.loc), 'loc', true), cOpts('How often', 'freq', f, Object.entries(PLAN_FREQ), true), cDate('Start', 'start', f, true), cOpts('Time', 'time', f, Object.entries(SLOT)), cNav('Keeper', f.keeper ? nm(f.keeper) : '', 'keeper', true)])
        + (check.length ? fg('Inventory', check.map(m => cInfo(m.name, pill(checkText(m).replace(m.name + ' ', ''), CHK_TONE[m.state])))) : '');
    },
    pickers: {
      activity: () => pickerPage({ title: 'Activity', key: 'activity', search: true, after: f => { f.target = ''; fix(f); }, options: A().activities.filter(a => a.state === 'approved' && (!spid || a.species.includes(spid))).map(a => ({ v: a.id, t: a.name, s: `${ACT_TYPE[a.type]} · ${a.species.map(s => speciesOf(s).name).join(', ')}`, group: ACT_TYPE[a.type] })) }),
      target: f => f.kind === 'animal'
        ? pickerPage({ title: 'Animal', key: 'target', search: true, after: fix, options: scopeAnimals(f).map(x => ({ v: x.id, t: x.name, s: `${speciesOf(x.species).name} · ${locName(x.loc)}`, group: speciesOf(x.species).name })) })
        : pickerPage({ title: 'Species', key: 'target', after: fix, options: [...new Set(scopeAnimals(f).map(x => x.species))].map(s => ({ v: s, t: speciesOf(s).name, s: speciesOf(s).sci })) }),
      loc: f => pickerPage({ title: 'Enclosure', key: 'loc', after: fix, options: homes(f).map(l => ({ v: l, t: locName(l), s: secName(locOf(l).section) })) }),
      keeper: f => pickerPage({ title: 'Keeper', key: 'keeper', options: f.loc ? peopleOpts(p => p.role === 'keeper' && p.sections.includes(locOf(f.loc).section)) : [] }),
    },
    done: { label: 'Assign', ok: f => f.activity && f.target && f.loc && f.freq && f.start && f.keeper, run: f => { const id = assignActivity(UI.me, f); const sp = planSpecies(planOf(id)); return { msg: 'Activity assigned', go: '#/species/' + sp }; } },
  }, (() => { const f = { activity: aid, kind: 'species', target: spid, loc: '', freq: 'daily', start: day(nowIs()), time: '09:00', keeper: '' }; if (f.target) fix(f); return f; })());
};
const _opt = DO.opt;
DO.opt = a => { _opt(a); if (SH && 'activity' in SH.f && 'keeper' in SH.f && a.startsWith('kind|')) { SH.f.target = ''; SH.f.loc = ''; SH.f.keeper = ''; refreshSheet(); } };

DO.actRecord = key => {
  closePop(true);
  const [pid, date] = key.split('@'), p = planOf(pid), a = activityOf(p.activity);
  const here = D.items.filter(it => it.loc === p.loc && usableForAnimals(it));
  const ready = inventoryCheck(a.id, p.loc).filter(m => m.state === 'ready').map(m => m.items[0].id);
  sheet({
    title: 'Record session',
    body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(a.name)}</div><div class="row__s">${esc(planName(p))} · ${esc(locName(p.loc))} · ${fs(date)}</div></div></div>`
      + fg('Session', [cOpts('Duration', 'mins', f, [...new Set([10, 15, 20, 30, 45, 60, 90, a.mins])].sort((x, y) => x - y).map(n => [String(n), n + ' min'])), cNav('Materials used', f.mats.length ? namesOf(f.mats, id => itemOf(id).name) : 'None', 'mats')])
      + fg('Observation', [cOpts('Engagement', 'engage', f, Object.entries(ENGAGE), true), cMultiOpts('Behaviours', 'beh', f, BEHAVIOURS)])
      + fg('Was it successful?', [cSeg('success', f, [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']]), cStars('rating', f), cArea('Comments', 'comment', f)])
      + fg('Evidence', [cPhotos('photos', f)])
      + fg('Safety', [cToggle('Safety incident', 'safe', f), f.safe && cNav('Item', f.sitem ? `${itemOf(f.sitem).name} · ${f.sitem}` : '', 'sitem', true), f.safe && cOpts('Issue', 'sissue', f, ISSUES, true), f.safe && cArea('What happened', 'snotes', f)]),
    pickers: {
      mats: () => multiPage({ title: 'Materials used', key: 'mats', options: here.map(it => ({ v: it.id, t: it.name, s: `${it.id}${it.mode === 'batch' ? ' · ' + it.qty + ' units' : ''}` })) }),
      sitem: f => pickerPage({ title: 'Item', key: 'sitem', options: f.mats.map(id => itemOf(id)).map(it => ({ v: it.id, t: it.name, s: it.id })) }),
    },
    done: {
      label: 'Save', ok: f => f.engage && f.success && f.rating && (!f.safe || (f.sitem && f.sissue)),
      run: f => { recordSession(UI.me, { plan: p.id, date, mins: +f.mins, materials: f.mats, engage: f.engage, behaviours: f.beh, success: f.success, rating: +f.rating, comment: f.comment, photos: f.photos, safety: f.safe ? { item: f.sitem, issue: f.sissue, notes: f.snotes, photos: f.photos } : null });
        return f.safe ? `Session saved · ${itemOf(f.sitem).name} flagged unsafe` : 'Session saved'; },
    },
  }, { mins: String(a.mins), mats: ready, engage: '', beh: [], success: '', rating: '', comment: '', photos: [], safe: false, sitem: '', sissue: '', snotes: '' });
};
DO.actSkip = key => {
  closePop(true);
  const [pid, date] = key.split('@'), p = planOf(pid), a = activityOf(p.activity), check = inventoryCheck(a.id, p.loc);
  sheet({
    title: 'Skip session',
    body: f => `<div class="sheet__sum"><div class="row__b"><div class="row__t">${esc(a.name)}</div><div class="row__s">${esc(planName(p))} · ${fs(date)}</div></div></div>` + fg('Reason', [cOpts('', 'reason', f, SKIP_REASONS, true), cArea('Note', 'comment', f)]),
    done: { label: 'Skip', ok: f => f.reason, run: f => { skipSession(UI.me, { plan: p.id, date, reason: f.reason, comment: f.comment }); return 'Session skipped'; } },
  }, { reason: checkReady(check) ? '' : 'Materials not available', comment: '' });
};
// actMat('ACT-x|L-y|name') — any part may be empty
DO.actMat = arg => {
  closePop(true);
  const [aid = '', loc = '', name = ''] = String(arg || '').split('|');
  const mine = l => l.kind === 'enclosure' && can(UI.me, 'matRequest', l);
  const encl = f => { const a = activityOf(f.activity); return a ? [...new Set(A().animals.filter(x => a.species.includes(x.species)).map(x => x.loc))].map(locOf).filter(mine) : []; };
  sheet({
    title: 'Request material',
    body: f => {
      const a = activityOf(f.activity), st = f.loc && f.name ? storedFor({ name: f.name, section: locOf(f.loc).section }) : [];
      return fg('For', [cNav('Activity', a?.name || '', 'activity', true), cNav('Enclosure', locName(f.loc), 'loc', true)])
        + fg('Material', [a && a.materials.length ? cOpts('', 'name', f, a.materials, true) : cText('Material', 'name', f, true), cStep('Quantity', 'qty', f, 1, 20), f.name && f.loc && cInfo('In store', st.length ? `${plural(st.length, 'usable record')} · ${esc(locName(st[0].loc))}` : 'None'), cArea('Note', 'note', f)]);
    },
    pickers: {
      activity: () => pickerPage({ title: 'Activity', key: 'activity', search: true, after: f => { const a = activityOf(f.activity); if (!a.materials.includes(f.name)) f.name = a.materials[0] || ''; if (!encl(f).some(l => l.id === f.loc)) f.loc = ''; }, options: A().activities.filter(a => a.state === 'approved').map(a => ({ v: a.id, t: a.name, s: ACT_TYPE[a.type], group: ACT_TYPE[a.type] })) }),
      loc: f => pickerPage({ title: 'Enclosure', key: 'loc', options: encl(f).map(l => ({ v: l.id, t: l.name, s: secName(l.section) })) }),
    },
    done: { label: 'Send', ok: f => f.activity && f.loc && f.name.trim(), run: f => { const id = requestMaterial(UI.me, f); return { msg: 'Request sent to the custodian', go: '#/matreq/' + id }; } },
  }, { activity: aid, loc, name: name || (activityOf(aid)?.materials[0] || ''), qty: 1, note: '' });
};
