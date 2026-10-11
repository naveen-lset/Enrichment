# Handoff — Enrichment & Furnishing tablet prototype

Last session: 11 Oct 2026. Repository: https://github.com/naveen-lset/Enrichment

## Run
```sh
cd /Users/naveen/Enrichment/enrichment-tablet
npm start            # http://localhost:8834/
npm test             # 26 rule tests
npm run test:ui      # UI checks, 4 iPad sizes (server running, Chrome installed)
```
Hard-refresh after CSS changes. `?reset=1` restores the sample data; **Reset** in the top bar does the same.

## State
- **New iPad-style app** (`index.html`, `src/ipad/*`) replaces the phone-style build. The old build is `v1.html` + `src/app/` + `flow.html`, kept for comparison.
- `src/model/model.js` is unchanged (the PRD rules). `seed.js` gained two hooks that call `seed-demo.js` (app only; tests don't load it).
- `src/model/work.js`: **proposed** template / schedule / occurrence / task / corrective-task layer.
- `docs/WORKFLOWS.md`: workflow map, screen inventory, layout spec, status and role matrices, task-model concepts, traceability, decisions, integrations, test checklist.
- Pushed to GitHub (`main`). Live on Cloudflare Pages: https://antz-enrichment.pages.dev (Cloudflare Pages project `antz-enrichment`). Redeploy: `npm run deploy`.

## User's rules
1. No helper text or explanations in the UI. Simple and clean.
2. Antz colour tokens only (no hex outside `kit/tokens.css`). Inter. Restrained: no gradients, radius 12.
3. Tablet-first: iPad concept (sidebar, split view, sheets, popovers), not a copy of iPad.
4. Label prototype-only behaviour in the docs, not in the UI.

## Open
- FR-04 is not traced; check the PRD text (no PDF tool on this machine).
- The 14 decisions in docs/WORKFLOWS.md §8 need stakeholder answers.
- The Task / Assessment / Audit links (work.js) must be checked against the real ANTZ modules.
