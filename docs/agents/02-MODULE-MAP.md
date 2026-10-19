# HRMS — Module Map (route → action → service → schema → tests)

Use this to find the right files before editing. Route access is defined in `src/lib/nav/routeConfig.ts` (the gate list, enforced in `src/middleware.ts`). Permission codes are defined in `src/lib/auth/permissions-map.ts` and seeded in `schema/01_rbac.sql`. Pages are under `src/app/<route>/page.tsx`. Components are under `src/components/<module>/`.

Test locations:
- **Unit / service tests:** `src/lib/services/__tests__/` (one file per engine or action, e.g. `payroll-engine.test.ts`), `src/lib/**/__tests__/`, `src/components/**/__tests__/`.
- **Integration (needs live DB):** `src/lib/services/__tests__/integration/`.
- **E2E (Playwright):** `e2e/specs/` — `smoke/`, `rbac/`, `roles/`, `modules/`, `flows/`, `cross-module/` (golden paths `gp01`–`gp10`), `nfr/`, `ui/`, `navigation/`.

| # | Module | Routes | Server actions (`src/lib/actions/`) | Services (`src/lib/services/`) | Schema (`schema/`) | Permissions (prefix) | Tests |
|---|---|---|---|---|---|---|---|
| 1 | **Auth & session** | `/login`, `/auth/confirm`, `/auth/reset-password`, `/403` | `auth.ts`, `sessions.ts` | — | `00_auth_helpers`, `02_org` (lockout columns), `26_…` | — | `src/lib/auth/__tests__/`, `e2e/specs/smoke/auth.spec.ts`, `e2e/specs/rbac/` |
| 2 | **Access control core** | all routes; `src/middleware.ts`, `src/lib/auth/*` | `permissions.ts`, `data.ts` (search scope) | `mock-rbac.ts` | `01_rbac`, `21_rbac_scope_fallback` | all 62 codes | `scripts/verify-permissions-sync.mjs`, `e2e/specs/rbac/route-matrix.spec.ts`, `e2e/specs/rbac/self-approval.spec.ts` |
| 3 | **Employee lifecycle & org** | `/employees`, `/employees/import`, `/onboarding`, `/departments`, `/profile` | `employees.ts`, `departments.ts`, `profile.ts` | `employees.ts`, `mappers.ts`; `src/lib/batch-import/` | `02_org`, `25_atomic_assignment_mutations` | `employee.*` (7) | `src/lib/batch-import/__tests__/`, `e2e/specs/modules/org.spec.ts`, `e2e/specs/flows/onboarding-stepper.spec.ts` |
| 4 | **Work calendar** | `/calendar` | `calendar.ts` | — | `04_work_calendar` | `settings.manage`, `employee.view.self` | `e2e/specs/modules/calendar.spec.ts` |
| 5 | **Attendance & punch** | `/attendance` | `attendance.ts` | `attendance.ts` | `05_attendance` | `attendance.*` (8) | `src/components/attendance/__tests__/`, `e2e/specs/modules/attendance.spec.ts` |
| 6 | **Leave engine** | `/leave` | `leave.ts` | `leave.ts`, `leave-engine.ts`, `leave-routing.ts`, `workflow-steps.ts` | `06_leave`, `12_leave_financial` | `leave.*` (11) | `leave-engine.test.ts`, `leave-sandwich-edge.test.ts`, `leave-routing.test.ts`, `leave-action.test.ts`, `e2e/specs/modules/leave.spec.ts`, `gp03-leave-sandwich.spec.ts`, `golden-path-routing-trace.spec.ts` (TRACE-09: HR→System Admin fallback) |
| 7 | **Short permissions & comp-off** | `/permissions` | `permissions.ts` | — | `06_leave` (`comp_off_grants`) | `permission.*` (3), `compoff.*` (4) | `e2e/specs/modules/permissions.spec.ts`, `gp04-compoff-lifecycle.spec.ts` |
| 8 | **Leave encashment** | `/encashment` | `encashment.ts` | — | `12_leave_financial` | `leave.encash.*` | `e2e/specs/modules/encashment.spec.ts` |
| 9 | **Approvals inbox** | `/approvals` | `approvals.ts` | — | reads across `05`, `06`, `11`, `13` | union of approve permissions | `e2e/specs/flows/approvals.spec.ts`, `e2e/specs/cross-module/` |
| 10 | **Salary structure** | `/salary` | `salary.ts` | — | `07_salary` | `salary.*` (4) | `e2e/specs/modules/salary.spec.ts`, `e2e/specs/rbac/manager-salary.spec.ts` (CTC isolation) |
| 11 | **Payroll eligibility** | `/eligibility` | `eligibility.ts` | `eligibility` reports (see `eligibility-reports-action.test.ts`) | `08_payroll_eligibility` | `payroll.*` | `src/lib/services/__tests__/eligibility-reports-action.test.ts` (no dedicated E2E spec) |
| 12 | **Payroll run & payslips** | `/payroll`, `/payroll/bank-file` | `payroll.ts` | `payroll.ts`, `payroll-engine.ts`, `compensation-engine.ts`, `payroll-bank-file` | `09_payroll`, `23_atomic_payroll_run`, `24_payroll_dirty_triggers` | `payroll.*` (6) | `payroll-engine.test.ts`, `payroll-action.test.ts`, `payroll-bank-file.test.ts`, `integration/payroll.integration.test.ts`, `e2e/specs/modules/payroll.spec.ts`, `e2e/specs/flows/payroll-lifecycle.spec.ts`, `gp01`, `gp02`, `gp09` |
| 13 | **Statutory (PF/ESI/PT/TDS)** | `/statutory`, `/statutory/declarations` | `statutory.ts`, `declarations.ts` | `statutory-engine.ts` | `10_statutory` | `statutory.*` (3) | `statutory-engine.test.ts`, `e2e/specs/modules/statutory.spec.ts`, `gp10-statutory-deductions.spec.ts` |
| 14 | **Reimbursements** | `/reimbursements` | `reimbursements.ts` | — | `11_reimbursements` | `reimbursement.*` (5) | `reimbursements-action.test.ts`, `e2e/specs/modules/reimbursements.spec.ts`, `gp05-expense-to-payslip.spec.ts` |
| 15 | **Offboarding & F&F** | `/offboarding` | `offboarding.ts` | `offboarding-engine.ts` | `13_ff_settlement` | `separation.*`, `ff.*`, `offboarding.manage` | `offboarding-engine.test.ts`, `offboarding-action.test.ts`, `integration/offboarding.integration.test.ts`, `e2e/specs/modules/offboarding.spec.ts`, `flows/offboarding-stepper.spec.ts`, `gp06-resignation-to-ff.spec.ts` |
| 16 | **Documents & attachments** | `/documents` | `attachments.ts` | — | `14_attachments` | `attachment.*` (2) | `attachments-audit-action.test.ts`, `e2e/specs/modules/attachments.spec.ts` |
| 17 | **Assets (new, uncommitted)** | `/assets` | `assets.ts` | — | `27_assets` | `employee.view.all`, `offboarding.manage`, `settings.manage` | `assets-action.test.ts` (no E2E yet) |
| 18 | **Audit trail** | `/audit` | `audit.ts` | — | `15_audit` (triggers + `audit_logs`) | `audit.view` | `e2e/specs/modules/audit.spec.ts`. **Read review F-01 and F-02 before touching.** |
| 19 | **Notifications** | `NotificationsBell`, `/settings/notifications` | `notifications.ts` | `notifications.ts` | `16_notifications` | — | `src/components/shared/__tests__/` (no E2E yet) |
| 20 | **Settings & policy** | `/settings`, `/settings/sessions` | `settings.ts`, `sessions.ts` | — | `03_settings` | `settings.manage` | `e2e/specs/modules/settings.spec.ts` |
| 21 | **Global search** | `GlobalSearchPalette` (every page) | `data.ts` (`globalSearchAction`) | — | `18_search` | scoped by role | `data-action.test.ts`, `e2e/specs/ui/command-palette.spec.ts` |
| 22 | **Dashboards & reports** | `/` (dashboard), `/reports` | `reports.ts` | `dashboard.ts`, `reports-engine.ts` | `19_reports`, `20_performance_optimizations`, `22_…indexes` | `reports.*` | `dashboard.test.ts`, `reports-engine.test.ts`, `e2e/specs/navigation/dashboard.spec.ts`, `e2e/specs/modules/reports.spec.ts` |
| 23 | **Scheduled jobs** | `/jobs` | `jobs.ts` | — | `17_scheduled_jobs` | `job.*` | `e2e/specs/modules/jobs.spec.ts`, `scripts/test-db-triggers.mjs` |
| 24 | **Health** | `/api/health` | — | — | — | public | `src/app/api/health/__tests__/` |

