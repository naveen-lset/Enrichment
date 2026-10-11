# Handoff — Enrichment & Furnishing tablet flow

Last session: 10–11 Oct 2026. Owner: naveen@lifesciencetrust.com.

## Run
```sh
cd /Users/naveen/Enrichment/enrichment-tablet
python3 -m http.server 8834      # or: npm start
# flow map: http://localhost:8834/flow.html   app: http://localhost:8834/index.html
npm test                         # 26 rule tests, Node 20+
```
- `index.html?reset=1&as=P-ANJ#/mywork` opens fresh data, as a person, on a screen. Switch user and **Reset demo data** sit behind the user icon.
- Hard refresh after CSS changes; the browser caches `index.html`.

## What exists
- Source PRD: `../ANTZ_Enrichment_and_Furnishing_Management_PRD.pdf` (v1.0, 10 Oct 2026). Design kit: `../antz-grc-v2-starter/` (unchanged; its `assets/` is copied to `kit/`, unchanged).
- `src/model/model.js` — all PRD rules: receive/register, move (same section only), flag → biologist/workshop checks → repair, transfer + acknowledge / exception, disposal request → validate → approve/reject → complete, audits, permissions (`CAN`), `tasks()`, `notifications()`, `report()`, `printLabels()`. `seed.js` plays the demo history through it (demo "now" = 10 Oct 2026 10:00).
- `src/app/shell.js` — router, page header (`header`, `page`), sheets (`pick`, `edit`, `review`, `confirmSheet`), task-page helpers (`part`, `fld`, `chc`, `lbl`), list card (`card`).
- `src/app/screens/phase-1…4-*.js` — 30 screens by PRD phase. `flow.html` — phase tabs linking every screen as its role.
- `src/app/theme.css` — Untitled UI look, Antz tokens only. `src/app/app.css` — device frame and spacing.
- `docs/acceptance-criteria.md` — one sentence per test.

## Constraints the user set (keep them)
1. GRC v2 kit components with status **confirmed** only. Buttons / pills / fields appear only inside a confirmed component's own slot (README table).
2. No helper lines in the UI (no hints, placeholders, sheet explanations).
3. Clean: no surface inside another surface; ghost actions in cards; no dashed boxes in cards.
4. Untitled UI style, **Antz colours only** (no hex outside `kit/tokens.css`).

## Open questions for the owner / Sourav
- C-18 Audit card is used as the generic list card (its spec says Audits list); C-10 row card awaits confirmation.
- C-07 page header heads detail and task pages (C-08 / C-09 not confirmed); no table view (C-14 not confirmed).
- The theme overrides kit look (24 px gutters, 18 / 30 px sizes) — needs Sourav's sign-off before release.
- PRD §14 open decisions are set as prototype choices (README table): disposal approver, category routing, QR phase, audit cadence, reminder days.
- The Untitled UI styling was matched from general knowledge, not a reference file — check against the team's Untitled kit.

## Not done
- Not on GitHub: local git repo only, no remote. Not deployed anywhere (no Vercel project).
- Prototype only: data lives in browser localStorage; photos and CSV export are placeholders; no backend or real auth.
