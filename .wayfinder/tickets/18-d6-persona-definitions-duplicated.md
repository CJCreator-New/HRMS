---
type: wayfinder:task
id: 18
title: "D6: persona definitions duplicated across fixtures and seed script"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Why do persona definitions exist in two places with different shapes?

## Resolution

**Catalog entry — drift risk (category: data/maintainability).**

- The same 14 personas are defined twice: `e2e/fixtures/test-data.ts` and
  `scripts/seed-mock-data.mjs` (slightly different field shapes; ticket `01`
  flagged the duplication).
- Ticket `02` filled both out and guarded the seed inserts, but the two files
  remain the source of drift for any future persona change (e.g. the D13–D15
  route-list edits would need touching in both).
- Fix direction (follow-up effort): promote a single shared persona source
  (e.g. a JSON/TS module imported by the seed CLI and the fixtures) and derive
  the mock RBAC table from it where possible.
