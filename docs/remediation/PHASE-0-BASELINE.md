# HRMS v2.7 — Phase 0 Repository Forensics Baseline Report

**Execution Date:** August 2026  
**Auditor / Remediation Engineer:** Antigravity Senior Staff Engineer  
**Baseline Status:** COMPLETED (Read-Only Forensics & Verification)  
**Target State:** HRMS v2.7 Production Certification  

---

## 1. Executive Summary & Forensic Verification Scope

This Phase 0 Baseline Report establishes the objective, unvarnished baseline of the HRMS v2.7 codebase prior to executing production remediations. In accordance with Global Engineering Rules, no assumptions were made regarding prior audit reports. Every file, function, schema definition, and test suite was directly inspected and executed against the repository.

### Key Baseline Findings:
1. **Repository Health Baseline:**
   - `npm run verify:permissions`: **PASS** (62 unique permissions across 8 roles synchronized).
   - `npx tsc --noEmit`: **PASS** (0 errors).
   - `npm run lint`: **PASS** (0 errors, 175 warnings in tests for explicit `any`).
   - `npm run test:unit`: **PASS** (49 test files, 443 tests passing in 13.48s with `fileParallelism: false`).
2. **Schema & Migration Baseline:**
   - 25 modular schema files (`00_setup.sql` through `24_payroll_dirty_triggers.sql` + `bootstrap/01_system_admin.sql`) synchronized via `scripts/db-apply.mjs` into `schema/combined_init.sql`.
   - GiST exclusion constraints (`exclude using gist`) are implemented on assignment tables (`employee_department_assignment`, `employee_manager_assignment`, `employee_designation_assignment`, `employee_work_calendar_assignment`).
3. **Discrepancies & Remediation Targets Identified:**
   - **Payroll Fallback Risk:** `executeBulkPayrollRunAction` in `src/lib/actions/payroll.ts` contains a fallback `Promise.all` upsert if `supabase.rpc("execute_atomic_payroll_run")` returns an error. This violates Rule 1D (no production fallback bypassing atomicity).
   - **Timezone & Date String Handling:** Multiple actions still construct date strings using `new Date().toISOString().split("T")[0]` instead of centralized, IST-safe helper methods in `src/lib/utils/date-utils.ts`. Furthermore, `previousDateString` in `date-utils.ts` internally calls `.toISOString().split("T")[0]`.
   - **Assignment Updates Atomicity:** `updateEmployeeAssignmentAction` in `src/lib/actions/employees.ts` and `assignCalendarAction` in `src/lib/actions/calendar.ts` perform separate `update` and `insert` database calls across network boundaries instead of single atomic RPCs.
   - **Reimbursement Concurrency on Rejection:** While approvals use `.eq("status", claim.status)`, rejection in `approveReimbursementClaimAction` only checked `.eq("id", claimId)` without conditional state matching.
   - **Attachment Security Validation:** While MIME and extension allowlists exist, strict filename sanitization (checking null bytes, directory traversal patterns `..`, and empty filenames) requires hardening.
   - **Structured Logging & Redaction:** `logger.ts` needs comprehensive redaction keys (including salary components and auth tokens) and CRLF injection defenses.

---

## 2. Available Commands in `package.json`

