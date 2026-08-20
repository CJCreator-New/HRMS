# Specification: HRMS Core Lifecycle & Operational Governance

## Problem Statement

In enterprise workforce management, operations often suffer from governance ambiguities, improper segregation of duties, fragile payroll execution, and leaky approval workflows:
- HR and Payroll duties can blend together, creating financial compliance and authorization risks.
- Expense approvals lack multi-stage enforcement, allowing claims requiring manager validation to bypass managerial sign-off or stall indefinitely without clear rejection handling.
- Month-end payroll processing is susceptible to silent failures or arbitrary delays when individual attendance anomalies or missing salary structures block entire organization pay batches.
- Ambiguity around attendance regularizations at cut-off dates can lead to inaccurate salary disbursements or stalled payouts.

Administrators, HR managers, payroll specialists, and employees need clear, deterministic domain boundaries, automated multi-stage routing, robust pre-flight payroll validation locks, and standardized cut-off exception handling.

---

## Solution

A strictly governed, dual-layer verified HRMS architecture that provides:
1. **Enforced Segregation of Duties**: Clear boundary separation where HR controls employee lifecycle, onboarding, and leave/offboarding workflows, while Payroll Admin holds exclusive control over salary computation, pre-flight locks, revisions, and disbursement finalization. Dormant roles are fully retired.
2. **Two-Stage Expense Reimbursement State Machine**: Deterministic routing for `manager_then_hr` claims transitioning through `pending_manager` -> `pending_hr` -> `approved` (queued for disbursement), with explicit audit reasons upon terminal rejection at any stage.
3. **Pre-Flight Payroll Validation & Lock Architecture**: Batch calculations that compute valid employee payouts while isolating blocked profiles (unresolved attendance anomalies, missing effective salary structures) with explicit blocking flags to prevent premature finalization without stalling valid batch draft generation.
4. **Month-End Cut-Off Exception & Arrears Engine**: Standardized fallback treating unresolved attendance anomalies at cut-off as Loss of Pay (LOP) for the active cycle, automatically queuing approved retrospective regularizations as salary arrears in subsequent pay cycles.

---

## User Stories

1. As an HR Administrator, I want to onboard new employees directly with temporary credentials, so that they can activate their accounts on first login without complex invitation token overhead.
2. As an HR Administrator, I want to manage leave type definitions, calendar templates, and employee lifecycle states, so that organizational policies are consistently applied.
3. As an HR Administrator, I want to initiate and coordinate employee offboarding and clearances, so that all departmental sign-offs are completed before F&F settlement.
4. As an HR Administrator, I want system restrictions preventing me from executing or finalizing payroll batches, so that the organization strictly adheres to financial segregation of duties.
5. As a Payroll Admin, I want exclusive access to run, adjust, and finalize monthly payroll batches, so that compensation disbursements remain strictly governed by finance.
6. As a Payroll Admin, I want pre-flight validation during payroll calculation that highlights all blocked employees (missing salary structure or unresolved anomalies), so that I can audit exceptions before finalization.
7. As a Payroll Admin, I want to generate a draft payroll run that computes valid employee records while isolating blocked records, so that batch review is not blocked by a single employee anomaly.
8. As a Payroll Admin, I want unresolved attendance anomalies at the cut-off date to be automatically treated as Loss of Pay (LOP), so that the active pay cycle can finalize on schedule without paying unverified days.
9. As a Payroll Admin, I want retroactive attendance regularization approvals to flow automatically as salary arrears into the next active pay cycle, so that employees receive withheld compensation accurately.
10. As an Employee, I want to submit expense reimbursement claims with receipts, category selection, and duplicate detection warnings, so that my business expenses are recorded for payback.
11. As an Employee, I want to track my claim as it transitions from Manager review to HR review, so that I have complete visibility into its approval progress.
12. As an Employee, I want clear rejection reasons if either my Manager or HR rejects a claim, so that I can rectify issues and submit a fresh claim.
13. As a Manager, I want to review and approve/reject expense claims submitted by my direct reports under `manager_then_hr` categories, so that operational validity is vetted before finance review.
14. As a Manager, I want my approval on a two-stage claim to advance it to `pending_hr` without directly triggering payout, so that financial compliance review remains intact.
15. As a Manager, I want to regularize attendance anomalies for my team members before the payroll cut-off date, so that they do not incur avoidable Loss of Pay deductions.
16. As an Employee, I want self-service attendance check-in/out, short-permission passes, and leave applications with sandwich rule compliance, so that my work calendar is always accurate.
17. As a System Admin, I want retired roles (`statutory_admin`, `finance_admin`, `it_admin`) to remain pruned and unassignable, so that security access paths remain lean and audit-ready.

