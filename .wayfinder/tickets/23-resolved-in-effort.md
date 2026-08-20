---
type: wayfinder:task
id: 23
title: "Resolved in-effort: D1, D7, GP-01…10 overclaim"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Which flagged findings were resolved during this verification effort rather
than surviving as gaps?

## Resolution

**Catalog entry — resolved in-effort (recorded so the record is complete).**

- **D1** (ticket `01`): 6 personas couldn't authenticate in mock mode +
  LIFE-01 was vacuous. Resolved by ticket `02` (mock gate extended 8 → 14;
  suspended/offboarded are deny-all **by design**) and ticket `03` (LIFE-01
  rewritten to assert the forced-password-reset modal). No surviving gap.
- **D7** (ticket `01`): ticket text named `src/lib/services/rbac-routing.ts`,
  which does not exist — the permission map lives in `roleContext.tsx`.
  Resolved in the ticket `01` resolution itself; the surviving *substance*
  (rbac-routing.test.ts copies the map locally) is cataloged as
  `16-d4-role-permissions-map-not-exported.md`.
- **GP-01…GP-10 overclaim** (ticket `04` finding): the former "golden path"
  smokes were render-level, not routing traces. Resolved by ticket `05`: the
  GP specs now self-skip offline and honestly record **pending live backend**,
  and a real trace spec (`golden-path-routing-trace.spec.ts`, TRACE-01…08) was
  added. The routing-verification facts live in the living matrix doc, section
  5.
