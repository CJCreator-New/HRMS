# Journey Map — HR Admin (Today vs After)

> Written from the shipped UI (verified against `src/app/*`), not aspirational prose.

## Today (as implemented)

1. **Dashboard** (`/`) — "HR Operations Workspace" greeting; next-actions
   include **Direct Onboard** (`employee.create`) and **Review Approvals**.
   Headcount widget summaries active employees.
2. **Onboarding** (`/onboarding`) — **2-step guided flow** (WS-C C3, FLW-04):
   Step 1 Identity & Org Assignment (code, name, email, phone, DOJ, roles),
   Step 2 Credentials Review & Confirm with temp-password generation
   (ADR 0001 unchanged) → `createEmployeeAction` → "Status: Invited".
   `Stepper` shows progression.
3. **Employee directory** (`/employees`) — shared `PageHeader`, server-side
   `DataTable` with search/pagination/sort (M-09), `StatusBadge`, shared
   `Modal` for effective-dated assignment, and **Revoke Access behind
   `ConfirmDialog`** (H-12). "Bulk CSV Import" links to `/employees/import`.
4. **Bulk import** (`/employees/import`) — CSV upload with line-item result
   table (hand-rolled page; execution open item).
5. **Approvals** (`/approvals`) — same unified inbox as the manager plus HR
   permissions; F&F and leave approvals; drawer detail + batch approve.
6. **Offboarding** (`/offboarding`) — **separation stepper** (WS-C C2, FLW-03)
   bound to the separation FSM: resignation → notice → clearance (IT/Finance/
   Admin/HR board) → F&F draft → approval. `approve-ff-btn` requires all
   clearances; stale-settlement banner surfaces leave-ledger drift.
7. **Calendar / departments / documents** (`/calendar`, `/departments`,
   `/documents`) — holiday templates + optional selection, department master,
   attachment register (hand-rolled pages; execution open items).

## Pain points observed (from the audit)

- Onboarding/offboarding are now guided (steppers), but the surrounding
  org pages (`departments`, `calendar`, `documents`, `employees/import`) still
  hand-roll headers/modals/tables; `departments` modals lack the shared focus
  trap (H-11 bypass) — recorded as execution open items.
- The leave page (flagship) was partially migrated; completed in the audit
  (PageHeader, reject confirmation, DateText).

## Target (what the shipped UI already delivers)

- Stepped onboarding with temp password; stepped offboarding with clearance +
  F&F; unified approvals with F&F detail + batch.
- Notifications deep-link (onboarding → employees, F&F → offboarding).
- Consistent flagships (approvals/leave/employees/payroll/offboarding) on the
  shared pattern library.

## Where the target is not yet met

- Remaining org pages (departments, calendar, documents, employees/import,
  onboarding header) migration — execution open items (audit ticket 08).
- No cross-role workspace/task-assignment UI (not in design-flow scope).

_Last updated: 2026-08-14 (design-flow audit)._
