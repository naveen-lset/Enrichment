# Enrichment & Furnishing Management — workflows, screens, rules and traceability

Tablet prototype of *ANTZ_Enrichment_and_Furnishing_Management_PRD.pdf* (v1.0, 10 Oct 2026). Run it with `npm start`, then open `http://localhost:8834/`.

Every row below carries one of these tags:

| Tag | Meaning |
|---|---|
| **PRD** | Stated in the PRD. Built as a rule in `src/model/model.js`, covered by `npm test`. |
| **Proposed** | UX or behaviour proposed by this prototype. Not in the PRD. Needs sign-off. |
| **Integration** | Stands in for an existing ANTZ capability (ticket, workshop, material transfer, Task, Assessment, Audit). Must be wired to the real module. Not connected here. |
| **Decision** | Open business decision. The prototype makes a reversible choice so the flow can be shown. |

**Prototype limits.** All data is sample data, held in the browser (localStorage, one browser only). There are no APIs, no real authentication and no server confirmation. Photos are placeholders. CSV export builds the file in the browser. **Reset** (top bar, or the profile menu) restores the sample data.

---

## 1 · End-to-end workflow map

```mermaid
flowchart LR
  REQ[Request / ticket<br/>Integration] --> DISP[Dispatched]
  DISP --> REC{Receive}
  REC -- excluded category --> CONF[Confirmed · no record]
  REC -- not fit / damaged --> ASS
  REC -- fit --> REG[Registered<br/>In use / In storage]
  REG --> MOVE[Move / rotate<br/>same section] --> REG
  REG --> TR[Transfer · In transit] --> ACK{Acknowledge}
  ACK -- good --> REG
  ACK -- damaged --> ASS
  ACK -. AFM exception .-> REG
  REG --> FLAG[Report issue] --> ASS[Under assessment]
  ASS --> BIO[Animal-use check<br/>biologist]
  ASS --> TECH[Repairability check<br/>workshop / VIC]
  ASS --> DEC[Custodian decides<br/>no routed check]
  BIO & TECH & DEC --> OUT{Outcome}
  OUT -- suitable only --> REG
  OUT -- repairable / unsuitable --> APP[Repair approved] --> REP[Under repair] --> DONE[Repair completed] --> REG
  OUT -- beyond repair --> DR
  REG --> DR[Disposal request] --> VAL[Validations] --> APR{Approver}
  APR -- reject --> REG
  APR -- approve --> FIN[Final disposition<br/>Retired / Scrapped · record kept]
  SCH[Schedule<br/>Proposed] --> OCC[Occurrence] --> AUD[Audit session + execution task]
  AUD --> CHK{Line result}
  CHK -- verified --> REG
  CHK -- location mismatch --> REG
  CHK -- not found --> MISS[Missing]
  CHK -- finding --> CA[Corrective-action task] --> RES[Resolved] --> CLOSE[Close audit]
  MISS --> CA
```

