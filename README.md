# ANTZ · Enrichment & Furnishing Management — tablet flow

A clickable tablet prototype of every phase in the PRD (*ANTZ_Enrichment_and_Furnishing_Management_PRD.pdf*, v1.0, 10 Oct 2026).
It is built only with the GRC v2 kit components (`kit/`, copied unchanged from `antz-grc-v2-starter/assets`).
Device: app tablet, 834 × 1194, portrait.

## Run

```sh
cd enrichment-tablet
python3 -m http.server 8834
# app:       http://localhost:8834/index.html
# flow map:  http://localhost:8834/flow.html
npm test                    # 26 tests of the rules (Node 20+)
```

- `flow.html` lists the 4 phases and 30 screens. Each row opens the app on that screen, signed in as the right role.
- In the app, the name at the top right switches user (role). **Reset demo data** is in that sheet.
- `index.html?reset=1&as=P-ANJ#/mywork` opens the app with fresh data, as a given person, on a given screen.
- The demo date is 10 Oct 2026, 10:00. Changes are kept in the browser's local storage.

## Folder structure

```
enrichment-tablet/
├── index.html                 the app (one page, hash routes)
├── flow.html                  flow map: phases → screens → role
├── README.md
├── docs/
│   └── acceptance-criteria.md PRD rules as sentences, one per test
├── kit/                       GRC v2 kit, unchanged (tokens, type, icons, kit.css, kit.js)
├── src/
│   ├── model/
│   │   ├── model.js           module rules, no UI (statuses, permissions, workflows, tasks, notifications, reports)
│   │   └── seed.js            demo data, played through the model
│   └── app/
│       ├── app.css            page shell only (device frame, scroll area, list spacing), tokens only
│       ├── theme.css          Untitled UI look for the kit classes, Antz tokens only
│       ├── shell.js           state, router, page header, sheets, pickers, review sheet, toast, task pages
│       ├── main.js            start-up
│       └── screens/
│           ├── phase-1-register.js        Overview, Register, Item details, Receipts, Receive, Register item, Setup
│           ├── phase-2-lifecycle.js       Move, Repair request, checks, Complete repair, Transfer, Acknowledge
│           ├── phase-3-disposal-audit.js  Disposal request + detail, Disposal list, Audits, New audit, Audit workspace
│           └── phase-4-optimise.js        My work, Reports, Notifications, Labels
└── tests/
    └── model.test.mjs
```

## Navigation

Module header (site selector, notifications, user switch as icon buttons) with level-1 tabs: **Overview · Register · My work · Audits · Reports** (+ **Setup** for the admin).
The Create FAB on top-level pages offers Receive items, Register item, Print labels and New audit (by role).

| Phase | Screens |
|---|---|
| 1 · Configure & register | Overview dashboard · Item register (find, filter, status strip) · Item details (Summary, Timeline, Repairs and transfers; primary action + More) · Pending receipts · Receive items · Register item · Setup: categories, category |
| 2 · Lifecycle controls | Move / rotate · Mark for repair · Animal-use check, Repairability check, Decide outcome, Start repair (sheets) · Complete repair · Initiate transfer · Acknowledge receipt, Complete by exception (sheets) |
| 3 · Disposal & audit | Request disposal · Disposal request (Validate, Approve, Reject, Complete) · Disposal requests · Audits · New audit · Audit workspace (Check, Assign, Resolve, Close) |
| 4 · Optimisation | Print labels (queue, print, logged) · Find by label · Reports (8 reports, PRD success measures) · Notifications · My work |

## Demo people

| Person | Role | Scope | What to try |
|---|---|---|---|
| Ravi Kumar | Supervisor | Primates, Small Mammals | Receive TK-2051, move, flag a repair, transfer, request disposal of EF-0010, resolve the missing swing |
| Lakshmi Menon | Supervisor | Carnivores, Birds | Receive TK-2047 / TK-2053 |
| Arun Das | Supervisor | Rescue Wards | Acknowledge EF-0009 |
| Meera Iyer | AFM | Both sites | Audit Q4 2026: check, assign, close; approve; exception transfer |
| Dr. Anjali Rao | Biologist | — | Animal-use check on EF-0005; validate DR-0005 |
| Joseph Thomas, Kavya Nair | Workshop / VIC | — | Complete repair of EF-0016 |
| Suresh Pillai | Management approver | — | Approve or reject DR-0004 |
| Neha Shah | ANTZ admin | All | Setup, every task |

## Look: Untitled UI style, Antz colours only

