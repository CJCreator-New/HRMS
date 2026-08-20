# HRMS v2.7 — Product Requirement Document (PRD)

## Problem Statement

Organizations lack a centralized, unified, and compliant Human Resource Management System (HRMS) capable of handling the entire employee lifecycle—from onboarding and multi-template work calendar assignments, to complex punch verification, leave balance management with sandwich rules, India statutory payroll processing, expense reimbursements, and full & final offboarding settlements.

Existing solutions either force rigid hardcoded statutory rules, lack proper Row Level Security (RLS) and multi-role access control, or fail to enforce strict payroll locking when attendance anomalies or unresolved leave applications exist.

## Solution

A enterprise-grade full-stack HRMS web application built on Next.js 14+ (App Router), TypeScript, and PostgreSQL / Supabase with Row Level Security (RLS).

The system provides:
1. Direct Admin Onboarding with mandatory first-login password changes (ADR 0001).
2. Granular Role-Based Access Control (RBAC) supporting Multi-Role Union permissions with an interactive UI role context switcher.
3. Two-Layer Time & Attendance management (Base Calendar Layer + Attendance Event Layer) with derived read-only on-leave views and automated anomaly flagging (`Pending Review`).
4. Comprehensive Leave Management with configurable Sandwich Rules, date-range overlap prevention, dynamic singular HR alternate routing (FR §1.4), and Loss of Pay (LOP) auto-conversion.
5. Per-Employee Versioned Salary Structures (FR §5.1) with pro-rated mid-month salary split calculations.
6. Statutory Payroll Engine supporting versioned statutory rules (`statutory_rule_version`), India FY 2025-26 deductions (PF, ESI, PT, TDS), and non-taxable expense reimbursement payroll inclusion.
7. Strict Payroll Lock verification enforcing all FR §5.7 blocking conditions prior to finalization.
8. Complete Offboarding & Full & Final (F&F) Settlement workflow with resignation rescission, notice period recalculation, offboarding checklists, and numeric asset recovery deductions (FR §5.4).

---

## User Stories

### 1. Employee Lifecycle & Onboarding (Modules 00 & 02)
1. As an HR Admin, I want to onboard a new employee by creating an invitation record with an initial temporary password, so that I can hand over credentials directly to the new hire (ADR 0001).
2. As a newly onboarded Employee logging in for the first time, I want to be forced to change my initial temporary password, so that my account is activated (`invited` $\rightarrow$ `active`) and secured.
3. As an HR Admin, I want to assign an employee to a Department, Manager, and Designation with effective start and end dates, so that historical organizational assignments are accurately preserved without overlapping ranges.
4. As an HR Admin, I want to deactivate an employee's system access, so that their access is revoked immediately without mutating their employment status.
5. As an HR Admin, I want to upload a CSV file to bulk import employees, so that I can onboard multiple employees efficiently while receiving row-level validation reports.

### 2. Access Control & Role Management (Module 01)
6. As a System Admin, I want to assign multiple roles (e.g. Manager and HR Admin) to a single employee, so that they receive the cumulative union of permissions across all assigned roles.
7. As a multi-role Employee, I want to use a UI Role View Switcher in the application header, so that I can filter my workspace view between Manager operations and HR operations without losing my underlying permissions.
8. As a System Admin, I want the system to block me from granting business-approval permissions to my own account, so that self-granting approval authority is prevented (§1.3).
9. As a System Admin, I want a break-glass bootstrap script, so that I can provision the initial System Admin account outside RLS during initial setup.

### 3. Work Calendar & Holiday Management (Module 04)
10. As an HR Admin, I want to create multiple Work Calendar Templates (e.g., 5-Day Week vs 6-Day Week), so that different departments can operate under different weekly working schedules.
11. As an HR Admin, I want to configure compulsory and optional holidays for a calendar template, so that holidays are automatically recognized by the attendance and leave engines.
12. As an Employee, I want to select my optional holidays from an HR-curated default list before the annual selection deadline, so that my floating holiday choices are credited for the year.
13. As an Employee who missed the optional holiday selection deadline, I want the system to auto-allocate the HR-curated default optional holiday set, so that my holiday entitlements are correctly set.

