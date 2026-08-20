---
type: wayfinder:research
id: 01
title: Canonical role, persona & permission inventory
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

What is the canonical inventory this effort verifies against — the settled list
of roles, personas, and lifecycle states, with each one's permissions and route
gates? (Decision: lock the matrix that every other ticket's specs and mock data
must cover.)

Read the code, don't guess:

- `src/lib/types/index.ts` — the roles union
- `src/lib/services/mock-rbac.ts` + `src/lib/services/rbac-routing.ts` — mock role resolution & `ROLE_PERMISSIONS_MAP`
- `src/lib/roleContext.tsx` — client-side role unions & gate logic
- `src/middleware.ts` — route-gating middleware (system_admin bypass)
- `src/lib/services/leave-routing.ts` — cross-role approver resolution
- `e2e/fixtures/test-data.ts` + `e2e/global-setup.ts` — personas seeded today (ADR 0004)
- `docs/adr/0001…0005` + `CONTEXT.md` — accepted decisions & glossary

Deliver: the canonical 5-role × persona × lifecycle-state matrix with per-role
permissions, and any mismatch between what code defines and what fixtures/seed
currently cover (e.g. missing personas, stale role names).

## Resolution

Inventory locked from code (primary sources: `src/lib/types/index.ts`,
`src/lib/roleContext.tsx`, `src/lib/services/mock-rbac.ts`, `src/middleware.ts`,
`src/lib/actions/auth.ts`, `src/lib/nav/routeConfig.ts`, `schema/01_rbac.sql`,
`e2e/fixtures/test-data.ts`, `scripts/seed-mock-data.mjs`, ADR 0001–0005).

**Roles — 5 active, 3 dormant.** Active: `employee` (16 perms), `manager` (29),
`hr` (34), `payroll_admin` (17), `system_admin` (5 + middleware bypass + full
client-side union). Client `ROLE_PERMISSIONS_MAP` (roleContext.tsx) == DB
`role_permissions` grants for all 5 active roles (verified list-by-list).
Dormant: `statutory_admin` (7), `finance_admin` (8), `it_admin` (7) — seeded in
schema + client map, but **no persona, no route gate, no login resolution, no
UI switcher entry anywhere**. Schema comment even lists only the 5 active codes
while seeding 8.

**Personas — 14 defined, 8 auth-capable in mock mode.** `e2e/fixtures/test-data.ts`
and `scripts/seed-mock-data.mjs` each define the same 14 (duplicated, slightly
different shapes — drift risk). Mock-auth (cookie = email) works only for the 8
emails in `E2E_MOCK_ALLOWED_ROUTES`: sysadmin (ALL), hradmin, payroll,
manager.m1, employee.e1, employee.e2 (deny-all), multi.hrmgr (hr+manager),
hr.alt (deny-all). The other 6 — manager.m2, employee.e3, invited.emp,
suspended.emp, notice.emp, offboarded.emp — are **403'd at the middleware in
mock mode** (unknown email → deny). `resolveMockRolesFromEmail` covers 7 email
patterns; `invited` → mustChangePassword:true is the only lifecycle signal.

**Lifecycle states — 6 in code, 5 modeled.** `invited`, `active`, `suspended`,
`notice_period`, `offboarded`, `withdrawn` (TS union + DB). Personas exist for
the first five; `withdrawn` has none.

**Routes — 22 gated + `/login` public (+ `/403` open).** `ROUTE_CONFIG` has 23
entries; the RBAC matrix spec covers 22 routes × 7 personas = 154 cases.

**Cross-role routing primitives (for tickets 04/05):** `leave-routing.ts`
resolves approvers (manager via `employee_manager_assignment`, or
`alternate_hr_approver_id` → system_admin fallback for HR applicants);
`has_permission` RPC does `.self/.team/.all` scope matching;
`acted_as_approver` grants historical approval views; system_admin bypasses
all middleware gates.

**Claim-vs-code discrepancies (hand to gap catalog, ticket 07):**
- **D1** — 6 personas can't authenticate in mock mode (middleware 403);
  lifecycle spec `LIFE-01` logs in `invited.emp` with `TempPass2026!` while the
  seeder sets `Password123!`, and asserts only `body` visible — vacuous.
- **D2** — `employee_e1` mock table + RBAC matrix spec allow `/payroll`
  (asserted ALLOW), but the route gate (`payroll.view|payroll.run`) and real
  `has_permission` deny it — mock mode is more permissive than real mode.
- **D3** — 3 dormant roles defined but unreachable (no personas/flows/gates).
- **D4** — `ROLE_PERMISSIONS_MAP` is not exported; `mock-rbac.test.ts` and
  `rbac-routing.test.ts` copy it locally → unit tests can drift from the real map.
- **D5** — `withdrawn` status unmodeled (no persona, no spec).
- **D6** — persona definitions duplicated across fixtures and seed script
  (two shapes, two files, no shared source).
- **D7** — ticket text named `src/lib/services/rbac-routing.ts` as a source;
  it does not exist — the map lives in `roleContext.tsx`. (`rbac-routing.test.ts`
  tests its own local copy, cf. D4.)
