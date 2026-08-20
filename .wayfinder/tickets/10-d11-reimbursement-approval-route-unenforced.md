---
type: wayfinder:task
id: 10
title: "D11: reimbursement approval_route is unenforced"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Does the reimbursement two-stage approval workflow actually route through
manager → hr as `approval_route` promises?

## Resolution

**Catalog entry — functional issue (the most serious finding; category:
functional/routing).** Confirmed in code (ticket `04` + `05`, trace TRACE-03):

- `submitReimbursementClaimAction` (`src/lib/actions/reimbursements.ts`) sets
  `initialStatus` from `approval_route`:
  `manager_then_hr` → `pending_manager`, anything else → `pending_hr`.
- `decideApprovalAction` (`src/lib/actions/approvals.ts`) then updates status
  **directly to `approved`** with no stage transition — so:
  - `manager_then_hr` claims finalize at the manager stage without ever
    reaching HR (the two-stage chain is dead code).
  - `manager_only` claims start at `pending_hr`, skipping the manager entirely.
- `v_pending_approvals_dashboard` surfaces every pending claim to anyone
  holding `reimbursement.approve` (manager AND hr), masking the missing stages.
- Fix direction (follow-up effort): enforce stage FSM — manager approval moves
  `pending_manager → pending_hr`, HR approval moves `pending_hr → approved`;
  scope the dashboard view by the acting role's stage; add the CR-C4 live
  probe to green before closing.