| Flow | Entry | Actions | Outcome | Next |
|---|---|---|---|---|
| **A · Receipt → registration** | My tasks › Confirm receipt · Receipts › Waiting · **+** › Receive delivery | Review the request (ticket, workshop order, material transfer) → set received quantity (+/−) → shortage / excess reason when it differs → condition + fit for use → location → custodian → **Review** → Receive | Individual: one record per unit (EF-…). Group: one record with quantity (EB-…). Excluded: delivery confirmed, no record. Not fit or not Good: Under assessment, never Available. | Opens the first new item. The request shows Received + Registered. |
| **B · Item → move** | Items › row › Move · swipe left › Move · long press › Move | Destination (same section; enclosures are disabled for items not cleared for animal use) → reason → quantity for a group → **Review** → Move | Same record, new location. Status follows the location (enclosure = In use, store = In storage). Part of a group splits into a linked record. History: Moved (from → to, reason, user, time). | Item stays open. Undo is in the toast. |
| **C · Damage → repair** | Item › Report issue · swipe › Issue | Issue type → condition → description → photo where the category needs it | Under assessment. Checks are routed by category. | Biologist: *Animal-use check* card. Workshop: *Repairability check* card. With no routed check, the custodian gets *Decide outcome*. |
| | Repairs board › card (slide-over) | Animal use: suitable / unsuitable (+ reason) · Repairability: repairable / beyond (+ assessment) | Suitable only → cleared, back to its previous status. Repairable or unsuitable → Repair approved. Beyond → disposal needed. | Start repair (team) → Complete repair (work done, team, return location, photo) → Good, back in use. |
| **D · Transfer → acknowledge** | Item › Transfer | Section (grouped by site) → receiver (custodians of that section only) → transfer reference (required for Category A) → **Review** → Dispatch | In transit. Both ends kept. | Receiver: *Arriving from …* card → condition + location → Confirm. Damaged on arrival → Under assessment. AFM / admin: Complete by exception (reason required). |
| **E · Schedule → audit → close** | Inspections & Audits › Schedules › **+** | Template → site → frequency → start → assignee | Schedule saved. Next occurrence shown. | **Generate** → one audit session + one execution task (TSK-…). Refused if the site already has an open audit or the period already exists. |
| | Session › To check | **Verified** (one tap) · **…** › Location mismatch (found at) / Condition mismatch (note) / Not found (note) / Action required (note) | Verified updates Last verified. Location mismatch corrects the register. Not found → Missing. The original line result is kept. | Findings › Assign → corrective-action task (owner, due) → owner resolves (found at, resolution) → task done → **Close audit** once every line is checked and every finding is assigned. |
| **F · Disposal → approval** | Item › Dispose · *Beyond repair* card | Reason → condition → notes / photos (by category) → approver → expedited (needs a photo) → **Review** → Submit | DR-… *Needs validation*. The item stays in the active register. | Validators agree / disagree (reason required to disagree) → approver approves or rejects (comments required) → custodian records the final disposition (**Review**) → Retired / Scrapped. The record stays searchable under *Closed*. |
| **G · Dashboard → pending action** | Overview tile · My tasks row · notification | Tile → filtered list. Task row → the record, or its action sheet through the row button. | Action completed. | Counts on My tasks, the sidebar and the Overview update straight away. |

---

## 2 · Screen and navigation inventory

Sidebar (only the sections a role may use): **My tasks · Overview · Items · Receipts · Labels · Repairs & Issues · Transfers · Inspections & Audits · Disposal & Approvals · Reports · Setup**. Footer: site switch (Main / Rescue / All for people with two sites) and the profile menu (sign in as, demo guide, reset). Toolbar on every screen: notifications, **+** (create).

