---
type: wayfinder:task
id: 07
title: Gap, functional-issue & routing-error catalog
status: closed
assignee: buffy
blockedBy: [03, 04, 05]
parent: map
created: 2026-08-17
---

## Question

Which findings from the per-role, cross-role, and trace work (tickets `03`, `04`,
`05`) qualify as workflow gaps, functional issues, or routing errors — and how
are they recorded so they survive cleanup? (Decision: the final gap catalog —
the destination's last artifact; HITL review.)

Work (HITL — the human reviews the catalog):

- Consolidate every gap/issue/error flagged by tickets `03`–`05`; dedupe and
  categorize (functional, routing, data, coverage).
- Record each as a **closed tracker ticket** under this map (status: closed,
  one-line gist appended to the map's Decisions so far) — the format that
  survives repo cleanup, replacing the deleted one-time audit reports.
- Present the catalog to the user; anything the user rules out of scope is
  recorded there instead of in the catalog.

## Resolution

**The catalog is complete and reviewed (HITL).** Every gap/issue/error flagged
by tickets `01`–`05` — plus three mock↔real divergences found while grounding
 the living matrix (ticket `06`) — is recorded as a **closed catalog ticket**
under `.wayfinder/tickets/` (files `08`…`23`, all `parent: map`, one-line gists
on the map's Decisions so far).

| # | Gap | Ticket | Category |
|---|---|---|---|
| D2 | `employee_e1` mock over-grants `/payroll` | `08-d2-payroll-mock-overgrant.md` | mock↔real |
| D9 | `hradmin` mock over-grants `/permissions` | `09-d9-hr-permissions-mock-overgrant.md` | mock↔real |
| D11 | reimbursement `approval_route` unenforced (two-stage dead) | `10-d11-reimbursement-approval-route-unenforced.md` | **functional** |
| D12 | `hr_alt` deny-all in mock blocks FR §1.4 offline | `11-d12-hr-alt-deny-all-in-mock.md` | mock↔real |
| D13 | `/encashment` gate admits manager+payroll in real mode | `12-d13-encashment-gate-divergence.md` | mock↔real |
| D14 | `/jobs` — manager `job.view` real vs blocked mock/spec | `13-d14-jobs-manager-divergence.md` | mock↔real |
| D15 | `multi_hr_mgr` mock under-grants `/salary` | `14-d15-multi-union-salary-divergence.md` | mock↔real |
| D3 | dormant roles defined but unreachable | `15-d3-dormant-roles-unreachable.md` | data |
| D4 | `ROLE_PERMISSIONS_MAP` not exported; tests copy it | `16-d4-role-permissions-map-not-exported.md` | data |
| D5 | `withdrawn` lifecycle state unmodeled | `17-d5-withdrawn-unmodeled.md` | data |
| D6 | persona definitions duplicated (fixtures vs seeder) | `18-d6-persona-definitions-duplicated.md` | data |
| D8 | seeder drift (`seed-mock-data.mjs` vs `mock_seed.sql`) | `19-d8-seeder-drift.md` | data |
| C8 | HR-leave fallback→system_admin has no E2E | `20-c8-leave-fallback-no-e2e.md` | coverage |
| C15 | comp-off manual credit/revoke has no spec | `21-c15-compoff-manual-credit-no-spec.md` | coverage |
| D10 | EMP-06 bakes the D2 over-grant into the suite | `22-d10-emp06-bakes-in-d2.md` | coverage |
| — | D1 / D7 / GP-01…10 overclaim — resolved in-effort | `23-resolved-in-effort.md` | resolved |

**User review (2026-08-17)**: all entries kept — including the three new
mock↔real divergence tickets (D13/D14/D15). Nothing ruled out of scope.

**Fixes are explicitly out of scope** for this effort (map); each ticket
records the fix direction for a follow-up effort, and the most severe
(D11) is a confirmed functional defect in `approvals.ts` +
`reimbursements.ts`.
