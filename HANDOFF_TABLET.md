# Handoff — Enrichment & Furnishing tablet prototype

Last session: 12 Oct 2026. Repository: https://github.com/naveen-lset/Enrichment (public) · Live: https://antz-enrichment.pages.dev

## Run
```sh
cd /Users/naveen/Enrichment/enrichment-tablet
npm start            # python3 -m http.server 8834 → http://localhost:8834/
npm test             # 34 rule tests: 26 PRD + 8 activity (Node 20+)
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

- **Component pass (12 Oct)** to match the ANTZ medical iPad flow (https://medical-flow-ipad-ten.vercel.app/flow/ipad/app_3.html, library `library/app/type.css` + `components.css`): Antz text styles (Inter, line-height normal), navy pill segment tabs, rounded grey chips (navy when chosen), r5 tags, r10 cards and rows (selected = mint + 1px green), navy fill / navy outline buttons, grey search bars. Style block "17 · Antz component library pass" at the end of `ipad.css` (overrides 15 and 16).
- **Flowchart (12 Oct)**: Helpdesk request → PRD item lifecycle → optional activities, with suggestions per step. Private artifact https://claude.ai/artifact/HEwbjg4CBPWikwYBwQeGAU (source not in the repo).
- **Enrichment activities (12 Oct, Proposed)**: the Figma activity flows built in the same app and style. One sidebar entry *Enrichment* opening a module drawn like the ANTZ diet module (underlined tabs with counts, counted segment tabs and filter chips, request-style cards, one-card details with tinted-header tables): Sessions (day cards with material check, Record / Skip), Activities (catalogue, biologist approval, results), Species (like Diet by Species, with Recommended), Material requests (custodian: issue from store / send to request module / decline). New Keeper role (Priya Shetty, Imran Sheikh, Rosy Mathew). Rules `src/model/activity.js`, screens `src/ipad/activity-views.js`, tests `tests/activity.test.mjs` (8), docs `docs/WORKFLOWS.md` §11. Storage key bumped to `antz-enrichment-ipad-2`, so browsers reseed.

## User's rules
No helper text in the UI · iPad concept, not a copy · Antz colour tokens only (no hex outside `kit/tokens.css`) · Inter (Antz text styles), radius 10 cards / 8 buttons, no gradients · show each fact once (no repeated text) · few icons (sidebar, toolbar, none in rows or menus) · overlays blur the background · prototype-only behaviour labelled in docs, not in the UI.

## Open questions for the owner
- The 14 business decisions in docs/WORKFLOWS.md §8.
- The Task / Assessment / Audit links (`work.js`) need checking against the real ANTZ modules.
- The repo and the site are public. Make them private if the kit or module details are internal.
- Keep or remove the v1 build? Add the PRD PDF to `docs/`?

## Not done
- Remove repeated text on the older PRD screens (user feedback 12 Oct): e.g. site in header and on Overview, item name in hero and in detail cards. The Enrichment screens already follow this.
- **Deployed but not pushed**: the live site runs the 12 Oct work (deployed from the working copy). Commits since `aa2f276` are **local only**; another device cannot pull them yet. README screenshots show the 11 Oct style.
- Exceptions to the old UI rules, asked for by the user via the diet/medical references: counts on tabs and chips, small icons in session cards.
- Enrichment open decisions: scope sign-off (not in PRD), who may create activities, keeper recording a colleague's session, "partly" = half a success, 30-day "unused" window. Helpdesk → Receipts hand-off is not wired (prototype starts at a dispatched ticket).
- Not tested on a physical iPad. Check the Safari blur and the date picker on a device.
- Prototype only: sample data in each browser's localStorage, no backend or auth, placeholder photos, label print logs only, CSV built in the browser.