| # | Screen | Route | Layout | Entry points | Roles |
|---|---|---|---|---|---|
| 1 | My tasks (pending actions + notifications) | `#/today` | full | default, sidebar | all |
| 2 | Overview dashboard | `#/overview` | full | sidebar | all |
| 3 | Item register | `#/register` | split: list | sidebar, Overview tiles, search | all |
| 4 | Item details: Overview · History · Linked work | `#/register/EF-0001` | split: detail | register row, search, any linked record | all |
| 5 | Receipts: waiting / received + request detail | `#/receipts/TK-2051` | split | sidebar, My tasks, **+** | sup, afm, admin |
| 6 | Receive sheet (location and custodian pickers, review) | sheet | form sheet | receipt detail, My tasks | sup, afm, admin |
| 7 | Register existing item | sheet | form sheet | **+** | sup, afm, admin |
| 8 | Move sheet + review | sheet | form sheet | item, swipe, long press | sup, afm, admin (own scope) |
| 9 | Repairs & Issues board (Assessment · Approved · In repair · Beyond) + Completed | `#/repairs` | full + slide-over | sidebar, Overview pipeline | all |
| 10 | Report issue · Animal-use check · Repairability check · Decide · Start / Complete repair | sheets | form sheet | item next-step card, My tasks | by role |
| 11 | Transfers: in transit / completed + route detail | `#/transfers/TR-0001` | split | sidebar, item Linked work | sup, afm, admin, mgmt |
| 12 | Transfer · Acknowledge · Complete by exception | sheets | form sheet | item, transfer detail | by role |
| 13 | Inspections & Audits: Sessions · Schedules · Templates | `#/audits/AU-0002`, `SCH-…`, `TPL-…` | split | sidebar, Overview, My tasks | sup, afm, admin, mgmt |
| 14 | Audit session workspace (ring, To check / Findings / Verified) | `#/audits/AU-0002` | split: detail | sessions list, task | auditor, afm, admin |
| 15 | Schedule audit / edit schedule · Record finding · Corrective action · Resolve · Close | sheets | form sheet | audits | by role |
| 16 | Disposal & Approvals list + approval path | `#/disposals/DR-0004` | split | sidebar, item | all |
| 17 | Request disposal · Validate · Decision · Final disposition | sheets | form sheet | item, disposal | by role |
| 18 | Notifications | popover | popover | bell, My tasks | all |
| 19 | Reports (9) with CSV export | `#/reports/status` | split | sidebar | sup, afm, admin, mgmt |
| 20 | Labels: select, preview, print | `#/labels` | split | sidebar, **+**, item › Print label | sup, afm, admin |
| 21 | Setup: categories (tracking, routing, evidence, QR) and reminders | `#/setup/CAT-A` | split | sidebar | admin |
| 22 | Search | overlay | spotlight | sidebar, ⌘K | all |
| 23 | Demo guide (8 scenarios, signs in as the right person) | sheet | form sheet | top bar, profile menu | — |
| 24 | No access | any route the role may not use | full | direct link | — |

## 3 · Tablet layout specification (Proposed)

| | Landscape 1194 × 834 (1024–1279) | Portrait 834 × 1194 (768–1023) | Desktop (≥ 1280) |
|---|---|---|---|
| Sidebar | 272 px, always shown. It can be hidden from its header. | Slides over the content from the toolbar button, with a scrim. | Shown in the tablet frame. On a touch tablet, or with `?bare=1`, the app fills the screen. |
| List + detail | List 372 px, detail fills the rest. | List 340 px, detail fills the rest. | as landscape |
| Full screens | 4-column grid | 2-column grid | 4-column grid |
| Repairs | 4 columns + slide-over detail (500 px) | Columns scroll sideways + slide-over | as landscape |
| Forms | 560 px form sheet. Pickers open as pages inside the sheet. | same | same |

Type: Inter. Page title 28/700, item title 24/700, body 15, meta 13, labels 13/600. Spacing 4 · 8 · 12 · 16 · 20 · 24 · 32. Radius 12 (sheet 20). Touch targets are 40–52 px (primary buttons 44–52). Colour: Antz tokens only (`kit/tokens.css`). Deep teal for primary actions and selection, Antz green for success, tones for status. Motion: spring easing on sheets, slide-over, segmented controls and toasts. Rings fill on entry. Reduced-motion is respected.

Interaction patterns: swipe a row left (Move, Issue); long-press or right-click a row (context menu); large title that collapses into the toolbar on scroll; segmented tabs; toast with **Undo** after every change; review page before Move, Transfer, Receive, Disposal request, Final disposition and Exception; a warning before closing an edited form; the Done button disabled until required fields are filled and locked after the first tap; refused rules shown at the top of the sheet with a shake.

## 4 · Status-transition matrix (PRD §7, §8)

