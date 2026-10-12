# Handoff — Enrichment & Furnishing tablet prototype

Last session: 12 Oct 2026. Repository: https://github.com/naveen-lset/Enrichment (public) · Live: https://antz-enrichment.pages.dev

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
- **12 Oct restyle** to match the ANTZ app (reference: https://antzdietrequestflow.vercel.app/diet-home.html?as=kitchen-head#species): one white header (title, "Viewing as" pill, site menu, bell, +); full-width filter bands (segmented tabs, 48 px search + square filter button); list rows as white cards with chevron and green selected outline; titled detail cards; #EFF5F2 page background, radius 8, 5 % black lines. Shell in `render()` / `header()` in `core.js`; style block "15 · ANTZ app style" at the end of `ipad.css`.
- **Figma comparison (12 Oct)**: file `5iizWNcFdePpGJpenKpaTG` ("Enrichment Module Mobile App"), flows `44:374` and `553:801`. Both are user-flow diagrams for enrichment **activities** (categories, sessions, ratings, scheduling), not the PRD's item lifecycle. Touch points: inventory check, material requests, materials used, safety incidents, enclosures. Naming clashes: "category" and "assessment". 

## User's rules
No helper text in the UI · iPad concept, not a copy · Antz colour tokens only (no hex outside `kit/tokens.css`) · Inter, radius 8 (ANTZ app), no gradients · show each fact once (no repeated text) · few icons (sidebar, toolbar, none in rows or menus) · overlays blur the background · prototype-only behaviour labelled in docs, not in the UI.

## Open questions for the owner
- The 14 business decisions in docs/WORKFLOWS.md §8.
- The Task / Assessment / Audit links (`work.js`) need checking against the real ANTZ modules.
- The repo and the site are public. Make them private if the kit or module details are internal.
- Keep or remove the v1 build? Add the PRD PDF to `docs/`?

## Not done
- **First fix next session (user feedback 12 Oct):** remove repeated text. Same value shown twice on a screen, e.g. site in header and on Overview, item name in hero and in detail cards, tracking type in hero and Details, page title in header and list count. Show each fact once.
- The 12 Oct restyle is **committed locally only**, and the **live site still runs the 11 Oct style** (run `npm run deploy` after review). README screenshots show the old style.
- Activity flows from the Figma file are not built (separate module; see comparison above).
- Commits since `aa2f276` (deploy scripts, handoffs, restyle) are **local only, not pushed**.
- Not tested on a physical iPad. Check the Safari blur and the date picker on a device.
- Prototype only: sample data in each browser's localStorage, no backend or auth, placeholder photos, label print logs only, CSV built in the browser.
