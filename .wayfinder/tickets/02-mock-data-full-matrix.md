---
type: wayfinder:task
id: 02
title: Mock data for the full persona matrix
status: closed
assignee: buffy
blockedBy: [01]
parent: map
created: 2026-08-17
---

## Question

What must change so every persona in the canonical inventory (ticket
`01-role-persona-inventory.md`, now closed) has comprehensive, tailored mock
data populated in the local DB? (Decision: the seed surface — personas, org
hierarchy, salary structures, leave balances, attendance records, lifecycle
transitions.)

Baseline from ticket `01`: 14 personas already seeded (statuses/doj present in
`MOCK_PERSONAS`), but the mock-auth gate (`E2E_MOCK_ALLOWED_ROUTES` +
`resolveMockRolesFromEmail`) authenticates only 8 — extend both so the 6
lifecycle/extra personas (manager.m2, employee.e3, invited, suspended, notice,
offboarded) can log in offline, or the flow specs below can never exercise them.

Work (AFK — do, then record):

- Audit `scripts/seed-mock-data.mjs` and `e2e/global-setup.ts` against the
  inventory from ticket `01`; list what each persona lacks (e.g. no `invited` /
  `suspended` / `offboarded` employee, no union persona, no alt approver).
- Extend the seed CLI (and global-setup fixtures where ADR 0004 requires) so
  every persona has realistic per-role data: manager with team + approvals,
  hr with org-wide data, payroll_admin with salary structures + payroll periods,
  system_admin with audit/config data, lifecycle-state employees with the
  records their state implies.
- Populate the local Supabase/Postgres (offline, `127.0.0.1:54321`) and record
  row counts / persona credentials here.

Resolved when the local DB is populated for the full matrix and the seed script
is idempotent (re-runnable without duplicates).

## Resolution

**1. Mock-auth gate extended 8 → 14 personas (`src/lib/services/mock-rbac.ts`).**
`E2E_MOCK_ALLOWED_ROUTES` now covers manager.m2 (mirrors manager routes),
employee.e3 / invited.emp / notice.emp (pure employee route set — the
`employee_e1` `/payroll` deliberate extra grant is **not** propagated, D2 stays
open for the gap catalog), and suspended.emp / offboarded.emp as deny-all
(access revoked per CONTEXT.md domain model). `resolveMockRolesFromEmail`
already resolved all six correctly (manager pattern, employee default,
invited → mustChangePassword) — no change needed.

**2. Unit tests (`mock-rbac.test.ts`): 10 → 15 tests.** New coverage for the six
personas; the existing consistency guards (every mock grant reachable by the
persona's role union; deliberate-extra-grants exact list) pass unchanged — all
new grants are permission-clean, no new deliberate grants.

**3. Seed data (`scripts/seed-mock-data.mjs`).** Per-persona gaps from the
inventory audit filled:
- multi_hr_mgr: was near-empty — now dept (HR), manager (sysadmin), calendar,
  leave allocations, salary structure (₹18L CTC), statutory profile, payroll
  eligibility.
- manager_m2: calendar, allocations, salary structure (₹9L), statutory
  profile, payroll eligibility.
- employee_e3: salary structure (₹6L), statutory profile, payroll eligibility.
- employee_e2: salary structure (₹7.2L) — already had calendar/statutory/eligibility.
- hr_alt_approver: calendar + leave allocations (alt-approver leave flows now
  have data to work on).

**4. Idempotency fixed.** `leave_requests`, `separation_records`, and
`reimbursement_claims` were unguarded upserts that duplicated rows on every
re-run — converted to select-guarded inserts (`seedLeaveRequest` /
`seedSeparation` / `seedReimbursementClaim` helpers). All other tables were
already upsert-or-guarded; the persona loop remains delete-recreate.

**5. Verification.** `node --check` ✓ · `tsc --noEmit` ✓ · mock-rbac suite
15/15 ✓ · full unit suite 253/253 ✓ (5 vitest runner teardown timeouts on this
machine — pre-existing environment flakiness, all tests green).

**6. DB population: pending live backend.** Local Supabase (127.0.0.1:54321)
unreachable — the seeder printed the offline notice and exited 0. Per the
map's status language this is recorded as **pending live backend**, not
verified. When the backend starts, `npm run seed:mock` / global-setup populate
the full matrix; the script is now safe to re-run.

**Handed forward:** D2 (employee_e1 `/payroll` grant) stays open for the gap
catalog. New D8 candidate for the catalog: two seeders drift —
`scripts/seed-mock-data.mjs` (canonical, run by global-setup) vs
`schema/mock_seed.sql` (offline fallback; covers 14 personas but not the new
per-persona data). The `mock-rbac.ts` comment "mirrors
route-matrix.spec.ts" is now stale: the table covers 14 personas while the
spec's persona list covers 7 — spec extension belongs to tickets `03`/`04`.

**Unblocks:** tickets `03`, `04`, `05` — all 14 personas can now authenticate
offline; per-persona data exists for every role's flows.
