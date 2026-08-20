---
type: wayfinder:task
id: 03
title: Per-role flow specs covering every module
status: closed
assignee: buffy
blockedBy: [01, 02]
parent: map
created: 2026-08-17
---

## Question

What does verified per-role coverage look like — for each persona, which modules
(M00–M19) must its flow specs exercise, and which permitted functions/actions per
module does each spec assert? (Decision: the role × module coverage matrix the
extended `e2e/specs/roles/` suites must satisfy.)

Baseline: all 14 personas now authenticate offline (mock gate extended in
ticket `02`'s resolution — suspended/offboarded are deny-all; the
route-matrix spec's 7-persona list and the gate's 14 no longer mirror each
other — decide whether to extend `DISTINCT_ROLE_PERSONAS`).

Work (AFK):

- **Lifecycle-coverage shape (fog graduated from the map by ticket `01`):**
  decide here — parameterized additions to the employee role suite vs a
  dedicated suite — given that lifecycle personas exist only as `employee`
  personas and currently can't authenticate in mock mode (see ticket `02`'s
  baseline; seeded state: invited/active/suspended/notice_period/offboarded
  personas, `withdrawn` unmodeled).
- Audit existing `e2e/specs/roles/*.spec.ts` (7 suites) against the 20-module
  inventory from ticket `01`; build the coverage matrix and mark every
  role × module cell as covered / uncovered / not-permitted.
- Extend the suites so every permitted function and action per role per module
  is exercised and asserted (UI state + DB state via `db.fixture.ts`), preserving
  all existing `data-testid`s.
- Keep suites offline-green (self-skip live-backend assertions per ADR 0004).

Resolved when the role × module coverage matrix is fully asserted by specs and
recorded on this ticket (it feeds the living matrix doc, ticket `06`).

## Resolution

**Coverage matrix (role × module, all asserted by `e2e/specs/roles/`).**
Modules M00 (infra) / M16 (notifications, shell-level) / M18 (search, no
route) have no per-role routes; M01 = /settings + /permissions (sysadmin),
M02 = /employees + import/onboarding/departments, M03 = /settings,
M04 = /calendar, M05 = /attendance, M06 = /leave, M07 = /salary,
M08 = /eligibility, M09 = /payroll, M10 = /statutory, M11 = /reimbursements,
M12 = /encashment, M13 = /offboarding, M14 = /documents, M15 = /audit,
M17 = /jobs, M19 = /reports.

| Role | Modules exercised (spec) | Modules blocked (spec) |
|---|---|---|
| employee | M02 EMP-13 · M04 EMP-04 · M05 EMP-02 · M06 EMP-03 · M07 EMP-05 · M09 EMP-06 (mock over-grant, D2) · M11 EMP-07 · M12 EMP-08 · M13 EMP-09 · M14 EMP-11 · M16 EMP-12 (short-permission apply) | M01/M02-import/M15/M17/M19 EMP-10 · M16-approvals/M08/M10/M19/M02-import EMP-14 |
| manager | M04 MGR-10 ✓ · M05 MGR-02 · M06 MGR-03 · M11 MGR-04 · M13 MGR-09 · M14 MGR-08 · M16-approvals MGR-01 · M16-permissions MGR-07 | M07 MGR-05 (FR §5.8) · M01/M02-import/M08/M15/M17 MGR-06 · M09/M10/M12/M19/M02-import MGR-10 |
| hr | M02 HR-01…04 · M04 HR-05 · M05/M11 HR-11 · M06 HR-09 · M07/M10 HR-13 · M12 HR-07 · M13 HR-06 · M14/M15/M03 HR-12 · M16-approvals HR-10 · M19 HR-08 | M08/M09 HR-14 |
| payroll_admin | M05/M06 (read-only) PAY-05 · M07 PAY-02 · M08 PAY-04 · M09 PAY-01 · M10 PAY-03 · M11/M13/M14 PAY-08 · M19 PAY-07 · M02 PAY-09 | M01/M02-import/M03/M17 PAY-06 · M15/M16-approvals/M12/M16-permissions PAY-10 |
| system_admin | M01 SYS-02 · M03 SYS-01 · M04/M10/M11/M12/M14/M02 SYS-06 · M15 SYS-03 · M17 SYS-04 + bypass SYS-05 | — (bypass; system_admin denies nothing) |
| multi_hr_mgr (union) | M02-import/M03/M10/M14/M15/M17/M19 MULTI-03 · M16 MULTI-01/02 · M04/M06/M11/M12/M13 MULTI-01 | M08/M09 MULTI-04 |
| lifecycle states | invited reset LIFE-01 · notice workspace LIFE-07 · suspended/offboarded revoked LIFE-05/06 (+ data-level LIFE-02/03/04, pending live backend) | suspended/offboarded deny-all LIFE-05/06 |

**Decisions.**
1. **Lifecycle-coverage shape (graduated fog)**: dedicated suite retained and
   strengthened — lifecycle behaviors are state-specific, not role-specific
   (state personas exist only as `employee`); the role suites stay
   role-specific. LIFE-01 rewritten from a vacuous `body`-visible assertion to
   asserting the forced-password-reset modal (mock mustChangePassword:true);
   LIFE-05/06/07 added (suspended/offboarded deny-all, notice keeps access).
2. **Route-matrix `DISTINCT_ROLE_PERSONAS` not extended**: route access is
   role-determined; manager_m2/employee_e3 are data variants of covered roles
   and add no new route facts — they belong to the cross-role specs (ticket
   `04`). Lifecycle personas' route access is asserted in the lifecycle suite.

**Spec work: 42 → 65 tests.** EMP-11…14, MGR-07…10, HR-10…14, PAY-07…10,
SYS-06, MULTI-03/04 added; lifecycle suite rewritten (7 tests); SYS-05 title
corrected (22 gated routes + /login, not 24). All new assertions are
middleware/render-level, offline-safe in mock mode, matching suite style.

**Verification (offline, mock auth, no DB).** `tsc --noEmit` ✓ · `npm run
build` ✓ · `playwright test --list` 455 (7 projects × 65) ✓ · **chromium roles
suite: 65/65 passed (3.5 min)** — the matrix above is verified against the
running app, not just code-read. Data-level assertions (approval actions,
balances, payroll exclusion) remain pending live backend per ADR 0004.

**New gap-catalog candidates.**
- **D9**: hr reaching `/permissions` is a documented deliberate mock grant
  (`DELIBERATE_EXTRA_GRANTS`), but real-mode `has_permission` denies it (hr
  lacks `permission.approve`) — mock/real divergence like D2; verify intent
  against FR §1.3.
- **D10**: EMP-06 bakes the D2 over-grant into the suite (employee → /payroll
  ALLOW asserted) — when D2 is fixed, EMP-06 must flip to a blocked-route
  assertion. Cross-referenced so the gap catalog can action both.