| Script Name | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000 -H 0.0.0.0` | Launch local Next.js development server |
| `build` | `next build` | Next.js production build |
| `lint` | `eslint src` | ESLint static code analysis |
| `verify:permissions` | `node scripts/verify-permissions-sync.mjs` | Verifies RBAC sync between `schema/01_rbac.sql` and `permissions-map.ts` |
| `db:sync` | `node scripts/db-apply.mjs` | Regenerates `schema/combined_init.sql` from modular schema files |
| `seed:mock` | `node scripts/seed-mock-data.mjs` | Seeds mock data into Supabase instance |
| `test:unit` | `vitest run` | Runs Vitest unit & component tests |
| `test:coverage` | `vitest run --coverage` | Generates Vitest V8 code coverage report |
| `test:e2e` | `playwright test --project=chromium` | Runs Chromium Playwright E2E tests |
| `test:e2e:p0` | `playwright test e2e/specs/smoke e2e/specs/rbac --project=chromium` | Runs P0 smoke and RBAC E2E tests |
| `test:e2e:full` | `playwright test` | Runs complete Playwright test suite across browsers |
| `test:golden-path` | `playwright test e2e/specs/cross-module/golden-path-routing-trace.spec.ts` | Runs golden path routing trace tests |
| `setup:test-db` | `node scripts/setup-supabase-test.mjs` | Configures test database schema and seeds |

---

## 3. Actual Schema Structure & Migration Order

The schema is divided into 25 modular migration files in `schema/` managed by `scripts/db-apply.mjs`:

1. `00_setup.sql`: `pgcrypto`, `btree_gist`, `set_updated_at()`, `system_idempotency_keys`, `register_idempotency_key()`
2. `01_rbac.sql`: Roles, permissions, role-permission mappings, `has_permission()`, `has_any_permission()`, RLS helpers
3. `02_org.sql`: `employees`, `employee_status`, `departments`, `employee_department_assignment`, `employee_manager_assignment`, `employee_designation_assignment`, `employee_current_manager` view, `is_current_manager_of()`, `separation_records`
4. `03_settings.sql`: `company_settings`, `feature_flags`, system configuration
5. `04_work_calendar.sql`: `work_calendar_templates`, `holidays`, `employee_work_calendar_assignment`, `is_working_day()`
6. `05_attendance.sql`: `attendance_records`, `attendance_requests`, `biometric_punch_logs`, `daily_attendance_summary`
7. `06_leave.sql`: `leave_types`, `leave_allocations`, `leave_requests`, `leave_ledger`, `calculate_leave_days()`, `process_leave_request_state_change()`
8. `07_salary.sql`: `salary_components`, `employee_salary_structures`, `salary_structure_components`
9. `08_payroll_eligibility.sql`: `payroll_eligibility_snapshots`, cutoff evaluation
10. `09_payroll.sql`: `payroll_periods`, `payroll_revisions`, `payslips`, `payslip_components`, `payroll_adjustments`
11. `10_statutory.sql`: `statutory_profiles`, `statutory_calculation_snapshots` (PF, ESI, PT, TDS)
12. `11_reimbursements.sql`: `reimbursement_categories`, `reimbursement_claims`, `reimbursement_receipts`
13. `12_leave_financial.sql`: `leave_encashment_requests`, salary encashment calculations
14. `13_ff_settlement.sql`: `ff_settlement_records`, `ff_clearances`, `ff_computation_drafts`
15. `14_attachments.sql`: `document_attachments` (entity attachments, scan status)
16. `15_audit.sql`: `audit_logs` (immutable audit trail, trigger helpers)
17. `16_notifications.sql`: `notifications`, `in_app_announcements`
18. `17_scheduled_jobs.sql`: `scheduled_job_logs`, cron execution tracks
19. `18_search.sql`: Global search indexes, vector/tsvector configurations
20. `19_reports.sql`: Reporting views (`v_payroll_register_summary`, `v_attendance_muster_roll`)
21. `20_performance_optimizations.sql`: High-traffic query optimizations and materialized helpers
22. `21_rbac_scope_fallback.sql`: Extended RBAC scoping procedures
23. `22_comprehensive_performance_indexes.sql`: Composite performance indexes across high-volume FKs
24. `23_atomic_payroll_run.sql`: `execute_atomic_payroll_run()` stored procedure with row-level locks
25. `24_payroll_dirty_triggers.sql`: Triggers flagging `payroll_periods.is_dirty = true` upon retroactive changes
26. `bootstrap/01_system_admin.sql`: Default system admin user and permissions bootstrap

---

## 4. Forensic Findings by Topic

### A. Payroll Engine & Salary Resolution
- **File:** `src/lib/actions/payroll.ts`
- **Salary Resolution:** Uses `salaryMap.get(emp.id)` and `resolveMonthlyCtc(salStruct)`. Excluded employees are correctly tracked.
- **RPC Invocation:** Calls `supabase.rpc("execute_atomic_payroll_run", ...)`.
- **Finding:** If RPC fails, fallback code at line 471 executes `Promise.all` upsert to `payslips`, which violates atomic transactional execution in production. Must be removed so failure fails closed.

### B. Business Date Handling & Timezone (Asia/Kolkata)
- **File:** `src/lib/utils/date-utils.ts`
- **Exports:** `BUSINESS_TIMEZONE = "Asia/Kolkata"`, `getTodayDateStringIST()`, `getMonthStartDateString()`, `getDaysInMonth()`, `getMonthEndDateString()`, `previousDateString()`, `formatDateStringIST()`.
- **Finding:** `previousDateString()` used `.toISOString().split("T")[0]`.
- **Finding:** Actions such as `attendance.ts`, `calendar.ts`, `departments.ts`, `employees.ts`, `permissions.ts` contain scattered `new Date().toISOString().split("T")[0]` calls instead of `getTodayDateStringIST()`.

### C. Database Schema Columns on `employees`
- **Finding:** `employees` table correctly does NOT contain `manager_id`, `department`, or `designation`.
- **Queries Checked:**
  - `src/lib/actions/approvals.ts`: Queries `employee_current_manager` view / `employee_manager_assignment`.
  - `src/lib/actions/permissions.ts`: Queries `employee_manager_assignment`.
  - `src/lib/actions/data.ts`: Queries `employee_manager_assignment`.
  - No references to non-existent columns on `employees` found.

### D. Effective-Dated Assignments & Constraints
- **Tables:** `employee_department_assignment`, `employee_manager_assignment`, `employee_designation_assignment`, `employee_work_calendar_assignment`.
- **Constraints:** All 4 tables define `exclude using gist (employee_id with =, daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&)`.
- **Mutation Pattern:** In `employees.ts` and `calendar.ts`, previous record update and new record insert occur as separate sequential calls. A dedicated atomic procedure `schema/25_atomic_assignment_mutations.sql` will ensure complete atomicity.

### E. Audit Logging Permission Model
- **File:** `src/lib/actions/audit.ts`
- **Finding:**
  - `writeAuditLogAction`: Does not require `audit.view`; validates request origin, sanitizes input, and writes immutable audit entries.
  - `getAuditLogsAction`: Enforces `assertPermission("audit.view")` at line 29.
  - Architecture adheres to permission separation requirements.

### F. Concurrency Control
- **Leave Requests (`leave.ts`):** State transitions use `.eq("status", "pending")` and `.maybeSingle()`, triggering `process_leave_request_state_change()`.
- **Reimbursement Claims (`reimbursements.ts`):** State transitions for approval use `.eq("status", claim.status)`. Rejection branch must be updated to include the same atomic state verification.

### G. Idempotency Service
- **File:** `src/lib/services/idempotency.ts`
- **Schema:** `schema/00_setup.sql` (`system_idempotency_keys` table and `register_idempotency_key` function).
- **Finding:** Core infrastructure is present and integrated into high-risk flows.

### H. Attachment Upload Security
- **File:** `src/lib/actions/attachments.ts`
- **Controls:** MAX_FILE_SIZE_BYTES (10MB), MIME type allowlist, extension allowlist, path traversal rejection, default `scan_status: "pending"`.
- **Finding:** Filename validation should explicitly reject null bytes (`\0`), directory separators (`/`, `\`), and verify extension-to-MIME alignment.

---

## 5. Phase 0 Acceptance Sign-Off

- [x] Repository structure, schema, services, and actions fully inspected.
- [x] Baseline commands identified and executed.
- [x] No invented architecture or fabricated test results.
- [x] Phase 0 Baseline Report generated at `docs/remediation/PHASE-0-BASELINE.md`.
- [x] Proceed to Phase 1.
