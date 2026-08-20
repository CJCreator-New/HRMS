# Journey Map — Employee (Today vs After)

> Written from the shipped UI (verified against `src/app/*`), not aspirational prose.

## Today (as implemented)

1. **Dashboard** (`/`) — role-aware greeting (`ROLE_GREETINGS[activeRole]`) and a
   "Get Started" next-actions strip built from permissions: Punch Attendance,
   Apply for Leave, Review Approvals (if granted), Open Payroll (if granted).
   Attendance widget shows today's punch status; `formatDateIndian` date.
2. **Punch** — the dashboard punch widget or `/attendance`:
   `punch-in-btn` / `punch-out-btn` → `punchCheckInAction` /
   `punchCheckOutAction`; a `notice` banner confirms the punch.
3. **Apply leave** — `/leave`: leave-type select, duration type, date range,
   reason → `applyLeaveAction`; success toast carries a **Track in Approvals →
   next-step link** (F-06). Balance cards show allocated/used/balance and the
   Sandwich Rule toggle.
4. **Track requests** — `/leave` ledger shows status via `StatusBadge`; date
   range now `formatDateIndian` (M-08). Own requests are also reachable via the
   notification bell deep-links (F-05).
5. **Reimbursements / encashment** — `/reimbursements` (claim submit + approval
   queue read-only), `/encashment` (26-day-divisor calculator + request).
   Success toasts carry next-step links.
6. **Payslip** — `/payroll` register → `view-payslip-btn` → payslip modal →
   `print-payslip-btn` (M-10 print CSS isolates the payslip).

## Pain points observed (from the audit)

- Attendance and leave flows still use hand-rolled `notice` banners where
  employees see them (attendance); leave uses the shared Toast. (Open item:
  attendance banner → Toast.)
- `/approvals` drawer shows request detail but the employee normally tracks via
  the leave ledger, not the approvals inbox (they lack approve permissions).
- Salary visibility is gated; manager roles get an explicit restricted card.

## Target (what the shipped UI already delivers)

- Dashboard next-actions surface the three most common employee journeys
  (punch, leave, payslip/approvals) in one click — no hunting through the
  sidebar.
- Leave apply → toast with inline "Track in Approvals →" link; comp-off toast
  includes expiry date.
- Notification bell deep-links pending requests straight to the source route.
- All visible dates are DD-MMM-YYYY; currency is en-IN.

## Where the target is not yet met

- `/attendance` header + `notice` banner are not yet on shared primitives
  (PageHeader / Toast) — tracked as an execution open item (audit ticket 08).
- Employee-facing "apply → track" guidance on reimbursements/encashment relies
  on the toast link only; no persistent "my requests" summary on the dashboard
  (not in scope — flow work only re-orchestrates existing actions).

_Last updated: 2026-08-14 (design-flow audit)._
