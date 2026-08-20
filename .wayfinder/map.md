---
type: wayfinder:map
title: HRMS v2.7 role-flow verification — mock data, role & cross-role flows, E2E routing, gap catalog
status: closed
created: 2026-08-17
---

## Destination

HRMS v2.7 verified end-to-end across the full persona matrix: every role, persona,
and lifecycle state seeded with tailored mock data; every per-role and cross-role
flow mapped to the modules it touches with its permitted functions and actions
documented; every full workflow (onboarding → attendance → leave → payroll →
reimbursement → separation) traced E2E with correct inter-role request routing;
and every workflow gap, functional issue, and routing error identified and
recorded. Verification lives as **executable Playwright specs** (source of
truth), with one **living matrix doc** and CONTEXT.md glossary as the only
markdown — no one-time audit reports.

## Notes

- **Domain**: HRMS v2.7 — Next.js 16 App Router + TypeScript + Supabase/PostgreSQL.
  20 modules (M00–M19), 22 gated routes + `/login` public (per ticket `01`;
  note `rbac-routing.ts` does not exist — the permission map lives in
  `roleContext.tsx`). Keep single sources of truth: role/permission config in
  `src/lib/` (`mock-rbac.ts`, `roleContext.tsx`, `types/index.ts`,
  `middleware.ts`), test personas in `e2e/fixtures/test-data.ts` +
  `e2e/global-setup.ts` (ADR 0004), seed CLI in `scripts/seed-mock-data.mjs`.
- **Vocabulary (settled)**: *role* = permission-bearing system role — 5 active
  (employee, manager, hr, payroll_admin, system_admin) + 3 dormant
  (statutory_admin, finance_admin, it_admin — seeded in DB + client map but
  unreachable: no persona/flow/gate; verified by ticket `01`); *persona* = test
  identity (14 defined, incl. `multi_hr_mgr` union, `hr_alt_approver`, lifecycle
  personas); *lifecycle state* = employee status (6 in code: invited, active,
  suspended, notice_period, offboarded, withdrawn — `withdrawn` unmodeled);
  *flow* = a role's or role-pair's journey through modules; *trace* = E2E
  verification that a full workflow routes correctly between roles. Mock-auth
  gate covers all 14 personas (ticket `02`); suspended/offboarded are deny-all.
- **Deliverable shape (settled)**: specs as source of truth — extend existing
  `e2e/specs/roles/`, `e2e/specs/cross-module/`, `e2e/specs/rbac/` suites.
  Gaps are recorded as **closed tracker tickets** (one-line gist on this map),
  not markdown reports.
- **Environment (settled)**: offline-first. Live-Supabase suites self-skip via
  `isSupabaseReachable` (ADR 0004) and are recorded as **pending live backend**,
  never as failed. Status language is strict: "verified" applies only to suites
  that run green offline.
- **Subagents**: cannot be fired in this environment — research tickets are
  resolved by a normal work-through session (use the `research` skill's
  methodology), findings captured on the ticket itself.
- **Verify bar**: `tsc --noEmit`, `npm run build`, `npm run test:unit`, and
  `npx playwright test --list` must stay green throughout. `npm run lint`
  crashes on ESLint config load (pre-existing; CI does not run it) — do not chase it.
- **Skills to consult**: `research` (AFK fact-finding), `grilling` +
  `domain-modeling` (any HITL decision), `code-review` before shipping fixes.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Canonical role, persona & permission inventory](tickets/01-role-persona-inventory.md) — locked 5 active roles (employee/manager/hr/payroll_admin/system_admin; client map == DB grants) + 3 dormant (statutory/finance/it admin — seeded, unreachable); 14 personas, only 8 auth-capable in mock mode; 6 lifecycle states (withdrawn unmodeled); 22 gated routes; 7 claim-vs-code discrepancies (incl. employee_e1 mock over-grant on /payroll) handed to the gap catalog.
