// tests/ui/run.mjs — UI checks in headless Chrome (macOS path below), at four iPad sizes:
// scroll-check: every scroll area scrolls and nothing is cut off past the screen;
// layout-check: no element spills out of its card / column / sheet, no unbalanced markup, no ids broken over two lines.
// Needs the app served on :8834 (npm start). Run: npm run test:ui
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZES = [[1194, 834, 'P-MEERA'], [834, 1194, 'P-MEERA'], [744, 1133, 'P-RAVI'], [1180, 820, 'P-NEHA']];
const checks = ['scroll-check.js', 'layout-check.js'].map(f => [f, fs.readFileSync(here + f, 'utf8')]);
const port = 9400 + Math.floor(Math.random() * 400), prof = fs.mkdtempSync('/tmp/antz-ui-');
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws; for (let i = 0; i < 150 && !ws; i++) { try { const p = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { } await sleep(200); }
if (!ws) { console.log('FAIL  Chrome did not start (path: ' + CHROME + ')'); ch.kill(); process.exit(1); }
if (ws.readyState !== 1) await new Promise(r => ws.onopen = r);   // the socket may already be open after the polling pause
let id = 0; const pend = new Map(), errors = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
let failed = false;
for (const [w, h, who] of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:8834/index.html?reset=1&bare=1&as=${who}#/today` }); await sleep(1600);
  for (const [name, js] of checks) {
    const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    const v = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description;
    const ok = /OK$/.test(v); failed ||= !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${w}×${h}  ${name}${ok ? '' : '\n' + v}`);
  }
}
if (errors.length) { failed = true; console.log('JS errors:\n' + errors.join('\n')); }
ch.kill(); process.exit(failed ? 1 : 0);