| From \ action | Receive | Move | Report issue | Checks / decide | Start repair | Complete repair | Transfer | Acknowledge | Request disposal | Complete disposal | Audit: not found | Resolve found |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| (ticket) | In use · In storage · Under assessment (not fit) | | | | | | | | | | | |
| Available / In use / In storage | | In use · In storage · Available (by location kind) | Under assessment | | | | In transit | | stays (request open) | Retired / Scrapped | Missing | |
| Under assessment | | ✕ | ✕ | Previous status (cleared) · stays (approved / beyond) | Under repair | | ✕ | | stays | Retired / Scrapped | Missing | |
| Under repair | | ✕ | ✕ | | | In use · In storage (Good) | ✕ | | ✕ | | Missing | |
| In transit | | ✕ | ✕ | | | | ✕ | In use · In storage, or Under assessment if damaged | ✕ | | — not on audit | |
| Missing | | ✕ | ✕ | | | | ✕ | | stays | Retired / Scrapped | | In use · In storage |
| Retired / Scrapped | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |

Always refused: delete (any tracked item), Move into an enclosure for an item not cleared for animal use, Move to another section (use Transfer), a second open disposal request, Approve before required validations (except expedited), Complete before approval.

Disposal request: *Needs validation* → *Awaiting approval* → *Approved* → *Completed*, or → *Rejected* (item stays active). Repair record: assessment → approved → repair → done / cleared / beyond / closed. Audit: scheduled → open → closed.

## 5 · Role and permission matrix (PRD §11, `CAN` in model.js)

| Action | Supervisor (own sections) | Facility manager (own sites) | Biologist | Workshop / VIC | Approver | Admin |
|---|---|---|---|---|---|---|
| Receive, register | ✓ | ✓ | | | | ✓ |
| Move | ✓ | ✓ | | | | ✓ |
| Report issue | ✓ | ✓ | ✓ (any) | ✓ (any) | | ✓ |
| Animal-use check | | | ✓ | | | |
| Repairability check | | | | ✓ | | |
| Decide outcome (no routed check) | ✓ | ✓ | | | | ✓ |
| Start / complete repair | ✓ | ✓ | | ✓ | | ✓ |
| Transfer | ✓ | ✓ | | | | ✓ |
| Acknowledge | receiver only | receiving site | | | | |
| Complete transfer by exception | | ✓ | | | | ✓ |
| Request disposal · complete disposition | ✓ | ✓ | | | | ✓ |
| Validate disposal | | | ✓ (animal use) | ✓ (repairability) | | |
| Approve / reject disposal | | ✓ | | | ✓ | |
| Schedule audit · generate occurrence (Proposed) | | ✓ | | | | ✓ |
| Record audit line | ✓ | ✓ | | | | ✓ |
| Assign finding · close audit | | ✓ | | | | ✓ |
| Resolve finding | assigned owner | ✓ | | | | ✓ |
| Print labels | ✓ | ✓ | | | | ✓ |
| Configure categories | | | | | | ✓ |
| Delete a tracked item | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |

Sidebar visibility (Proposed): Receipts and Labels for supervisor, facility manager and admin; Transfers, Audits and Reports for supervisor, facility manager, admin and approver; Setup for admin only. A direct link to a hidden section shows **No access**.

## 6 · Template, schedule, occurrence, session and task (Proposed — `src/model/work.js`)

| Concept | Record | Created by | Holds | Example |
|---|---|---|---|---|
| Template | `TPL-…` | admin (seeded) | what is checked; kind = Audit / Assessment / Checklist | TPL-01 Furnishing register audit |
| Schedule | `SCH-…` | facility manager / admin | template, site, scope, frequency, start, assignee | SCH-0001 Main Campus, quarterly |
| Occurrence | inside the schedule | **Generate** | period, due date, links to session and task | Q4 2026 → AU-0002 + TSK-0003 |
| Audit session | `AU-…` (model.js) | the occurrence | expected values and the line results | AU-0002 |
| Execution task | `TSK-…` kind *audit* | the occurrence | assignee, due, open / done | TSK-0003, done when the audit closes |
| Assessment record | on the repair record | a routed check | result, by, time, note | Animal-use: Suitable, Dr. Anjali Rao |
| Corrective-action task | `TSK-…` kind *corrective* | assigning a finding | owner, due, open / done | TSK-0004, Not found · Hanging tyre swing |

