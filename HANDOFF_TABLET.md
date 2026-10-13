# Handoff — Enrichment & Furnishing tablet prototype

Last session: 12 Oct 2026. Repository: https://github.com/naveen-lset/Enrichment (public) · Live: https://antz-enrichment.pages.dev

## Run
```sh
cd /Users/naveen/Enrichment/enrichment-tablet
npm start            # python3 -m http.server 8834 → http://localhost:8834/
npm test             # 64 rule tests: 26 PRD + 8 activity + 12 Enrichments + 9 lifecycle + 9 register (Node 20+)
npm run test:ui      # UI checks at 6 iPad sizes, ~10 min (server running, Google Chrome installed)
npm run deploy       # build dist/ and publish to Cloudflare Pages (wrangler login saved on the owner's Mac)
```
- Hard-refresh after CSS changes. `?reset=1` restores the sample data (also *Viewing as › Reset demo data*).
- Full screen by default; `?frame=1` shows the old tablet frame. `?as=P-RAVI` signs in as a person (only Biologist / Supervisor / Site manager are allowed).

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

- **Enrichments Phase 1 (12 Oct, from the Phase 1 brief)**: sidebar *Enrichments* → Products (5 type tabs from `ACT_TYPE`, cards / list, search, filters, detail slide-over) · My requests · Approvals. Requests: product request, new product, same-site movement, inter-site transfer; custodian change is direct. Approval of movement / transfer runs `move()` / `transfer()` as the approver and the request is Completed (transfer item still waits for acknowledgement). Rules `src/model/products.js`, components `src/ipad/enrichment-components.js`, screens `src/ipad/enrichment-views.js`, tests `tests/products.test.mjs`, docs `docs/WORKFLOWS.md` §12 (dependencies D-E1…D-E10). Storage key bumped to `antz-enrichment-ipad-3`. Small shell changes in `core.js`: the search band also serves full-width pages (`searchBand()`), sidebar entry, seeding.

- **Enrichments Phase 2 (12 Oct)**: lifecycle controls in the product detail (Store / Return to use, Report issue, repair steps, transfer stages, lifecycle timeline), Approvals › To dispatch. Owner decisions: transfers = approval → dispatch → receipt (request Completed on receipt); workshop repairability check stays a waiting step. `tests/lifecycle.test.mjs`, docs §13 (D-P1…D-P6).

- **Current state (end of 12 Oct)** — read this first:
  - **Navigation**: bottom tabs Home · Enrichments · Requests (no sidebar). Roles: Biologist (Dr. Anjali Rao), Supervisors (Ravi, Lakshmi, Arun, Farhan), Site manager (Meera = AFM role).
  - **Design**: `/Users/naveen/Enrichment/Components.md` (Antz procurement tablet kit, supplied by the owner) is the component source. Built as `src/ipad/antz-kit.js` (HTML-string components: Btn, Tag, Section, KV, RecordCard, Stepper, StatusFoot, DecisionButtons, AppBar, CountTabs, BottomNav, PickRow …) and `src/ipad/antz-kit.css` (prefix `ak-`). Shell in `core.js`: `header()` = AppBar, `searchBand()` = ListBar + SearchBox, `paintTabbar()` = BottomNav, `paintSlide()` = FullPanel with StatusFoot + `showBanner()`, `drawSheet()` = bottom / side / dialog Sheet with footer, form fields `cText/cArea/cNav/cOpts/cSeg/cStep` = Field / TextIn / PickField / Choice / Stepper2. Docs §15.
  - **Screens** (`src/ipad/enrichment-views.js`): Products (CountTabs of the 5 types, record cards / list, filters side sheet, Fab for New request) → product FullPanel (`productPanel()`, actions `productActions()`); Requests (`VIEWS.enrreq` biologist / `VIEWS.enrappr` reviewers, record cards) → `requestPanel()` with Approve (banner) / Reject (reason dialog) / Dispatch / Edit / Withdraw / Revise; Home (`VIEWS.today`, tiles + To do from `enrTasks()` + Updates from `myNotifications()`).
  - **Forms**: Next / Submit always tappable; empty required fields get a red outline and "Fill in the fields marked *" (`markMissing()` in core.js).
  - **Click-through check**: every flow (27) was tapped through in headless Chrome, landscape and portrait, all passing (script kept outside the repo).
  - Storage key `antz-enrichment-ipad-5`.
