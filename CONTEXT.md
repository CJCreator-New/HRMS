# HRMS v2.7 — Ubiquitous Language & Domain Context

## System Boundary
Internal Enterprise Human Resource Management System (HRMS) handling employee lifecycle, multi-template work calendar, attendance verification, leave balance management, India statutory payroll processing, expense reimbursements, and full & final offboarding settlements.

---

## Authority & Governance
- **Primary Source of Truth**: HRMS v2.7 Functional Requirements (FR).
- **Approved Overrides**: Documented explicitly in ADR 0001 (Direct Admin Onboarding), ADR 0002 (Manual UI Test Data), and ADR 0003 (FR Primary Authority & Approved Overrides).

---

## Glossary & Ubiquitous Language

### Employee Lifecycle
- **Employee**: A registered individual within the organization holding an employment status.
- **Invited Employee**: An onboarding record created by HR prior to system login activation.
- **Withdrawn Employee**: A lifecycle state present in the code union and DB enum but **unmodeled** — no persona, flow, or spec covers it (wayfinder gap D5). Intended for an employment record withdrawn before activation.
- **Segregation of Duties (HR vs Payroll Admin)**: Strict separation of duties is enforced. `hr` governs employee lifecycle records, leave/comp-off approval policies, and offboarding initiation, but cannot execute or finalize payroll. `payroll_admin` holds exclusive authority over payroll execution, payroll lock resolution, salary revision processing, and disbursement finalization.
- **Retired Dormant Roles**: `statutory_admin`, `finance_admin`, and `it_admin` are formally retired and pruned from active domain scope to eliminate dead paths and authorization ambiguity.
- **Active Employee**: A fully onboarded employee with login credentials and active employment status.
- **Multi-Role Union**: Employees holding multiple roles (e.g., Manager + HR) receive the cumulative union of permissions across all assigned roles. The UI provides a role view switcher to filter workspace focus without restricting underlying backend access rights.
- **Suspended Employee**: An active employee undergoing administrative review with access revoked and payroll eligibility governed by explicit effective-dated `payroll_eligibility` flags.
- **Notice Period**: The transitional employment state between resignation/termination initiation and Last Working Day (LWD).
- **Rescission Workflow**: Resignations or notice periods can be rescinded prior to LWD, restoring employee status to `Active` and logging audit events. LWD modifications trigger notice period day recalculations provided exit payroll is not finalized.
- **Offboarded Employee**: Employment status reached when an employee reaches their Last Working Day (LWD).
- **Completed Separation**: A separation workflow state achieved when an employee is `Offboarded` AND their Full & Final (F&F) settlement is `Approved`.

### Time & Attendance
- **Base Calendar Layer**: Resolution of calendar day status (`not_applicable > weekly_off > compulsory_holiday > selected_optional_holiday > working_day`).
- **Attendance Event Layer**: Recorded attendance status (`present`, `half_day`, `absent`, `extra_work`).
- **Derived On-Leave View**: `on_leave` is a derived read-only view joining approved leave requests against base calendar days (not a writable attendance record).
- **Work Calendar Template**: A defined weekly schedule template (e.g. 5-day week, 6-day week) specifying standard working days and holidays.
- **Compulsory Holiday**: A non-working calendar holiday applicable automatically to all assigned employees.
- **Optional Holiday**: A floating holiday selected by an employee from an HR-curated default set prior to the selection deadline.
- **Attendance Punch**: A recorded timestamp representing check-in or check-out events.
- **Pending Review**: An attendance anomaly state triggered by missing check-out or insufficient work duration, requiring manager/HR correction approval.
- **Sandwich Rule**: A policy toggle determining whether non-working days (weekends/holidays) falling inside a leave period consume leave quota.

### Compensation & Payroll
- **Salary Component**: An individual earning, deduction, or statutory element forming a salary structure.
- **Per-Employee Versioned Salary Structure**: Effective-dated salary structure assignment per employee per FR §5.1.
- **Payable Days**: The calculated number of days in a payroll period for which an employee receives compensation based on worked units and paid leave units.
- **Loss of Pay (LOP)**: Unpaid absence or unapproved leave days deducted from monthly salary computation.
- **Statutory Deduction**: Mandated tax or social security deductions under effective-dated statutory rules (`statutory_rule_version`).
- **Statutory Rule Version**: Effective-dated regulatory rule versions (`statutory_rule_version`) defining contribution percentages and caps (e.g. PF ₹15k wage cap, ESI ₹21k gross threshold, State PT slabs, Old/New Tax regime TDS).
- **Payroll Lock & Pre-flight Validation**: Mandatory pre-flight validation before finalization. Draft batches calculate all valid employees; employees with blocking exceptions (unresolved anomalies, missing salary structure) are isolated with explicit blocking flags and excluded from finalization until resolved or overridden.
- **Unresolved Anomaly Cut-off & Arrears**: Unresolved attendance anomalies at month-end payroll cut-off default to Loss of Pay (LOP) for the active cycle. Subsequent regularization approvals generate retroactive salary arrears in the following cycle.
- **Binary Payroll Eligibility**: Effective-dated boolean flag (`is_eligible`) determining employee inclusion in bulk monthly payroll runs, independent of administrative employment status.

### Leave & Time Off Extensions
- **Short Permission**: A time-limited monthly personal pass (e.g. 2 hours) with monthly quota tracking and manager approval.
- **Comp-Off Grant**: A compensatory time-off credit granted for verified `extra_work` on weekends or holidays, valid for 90 days from the work date with automated forfeiture upon expiration.
- **Parental Leave Privacy Masking**: Medical privacy protection masking Maternity and Paternity leave types as "Parental Leave" and reasons as "[Redacted]" in manager-level views and unified approval queues (FR §4.7).

### Expense Reimbursements & Offboarding
- **Reimbursement Approval Route**: Category-level routing policy (`approval_route` = `manager_then_hr` | `hr_only`). For `manager_then_hr`, claims enforce a strict two-stage state machine: `pending_manager` -> (Manager approves) -> `pending_hr` -> (HR approves) -> `approved` (queued for payroll reimbursement). Manager approval alone cannot finalize claims under `manager_then_hr`. Terminal rejection at either stage transitions status directly to `rejected` with an audit reason, requiring a fresh submission. For `hr_only`, claims start and finalize at `pending_hr`.
- **Reimbursement Policy Mode**: Category-level duplicate claim handling policy (`block`, `warn_and_allow`, `allow_always`) with taxability classification (`is_taxable`).
- **Stale F&F Invalidation**: Automated trigger marking draft Full & Final settlements as `stale` whenever leave ledger or attendance records change prior to final clearance approval (FR §5.4).
- **Zero-Seed Configuration Gate**: Administrative system lock requiring initial company settings provisioning (`is_configured = true`) before operational transactions are permitted.

