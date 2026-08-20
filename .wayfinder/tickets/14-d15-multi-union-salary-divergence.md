---
type: wayfinder:task
id: 14
title: "D15: multi_hr_mgr mock under-grants /salary"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Does the union persona get `/salary` in mock mode like it does in real mode?

## Resolution

**Catalog entry — mock↔real divergence (found during the matrix-doc work,
ticket `06`; category: data/routing).**

- Real-mode: `multi_hr_mgr` = cumulative union of `hr` + `manager`. `hr` holds
  `salary.view.all`, so the `/salary` gate passes for the union persona.
- Mock mode: `multi.hrmgr@company.com`'s route list omits `/salary` — the mock
  blocks what real mode allows. No spec covers the cell either way
  (MULTI-04 blocks only `/payroll` + `/eligibility`), so the under-grant is
  unasserted, not deliberately asserted.
- Fix direction (follow-up effort): add `/salary` to `multi.hrmgr` mock routes
  and a MULTI assertion for the union salary view (or, if FR intends the union
  to hide salary, remove `salary.view.all` from `hr` — but that contradicts the
  standalone HR journey).
- Sibling divergence tickets: `08-d2-payroll-mock-overgrant.md`,
  `09-d9-hr-permissions-mock-overgrant.md`,
  `12-d13-encashment-gate-divergence.md`, `13-d14-jobs-manager-divergence.md`.