- **Minimal navigation (12 Oct, owner)**: bottom tabs Home · Enrichments · Requests replace the sidebar; roles Biologist · Supervisor · Site manager only; Home = role-scoped To do + Updates; repairability check removed (`noRepairCheck()`). Other modules stay in code, not in navigation. Docs §14. Storage key `antz-enrichment-ipad-4`.

- **Item register (13 Oct, from the *Actual Business Requirements* brief §1–9)**: product definitions (`D.products`, `EP-` IDs) separate from physical items; Enrichments lists items grouped under their product, available first, with filters for status (incl. Unavailable), condition, usable life, material, custodian (incl. Awaiting assignment), location. Receipt inside Requests › To receive (`receiveDelivery`: confirm or define the product, custodian optional → Awaiting assignment). Usable life per product with item override, review date from the received date, Life review (still fit / replace), never auto-changes status. Assign for use (enclosure + optional animals). Rules `src/model/register.js`, screens `src/ipad/register-views.js`, tests `tests/register.test.mjs`, docs §16. Storage key `antz-enrichment-ipad-6`. The brief's §10 onward was cut off: still to come.
- **Back arrow and polish (13 Oct)**: the panel back arrow now returns to the screen the record was opened from (`TRAIL` / `DO.back` in core.js; the panel's own list only when opened by link). Enrichments list: one white card per product (header = definition and available count, then its items as one-line rows, 5 then *Show all*); list layout = one flat list; item panel shows status once (footer), facts split into Details and Product and life, empty Associations / Activities cards hidden. `npm run test:ui` can stall in headless Chrome when all sizes run in one process (it did on the 12 Oct commit too); one size per run passes. Local files load with `?v=` in index.html: bump it after every change, or the browser shows a cached copy.

## User's rules
Keep it minimal (3 tabs, 3 roles; ask before adding modules, roles or nav entries) · follow Components.md · no helper text in the UI · Antz colour tokens only (no hex outside `kit/tokens.css`) · show each fact once · one main action per footer · prototype-only behaviour labelled in docs, not in the UI · full screen, no iPad frame.

## Open questions for the owner
- Enrichments decisions: docs/WORKFLOWS.md §12 (D-E1…D-E10), §13 (D-P2…D-P6), §14 (receipts, disposal and audit have no entry point in the 3-tab navigation).
- The 14 business decisions in docs/WORKFLOWS.md §8.
- The Task / Assessment / Audit links (`work.js`) need checking against the real ANTZ modules.
- The repo and the site are public. Make them private if the kit or module details are internal.
- Keep or remove the v1 build? Add the PRD PDF to `docs/`?

## Not done
- Remove repeated text on the older PRD screens (user feedback 12 Oct): e.g. site in header and on Overview, item name in hero and in detail cards. The Enrichment screens already follow this.
- **Not deployed**: the live site runs the minimal-navigation version **before** the Components.md redesign (deployed 12 Oct ~21:45). Run `npm run deploy` after the owner reviews localhost.
- **Not pushed**: `main` is ahead of `origin/main`; another device cannot pull it yet. README screenshots show the 11 Oct style.
- Exceptions to the old UI rules, asked for by the user via the diet/medical references: counts on tabs and chips, small icons in session cards.
- Enrichment open decisions: scope sign-off (not in PRD), who may create activities, keeper recording a colleague's session, "partly" = half a success, 30-day "unused" window. Helpdesk → Receipts hand-off is not wired (prototype starts at a dispatched ticket).
- Not tested on a physical iPad. Check the Safari blur and the date picker on a device.
- Prototype only: sample data in each browser's localStorage, no backend or auth, placeholder photos, label print logs only, CSV built in the browser.