## Cross-cutting utilities

| Concern | Location |
|---|---|
| Permission guard (server) | `src/lib/auth/assertPermission.ts` (`assertPermission`, `assertAnyPermission`, `assertCallerIdentity`) |
| Client permission hook | `src/lib/auth/usePermission.ts` — UX only, never a substitute for server guards |
| Mock session cookie | `src/lib/auth/mock-cookie.ts` |
| Rate limiting | `src/lib/auth/rate-limit.ts` (`checkLoginRateLimit`) |
| CSRF / origin check | `validateRequestOrigin` (used by mutating auth actions) |
| Supabase clients | `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/actions, user-scoped), `admin.ts` (service role — background jobs and tests only) |
| Idempotency keys | `src/lib/services/idempotency.ts` (`assertIdempotencyKey`, used on payroll runs) |
| Date handling (IST) | `src/lib/utils/date-utils.ts` (`getTodayDateStringIST`) — never `toISOString().split("T")[0]` |
| Log redaction | `src/lib/utils/logger.ts` (`REDACTED_KEYS`: salary, CTC, PAN, Aadhaar, bank account, IFSC, UAN) |
| Route gates | `src/lib/nav/routeConfig.ts`, enforced in `src/middleware.ts` |
| Mock personas | `src/lib/services/mock-rbac.ts`, `scripts/seed-mock-data.mjs`, `schema/mock_seed.sql` |

## Personas (manual and E2E testing)

Defined in `README.md` ("Seeded Test Personas"). Use the persona that matches the module you change. Two rules the tests depend on: `employee.e1` must never reach `/payroll` (route gate), and `hr.alt@company.com` exists to exercise HR self-approval delegation.

## Golden paths

GP-01 Hire-to-payslip · GP-02 Anomaly-to-lock · GP-03 Leave sandwich · GP-04 Comp-off lifecycle · GP-05 Expense-to-payslip · GP-06 Resignation-to-F&F · GP-07 HR self-approval · GP-08 Multi-role union · GP-09 Salary proration · GP-10 Statutory deductions. Specs: `e2e/specs/cross-module/gp01…gp10`. Routing traces (`TRACE-*`): `golden-path-routing-trace.spec.ts`. Flow reference: `docs/FLOW_MATRIX.md`.
