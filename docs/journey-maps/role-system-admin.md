# Journey Map — System Admin (Today vs After)

> Written from the shipped UI (verified against `src/app/*`), not aspirational prose.

## Today (as implemented)

1. **Dashboard** (`/`) — "System Administration Workspace" greeting;
   next-actions include **Company Settings** (`settings.manage`). Policy warning
   banner surfaces the initial-configuration gate with a **Configure Settings →
   link**.
2. **Settings** (`/settings`) — zero-seed configuration gate: company identity
   (name/timezone/currency), HR alternate-approver routing, manager SLA,
   notice-period default → `updateCompanySettingsAction`; status chip flips to
   "System Unlocked (is_configured = true)". Hand-rolled page (execution open
   item).
3. **Audit trail** (`/audit`) — append-only audit log viewer with server-side
   search (debounced) and immutable badge. Hand-rolled table (execution open
   item).
4. **Jobs** (`/jobs`) — scheduled job logs + manual `runScheduledJobAction`
   triggers for cron-style jobs (EL accrual, comp-off expiry, carry-forward).
   Hand-rolled (execution open item).
5. **Reports** (`/reports`) — report catalog cards with category filters and
   CSV/PDF export (`generateReportDataAction`, `export-report-btn`). Hand-rolled
   (execution open item).
6. **RBAC / permissions** (`/permissions`) — short-permission self-service
   (employee-facing form); role permission management is backend/schema-scoped.
7. **Breadcrumbs everywhere** — the admin routes all sit under the shared shell
   with breadcrumbs, `aria-current` sidebar, and per-route loading shells
   (WS-A, ticket 01).

## Pain points observed (from the audit)

- Admin pages (`settings`, `audit`, `jobs`, `reports`) are functional but
  visually inconsistent with the flagship pages — they hand-roll headers,
  banners, and tables. All are execution open items (ticket 08).
- Dashboard config-gate status is a banner, not a persistent status widget;
   the settings route remains the single configuration surface.

## Target (what the shipped UI already delivers)

- Breadcrumbs + role-aware dashboard + next-actions across every admin route.
- Settings gate reachable in one click from the dashboard warning banner.
- Audit/jobs/reports reachable from the sidebar with loading shells and proper
  error/404 boundaries.

## Where the target is not yet met

- Admin page adoption of the shared pattern library (PageHeader/Toast/DataTable/
  StatusBadge) — execution open items (audit ticket 08).
- No CI/CD or dark-mode/i18n work (explicitly out of the plan's scope).

_Last updated: 2026-08-14 (design-flow audit)._
