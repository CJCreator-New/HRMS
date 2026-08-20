# 3. Functional Requirements Primary Authority & Explicit Architectural Overrides

* **Status**: Accepted
* **Date**: 2026-08-12

## Context
During initial planning and grilling sessions, several design choices were proposed that diverged from the frozen **HRMS v2.7 Functional Requirements (FR)** document. A cross-document audit revealed inconsistencies between the FR, build spec, schema files, and ADRs.

We must establish a strict hierarchy of authority for all business rules, database schema designs, and application behavior.

## Decision
1. **Primary Source of Truth**: The frozen **HRMS v2.7 Functional Requirements (FR)** document is the primary authority for all business logic, workflow state machines, role permissions, and data structures.
2. **Explicit Overrides**: Only explicit decisions documented in formal ADRs may override the FR.

### Approved Overrides (Documented & Accepted)
- **ADR 0001 (Direct Admin Onboarding)**: HR creates new employees with an initial temporary password and `must_change_password` flag; the employee account transitions from `invited` to `active` upon mandatory first-login password change.
- **ADR 0002 (Manual UI Test Data Strategy)**: Baseline system catalogs (RBAC roles, permissions, settings container, leave types, salary components) are seeded in SQL; operational test data is populated manually via UI.
- **Sandwich Rule Toggle**: Configurable per leave type defaulting to `OFF` (spanned weekends/holidays consume working days only unless explicitly enabled).
- **Attachment Async Malware Scan**: Documents store `scan_status` enum (`pending`, `clean`, `flagged`) with database triggers enforcing MIME whitelist & 10MB limits.
- **Reimbursement Duplicate Modes**: Categories support `block`, `warn_and_allow`, and `allow_always` duplicate detection modes.
- **F&F Asset Recovery**: Direct numeric deduction field (`asset_recovery_amount`) on F&F settlement record per FR §5.4.
- **Multi-Template Work Calendars**: Support for multiple calendar templates with effective-dated per-employee assignment per FR §8.5.

### Explicitly Rejected Proposals (Reverted to FR Standard)
- **Subsistence Allowance 50%/75% Enum**: REJECTED. Payroll eligibility uses FR §2.1/§5.3 binary effective-dated `payroll_eligibility(eligible boolean, reason text, source)`.
- **Dynamic HR Pool Approval**: REJECTED. Workflow routing uses FR §1.4 singular configured `alternate_hr_approver_id` with System Admin fallback.
- **Hardcoded Statutory Rules in SQL Functions**: REJECTED. FR §5.10 requires versioned statutory rules (`statutory_rule_version`).
- **Auto-LOP for Negative Balances**: REJECTED. Follows FR §4.9 recovery paths (accrual offset, F&F deduction).
- **Gratuity & Notice Pay Fields in F&F**: REJECTED. Removed from MVP F&F settlement schema to match FR §5.4.
- **`probation_days_default`**: REJECTED. Removed from company settings per FR §9 (no probation distinction).

## Consequences
- Guarantees 100% traceability between database schema, application API behavior, and HRMS v2.7 FR.
- Eliminates workflow contradictions and ensures clean local and cloud deployment.
