---
type: wayfinder:task
id: 21
title: "C15: comp-off manual credit / revoke has no spec"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Where is the hr→employee comp-off manual credit / revoke workflow verified?

## Resolution

**Catalog entry — coverage gap (category: coverage).**

- The cross-role matrix (ticket `04`) records C15 (hr→employee, driven by
  `compoff.credit.manual` / `compoff.revoke`) as a real workflow with **no
  spec**. Neither the role suites nor cross-module suite assert the manual
  credit or revoke actions (GP-04 covers only the employee-claims path).
- Fix direction (follow-up effort): add a cross-module spec (or CR-C15 probe)
  that credits a comp-off day as HR and asserts the ledger + 90-day expiry,
  plus a revoke assertion.

**Refined during the follow-up spec work (2026-08-17):** `compoff.credit.manual`
/ `compoff.revoke` exist **only as permission strings** in the role map — no
action handler implements them anywhere in `src/lib/actions/`. The gap is
therefore **functional (missing feature)**, not only a coverage hole. The new
TRACE-10 probe + seeded `comp_off_grants` row (in
`scripts/seed-mock-data.mjs`) document the intended manual-credit contract
(HR approver, 90-day expiry via `computeCompOffExpiryDate`, linked extra-work
event).