---

## Implementation Decisions

### 1. Segregation of Duties & RBAC Model
- The permission architecture maintains a cumulative union model across active roles: `employee`, `manager`, `hr`, `payroll_admin`, and `system_admin`.
- Role capabilities are strictly separated:
  - `hr`: Retains permissions for `employee.*`, `leave.*`, `separation.*`, `ff.create`, `ff.approve`, `compoff.*`, but lacks `payroll.run` and `payroll.finalize`.
  - `payroll_admin`: Retains permissions for `payroll.*`, `salary.*`, `statutory.*`, `ff.view`, but cannot initiate separations or approve leaves.
- Dormant roles (`statutory_admin`, `finance_admin`, `it_admin`) are formally removed from active permission mappings and route guards.

### 2. Two-Stage Expense State Machine
For reimbursement categories configured with `approval_route = manager_then_hr`:
- Initial State: `pending_manager`
- State Transitions:
  - `pending_manager` + `approve` (Manager) -> `pending_hr`
  - `pending_manager` + `reject` (Manager) -> `rejected` (terminal, audit reason required)
  - `pending_hr` + `approve` (HR) -> `approved` (terminal, queued for payroll reimbursement)
  - `pending_hr` + `reject` (HR) -> `rejected` (terminal, audit reason required)
- For `hr_only` categories:
  - Initial State: `pending_hr` -> `approved` | `rejected`

### 3. Payroll Pre-Flight Lock & Exception Handling
- **Draft Calculation**: Executes calculation for all active employees possessing valid effective salary structures and clear attendance records.
- **Lock Check**: Evaluates:
  1. Presence of unassigned/zero salary structures.
  2. Unresolved attendance anomalies or pending leave requests in the pay period.
- **Pre-flight Partitioning**: Employees with exceptions are tagged with blocking error codes (`MISSING_SALARY_STRUCTURE`, `UNRESOLVED_ATTENDANCE_ANOMALY`). The batch remains in `draft` state with finalization disabled until exceptions are resolved or explicitly overridden.
- **Cut-Off LOP Fallback**: At cut-off time, unregularized days calculate as `lop_units` (`lop_units = total_days - payable_units`).
- **Retroactive Arrears Hook**: When a prior-period anomaly is regularized post-cut-off, the adjustment delta is recorded to be included as an earnings component in the subsequent cycle calculation.

---

## Testing Decisions

### Test Characteristics
- Tests must assert external behavior and invariant contracts (permissions granted/denied, status transitions, calculation arithmetic, lock conditions) rather than internal mock implementation details.
- Unit tests must run completely decoupled from database or network dependencies.
- E2E tests must validate multi-role persona boundaries through real browser sessions and API action calls.

### Tested Modules & Strategy
1. **Statutory & Payroll Engine Units (Vitest)**:
   - `src/lib/services/__tests__/payroll-engine.test.ts`: Validates `computePayableUnits`, `computeEmployeePayrollRun`, pro-rata salary split arithmetic, and statutory deductions.
   - `src/lib/services/__tests__/auth-action.test.ts` & `auth-session.test.ts`: Validates permission evaluation, multi-role union logic, and role segregation.
2. **Reimbursement Action & State Machine Units (Vitest)**:
   - `src/lib/services/__tests__/reimbursements-action.test.ts`: Validates rate limits, duplicate detection policies (`block`, `warn_and_allow`), and multi-stage status assignment.
3. **End-to-End Golden Paths (Playwright)**:
   - `e2e/`: Full browser verification of the Hire-to-Payslip lifecycle, multi-stage expense approval journey, and separation F&F settlement.

---

## Out of Scope

- Automated bank payment gateway / direct clearing house disbursement integrations (payroll output produces standard disbursement reports/CSV exports).
- Dynamic multi-tier approval graph builder (system enforces FR-defined single-manager, two-stage manager-then-HR, or HR-only routes).
- Real-time biometric IoT device driver integration (punches are ingested via API/manual entry/standard batch punch imports).
- Non-India statutory schemes (e.g., US 401k/W-2, UK PAYE).

---

## References

- `CONTEXT.md`: Domain terminology, ubiquitous language, and system boundaries.
- `docs/adr/0001-direct-admin-onboarding-activation.md`: Admin onboarding and password change lifecycle.
- `docs/adr/0003-fr-primary-authority-and-overrides.md`: Authority hierarchy and explicit overrides.
- `docs/adr/0005_testing_strategy.md`: Vitest service unit tests and Playwright E2E strategy.