### 4. Time & Attendance (Module 05)
14. As an Employee, I want to check in and check out using the Attendance Punch widget, so that my daily working hours are recorded accurately with timestamp and location metadata.
15. As an Employee who missed a check-out, I want the system to flag my attendance record as `Pending Review` and send me an inbox notification, so that I can submit an Attendance Correction request.
16. As a Manager, I want to review and approve my team members' Attendance Correction requests, so that their attendance status updates to `present` or `half_day`.
17. As an HR Admin, I want to override attendance records for any employee, so that manual administrative corrections can be performed when necessary.
18. As a Manager, I want the `on_leave` status to be derived dynamically from approved leave requests rather than editable as an attendance status, so that attendance and leave data never diverge (FR §3.5).

### 5. Leave Management & Policy (Module 06)
19. As an Employee, I want to view my leave balance allocations across Casual Leave (CL), Sick Leave (SL), Earned Leave (EL), and Comp-Off, so that I know my available quotas.
20. As an Employee, I want to apply for leave by selecting start and end dates and duration type (`full_day`, `first_half`, `second_half`), so that my request is submitted for approval.
21. As an Employee, I want the system to block me from applying for overlapping leave date ranges, so that duplicate or conflicting leave requests are prevented.
22. As an HR Admin, I want to configure the Sandwich Rule on specific leave types, so that weekends and holidays spanning a leave period are deducted only when the sandwich toggle is enabled.
23. As an HR Admin applying for leave, I want my request to route to a singular designated `alternate_hr_approver_id` (or System Admin if unset), so that self-approval of HR leave is prevented (FR §1.4).
24. As an Employee who worked on a weekend/holiday, I want to request a Comp-Off grant linked to the extra work attendance record, so that I receive a 1-day Comp-Off credit valid for 90 days (FR §4.6).
25. As a Manager viewing leave requests, I want Maternity and Paternity leave reason details to be masked as "Parental Leave", so that sensitive medical privacy is protected (FR §4.7).

### 6. Compensation & Salary Structures (Module 07)
26. As an HR Admin, I want to create and edit Salary Components with attributes for component type, calculation type, taxability, PF component, and ESI component, so that salary elements are properly categorized.
27. As an HR Admin, I want to assign a Per-Employee Versioned Salary Structure with effective start and end dates, so that salary revisions are versioned and historically traceable (FR §5.1).
28. As a Payroll Admin, I want mid-month salary structure revisions to be calculated pro-rata based on exact days under the old structure and new structure, so that compensation is calculated accurately.

### 7. Payroll Eligibility & Core Execution (Modules 08 & 09)
29. As a Payroll Admin, I want to view effective-dated binary `payroll_eligibility` records for employees, so that ineligible or suspended employees are flagged during payroll computation.
30. As a Payroll Admin, I want to initiate a monthly Payroll Period and execute a bulk Payroll Run, so that payslips are generated based on payable units (`worked_units + paid_leave_units`).
31. As a Payroll Admin, I want the system to strictly block payroll finalization if any unresolved `Pending Review` attendance records, pending leave requests, or missing statutory profiles exist in the period, so that non-compliant payrolls cannot be published (FR §5.7).
32. As a Payroll Admin, I want to recalculate a draft payroll run after attendance or leave corrections are approved, so that payslips update and a `payroll_revision_logs` entry is recorded.
33. As a Payroll Admin, I want to reopen a finalized payroll period for revision, so that a new `payroll_revision` is created without destroying historical payslip versions (FR §5.2).
34. As an Employee, I want to view and download my published monthly Payslip, so that I have an official summary of my earnings, deductions, and net pay.

### 8. Statutory Payroll Engine (Module 10)
35. As a Payroll Admin, I want to maintain statutory profiles for employees (PAN, UAN, PF number, ESI number, PT state, Old/New Tax Regime), so that statutory deductions are configured correctly.
36. As a Payroll Admin, I want statutory deductions (PF 12% capped at ₹15,000, ESI 0.75%, State PT, TDS) to be calculated using effective-dated `statutory_rule_version` rules, so that regulatory updates are version-controlled (FR §5.10).
37. As an Auditor, I want statutory calculation snapshots to be linked to specific payroll revisions, so that tax calculations are reproducible.

### 9. Expense Reimbursements (Module 11)
38. As an Employee, I want to submit an expense reimbursement claim with receipt attachments, vendor details, and expense category, so that I can claim business expenses.
39. As an HR Admin, I want to configure reimbursement categories with policy modes (`block`, `warn_and_allow`, `allow_always`), approval routes (`manager_only` | `manager_then_hr`), and taxability flags, so that claims are processed according to company policy (FR §5.11).
40. As an Employee, I want my approved expense reimbursements to be included as non-taxable or taxable earnings in my monthly payslip, so that reimbursements are disbursed during the payroll run.

