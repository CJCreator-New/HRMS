---
type: wayfinder:task
id: 13
title: "D14: /jobs — manager divergence + docs contradict each other"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Can a manager view `/jobs`? Real map, one living matrix, and the mock table
disagree.

## Resolution

**Catalog entry — mock↔real divergence (found during the matrix-doc work,
ticket `06`; category: data/routing).**

- Real-mode: the manager role map (`src/lib/roleContext.tsx`) holds
  `job.view`, so the `/jobs` gate (`job.view` / `job.rerun`) passes for a
  manager against a live backend.
- Mock mode + specs assert the opposite: `manager.m1/m2` are denied `/jobs`
  (MGR-06 lists it as a blocked route).
- The pre-existing docs contradict each other: the retired
  `docs/ROLE_FLOW_AND_ACTIONS_MATRIX.md` M17 row grants manager `[View]`,
  while the retired `docs/RBAC_ACCESS_MATRIX.md` marks manager `—`.
- Fix direction (follow-up effort): decide against FR intent whether managers
  may view scheduled jobs. If yes, add `/jobs` to the manager mock routes and
  drop it from MGR-06's blocked list; if no, remove `job.view` from the manager
  role map + DB grants. Update this living matrix accordingly.
- Sibling divergence tickets: `08-d2-payroll-mock-overgrant.md`,
  `09-d9-hr-permissions-mock-overgrant.md`,
  `12-d13-encashment-gate-divergence.md`, `14-d15-multi-union-salary-divergence.md`.
