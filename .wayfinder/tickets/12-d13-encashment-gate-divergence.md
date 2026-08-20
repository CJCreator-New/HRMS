---
type: wayfinder:task
id: 12
title: "D13: /encashment gate admits manager & payroll in real mode"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Is `/encashment` restricted to employees + HR as the mock table and role specs
assert, or open to manager and payroll_admin as the real permission map implies?

## Resolution

**Catalog entry — mock↔real divergence (found during the matrix-doc work,
ticket `06`; category: data/routing).**

- Real-mode: `/encashment` gate (`routeConfig.ts`) is ANY of
  `leave.encash.apply.self`, `leave.encash.approve`,
  `leave.view.self|team|all` — a broad gate. The manager role map holds
  `leave.encash.apply.self` (+ `leave.view.self`), and payroll_admin holds
  `leave.view.all`, so **both pass the gate against a live backend**.
- Mock mode + specs assert the opposite: `manager.m1/m2` and `payroll` are
  denied `/encashment` (MGR-10, PAY-10 list it as a blocked route).
- Fix direction (follow-up effort): tighten the gate to
  `leave.encash.apply.self` / `leave.encash.approve` only (dropping the
  `leave.view.*` catch-all), then align the mock table + PAY-10 to the real
  result — or, if managers may self-apply for encashment, keep the real map
  and flip MGR-10 instead. Decide against FR §5.x/§4.x intent.
- Sibling divergence tickets: `08-d2-payroll-mock-overgrant.md`,
  `09-d9-hr-permissions-mock-overgrant.md`,
  `13-d14-jobs-manager-divergence.md`, `14-d15-multi-union-salary-divergence.md`.
