# Journey Map — Manager (Today vs After)

> Written from the shipped UI (verified against `src/app/*`), not aspirational prose.

## Today (as implemented)

1. **Dashboard** (`/`) — "Manager Workspace" greeting; next-actions include
   **Review Approvals** when the manager holds any approve permission. Pending
   Approvals widget shows the inbox queue entry point.
2. **Approvals inbox** (`/approvals`) — unified queue across leave, attendance
   corrections, reimbursements, encashment, F&F. Features delivered by WS-C:
   - Server-side pagination + sort via `DataTable` (M-09).
   - **Detail drawer** (F-03): row `view-approval-btn` → `Drawer` with
     `getApprovalDetailAction` fields (dates, reason, requester, amounts);
     Approve/Reject act from inside the drawer (`approve-in-drawer-btn` /
     `reject-in-drawer-btn`).
   - **Batch approve** (F-04/UX-02): `select-all-approvals` + per-row
     checkboxes → `approve-selected-btn` loops `decideApprovalAction`.
   - Parental-leave masking: maternity/paternity reasons redacted for
     non-HR-admin viewers.
   - Decision toasts include "Review remaining approval(s) →" next-step links
     (F-06).
3. **Team attendance** (`/attendance`) — correction requests queue with
   Approve / Reject (reject behind shared `ConfirmDialog`, H-12) and
   `StatusBadge` statuses.
4. **Leave approvals** — `/leave` ledger Approve/Reject for the manager's team
   (reject now behind `ConfirmDialog` after ticket 02).
5. **Salary** — manager without `salary.view.*` gets the explicit
   "Salary Visibility Restricted" card (FR §5.8); the route stays navigable but
   content is gated.

## Pain points observed (from the audit)

- Approvals decisions previously fired with no confirmation on leave/reject;
  attendance had confirmation. Now both reject paths confirm (H-12).
- The manager must remember which module a request came from — the unified
  inbox + module filter chips mitigate this.
- `/attendance` still uses a hand-rolled header/notice (open item, ticket 08).

## Target (what the shipped UI already delivers)

- One inbox for all approval types with detail drawer + batch approve — no
  hopping between modules to guess where a request lives.
- Role-aware dashboard puts "Review Approvals" one click away.
- Notifications deep-link pending items to the approvals route (F-05).
- Destructive decisions are confirmed; toasts link onward to the remaining
  queue.

## Where the target is not yet met

- `/attendance` visual consistency (PageHeader/Toast) — execution open item.
- No per-team analytics on the dashboard for managers (not in design-flow
  scope; flow work only re-orchestrates existing actions).

_Last updated: 2026-08-14 (design-flow audit)._