Rules: one session and one task per occurrence (a repeated period, or a second open audit for a site, is refused). Editing a schedule changes only future occurrences; sessions keep their own auditor and due date. Completing a corrective task never changes the original line result. Item › Linked work shows tasks, assessments, repairs, transfers, audits and disposals for that item. **Integration**: the real Task, Assessment and Audit modules must provide these links; this prototype does not assume they do.

## 7 · PRD traceability checklist

| PRD reference | Requirement (short) | Where | Tag | Status |
|---|---|---|---|---|
| §4, FR-01 | Categories and tracking mode (individual / group / excluded), routing, evidence | Setup › category | PRD | ✓ |
| FR-02, FR-03, §5.1, AC-2 | Receipt linked to ticket, workshop order, material transfer; registration with site, location, custodian | Receipts, Receive sheet | PRD + Integration | ✓ |
| §5.1 | Partial / excess quantity needs a reason; not fit → Under assessment | Receive sheet | PRD | ✓ |
| §5.1 | Excluded category creates no record | Receive sheet (`receiveExcluded`) | Proposed | ✓ |
| FR-04 | Record receipt, status, condition, movements, transfers, repairs, retirement and disposal with timestamps and users | Item › History (every action logs actor and time) | PRD | ✓ |
| FR-05, §5.2, AC-3 | Move / rotate the same record; history; group split | Move sheet, History | PRD | ✓ |
| FR-06, §9, AC-1 | Register with search, filters, status | Items | PRD | ✓ |
| FR-07, AC-7 | No delete of tracked items | no delete anywhere; disposal only | PRD | ✓ |
| FR-08, §5.5, AC-6 | Disposal: reason, evidence, validations, approval, disposition; rejection keeps item active | Disposal & Approvals | PRD | ✓ |
| §14 | Expedited disposal with photo | Request disposal › Expedited | PRD / Decision | ✓ |
| FR-09, FR-10, §5.3, AC-5, AC-9 | Issue → routed checks → repair → completion | Report issue, checks, Repairs board | PRD | ✓ |
| FR-11, §5.4, AC-4 | Transfer, In transit, acknowledgement, exception | Transfers, Acknowledge | PRD | ✓ |
| FR-12, §5.6, AC-8 | Audit outcomes, exceptions with owner + due, close rules | Audit session | PRD | ✓ |
| — | Scheduled audits, occurrences, execution and corrective tasks | Schedules, Templates, tasks | Proposed + Integration | ✓ |
| FR-13, §10, AC-10 | Reports by site / status, disposal register, compliance, accuracy | Reports (9) | PRD | ✓ |
| FR-14 | QR labels for labelled categories, logged | Labels | PRD | ✓ (no real printer) |
| FR-15 | Timeline: actor, time, action, from → to | Item › History | PRD | ✓ |
| §3 | Pending work per role | My tasks | PRD | ✓ |
| §10 | Notifications: receipt, transfer, assessment / repair overdue, disposal, missing, audit due, exception overdue | Bell, My tasks | PRD | ✓ |
| §11 | Role permissions and scope | everywhere; No access | PRD | ✓ |
| §9 | Dashboard counts, clickable | Overview (records / units switch) | PRD + Proposed | ✓ |

## 8 · Unresolved business decisions

