---
type: wayfinder:task
id: 06
title: Living flow & permissions matrix doc
status: closed
assignee: buffy
blockedBy: [03, 04, 05]
parent: map
created: 2026-08-17
---

## Question

What does the single living document of role × module × permitted actions and
cross-role flows contain, now that verification (tickets `03`, `04`, `05`) has
established the facts? (Decision: the doc's shape, contents, and home — HITL
sign-off at the end.)

Work (HITL — the human reviews and signs off):

- Draft the living doc from the verified coverage matrices: per-role flows,
  cross-role combinations, and permitted functions/actions per role per module —
  generated from what the specs actually assert, not from claims.
- Keep it minimal: one doc (living matrix) + any CONTEXT.md glossary terms the
  verification surfaced (per the domain-modeling skill), replacing the
  one-time audit reports this effort deliberately does not produce.
- Present the draft to the user for sign-off; record the decision (location,
  contents, naming) on this ticket.

## Resolution

**The living doc exists and is signed off (HITL).**

- **Location / naming**: `docs/FLOW_MATRIX.md` ("HRMS v2.7 — Living Flow,
  Permissions & Cross-Role Matrix"), the single living matrix doc per the map's
  destination.
- **Contents**: canonical inventory (ticket `01`), real-mode route access
  matrix computed from `roleContext.tsx` + `routeConfig.ts` + `middleware.ts`
  (divergence cells flagged D2/D9/D13/D14/D15), role × module coverage matrix
  (ticket `03`), cross-role combination matrix C1–C15 (ticket `04`), golden-path
  routing verification matrix GP-01…GP-10 + TRACE-01…08 (ticket `05`), a gap
  summary table, and a sync note. All cells derive from what the specs assert.
- **CONTEXT.md glossary**: three terms surfaced by the verification were added —
  *Withdrawn Employee* (unmodeled state, D5), *Dormant Role* (D3), and
  *Reimbursement Approval Route* (`approval_route`, D11).
- **HITL decision (user, 2026-08-17)**: keep the pre-existing
  `docs/RBAC_ACCESS_MATRIX.md`, `docs/ROLE_FLOW_AND_ACTIONS_MATRIX.md`, and
  `docs/journey-maps/` alongside — **not** deleted. A one-line superseded
  banner was added to each of the two matrix docs so their stale claims
  (24 routes, 5 lifecycle states, V-vectors) aren't mistaken for canonical.
- **Sync**: the doc's own section 7 states it must be regenerated whenever the
  spec suites change; new gaps found while editing it must become catalog
  tickets, not prose.

Verification: no code changed; `tsc --noEmit` / `npm run test:unit` /
`playwright test --list` re-run green during this ticket's work.
