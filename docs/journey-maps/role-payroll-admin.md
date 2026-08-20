# Journey Map — Payroll Admin (Today vs After)

> Written from the shipped UI (verified against `src/app/*`), not aspirational prose.

## Today (as implemented)

1. **Dashboard** (`/`) — "Payroll Operations Workspace" greeting; next-actions
   include **Open Payroll**; Payroll Status widget links into the wizard.
2. **Payroll cycle** (`/payroll`) — **5-step guided stepper** (WS-C C1,
   FLW-01/02) bound to `payroll_periods.status`
   (`draft → processing → validated → finalized → published`):
   - Period & Revision selector with `StatusBadge`.
   - **Execute Bulk Run** (`run-payroll-btn`) → eligibility engine widget →
     payslip register (`DataTable`, en-IN currency, `view-payslip-btn`).
   - **Finalize & Lock** (`finalize-payroll-btn`) — gated by
     `validatePayrollLockAction` (lock check).
   - **Reopen for Revision** (`reopen-payroll-btn`) bumps `active_revision`.
   - Success toasts carry "Review payslips ↓" next-step links (F-06).
3. **Payslip print** (`/payroll`) — payslip modal with `print-payslip-btn`;
   `@media print` + `body.printing-payslip` isolate the statement (M-10).
4. **Eligibility** (`/eligibility`) — effective-dated eligible/ineligible flags
   per employee (hand-rolled table; execution open item).
5. **Statutory** (`/statutory`) — statutory profiles with edit via shared
   `Modal`; PF/ESI/PT/TDS amounts now `formatCurrencyIndian` (ticket 04).
6. **Salary** (`/salary`) — versioned salary structures with mid-month pro-rata
   preview; en-IN currency + `formatDateIndian` effective ranges (ticket 04).
7. **Read-only ops views** — attendance/leave show the `ReadOnlyBanner`
   ("Payroll Admin View") since the payroll admin holds no operational edit
   permissions (RBAC-04).

## Pain points observed (from the audit)

- The payroll run previously scattered run/finalize buttons across the page;
   the stepper now makes the cycle explicit and lock-gated.
- Payroll admin pages beyond `/payroll` (`eligibility`, `salary`, `statutory`
   header/table) remain hand-rolled — execution open items (ticket 08).

## Target (what the shipped UI already delivers)

- A guided, lock-verified payroll cycle with versioned revisions and a
  print-ready payslip.
- Dashboard "Open Payroll Wizard" entry point; toast links down to the register.
- Locale-correct currency and dates on the payroll register/modal and the
  support pages after the WS-D sweep.

## Where the target is not yet met

- `eligibility` / `salary` / `statutory` page consistency (DataTable/PageHeader/
  Toast adoption) — execution open items.
- Live-backend E2E for the stepper flows recorded as pending (needs Supabase).

_Last updated: 2026-08-14 (design-flow audit)._
