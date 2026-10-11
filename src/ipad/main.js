// src/ipad/main.js — start-up: load the saved demo (or play the seed), apply ?as=<person>&o=<portrait|landscape>&bare=1&reset=1, fit the tablet frame, draw.
(function start() {
  const q = new URLSearchParams(location.search);
  if (q.get('reset') === '1' || !load()) { fresh(); }
  if (q.get('as') && person(q.get('as'))) { UI.me = q.get('as'); UI.site = me().sites[0]; }
  if (q.get('o')) UI.o = q.get('o') === 'portrait' ? 'portrait' : 'landscape';
  const touchTablet = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) >= 700;
  if (q.get('bare') === '1' || touchTablet) document.body.classList.add('bare');
  save();
  if (q.toString()) history.replaceState(null, '', location.pathname + (location.hash || '#/today'));

  function orient() {
    const bare = document.body.classList.contains('bare');
    if (bare) UI.o = innerWidth >= innerHeight ? 'landscape' : 'portrait';
    $('#ipad').dataset.o = UI.o;
    $('#app').classList.toggle('sb-off', UI.o === 'landscape' && !UI.sb);
    $('#orient').dataset.i = UI.o === 'landscape' ? 0 : 1; $('#orient').style.setProperty('--n', 2);
    $('#orient').innerHTML = `<span class="seg__thumb"></span><button class="${UI.o === 'landscape' ? 'on' : ''}" data-do="orient" data-arg="landscape">Landscape</button><button class="${UI.o === 'portrait' ? 'on' : ''}" data-do="orient" data-arg="portrait">Portrait</button>`;
    placeSegs($('.desk-bar'));
    fit();
  }
  function fit() {
    if (document.body.classList.contains('bare')) return;
    const w = UI.o === 'landscape' ? 1222 : 862, h = UI.o === 'landscape' ? 862 : 1222;
    const st = $('#stage'), k = Math.min(1, (st.clientWidth - 32) / w, (st.clientHeight - 24) / h);
    $('#fit').style.transform = `scale(${k})`; $('#fit').style.height = h * k + 'px';
  }
  DO.orient = o => { UI.o = o; UI.peek = false; $('#app').classList.remove('sb-peek'); save(); orient(); setTimeout(() => { $('#main').dataset.layout = ''; render(); }, 30); };
  addEventListener('resize', () => { const was = UI.o; orient(); if (was !== UI.o) { $('#main').dataset.layout = ''; render(); } });
  setInterval(() => { $('#clock').textContent = nowIs().slice(11, 16); }, 1000);
  $('#sdate').textContent = `${dow(nowIs()).slice(0, 3)} ${fs(nowIs())}`;
  orient();
  render();
})();
