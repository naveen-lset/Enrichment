# Handoff — Enrichment & Furnishing tablet prototype

Last session: 11 Oct 2026. Repository: https://github.com/naveen-lset/Enrichment (public) · Live: https://antz-enrichment.pages.dev

## Run
```sh
cd /Users/naveen/Enrichment/enrichment-tablet
npm start            # python3 -m http.server 8834 → http://localhost:8834/
npm test             # 26 rule tests (Node 20+)
npm run test:ui      # UI checks at 4 iPad sizes (server running, Google Chrome installed)
npm run deploy       # build dist/ and publish to Cloudflare Pages (wrangler login saved on the owner's Mac)
```
- Hard-refresh after CSS changes. `?reset=1` restores the sample data; **Reset** in the top bar does the same.
- `?bare=1` fills the screen (automatic on a touch tablet); `?as=P-MEERA` signs in as a person; `?o=portrait`.

## What exists
- **App** (`index.html`, `src/ipad/`): iPad-style UI with sidebar, split view (first record opens automatically), repairs board (stacked in portrait), form sheets with picker pages and review pages, popovers, toast + undo, ⌘K search, swipe and long-press, blur behind overlays.
  - `core.js` holds state, router, painting, sheets, popovers and input. `views.js` holds the screens, `actions.js` the workflow sheets, `ipad.css` the tokens, layout and components.
- **Rules** (`src/model/model.js`): PRD rules, unchanged and tested. `seed.js` calls `seed-demo.js` (70 records; app only).
- **Proposed work layer** (`src/model/work.js`): templates → schedules → occurrences → audit session + execution task → corrective-action tasks.
- **Docs** (`docs/WORKFLOWS.md`): workflow map, screens, layout spec, status and role matrices, traceability, decisions, integrations, QA checklist. README has screenshots (`docs/screenshots/`).
- **UI checks** (`tests/ui/`): scrolling, overflow, unbalanced markup and wrapped IDs at 1194×834, 834×1194, 744×1133 and 1180×820.
- **Deploy**: `scripts/build.mjs` copies only the site files to `dist/`. Cloudflare Pages project `antz-enrichment`, created with `--force` so it stays on Pages, not Workers. Don't add a `wrangler.jsonc`.
- **Old build**: the earlier phone-style build is kept as `v1.html` + `src/app/` + `flow.html`.

## User's rules
No helper text in the UI · iPad concept, not a copy · Antz colour tokens only (no hex outside `kit/tokens.css`) · Inter, radius 12, no gradients · few icons (sidebar, toolbar, none in rows or menus) · overlays blur the background · prototype-only behaviour labelled in docs, not in the UI.

## Open questions for the owner
- FR-04 is not traced; check the PRD text (no PDF tool on this machine).
- The 14 business decisions in docs/WORKFLOWS.md §8.
- The Task / Assessment / Audit links (`work.js`) need checking against the real ANTZ modules.
- The repo and the site are public. Make them private if the kit or module details are internal.
- Keep or remove the v1 build? Add the PRD PDF to `docs/`?

## Not done
- The deploy-scripts commit and this handoff are **local only, not pushed**.
- Not tested on a physical iPad. Check the Safari blur and the date picker on a device.
- Prototype only: sample data in each browser's localStorage, no backend or auth, placeholder photos, label print logs only, CSV built in the browser.
