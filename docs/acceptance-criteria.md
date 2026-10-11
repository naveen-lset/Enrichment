# Enrichment & Furnishing — acceptance criteria

`src/model/model.js` holds the rules of the module. `tests/model.test.mjs` tests them: 26 tests.
Each sentence below is one test. The build is correct when it meets every sentence. Run `npm test`.
References: PRD sections (§), functional requirements (FR-), and the PRD's MVP acceptance criteria (AC-1 … AC-10, in PRD order).

## Phase 1 · Configure & register

1. **Categories (FR-01).** A category tracks items individually, as a group / quantity, or not at all. Only the ANTZ admin changes a category. A category needs a name. — `P1-1`
2. **Receipt, Category A (AC-2, FR-02, FR-03).** Receiving a ticket makes one record per unit, linked to the ticket, the workshop reference and the material-transfer reference, with site, location and custodian. A ticket is received once. — `P1-2`
3. **Receipt, batch.** A batch is one record with its quantity. A quantity that differs from the ticket needs a discrepancy note. — `P1-3`
4. **Not fit on receipt (§5.1).** An item not fit on receipt goes to Under assessment and is never offered for animal use. The location must be in the ticket section. A supervisor receives only for their own sections. — `P1-4`
5. **Register (AC-1).** A supervisor sees the tracked items of their sections, with location, condition and status. — `P1-5`

## Phase 2 · Lifecycle controls

1. **Move (AC-3, FR-05).** A rotation moves the same record; no duplicate is made. The history keeps from, to, user and time. A move needs a reason and a new location in the same section. Another section or site is a transfer. — `P2-1`
2. **Batch split.** Moving part of a batch splits it into a new batch record linked to the first. — `P2-2`
3. **Animal use (§8).** An unsafe, unsuitable or beyond-repair item is never placed in an enclosure. An item under repair cannot move. — `P2-3`
4. **Repair (AC-5, FR-10).** Flag an issue (with a photo where the category needs one) → animal-use check by a biologist → repairability check by the workshop → start repair → complete repair with notes and team. The item returns to a valid location in Good condition. Only the routed roles can record each check. — `P2-4`
5. **Biologist only where needed (AC-9).** Category A always asks a biologist; Category B only while the item is in use; Category C never. With no routed check, the custodian decides. — `P2-5`
6. **Transfer (AC-4, FR-11).** A transfer needs a receiving custodian of the receiving section (and the transfer reference where the category needs it). The item is In transit until the receiver acknowledges. The history keeps both ends, users, times and the reference. — `P2-6`
7. **Exception (§8).** Only an AFM or the admin completes a transfer without acknowledgement, and only with a reason. — `P2-7`
8. **Timeline (FR-15).** Every event has an actor, a time and an action, newest first. — `P2-8`

## Phase 3 · Disposal & audit

1. **No delete (AC-7, FR-07).** A tracked item cannot be deleted. A scrapped record stays. — `P3-1`
2. **Request (FR-08).** A disposal request needs a reason, a condition, the evidence the category asks for, and an authorised approver. Validations are routed by category. The item stays in the active register. One open request per item. — `P3-2`
3. **Completion (AC-6).** Approval waits for the required validations. Completion waits for approval and needs a final disposition. The item becomes Retired / disposed or Scrapped. — `P3-3`
4. **Rejection (§5.5).** A rejection needs comments, returns the request to the custodian and keeps the item active. — `P3-4`
5. **Expedited route (§14).** An expedited request needs a photo. The approver can approve before validation; completion still waits for every validation. — `P3-5`
6. **Audit outcomes (AC-8, FR-12).** Verified, location mismatch (with the found location), condition mismatch, not found and action required. Not found marks the item Missing; a location mismatch corrects the location. An exception needs a custodian and a due date. A missing item found again returns to a location. — `P3-6`
7. **Audit close (§5.6).** Only an authorised role closes an audit, and only when every item is checked and every exception is assigned. A closed audit takes no more results. — `P3-7`
8. **Reports (AC-10, FR-13).** Items by site and status, and a disposal / scrap register with reason, validators, approver and completion. Disposal compliance and location accuracy come from the records. — `P3-8`

## Phase 4 · Optimisation

1. **Labels (FR-14).** Only individual records of a labelled category take a label. Printing is logged on each item. — `P4-1`

## Tasks, notifications, permissions

1. **My work (§3).** Each role sees only what it must act on. The biologist sees only animal-use checks and validations. Late tasks are marked. — `T-1`
2. **Notifications (§10).** Receipt pending, transfer awaiting acknowledgement, repair overdue, disposal awaiting action, item missing, audit due, and an unresolved exception past its due date. — `T-2`
3. **Permissions (§11).** A supervisor acts only on their own sections; only the receiver acknowledges; only the admin configures. — `T-3`
4. **Demo data.** The seed lands on 10 Oct 2026, 10:00 with: one item under repair, one in transit, one missing, two under assessment (one beyond repair), one scrapped, one batch disposed; disposals completed, completed, rejected, awaiting approval, awaiting validation; three tickets awaiting receipt; one closed and one open audit. — `T-4`
