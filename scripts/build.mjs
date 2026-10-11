// scripts/build.mjs — copies only the files the site needs into dist/ (for Cloudflare Pages). No bundling: the app is plain HTML, CSS and JS.
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname, out = root + 'dist/';
fs.rmSync(out, { recursive: true, force: true });
for (const p of ['index.html', 'v1.html', 'flow.html', 'src', 'kit']) fs.cpSync(root + p, out + p, { recursive: true, filter: f => !f.endsWith('.DS_Store') });
// short cache for the app files so a new deploy shows straight away
fs.writeFileSync(out + '_headers', '/*\n  Cache-Control: public, max-age=300\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
const count = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(d + e.name + '/') : 1), 0);
console.log(`dist/ ready · ${count(out)} files`);