### 10. Financial Leave Operations & Encashment (Module 12)
41. As an Employee, I want to submit a Leave Encashment request for eligible Earned Leave days, so that encashment payouts are calculated using a 26-day divisor and included in payroll.
42. As a System Admin, I want an automated background job to execute year-end carry forward and lapse processing, so that unused leave balances are carried forward or lapsed according to leave type rules.

### 11. Separation & Full & Final Settlement (Module 13)
43. As an Employee, I want to submit a resignation request, so that my notice period is initiated and my Last Working Day (LWD) is calculated.
44. As an HR Admin, I want to rescind a resignation before LWD, so that the employee status is restored to `Active` and audited.
45. As an HR Admin, I want to create a Full & Final (F&F) Settlement record with leave encashment earnings, numeric asset recovery deductions (`asset_recovery_amount`), and tax deductions, so that exit settlement payouts are computed (FR §5.4).
46. As an HR Admin, I want draft F&F settlements to be automatically marked as `stale` if leave or attendance records change before approval, so that outdated settlements are re-verified (FR §5.4).
47. As an HR Admin, I want the separation status to automatically transition to `completed` only when the employee reaches LWD AND the F&F settlement is `approved` (FR §2.2–§2.3).

### 12. Cross-Cutting Services (Modules 14–19)
48. As a User, I want to upload document attachments (PDF, JPEG, PNG up to 10MB) with asynchronous malware scan status tracking (`pending`, `clean`, `flagged`), so that file uploads are secured (FR §6).
49. As an Auditor, I want immutable `audit_logs` capturing entity changes, old/new values, reasons, correlation IDs, and actor IDs, so that system administrative changes are fully auditable (FR §8.1).
50. As a User, I want to receive in-app inbox notifications for pending approvals, correction requests, and payroll releases, so that I can stay informed of workflow events.
51. As an HR Admin or Manager, I want a unified "My Approvals" dashboard aggregating leave, attendance, reimbursement, encashment, and F&F approval items, so that pending tasks can be managed in one place (FR §10).
52. As a User, I want to use a Global Search command palette (`Ctrl+K`), so that I can instantly search for employees, departments, and payroll periods across the system (FR §5.13).

---

## Implementation Decisions

### Modules Built & Modified
- **`schema/00_setup.sql`**: Core extensions (`pgcrypto`, `btree_gist`), `auth_employee_id()`, `set_updated_at()`, and `system_idempotency_keys` table with `register_idempotency_key()` trigger pattern (FR §8.4).
- **`schema/bootstrap/01_system_admin.sql`**: Service-role break-glass script for initial System Admin setup outside RLS.
- **`schema/01_rbac.sql`**: `roles`, `permissions` (56 FR §1.2 codes), `role_permissions` mapping table (§1.3), `employee_roles`, `has_permission()`, and `block_self_grant` trigger.
- **`schema/02_org.sql`**: `employees` (`must_change_password`, `is_deactivated`), `employee_status_transition_log`, `departments`, assignments, `separation_records`, `offboarding_checklist`, and import tables.
- **`schema/03_settings.sql`**: `company_settings` (`alternate_hr_approver_id`, `manager_sla_days`, `is_configured`), `policy_configurations`, and `is_system_configured()` gate helper.
- **`schema/04_work_calendar.sql`**: `work_calendar_templates`, `holidays`, `employee_work_calendar_assignment`, `employee_optional_holiday_selections`, and `is_working_day()` helper.
- **`schema/05_attendance.sql`**: `attendance_records` (two-layer model), `attendance_punches`, `attendance_corrections` (FR §3.4 FSM), and `v_employee_on_leave` derived view.
- **`schema/06_leave.sql`**: `leave_types` (sandwich rule toggle), `leave_allocations`, `leave_requests` (`duration_type`), `leave_request_approvals`, `leave_ledger`, `permission_requests`, `comp_off_grants` (linked to `extra_work`), `prevent_overlapping_leave_requests()` trigger, and `v_leave_requests_masked` view.
- **`schema/07_salary.sql`**: `salary_components`, `employee_salary_structures` (per-employee versioned), and `employee_salary_structure_items` (FR §5.1).
- **`schema/08_payroll_eligibility.sql`**: `payroll_eligibility` (effective-dated binary boolean) and `payroll_eligibility_snapshots` (`worked_units + paid_leave_units`).
- **`schema/09_payroll.sql`**: `payroll_periods`, `payroll_revisions` (revision/supersede flow), `payslips`, `payslip_components`, `payroll_adjustments`, and `validate_payroll_lock()` enforcing FR §5.7 checks.
- **`schema/10_statutory.sql`**: `statutory_rule_versions` (effective-dated versioned rules), `statutory_profiles`, and `statutory_calculation_snapshots`.
- **`schema/11_reimbursements.sql`**: `reimbursement_categories` (`is_taxable`, `approval_route`, `duplicate_policy`), `reimbursement_claims`, and `reimbursement_receipts`.
- **`schema/12_leave_financial.sql` & `schema/13_ff_settlement.sql`**: `leave_encashment_requests` (`encashment_trigger`), `leave_carry_forward_logs`, `ff_settlement_records` (`asset_recovery_amount`, `is_stale`), `ff_clearances`, and `invalidate_stale_ff_settlement()` trigger.
- **`schema/14_attachments.sql` to `19_reports.sql`**: `document_attachments`, `audit_logs`, `inbox_notifications`, `scheduled_job_logs`, `search_global()`, and `v_pending_approvals_dashboard`.

