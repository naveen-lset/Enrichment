const IC_BASE = (document.currentScript && document.currentScript.src) ? new URL('icons/', document.currentScript.src).href : 'assets/icons/';
// Starter pack copy of Projects/GRC-v2/grc-v2/icons.js (icon path made relative to this file) — GRC tablet: the reference's icon names, drawn with Antz icons only (app/icons/, LIB-ICON-001).
// Each name maps to [slug, transform]. A slug starting "new/" is a pending master glyph in app/icons/new/, used as a file mask.
// ic(name, size) keeps the reference's signature; the glyph takes the colour of its parent (currentColor).
const IC = {
  home: ['dashboard'], inbox: ['list'], shield: ['file-doc'], book: ['notes'], clip: ['reason-or-list'],
  checkc: ['approved'], comp: ['checkbox-with-outline'], check: ['just-tick-mark'], plus: ['add'], search: ['search'],
  chev: ['dropdown', 'rotate(-90deg)'], back: ['dropdown', 'rotate(90deg)'], upc: ['dropdown', 'rotate(180deg)'], dnc: ['dropdown'],
  lib: ['new/category'], cam: ['image'], file: ['file-doc'], x: ['close'], alert: ['alert'], clock: ['time'], flag: ['alert'], /* finding: the thin triangle, same line weight as the nav (Sourav 2026-09-28; was a bookmark) */
  up: ['back', 'rotate(135deg)'], down: ['back', 'rotate(-135deg)'], user: ['user'], cal: ['calendar'], table: ['new/table-view'],
  layers: ['list'], eye: ['view'], grid: ['dashboard'], site: ['location-icon'], chart: ['percentage'], cog: ['view-settings'],
  upload: ['download', 'rotate(180deg)'], download: ['download'], copy: ['compare'], trash: ['delete'], edit: ['pencil'],
  undo: ['reset', 'scaleX(-1)'], redo: ['reset'],
  tool: ['transfer'], users: ['user'], info: ['info'], list: ['list'], filter: ['filter'], scan: ['scan'], more: ['menu-vertical'], addc: ['add-with-circle'],
  navgov: ['compare'], navcomp: ['new/seal-proof'], attachthin: ['new/task-attachment'], cycle: ['cycle'], notif: ['notification'], send: ['send'], startby: ['new/person-edit'], xcirc: ['close-with-circle'], abRepeat: ['new/repeat-thin'], abPerson: ['new/person-thin'], abBell: ['new/bell-thin'], abBook: ['new/book-thin'], /* bottom nav: one line weight across all five (thin outline) */ /* the reference named these but never drew them (quirk 1) */
};
const ic = (n, s = 20) => {
  const [slug, tf] = IC[n] || ['question'];
  const isNew = slug.startsWith('new/');
  const style = `width:${s}px;height:${s}px${isNew ? `;--icon:url(${IC_BASE}${slug}.svg)` : ''}${tf ? `;transform:${tf}` : ''}`;
  return `<span class="app-icon app-icon--tint${isNew ? '' : ' i-' + slug}" style="${style}" aria-hidden="true"></span>`;
};
