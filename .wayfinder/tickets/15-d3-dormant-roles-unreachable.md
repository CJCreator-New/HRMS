---
type: wayfinder:task
id: 15
title: "D3: dormant roles defined but unreachable"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

What is the state of `statutory_admin`, `finance_admin`, and `it_admin`?

## Resolution

**Catalog entry — inventory gap (category: data/coverage).**

- All three are seeded in `schema/01_rbac.sql` and present in the client
  `ROLE_PERMISSIONS_MAP` (7–8 perms each), but none has: a persona, a route
  gate, a login resolution in `resolveMockRolesFromEmail`, or a UI role
  switcher entry. The schema comment even lists only the 5 active codes while
  seeding 8.
- Consequence: dead configuration surface with no way to exercise it; dormant
  roles are excluded from every matrix in the living doc.
- Fix direction (follow-up effort): either remove them from schema + client map
  (if the product truly ships 5 roles) or wire one persona + gates per role.
