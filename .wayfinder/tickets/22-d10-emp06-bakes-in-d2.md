---
type: wayfinder:task
id: 22
title: "D10: EMP-06 bakes the D2 /payroll over-grant into the suite"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

What happens to EMP-06 when D2 is fixed?

## Resolution

**Catalog entry — spec coupling (category: coverage).**

- `e2e/specs/roles/role-employee.spec.ts` EMP-06 asserts the employee persona
  can reach `/payroll` — an ALLOW assertion that only holds because of the D2
  mock over-grant (`employee.e1`). It is not a real-mode fact.
- Coupled to catalog ticket `08-d2-payroll-mock-overgrant.md`: when D2 is
  resolved to match real mode (mock grant removed), EMP-06 must flip to a
  blocked-route assertion (same shape as EMP-10/EMP-14) in the same change.
- Fix direction is therefore owned by the D2 fix; this ticket exists so the
  two are never done separately.