- [Mock data for the full persona matrix](tickets/02-mock-data-full-matrix.md) — mock-auth gate extended 8 → 14 personas (suspended/offboarded deny-all; employee_e1's /payroll grant deliberately not propagated); seed script now covers every persona (multi_hr_mgr filled in, m2/e3/e2/alt rounded out) and is idempotent (leave/separation/reimbursement inserts guarded); tsc + 253 unit tests green; DB population **pending live backend** (Supabase unreachable); new D8 candidate (JS seeder vs mock_seed.sql drift).
- [Per-role flow specs covering every module](tickets/03-per-role-flow-specs.md) — role × module coverage matrix locked (spec-asserted per cell); lifecycle coverage stays in a strengthened dedicated suite (LIFE-01 now asserts the forced-password-reset modal; LIFE-05/06/07 added for deny-all/notice); route-matrix persona list not extended (role-determined); suites grew 42 → 65 tests, **chromium 65/65 passed offline**; new D9 (hr /permissions mock-vs-real divergence) + D10 (EMP-06 bakes in the D2 over-grant) candidates for the gap catalog.
- [Cross-role flow combination specs](tickets/04-cross-role-combination-specs.md) — 15 real cross-role workflows matrixed with routing sources + coverage (C1–C15), 2 combos ruled out (system_admin technical-only; payroll_admin no approval perms); GP-01…GP-10 found **smoke-level, not routing traces** (overclaim); new D11 (reimbursement approval_route unenforced — manager_only starts pending_hr, manager_then_hr never two-stages) + D12 (hr_alt deny-all in mock blocks FR §1.4 offline); new cross-role-routing spec — **3 route-level contract tests passed offline**, 3 DB probes pending live backend.
- [E2E golden-path trace & routing verification](tickets/05-golden-path-routing-trace.md) — routing verification matrix for GP-01…GP-10 (chain + handoff primitive + FSM + status); GP smoke specs now honestly self-skip offline (were silently passing weak assertions); new golden-path-routing-trace.spec.ts with 8 seeded-world DB traces (leave→manager, HR→alt, reimbursement stages, anomaly→draft lock, payroll→payslip, separation→F&F, eligibility, org hierarchy); D11/D12 reconfirmed, no new routing errors; cross-module offline **3 passed / 21 skipped** — all action-level traces pending live backend.
- [Living flow & permissions matrix doc](tickets/06-living-flow-matrix-doc.md) — `docs/FLOW_MATRIX.md` is the single living matrix (canonical inventory, real-mode route access with divergence cells, role×module coverage, C1–C15 combos, GP-01…10 + TRACE-01…08, gap summary, sync note); CONTEXT.md gained *Withdrawn* / *Dormant Role* / *Reimbursement Approval Route* glossary terms; user kept the old matrix docs (banner-marked superseded, not canonical).
- [Gap, functional-issue & routing-error catalog](tickets/07-gap-catalog.md) — 16 closed catalog tickets (08–23) below; user reviewed, kept everything including the new D13/D14/D15 divergence family; fixes are out of scope, each ticket records its fix direction.

### Gap catalog (tickets 08–23, all closed)

- [D2 — employee_e1 mock over-grants /payroll](tickets/08-d2-payroll-mock-overgrant.md) — deliberate mock grant vs real 403; fix = drop grant + flip EMP-06.
- [D9 — hr mock over-grants /permissions](tickets/09-d9-hr-permissions-mock-overgrant.md) — mock allows what real `has_permission` denies; FR §1.3 intent to confirm.
- [D11 — reimbursement approval_route unenforced](tickets/10-d11-reimbursement-approval-route-unenforced.md) — two-stage FSM dead: `manager_then_hr` skips HR, `manager_only` skips manager (**functional, most severe**).
- [D12 — hr_alt deny-all in mock](tickets/11-d12-hr-alt-deny-all-in-mock.md) — FR §1.4 alternate-approver flow not exercisable offline.
- [D13 — /encashment gate admits manager+payroll](tickets/12-d13-encashment-gate-divergence.md) — real `leave.view.*` ANY vs mock MGR-10/PAY-10 blocked.
- [D14 — /jobs manager divergence](tickets/13-d14-jobs-manager-divergence.md) — real `job.view` vs mock MGR-06 blocked; old docs contradict each other.
- [D15 — multi_hr_mgr mock under-grants /salary](tickets/14-d15-multi-union-salary-divergence.md) — union `salary.view.all` blocked in mock, unasserted.
- [D3 — dormant roles unreachable](tickets/15-d3-dormant-roles-unreachable.md) — statutory/finance/it admin seeded but no persona/gate.
- [D4 — ROLE_PERMISSIONS_MAP not exported](tickets/16-d4-role-permissions-map-not-exported.md) — unit tests copy the map locally; drift risk.
- [D5 — withdrawn state unmodeled](tickets/17-d5-withdrawn-unmodeled.md) — 6th lifecycle state, no persona/spec.
- [D6 — persona definitions duplicated](tickets/18-d6-persona-definitions-duplicated.md) — fixtures vs seeder, two shapes.
- [D8 — seeder drift](tickets/19-d8-seeder-drift.md) — JS seeder vs `mock_seed.sql` offline fallback.
- [C8 — HR leave fallback no E2E](tickets/20-c8-leave-fallback-no-e2e.md) — hr→system_admin fallback unit-tested only.
- [C15 — comp-off manual credit no spec](tickets/21-c15-compoff-manual-credit-no-spec.md) — `compoff.credit.manual` / `compoff.revoke` unverified.
- [D10 — EMP-06 bakes in D2](tickets/22-d10-emp06-bakes-in-d2.md) — must flip to blocked-route when D2 is fixed.
- [Resolved in-effort: D1 / D7 / GP-overclaim](tickets/23-resolved-in-effort.md) — closed by tickets 02/03/05, recorded for completeness.

## Completed

The destination's artifacts all exist: executable Playwright suites are the
source of truth (`e2e/specs/roles/`, `e2e/specs/cross-module/`, `e2e/specs/rbac/`),
the living matrix is `docs/FLOW_MATRIX.md` (+ CONTEXT.md glossary), and the gap
catalog is tickets 08–23 above. Everything formerly listed under Not yet
specified is delivered: the concrete gap catalog (07), the cross-role
combination matrix (04, C1–C15 + 2 ruled out), and the third/fourth-order role
chains revealed by the trace work (05: TRACE-01…08 + C10's 4-role chain).

## Out of scope

- **Fixing gaps/issues found** — this effort only *identifies* them (the user's
  ask); fixes are separate follow-up efforts, each filed from the gap catalog.
- **Live-backend E2E execution** — offline-first per environment decision; live
  suites self-skip and are recorded as pending, never failed.
- **Anything beyond HRMS v2.7** — e.g. the healthcare-module plans consciously
  removed in the earlier cleanup; they are not part of this destination.
