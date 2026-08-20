---
type: wayfinder:task
id: 11
title: "D12: hr_alt_approver is deny-all in mock mode"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Why can't the FR §1.4 alternate-HR-approver flow be exercised offline?

## Resolution

**Catalog entry — mock↔real limitation (category: data/coverage).**

- `E2E_MOCK_ALLOWED_ROUTES` sets `hr.alt@company.com` → `[]` (deny-all,
  documented as "secondary test persona for negative / alternate testing").
- In real mode `hr_alt_approver` is a functional approver: seeded as
  `company_settings.alternate_hr_approver_id` and targeted by
  `leave-routing.ts` (FR §1.4 self-approval bypass). The mock thus cannot
  represent it as an actor — GP-07 and CR-C7 can't drive the FR §1.4 flow
  offline.
- Fix direction (follow-up effort): give `hr.alt` the same route set as
  `hradmin` (it resolves to the `hr` role via `resolveMockRolesFromEmail`
  already), so the alternate-approver inbox is reachable in mock mode; then
  extend GP-07 to an action-level trace.
