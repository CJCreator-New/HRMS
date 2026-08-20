---
type: wayfinder:task
id: 16
title: "D4: ROLE_PERMISSIONS_MAP not exported — unit tests copy it"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

How can unit tests drift from the real permission map?

## Resolution

**Catalog entry — drift risk (category: data/maintainability).**

- `ROLE_PERMISSIONS_MAP` is a module-private `const` in
  `src/lib/roleContext.tsx` and is never exported.
- `mock-rbac.test.ts` and `rbac-routing.test.ts` each maintain a **local
  copy** of the map to assert against — two more copies beside the client map
  and the DB grants, all of which ticket `01` had to verify list-by-list by
  hand.
- Fix direction (follow-up effort): extract the map to its own module
  (e.g. `src/lib/rbac/permissions.ts`), export it, and have roleContext + both
  test files import it — eliminating the copy-drift class of bug.
