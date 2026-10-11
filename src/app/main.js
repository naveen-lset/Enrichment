// src/app/main.js — start: load the saved demo state (or play the seed), apply ?as=<person>&site=<site> from flow.html, then draw.
(function start() {
  if (!load()) { boot(); save(); }
  const q = new URLSearchParams(location.search);
  if (q.get('reset') === '1') { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } boot(); save(); }
  if (q.get('as') && person(q.get('as'))) { A.me = q.get('as'); const p = me(); A.site = p.sites.length === 1 ? p.sites[0] : (q.get('site') || A.site); save(); }
  if (q.toString()) history.replaceState(null, '', location.pathname + (location.hash || '#/overview'));
  render();
})();
