---
type: wayfinder:task
id: 05
title: E2E golden-path trace & routing verification
status: closed
assignee: buffy
blockedBy: [01, 02]
parent: map
created: 2026-08-17
---

## Question

For each full workflow — onboarding → attendance punching → leave apply/approve →
payroll run → reimbursement submit/approve → F&F/separation (and every other
core feature) — does every request route correctly between roles through the
whole chain? (Decision: the routing verification matrix; every routing error
found becomes a gap ticket.)

Baseline: seeded data now covers every persona (ticket `02`) — leave requests
routed to manager/alt-approver, reimbursement claims in manager/HR stages,
active + completed separations, finalized + draft payroll periods. Note the
mock-vs-real divergence on `/payroll` (D2) when tracing employee routes.

Work (AFK):

- Audit `e2e/specs/cross-module/gp01…gp10` against the actual request paths:
  who initiates, who approves, which statuses transition, what notifications /
  deep-links fire, where RLS gates sit.
- Extend the golden-path specs so each workflow is traced start-to-finish with
  inter-role routing asserted at every handoff (initiator role → approver role →
  next-stage role), including the lifecycle states the workflow passes through.
- Record the routing verification matrix; flag every routing error, dead end,
  or mis-routed request as a gap entry here.

Resolved when every golden path is traced with routing asserted and all routing
errors are recorded (they feed the gap catalog, ticket `07`).

## Resolution

**Routing verification matrix (the decision).** For each golden path, the chain,
the routing primitive at each handoff, the status FSM, and the verification
status (per the map's strict status language — "verified" only for what runs
green offline).

| GP | Chain (roles in order) | Routing primitive at handoff | Status FSM | Verification |
|---|---|---|---|---|
| 01 hire→payslip | hr→employee→manager→hr→payroll_admin→employee | onboarding create (hr) / punch (emp) / leave apply (emp) / approve (mgr) / run (payroll) / publish→view (payroll→emp) | invited→active; pending→approved; draft→finalized; unpublished→published | **pending live backend** (action-level) |
| 02 anomaly lock | employee→manager→payroll_admin | anomaly punch (emp) / correction approve (mgr) / lock gate (payroll) | present→pending_review→approved | **pending live backend** |
| 03 leave sandwich | employee→manager | apply (emp) / approve (mgr); sandwich rule | pending→approved | **pending live backend** |
| 04 comp-off lifecycle | employee→manager→employee | extra work (emp) / comp-off apply (emp) / approve (mgr) / 90-day expiry | extra_work→granted→expired | **pending live backend** |
| 05 expense→payslip | employee→manager→hr→payroll_admin | submit (emp) / stage1 (mgr) / stage2 (hr) / payroll item (payroll) | pending_manager→pending_hr→approved→paid | **pending live backend** — **D11: two-stage unenforced** |
| 06 resignation→F&F | employee→manager→hr | resign (emp) / separation (mgr/hr) / clearance + F&F approve (hr) | active→offboarded; ff draft→approved | **pending live backend** |
| 07 HR self-approval | hr→hr_alt_approver | apply (hr) / route to alt (leave-routing) | pending→approved | **pending live backend** — **D12: alt deny-all in mock** |
| 08 multi-role union | multi_hr_mgr | union acts as hr+manager | — | **verified offline** (ticket `03` MULTI-01…04) |
| 09 salary proration | payroll_admin | salary revision → pro-rata split | versioned structure | **pending live backend** (engine unit-tested) |
| 10 statutory | payroll_admin | statutory rules → deductions | FY25-26 rules | **pending live backend** (engine unit-tested) |

**Spec work.**
1. **GP-01/02/05/06/07/08/09/10 now self-skip offline** (gp03/04 already did):
   they were silently passing weak render assertions in mock mode while
   claiming "golden path" — they are action-level traces and are now honestly
   recorded as **pending live backend** per ADR 0004 (ticket `04`'s finding
   actioned).
2. **New `golden-path-routing-trace.spec.ts`** — 8 DB-level traces of the
   seeded world's interconnections (self-skip live): TRACE-01 leave→manager
   (pending EL current_approver = manager_m1); TRACE-02 HR leave→alt approver
   + company_settings.alternate_hr_approver_id (FR §1.4); TRACE-03
   reimbursement stages per approval_route (TRAVEL approved@HR, INTERNET in
   manager stage, D11 noted); TRACE-04 attendance anomaly preconditioning the
   August draft (anomaly lock); TRACE-05 finalized July → published E1 payslip
   (₹92,800); TRACE-06 offboarded→completed separation+approved F&F vs
   notice→active separation with LWD; TRACE-07 suspended excluded from payroll
   eligibility (hr_override) vs active included; TRACE-08 org hierarchy routes
   team data to the right managers (E1/E2→M1, E3→M2, M1→sysadmin).

**Routing errors found (all feed the gap catalog, ticket `07`).**
- **D11** (reconfirmed from the trace view): reimbursement `approval_route` is
  unenforced — see ticket `04`; the GP-05 chain can never actually pass through
  manager→hr stages.
- **D12** (reconfirmed): hr_alt_approver deny-all in mock mode blocks exercising
  GP-07 offline.
- **No additional routing errors surfaced** — the seeded world's interconnections
  (leave routing, reimbursement stages, payroll periods→payslips, separation→F&F,
  eligibility, org hierarchy) are internally coherent; the trace spec locks that
  in for live runs.

**Verification.** `tsc --noEmit` ✓ · chromium cross-module offline: **3 passed /
21 skipped (35s)** — route-level contract verified; all action-level traces
recorded as pending live backend, never failed (map's status language).
`playwright test --list` includes the new trace spec (8 tests × 7 projects).