| # | Decision | Prototype choice | Where to change |
|---|---|---|---|
| 1 | Who approves disposal | Management approver or facility manager of the site | `CAN.approve` |
| 2 | Category routing to biologist / workshop | A always + workshop; B biologist only while in use + workshop; C none (custodian decides) | Setup |
| 3 | Evidence per category | A: photo on repair, ref on transfer, photo + notes on disposal; B: photos | Setup |
| 4 | Partial receipt | Allowed with a reason. The ticket closes; the rest is not tracked as a back-order. | `receive()` |
| 5 | Excluded deliveries | Confirmed without a record | `receiveExcluded()` |
| 6 | Audit cadence and scope | Main Campus quarterly, Rescue Centre half-yearly; scope = all active items at the site | Schedules |
| 7 | One open audit per site | Enforced | `createAudit()` |
| 8 | Can an audit close with open (assigned) findings? | Yes, when every finding is assigned | `closeAudit()` |
| 9 | Reminder days | Receipt 3, assessment 5, repair 14, approval 5 | Setup › Reminders |
| 10 | Transfer acknowledgement window | 2 days, then overdue | `tasks()` |
| 11 | Expedited disposal | Approver may approve before validation; completion still waits | `approveDisposal()` |
| 12 | Count semantics (records vs units) | Records by default; Units switch on Overview | Overview |
| 13 | Missing item path | Missing → corrective task → found (back to a location) or disposal; never auto-disposed | audits |
| 14 | QR labels phase | Phase 4, required for A, optional for B | Setup |

## 9 · Backend integrations needed for production

| Integration | Purpose | Prototype stand-in |
|---|---|---|
| Request / ticket and procurement | Source of expected deliveries (item, category, quantity, section) | `D.tickets` in the seed |
| Workshop orders | Workshop reference on receipt, repair teams | text reference |
| Material transfer | Transfer reference and dispatch status | text reference |
| Site / section / enclosure master | Locations and kinds (enclosure, store) | `D.sections`, `D.locations` |
| Users, roles, scopes, auth | Permissions, sign-in | demo people + Sign in as |
| Task module | Execution and corrective tasks, assignment, due dates, reminders | `work.js` tasks |
| Assessment module | Animal-use and repairability records | fields on the repair record |
| Audit module / scheduler | Templates, schedules, occurrences, sessions | `work.js` + `createAudit()` |
| Notifications service | Push / email of the §10 events | computed in the app |
| File storage | Photos and evidence | placeholders |
| Label printing | QR / barcode labels | preview + log only |
| Reporting and export | Scheduled reports, server exports | in-browser CSV |
| Persistence and audit log | Server-confirmed writes, history | localStorage |

## 10 · Test checklist

Use **Demo guide** (top bar) to sign in as the right person. Use **Reset** between runs.

| # | Scenario | Expected |
|---|---|---|
| 1 | Ravi › Receipts › TK-2051 › Receive with 3 | 3 records EF-…, In use, Ravi custodian; request shows Received + Registered |
| 2 | Same with 2 | Receive stays disabled until a shortage reason is written |
| 3 | Receive TK-2062 (Category D) | Confirmed, no record |
| 4 | Receive with Damaged | Records go to Under assessment, never In use |
| 5 | Receive the same ticket again | The ticket is no longer waiting; the model refuses a second receipt |
| 6 | Move EF-0006 to Primate Enclosure 2 | Review shows from / to; history adds Moved; Undo restores |
| 7 | Move part of Bamboo foraging tube (group) | New EB-… record with the moved quantity; the rest stays |
| 8 | Ravi reports an issue on EF-0006 (A) without a photo | Submit refused: "Add a photo of the issue." |
| 9 | Anjali › animal-use check › Unsuitable without a note | Save disabled; with a note → condition Unsafe |
| 10 | Joseph › repairability › Repairable › Start › Complete | Back in use, Good; repair in Linked work |
| 11 | Ravi › Hide log › Decide outcome | Custodian decides (no routed check for C) |
| 12 | Ravi transfers EF-0001 to Carnivores | Next stays disabled until the transfer reference is entered (Category A); then In transit |
| 13 | Lakshmi acknowledges with Damaged | Received, then Under assessment |
| 14 | Meera › exception on Small transport cage | Completed by exception with a reason |
| 15 | Meera › Q4 audit › Verified / Not found / Assign / Close | Line result kept; corrective TSK-… created; Close audit appears only when every line is checked and every finding assigned |
| 16 | Meera › Schedules › Rescue › Generate | Refused: open audit at the site |
| 17 | Suresh › DR-0004 › Reject without comments | Save disabled; with comments → item stays active |
| 18 | Suresh approves DR-0004 › Ravi completes Scrapped | Item Scrapped, record under Items › Closed |
| 19 | Joseph opens `#/setup` | No access |
| 20 | Rotate to portrait | Sidebar becomes a slide-over; split view stays; forms unchanged |
| 21 | Close an edited form | Discard changes / Keep editing |
| 22 | Overview › tile | Items list opens with the matching filter |
| 23 | ⌘K › "hammock" | Items, deliveries and disposals that match |