`src/app/theme.css` restyles the kit's own classes in the Untitled UI manner; `kit/` stays unchanged.
- Surfaces: white, 1 px hairline, extra-small shadow, radius 12 (controls 8, badges 999).
- Type: Inter on the Antz ladder with Untitled line heights; page titles 24 / 600, card titles 18 / 600, metric values 30 / 600, labels 14 / 500 in secondary text.
- Badges: light fill, matching border, dark text, no dot (UI-6). Tabs: underline. Inputs and chips: subtle shadow, 4 px focus ring.
- Key-value lists with row dividers, an activity-feed timeline, featured-icon empty states, white notification toasts.
- Spacing: 24 px page gutter and 24 px between sections; list cards 12 apart.
- Colour: every value is an Antz token (`--md3-*`, its alpha steps, `--black-NN`). The Untitled roles map to Antz tokens at the top of `theme.css` (text primary → OnSurfaceVariant, secondary → OnSurfaceVariant 80%, border → SurfaceVariant, brand fill → OnPrimaryContainer, accent → Primary, focus ring → Primary 20%). No hex anywhere outside `kit/tokens.css`.

## Confirmed components only

Only components with status **confirmed** in `components.json` are used:
C-04 site selector · C-05 FAB · C-07 page header + tabs · C-15 card · C-17 KPI tile · C-18 card · C-24 ring · C-25 bars · C-26 stat strip · C-46 thumbnails
· C-47 timeline · C-48 sheet + option rows · C-50 / C-51 picker sheets · C-52 confirm sheet · C-53 review & submit sheet · C-54 sheet with fields · C-59 key-value
· C-60 trend + bar rows · C-61 compliance overview · C-62 empty state · C-63 toast.

Parts that are not confirmed on their own appear only inside the slot of a confirmed component whose own spec uses them:

| Part | Only inside |
|---|---|
| `kButton` (N-01) | C-07 header actions · C-15 card action · sheet footers (C-48–C-54) · C-62 empty-state action |
| `kPill` (C-19) | C-18 card status |
| `kField`, `kChoice`, `kFormSection` (C-55) | C-54 sheet body |

How the screens change because of this:

| Not confirmed | Used instead |
|---|---|
| C-08 detail header, C-09 task header | C-07 page header: title, sub line, Back and the page actions in its actions slot |
| C-06 bottom action bar | buttons in the C-07 actions slot (secondary first, primary last) |
| C-10 / C-12 / C-13 row cards, C-14 table | C-18 card: name, detail line, status, up to four facts |
| C-27 toolbar, C-28 segment | C-26 stat strip as a filter · C-51 filter sheet · C-54 find sheet |
| C-16 area tile | C-17 KPI tile with onclick |
| C-49 step form, C-55 fields on a page | task page: one C-15 card per topic, its action opens a C-54 sheet (three fields or fewer) or a C-51 picker; submit opens the C-53 review & submit sheet, which stops Submit while something is missing |

To raise with Sourav (README §15):
- **C-18** says "Use it in the Audits list". It is the only confirmed list card, so the app uses it for every list (items, tasks, tickets, requests). The row card **C-10** is waiting for confirmation.
- **C-07** is meant for top-level pages. With C-08 / C-09 not confirmed, it heads the detail and task pages too, with Back in its actions slot.
- **UI-3** asks for a table when there are many rows; **C-14** is not confirmed, so the register has cards only.

Clean composition: no surface inside another surface (lists inside a card are a timeline or key-value rows) · card and header actions are ghost buttons · no dashed empty boxes inside cards · every label in a sheet uses the field label style (14 / 600) · spacing only from the 2 · 4 · 8 · 12 · 16 · 24 · 32 scale.

Also followed: no helper lines (no hints, placeholders, sheet explanations or step text) · sheets hold one decision and never a multi-step form (UI-8) · status is a pill, never a dot (UI-6) · one item = one card (UI-3).

## Open decisions (PRD §14), as set in this prototype

| Decision | Prototype choice | Where to change |
|---|---|---|
| Categories and tracking mode | A individual, B individual (biologist only while in use), C batch, D not tracked | Setup, `seed.js` |
| Disposal approver | Management approver or AFM | `CAN.approve` in `model.js` |
| QR labels | Phase 4, required for A, optional for B | Category form |
| Audit cadence | Per site, per period (Q4 2026, H2 2026 …) | New audit |
| Reminders | Receipt 3 days, assessment 5, repair 14, approval 5 | `config` in `seed.js` |
| Move vs transfer | Move stays in a section; another section or site is a transfer | `move()` in `model.js` |
