---
type: wayfinder:task
id: 08
title: "D2: employee_e1 mock over-grants /payroll"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Why does the mock table let `employee_e1` reach `/payroll` while real-mode
RBAC denies it, and what should happen about it?

## Resolution

**Catalog entry — mock↔real divergence (category: data/routing).**

- `E2E_MOCK_ALLOWED_ROUTES` (`src/lib/services/mock-rbac.ts`) grants
  `employee.e1@company.com` `/payroll` — recorded as a
  `DELIBERATE_EXTRA_GRANTS` entry in `mock-rbac.test.ts` (mock over-grant).
- The `/payroll` route gate (`payroll.view` / `payroll.run`,
  `src/lib/nav/routeConfig.ts`) and the real `has_permission` RPC deny an
  `employee` — the employee role map holds no `payroll.*` permission
  (`src/lib/roleContext.tsx`).
- Net effect: mock mode is **more permissive than real mode** on `/payroll`
  for this one persona, and EMP-06 (`e2e/specs/roles/role-employee.spec.ts`)
  bakes the grant in as an ALLOW assertion (see catalog ticket `22-d10-emp06-bakes-in-d2.md`).
- Fix direction (for a follow-up effort, not this one): either remove the mock
  grant and flip EMP-06 to a blocked-route assertion (preferred — matches real
  behavior), or grant `employee` `payroll.view`-equivalent access in real mode
  if FR intends payslip access via a separate route. See also the sibling
  divergence tickets `09-d9-hr-permissions-mock-overgrant.md`,
  `12-d13-encashment-gate-divergence.md`, `13-d14-jobs-manager-divergence.md`,
  `14-d15-multi-union-salary-divergence.md`.