### Architectural & API Decisions
1. **Next.js 14+ App Router & Supabase Client**: Server Components, Server Actions for mutations, and Supabase TypeScript client running locally first.
2. **Multi-Role Union Permission Evaluation**: Backend RLS and middleware evaluate cumulative union of assigned permissions; UI header provides role view switcher.
3. **Direct Admin Onboarding (ADR 0001)**: HR sets temporary password on employee creation; mandatory password reset on first login activates account (`invited` $\rightarrow$ `active`).
4. **Manual UI Test Data (ADR 0002)**: Baseline catalogs seeded in SQL; operational data created manually via UI during local testing.
5. **FR Primary Authority (ADR 0003)**: FR v2.7 is primary authority; explicit ADRs document approved overrides.

---

## Testing Decisions

### What Makes a Good Test
Good tests in this codebase must test **external behavior and contracts** rather than internal private implementation details:
- SQL tests verify database triggers, constraints, RLS policies, and function return values directly against PostgreSQL.
- API tests verify HTTP status codes, JSON payload shapes, permission denials, and database mutations.
- UI tests verify user interactions, form validation error messages, role view switching, and state transitions.

### Modules & Seams Tested
1. **Database & RLS Seam**:
   - `01_rbac.sql`: Test `has_permission()` with `.self`, `.team`, `.all` scoping and self-grant prevention trigger.
   - `02_org.sql`: Test employee status transition matrix (`enforce_employee_transition()`) and exclusion constraints on effective-dated assignments.
   - `05_attendance.sql`: Test auto-calculation of work duration and `pending_review` status assignment.
   - `06_leave.sql`: Test `prevent_overlapping_leave_requests()` trigger blocking duplicate date ranges and sandwich rule calculations.
   - `09_payroll.sql`: Test `validate_payroll_lock()` blocking finalization on unresolved anomalies.
   - `11_reimbursements.sql`: Test duplicate claim detection trigger (`check_reimbursement_duplicate()`).
   - `13_ff_settlement.sql`: Test stale-input invalidation trigger on leave ledger updates.

2. **Server Actions / API Route Seam**:
   - Test Direct Admin Onboarding API (`must_change_password` forced reset).
   - Test Attendance Punch check-in/out API.
   - Test Leave Application API (balance reservation & HR alternate routing).
   - Test Mid-Month Salary Pro-Ration computation API.
   - Test Bulk Payroll Execution & Recalculation API.
   - Test Reimbursement Claim submission & taxability classification.

3. **UI Component & Component Seam**:
   - Test UI Role View Switcher state filtering.
   - Test Attendance Punch widget timer and location validation.
   - Test Apply Leave Form date picker and attachment preview.
   - Test Payroll Processing Wizard steps and locking modal.
   - Test Unified Approvals Dashboard tab filtering.

---

## Out of Scope

The following items are explicitly out of scope for Phase 1 MVP per FR §11:
1. SSO / SAML / OAuth / Multi-Factor Authentication (MFA) integration.
2. Biometric hardware device integration or GPS geofencing punch validation.
3. Multi-location / multi-tenant organizational structure.
4. Direct Bank Payment Gateway API integration.
5. External ERP / Accounting system integration (SAP, Oracle, Tally).
6. Direct tax filing portal APIs (Income Tax / EPFO / ESIC government portal filing).
7. Manager visibility into employee salary details.
8. Employee advances, loans, and salary advance workflows.
9. Discretionary bonus workflows outside standard payroll adjustments.

---

## Further Notes

- **Local Backend First**: The backend and database run locally during development and testing. Migration to cloud Supabase infrastructure will occur after local verification is complete.
