(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = [];
  const scr = document.getElementById('screen').getBoundingClientRect();
  const check = (where) => {
    // every scroll container: can it scroll if it overflows?
    document.querySelectorAll('#screen *').forEach(el => {
      const cs = getComputedStyle(el);
      if (!el.offsetParent && cs.position !== 'fixed') return;
      const oy = cs.overflowY, over = el.scrollHeight - el.clientHeight;
      if (over > 4 && (oy === 'auto' || oy === 'scroll')) { const b = el.scrollTop; el.scrollTop = b + 50; if (el.scrollTop === b) out.push(`${where}: STUCK scroll ${el.className || el.id}`); el.scrollTop = b; }
      // content past the screen with no scrolling ancestor
      const r = el.getBoundingClientRect();
      const inScroll = el.parentElement && el.parentElement.closest('.scroll, .sheet__page, .spot__r, .pop, .sb__nav');
      if (!inScroll && r.height && r.bottom > scr.bottom + 2 && (el.matches('.sheet, .sheet__page, .pop, .spot, .slide, .col, .pane, .panes, .lane, .board') )) out.push(`${where}: CLIPPED ${el.className} bottom ${Math.round(r.bottom - scr.bottom)}px past screen`);
    });
  };
  const views = ['today', 'overview', 'register/EF-0001', 'receipts/TK-2051', 'repairs', 'repairs/EF-0016', 'transfers', 'disposals/DR-0004', 'audits/AU-0002', 'audits/SCH-0001', 'reports/register', 'labels'];
  for (const v of views) { location.hash = '#/' + v; await sleep(500); check(v); }
  const sheets = [["register/EF-0001", "DO.actDispose('EF-0001')"], ["receipts/TK-2051", "DO.actReceive('TK-2051'); SH.f.qty=2; refreshSheet()"], ["register/EF-0001", "DO.actTransfer('EF-0001')"], ["register/EF-0006", "DO.actFlag('EF-0006')"], ["audits/AU-0002", "DO.actSchedule()"]];
  for (const [v, js] of sheets) { location.hash = '#/' + v; await sleep(400); eval(js); await sleep(500); check('sheet ' + js.slice(3, 25)); closeSheet(); await sleep(300); }
  location.hash = '#/register'; await sleep(400); DO.regFilter(null, document.querySelector('[data-do=regFilter]')); await sleep(400); check('filter popover'); closePop(true);
  return out.join('\n') || 'all scroll areas OK';
})()
