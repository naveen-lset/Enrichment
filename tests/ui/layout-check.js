(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = [];
  const HSCROLL = '.chips, .board, .photos, .tbl-wrap, .sb__nav';
  const check = where => {
    // 1 · unbalanced markup in painted regions
    ['#lrows', '#lhead', '#dbody', '#fbody', '#sbody'].forEach(id => { const el = document.querySelector(id); if (!el || !el._html) return;
      const o = (el._html.match(/<div\b/g) || []).length, c = (el._html.match(/<\/div>/g) || []).length; if (o !== c) out.push(`${where}: ${id} div open ${o} / close ${c}`); });
    // 2 · anything spilling past its container (column, sheet, card, popover) on the right
    document.querySelectorAll('#screen *').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
      if (el.closest(HSCROLL)) return;
      const box = el.parentElement && el.parentElement.closest('.card, .w, .fg__c, .sheet, .pop, .col, .kcard, .lane, .label, .next, .line');
      if (!box) return; const b = box.getBoundingClientRect();
      if (r.right > b.right + 1.5 || r.left < b.left - 1.5) out.push(`${where}: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.textContent || '').trim().slice(0, 24)}" spills ${Math.round(Math.max(r.right - b.right, b.left - r.left))}px out of .${box.className.split(' ')[0]}`);
    });
    // 3 · text broken mid-word (an id split over two lines)
    document.querySelectorAll('.label__id, .row__s, .kstat__n, .due, .pill').forEach(el => { if (el.getClientRects().length > 1 && el.tagName !== 'DIV') out.push(`${where}: wrapped ${el.className} "${el.textContent.slice(0, 20)}"`); });
  };
  const views = ['today', 'overview', 'register/EF-0035', 'register/EF-0016', 'receipts/TK-2051', 'repairs', 'repairs/EF-0016', 'transfers/TR-0005', 'disposals/DR-0007', 'audits/AU-0002', 'audits/SCH-0001', 'audits/TPL-01', ...['register', 'status', 'storage', 'repairs', 'transfers', 'missing', 'disposals', 'reuse', 'audit'].map(k => 'reports/' + k), 'labels'];
  for (const v of views) { location.hash = '#/' + v; await sleep(450); check(v); }
  UI.tab.item = 'history'; location.hash = '#/register/EF-0016'; render(); await sleep(400); check('item history');
  UI.tab.item = 'work'; render(); await sleep(400); check('item linked work'); UI.tab.item = 'overview';
  location.hash = '#/labels'; await sleep(300); DO.labAll('all'); await sleep(400); check('labels selected'); DO.labAll('clear');
  const sheets = ["DO.actDispose('EF-0001')", "DO.actReceive('TK-2051')", "DO.actTransfer('EF-0001')", "DO.actFlag('EF-0006')", "DO.actSchedule()", "DO.regFilter()", "DO.guide()"];
  for (const js of sheets) { location.hash = '#/register/EF-0001'; await sleep(300); eval(js); await sleep(500); check('sheet ' + js); closeSheet(); await sleep(260); }
  return [...new Set(out)].join('\n') || 'layout OK';
})()
