// src/model/work.js — PROPOSED PROTOTYPE BEHAVIOUR (needs validation against the real ANTZ Task / Assessment / Audit modules).
// Keeps five concepts apart: template (what to check) → schedule (when it is due) → occurrence (one period of a schedule)
// → audit session (the results, model.js audits) + execution task (assignment and due date) → corrective-action task (one per finding).
// The original audit line result is never changed when its corrective task is completed. No DOM; the app loads it after model.js.

const FREQ = { monthly: { t: 'Monthly', m: 1 }, quarterly: { t: 'Quarterly', m: 3 }, halfyearly: { t: 'Half-yearly', m: 6 } };
const TPL_KIND = { audit: 'Audit', assessment: 'Assessment', checklist: 'Checklist' };
const W = () => D.work || (D.work = { templates: [], schedules: [], tasks: [] });

function periodOf(freq, ymd) {
  const y = ymd.slice(0, 4), m = +ymd.slice(5, 7);
  if (freq === 'quarterly') return `Q${Math.ceil(m / 3)} ${y}`;
  if (freq === 'halfyearly') return `H${m <= 6 ? 1 : 2} ${y}`;
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}
function addMonths(ymd, n) { const d = new Date(ymd.slice(0, 10) + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }

function addTask(o) {
  const t = Object.assign({ id: nextId('TSK'), state: 'open', created: NOW, done: null }, o);
  W().tasks.push(t); return t;
}
const taskOf = id => W().tasks.find(t => t.id === id);
const scheduleOf = id => W().schedules.find(s => s.id === id);
const templateOf = id => W().templates.find(t => t.id === id);
function taskDone(t, byId) { if (t && t.state === 'open') { t.state = 'done'; t.done = { at: NOW, by: byId }; } }

// the next occurrence of a schedule: the first period on or after its start that has no occurrence yet
function nextOccurrence(sch) {
  let start = sch.start;
  for (let i = 0; i < 40; i++) {
    const period = periodOf(sch.freq, start);
    if (!sch.occurrences.some(o => o.period === period)) return { period, start, due: addDaysYmd(addMonths(start, FREQ[sch.freq].m), -1) };
    start = addMonths(start, FREQ[sch.freq].m);
  }
  return null;
}
const addDaysYmd = (ymd, n) => addDays(ymd, n).slice(0, 10);

// saveSchedule(by, {id?, template, site, freq, start, assignee}) — edits change only future occurrences; history keeps its own values
function saveSchedule(byId, o) {
  must(byId, 'auditCreate');
  need(o.template, 'Pick the template.'); need(o.site, 'Pick the site.'); need(o.assignee, 'Pick who does the audit.');
  if (!FREQ[o.freq]) fail('Pick the frequency.'); need(o.start, 'Pick the start date.');
  const cur = o.id && scheduleOf(o.id);
  if (cur) { Object.assign(cur, { template: o.template, freq: o.freq, assignee: o.assignee, start: cur.occurrences.length ? cur.start : o.start, edited: { at: NOW, by: byId } }); return cur.id; }
  if (W().schedules.some(s => s.site === o.site && s.template === o.template && s.active)) fail('This site already has this schedule.');
  const s = { id: nextId('SCH'), template: o.template, site: o.site, freq: o.freq, start: o.start, assignee: o.assignee, active: true, occurrences: [], created: NOW, by: byId };
  W().schedules.push(s); return s.id;
}

// generateOccurrence(schId, by) — one audit session and one linked execution task per occurrence, never two
function generateOccurrence(schId, byId) {
  const s = scheduleOf(schId) || fail('Schedule not found.');
  must(byId, 'auditCreate');
  const n = nextOccurrence(s) || fail('No occurrence left to generate.');
  if (s.occurrences.some(o => o.period === n.period)) fail('This occurrence already exists.');
  const aId = createAudit(byId, { site: s.site, period: n.period, due: n.due, auditor: s.assignee });
  const t = addTask({ kind: 'audit', title: `${n.period} audit`, audit: aId, item: '', assignee: s.assignee, due: n.due, schedule: s.id, origin: 'schedule' });
  s.occurrences.push({ period: n.period, due: n.due, audit: aId, task: t.id, at: NOW });
  auditOf(aId).task = t.id; auditOf(aId).schedule = s.id;
  return aId;
}

// a finding becomes a corrective-action task when it is assigned; resolving the finding completes the task
function raiseCorrective(aId, itemId, byId, o) {
  assignException(aId, itemId, byId, o);
  const l = auditOf(aId).lines.find(x => x.item === itemId);
  const t = addTask({ kind: 'corrective', title: `${AUDIT_OUT[l.outcome]} · ${itemOf(itemId).name}`, audit: aId, item: itemId, assignee: o.to, due: o.due, origin: 'finding' });
  l.exc.task = t.id;
  return t.id;
}
function resolveCorrective(aId, itemId, byId, o) {
  resolveException(aId, itemId, byId, o);
  const l = auditOf(aId).lines.find(x => x.item === itemId);
  taskDone(taskOf(l.exc.task), byId);
}
function closeAuditWork(aId, byId) {
  closeAudit(aId, byId);
  const a = auditOf(aId); taskDone(taskOf(a.task), byId);
}

// receiveExcluded — a delivery of an excluded (not tracked) category is confirmed without creating an item record
function receiveExcluded(ticketId, byId, o = {}) {
  const t = by('tickets', ticketId) || fail('Ticket not found.');
  if (t.status !== 'dispatched') fail('This ticket is already received.');
  must(byId, 'receive', { section: t.section, site: sectionOf(t.section).site });
  if (by('categories', t.cat).mode !== 'excluded') fail('This category is tracked.');
  Object.assign(t, { status: 'received', receivedAt: NOW, receivedBy: byId, items: [], discrepancy: o.discrepancy || '', excluded: true });
}

// open tasks for a person: their own; the AFM also sees the tasks of their sites; the admin sees all
function workTasks(byId, all = false) {
  const p = person(byId);
  return W().tasks.filter(t => (all || t.state === 'open') && (p.role === 'admin' || t.assignee === byId || (p.role === 'afm' && t.audit && p.sites.includes(auditOf(t.audit).site))));
}

// demo: link the seeded audits to templates, schedules and tasks
function workSeed() {
  const w = W(), q3 = D.audits.find(a => a.period === 'Q3 2026'), q4 = D.audits.find(a => a.period === 'Q4 2026'), h2 = D.audits.find(a => a.period === 'H2 2026');
  w.templates.push(
    { id: 'TPL-01', kind: 'audit', name: 'Furnishing register audit', checks: ['Item present', 'Location matches', 'Custodian matches', 'Condition matches'] },
    { id: 'TPL-02', kind: 'checklist', name: 'Monthly enclosure furnishing check', checks: ['Fixings secure', 'No sharp edges', 'Clean and dry'] },
    { id: 'TPL-03', kind: 'assessment', name: 'Animal-use suitability', checks: ['Suitable for the species', 'No injury risk', 'No ingestion risk'] },
    { id: 'TPL-04', kind: 'assessment', name: 'Repairability assessment', checks: ['Structure sound', 'Repair possible', 'Cost below replacement'] },
  );
  const at = t => setNow(t);
  at('2026-07-01T09:00');
  const sm = { id: nextId('SCH'), template: 'TPL-01', site: 'S-MAIN', freq: 'quarterly', start: '2026-07-01', assignee: 'P-MEERA', active: true, occurrences: [], created: NOW, by: 'P-NEHA' };
  const sr = { id: nextId('SCH'), template: 'TPL-01', site: 'S-RESC', freq: 'halfyearly', start: '2026-07-01', assignee: 'P-ARUN', active: true, occurrences: [], created: NOW, by: 'P-NEHA' };
  w.schedules.push(sm, sr);
  const link = (s, a) => {
    at(a.created);
    const t = addTask({ kind: 'audit', title: `${a.period} audit`, audit: a.id, item: '', assignee: a.auditor, due: a.due, schedule: s.id, origin: 'schedule' });
    s.occurrences.push({ period: a.period, due: a.due, audit: a.id, task: t.id, at: a.created });
    a.task = t.id; a.schedule = s.id;
    if (a.state === 'closed') { t.state = 'done'; t.done = { at: a.closed.at, by: a.closed.by }; }
    a.lines.filter(l => l.exc).forEach(l => {
      at(l.exc.at);
      const c = addTask({ kind: 'corrective', title: `${AUDIT_OUT[l.outcome]} · ${itemOf(l.item).name}`, audit: a.id, item: l.item, assignee: l.exc.to, due: l.exc.due, origin: 'finding' });
      l.exc.task = c.id;
      if (l.exc.resolved) { c.state = 'done'; c.done = { at: l.exc.resolved.at, by: l.exc.resolved.by }; }
    });
  };
  if (q3) link(sm, q3); if (q4) link(sm, q4); if (h2) link(sr, h2);
  setNow(NOW_DEFAULT);
}