## 11 · Enrichment activities (Proposed — `src/model/activity.js`, screens in `src/ipad/activity-views.js`)

Source: Figma file `5iizWNcFdePpGJpenKpaTG` ("Enrichment Module Mobile App"), flows `44:374` and `553:801`. These flows are **not in PRD v1.0**; the whole section is **Proposed** and needs scope sign-off. Drawn in the ANTZ app style (diet-request app): session cards like diet request cards, Species like Diet by Species.

**Names (to avoid the two clashes with the PRD):** *Activity type* (social, cognitive, environmental, food-based, sensory), never "category" (the PRD's A–D tracking category). *Observation* (how the animal responded), never "assessment" (the PRD's item condition check).

| Step | Who | Screen | Rule |
|---|---|---|---|
| Create activity | keeper, supervisor, biologist, AFM, admin | + › New activity | Name, type, goal and at least one species; a duplicate name is refused. Starts **Awaiting approval**. |
| Approve | biologist only | Activities › Awaiting approval, My tasks | Approve, or send back with a note (**Changes requested**); the author edits and resubmits. |
| Assign | supervisor (own sections), AFM (own sites), admin | Species › Recommended, + › Assign activity | Only an approved activity, for a species it is approved for, in an enclosure where the animals live, to a keeper of that section; species-wide or one animal; daily / alternate days / weekly / once, morning / midday / afternoon. |
| Inventory check | — | session cards, Assign sheet, Species | Reads the item register for each material at the enclosure: **ready** (usable item there), **in store** (usable in a store of the section), **blocked** (under assessment / repair / unsafe), **not in the register**. Uses `usableForAnimals()` from model.js. |
| Run and record | the assigned keeper (and supervisor / AFM / admin) | Sessions › Record, My tasks | One record per plan and day, not before the day. Materials used must be cleared items at that enclosure; each gets a *Used in activity* event in its history. Engagement, behaviours, successful (yes / partly / no), 1–5 rating, comments, photos. Or **Skip** with a reason. |
| Safety incident | keeper | Record session › Safety | The item must be one used in the session. It is flagged **Unsafe** through `flagIssue()`, so it goes into the PRD repair flow (biologist / workshop checks) and leaves animal use. |
| Material request | keeper, supervisor | + › Request material, session detail | Goes to the section custodian. |
| Inventory approval | custodian (supervisor), AFM, admin — **not the biologist** | Material requests | **Issue** a usable stored item (moves it to the enclosure through `move()`, splitting a batch) — or **Send to the request module** (needs a reason when a usable item is in store) — or **Decline** with a reason. The request module itself is **Integration**: delivery then arrives in Receipts as today. |
| Results | everyone | Activity › Results, Species, Reports | Sessions, % successful (partly = half), average rating, safety incidents, behaviours seen; *Activity effectiveness* and *Unused activities* (approved, not assigned or no session in 30 days) reports. |

New role **Keeper** (`ROLE.keeper`): acts in own sections like a supervisor; can report an item issue; cannot move, transfer, receive or dispose. Disposal & Approvals is hidden for keepers.

Prototype limits: no live timer (duration is picked); voice notes, video and the idea gallery from Figma are not built; animals and species are sample data and must come from the ANTZ animal module (**Integration**). The Figma screens are a phone app; this prototype draws them for the iPad.

Open decisions: who may create activities (all staff, or supervisors and biologists only); whether a keeper can record a colleague's session; whether "partly" counts as half a success; the 30-day window for *unused*.
