---
type: wayfinder:task
id: 20
title: "C8: HR leave fallback to system_admin has no E2E"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Where is the HR-leave-without-alt-approver fallback verified end to end?

## Resolution

**Catalog entry — coverage gap (category: coverage).**

- `src/lib/services/leave-routing.ts` falls back to system_admin when an HR
  applicant has no `alternate_hr_approver_id` set — but the fallback is only
  unit-tested (`leave-routing.test.ts`). No Playwright spec drives the
  hr→system_admin handoff (GP-07 covers only the alternate-approver branch).
- Fix direction (follow-up effort): add a GP-07 variant (or CR-C8 probe) that
  seeds `alternate_hr_approver_id = NULL` and asserts the HR leave request
  routes to the system_admin approver with a visible approval inbox entry.

**Implemented (2026-08-17):** TRACE-09 in `golden-path-routing-trace.spec.ts`
+ a seeded fallback scenario in `scripts/seed-mock-data.mjs`. The seeded
scenario exercises the self-approval guard branch instead of NULL-ing
`company_settings` (which TRACE-02 depends on): `hr_alt_approver` applies for
leave and, being the configured alternate themselves, falls back to the
system_admin approver via `resolveLeaveApprover`. A UI/action-level trace of
the inbox entry remains pending live backend.
