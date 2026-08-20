---
type: wayfinder:task
id: 09
title: "D9: hr mock over-grants /permissions"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Why can `hradmin` reach `/permissions` in mock mode when real-mode
`has_permission` denies it, and is the mock or the real model correct?

## Resolution

**Catalog entry — mock↔real divergence (category: data/routing).**

- `E2E_MOCK_ALLOWED_ROUTES` grants `hradmin@company.com` `/permissions` and it
  is a documented `DELIBERATE_EXTRA_GRANTS` entry.
- The `/permissions` gate is `permission.apply.self` / `permission.approve`
  (`routeConfig.ts`). The `hr` role map holds neither — real-mode
  `has_permission` denies, so `/permissions` 403s for HR against a live
  backend.
- FR §1.3 intent needs confirming (the fix effort): if HR should approve short
  permissions, add `permission.approve` to the `hr` role map + DB grants and
  keep the mock grant; otherwise remove the mock grant (mirroring the D2
  resolution pattern).
- Sibling divergence tickets: `08-d2-payroll-mock-overgrant.md`,
  `12-d13-encashment-gate-divergence.md`, `13-d14-jobs-manager-divergence.md`,
  `14-d15-multi-union-salary-divergence.md`.
