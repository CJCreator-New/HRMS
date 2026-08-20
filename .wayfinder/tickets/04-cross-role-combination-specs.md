---
type: wayfinder:task
id: 04
title: Cross-role flow combination specs
status: closed
assignee: buffy
blockedBy: [01, 02]
parent: map
created: 2026-08-17
---

## Question

Which cross-role combinations are real workflows in this app, and what specs
prove each one routes correctly between roles? (Decision: the cross-role
combination matrix — which pairs/triples get specs and what each spec asserts.)

Baseline: all 14 personas authenticate offline now (ticket `02`); union
persona (multi_hr_mgr) and alt approver (hr_alt_approver) both have seeded
data (dept, calendar, allocations, salary, statutory) to drive flows with.

Work (AFK):

- Enumerate candidate combinations from the routing code (e.g.
  `src/lib/services/leave-routing.ts` approver resolution, approval workflows):
  employee→manager, employee→hr, manager→hr, hr→payroll_admin, hr_alt_approver
  edge, multi_hr_mgr union behavior, system_admin→any, and any 3-role chains
  the flow mapping surfaces.
- For each combination that is a real workflow, add/extend Playwright specs
  (new `e2e/specs/cross-module/` specs or additions to `e2e/specs/roles/`)
  asserting the request reaches the right role at the right stage with the
  right status transitions.
- Record the combination matrix on this ticket; combinations ruled out are
  noted with the reason.

Resolved when every real cross-role combination is spec-verified offline-green.

## Resolution

**Cross-role combination matrix (the decision) — 15 real workflows, 2 ruled out.**
Routing sources read: `leave-routing.ts`, `actions/reimbursements.ts`,
`actions/permissions.ts`, `actions/encashment.ts`, `actions/approvals.ts`,
`services/mappers.ts`, `schema/19_reports.sql` (approvals view),
`schema/11_reimbursements.sql`.

| # | Combination | Workflow | Routing source | Coverage |
|---|---|---|---|---|
| C1 | employee→manager | leave approval | leave-routing (employee_manager_assignment) | GP-03 smoke + CR-C1 probe + CR-ROUTE-01 ✓ |
| C2 | employee→manager | attendance correction | attendance.correct.approve | modules/attendance (live) + CR-ROUTE-01 ✓ |
| C3 | employee→manager | short permission | permissions.ts (manager_id) | modules/permissions (live) + CR-ROUTE-01 ✓ |
| C4 | employee→manager→hr | reimbursement manager_then_hr | reimbursements.ts initialStatus | GP-05 smoke + CR-C4 probe (**D11**: two-stage unimplemented) |
| C5 | employee→hr | reimbursement manager_only | reimbursements.ts initialStatus=pending_hr | CR-C4 probe (**D11**: starts pending_hr, skips manager) |
| C6 | employee→hr | encashment | leave.encash.approve | modules/encashment (live) + CR-ROUTE-01 ✓ |
| C7 | hr→hr_alt_approver | HR leave self-approval (FR §1.4) | leave-routing alt_hr | GP-07 smoke + CR-C7 probe (**D12**: alt deny-all in mock) |
| C8 | hr→system_admin | leave fallback (no alt approver) | leave-routing fallback | unit-tested only (leave-routing.test.ts) — **no E2E, gap** |
| C9 | manager→hr | offboarding / F&F | ff.approve | GP-06 smoke |
| C10 | employee→manager→hr→payroll_admin | hire→payslip full chain | GP-01 | GP-01 smoke |
| C11 | hr→payroll_admin | payroll run after approvals | payroll.run | GP-01/02 smoke + CR-ROUTE-03 ✓ |
| C12 | payroll_admin→employee | payslip publish→view | payroll.publish | GP-01 smoke |
| C13 | multi_hr_mgr (union) | acts as hr AND manager | union perms | GP-08 smoke + MULTI-01…04 (ticket `03`, verified) ✓ |
| C14 | manager→employee | comp-off approval | compoff.approve | GP-04 smoke |
| C15 | hr→employee | comp-off manual credit / revoke | compoff.credit.manual | **no spec, gap** |

**Ruled out (recorded, not fog):** system_admin has no operational approval
flows beyond the C8 leave fallback (technical-only role: settings/audit/jobs);
payroll_admin holds no approval perms (read-only ops per PAY-05) so no approval
combos; finance_admin/it_admin/statutory_admin are dormant (D3) — no combos.

**Findings (hand to gap catalog, ticket `07`).**
- **GP-01…GP-10 are smoke-level, not routing traces** — every one asserts
  render / not-403, never an action-level handoff (e.g. GP-01 checks each role
  can open a page; it never onboards → punches → approves → runs payroll). The
  "golden path" naming overclaims; action-level tracing is ticket `05`'s job.
- **D11 — reimbursement approval_route is not enforced.**
  `submitReimbursementClaimAction` sets initialStatus from
  `manager_then_hr`→pending_manager else pending_hr, but
  `decideApprovalAction` flips status straight to approved with **no stage
  transition**, and `v_pending_approvals_dashboard` surfaces all pending claims
  to anyone holding reimbursement.approve (manager AND hr). Net effect:
  manager_only claims start at pending_hr (skipping the manager) and
  manager_then_hr claims finalize at the manager stage without HR. Verify live
  (CR-C4 probe) then action.
- **D12 — hr_alt_approver is deny-all in mock mode** (`E2E_MOCK_ALLOWED_ROUTES`)
  but is a functional approver in real mode (FR §1.4, seeded as
  alternate_hr_approver_id). The FR §1.4 flow can't be exercised via UI
  offline; CR-C7 probe covers it live.

**Spec work.** New `e2e/specs/cross-module/cross-role-routing.spec.ts`:
CR-ROUTE-01/02/03 assert the route-level routing contract (initiators reach
submit surfaces but not /approvals; manager+hr reach the inbox, payroll_admin
doesn't; payroll boundary) — **verified offline**. CR-C1/C7/C4 are DB routing
probes that self-skip until a live backend (ADR 0004).

**Verification.** `tsc --noEmit` ✓ · chromium cross-role-routing: **3 passed /
3 skipped (1.1 min)** — route-level contract verified against the running app;
DB probes pending live backend. `playwright test --list` includes the new file
(6 tests × 7 projects).
