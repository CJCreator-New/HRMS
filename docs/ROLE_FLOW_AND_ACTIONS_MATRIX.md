> **Superseded** — retained by user decision (wayfinder ticket `06`). The
> canonical living matrix is [`docs/FLOW_MATRIX.md`](FLOW_MATRIX.md); this
> file carries stale claims (5 lifecycle states vs 6, V-vectors vs the verified
> C1–C15 combinations) and is kept only for reference.

# HRMS v2.7 — Role Flow Mapping, Permitted Actions & Cross-Role Interaction Matrix

> **Version**: 2.7  
> **Authority**: FR v2.7 §1.1–§1.4, §2–§10, ADR 0001–0003 & [`docs/RBAC_ACCESS_MATRIX.md`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/docs/RBAC_ACCESS_MATRIX.md)  
> **Target File**: `docs/ROLE_FLOW_AND_ACTIONS_MATRIX.md`  

---

## 1. System Roles & Persona Taxonomy

The HRMS v2.7 platform defines **5 Base System Roles**, **1 Multi-Role Union**, **1 Dedicated Operational Persona**, and **5 Employee Lifecycle States**:

| Role Code | Role Name | System Authority | Primary Scope & Workspaces |
|---|---|---|---|
| `employee` | Employee | Standard Individual Contributor | Self-service attendance punching, correction submission, leave application, expense claims, payslip downloads, personal settings. |
| `manager` | Manager | Line Manager / Team Lead | Team attendance monitoring, correction approvals, team leave review (with masked parental leave view), comp-off/short permission approvals, stage-1 expense review. **Strictly barred from salary views (FR §5.8)**. |
| `hr` | HR Admin | Organization & People Operations | Employee directory CRUD, direct admin onboarding with temp password (ADR 0001), department/manager assignments, leave policy master, HR leave stage approvals, encashment approvals, offboarding checklist & F&F settlements. |
| `payroll_admin` | Payroll Administrator | Compensation & Compliance | Salary components & versioned structures, statutory rule versions (India FY 25-26), payroll period initiation, anomaly lock checks, bulk run execution, recalculation, payslip publishing. **Read-only on operational data with amber banner (Q11)**. |
| `system_admin` | System Administrator | Technical & Security Governance | Break-glass bootstrap (`schema/bootstrap/01_system_admin.sql`), zero-seed company settings gate unlock, RBAC role/permission management (with self-grant protection), scheduled jobs execution, immutable audit trail inspection. |
| `multi_hr_mgr` | HR + Manager (Multi-Role) | Multi-Role Cumulative Union | Holds cumulative union of permissions. UI Role View Switcher in header filters sidebar focus between Manager and HR workspaces without revoking backend API permissions. |
| `hr_alt_approver`| Alternate HR Approver | Secondary HR Admin | Designated in `company_settings.alternate_hr_approver_id` to approve HR Admin leave applications, eliminating self-approval deadlocks (FR §1.4). |

---

## 2. Master Module-by-Module Permitted Actions Matrix (All 20 Modules)

```
[CRUD] = Create, Read, Update, Delete     [RO] = Read-Only (with UI Banner)
[Appr] = Approval Authority               [Own] = Own Records Only
[Team] = Direct Reports Only              [All] = Organization-Wide
[—] = Access Prohibited (403 / Hidden)
```

| Module # | Module Name & Route | Employee | Manager | HR Admin | Payroll Admin | System Admin | Key Permission Codes |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| **00** | **App Shell & Dashboard** (`/`, `/login`) | [Own] | [Team] | [All] | [All] | [All] | `employee.view.self` |
| **01** | **RBAC Governance** (`/settings`, `/permissions`) | — | — | — | — | [CRUD] | `settings.manage` |
| **02** | **Employee Lifecycle** (`/employees`, `/onboarding`) | [Own] | [Team] | [CRUD] | [RO] | [CRUD] | `employee.create`, `employee.edit`, `employee.import` |
| **03** | **Settings & Policies** (`/settings`) | — | — | [CRUD] | — | [CRUD] | `settings.manage` |
| **04** | **Work Calendar & Holidays** (`/calendar`) | [Select Opt] | [Select Opt] | [CRUD] | [RO] | [CRUD] | `settings.manage`, `employee.view.self` |
| **05** | **Attendance Tracking** (`/attendance`) | [Punch/Correct] | [Appr Team] | [Override] | [RO] | [All] | `attendance.mark.self`, `attendance.correct.approve` |
| **06** | **Leave Management** (`/leave`, `/approvals`) | [Apply/Cancel] | [Appr Team] | [Appr HR/Master]| [RO] | [All] | `leave.apply.self`, `leave.approve.manager`, `leave.approve.hr` |
| **07** | **Salary Master** (`/salary`) | [Own Structure] | **— (Hidden)** | [CRUD Structures]| [CRUD Structures]| [All] | `salary.view.self`, `salary.view.all`, `salary.edit` |
| **08** | **Payroll Eligibility** (`/eligibility`) | — | — | [RO] | [Manage] | [Manage] | `payroll.view`, `payroll.run` |
| **09** | **Payroll Core Engine** (`/payroll`) | [Download Own] | — | [RO] | [Run/Finalize] | [All] | `payroll.view`, `payroll.run`, `payroll.finalize` |
| **10** | **Statutory Engine** (`/statutory`) | — | — | [RO Profiles] | [CRUD Profiles/Rules]| [All] | `statutory.view`, `statutory.edit` |
| **11** | **Expense Reimbursements** (`/reimbursements`) | [Submit/Cancel] | [Appr M1] | [Appr HR/Config] | [RO Disbursal]| [All] | `reimbursement.apply.self`, `reimbursement.approve` |
| **12** | **Leave Encashment** (`/encashment`) | [Apply Own] | — | [Appr] | [RO] | [All] | `leave.encash.apply.self`, `leave.encash.approve` |
| **13** | **Offboarding & F&F** (`/offboarding`) | [Resign/View] | [Team View] | [CRUD/Appr] | [RO] | [All] | `separation.create`, `ff.create`, `ff.approve` |
| **14** | **Document Attachments** (`/documents`) | [Own Upload] | [Team View] | [All] | [All] | [All] | `attachment.upload`, `attachment.view` |
| **15** | **Centralized Audit Trail** (`/audit`) | — | — | [View] | — | [View] | `audit.view` |
| **16** | **Notifications Engine** (Header Bell Icon) | [Own Inbox] | [Own Inbox] | [Own Inbox] | [Own Inbox] | [Own Inbox] | In-App / Email Delivery |
| **17** | **Scheduled Jobs** (`/jobs`) | — | [View] | [View/Rerun] | — | [View/Rerun] | `job.view`, `job.rerun` |
| **18** | **Global Search** (`Cmd+K` / `Ctrl+K`) | [Scoped] | [Scoped Team] | [All] | [All] | [All] | Scoped by Active Role Permissions |
| **19** | **Reports & Dashboards** (`/reports`, `/approvals`)| — | [Team Queue] | [All Reports] | [Pay Reports] | [All] | `reports.export` |

---

## 3. Detailed Single-Role User Journeys

### 3.1 Employee Journey (`employee`)
1. **Login & Password Reset**: Logs in at `/login`. If status is `invited` with `must_change_password: true`, redirected to forced reset. Entering new password activates account (`invited` $\rightarrow$ `active`).
2. **Attendance Punching**: Opens `/attendance` or dashboard widget. Clicks `Check In` (records timestamp & geolocation). At day end, clicks `Check Out` (auto-computes work duration).
3. **Punch Correction**: If punch-out was missed, record flags `pending_review`. Employee clicks `Request Correction`, inputs missing time and reason, submits to manager.
4. **Leave Application**: Opens `/leave`, checks balance cards (CL, SL, EL). Selects dates and duration (`full_day`, `first_half`, `second_half`). Submits request. Overlapping dates are blocked by trigger.
5. **Short Permission & Comp-Off**: Submits 2-hour permission pass or claims 1-day comp-off linked to weekend extra work punch.
6. **Expense Reimbursement**: Opens `/reimbursements`, selects category (`Travel`, `Internet`), uploads receipt PDF/image, enters vendor and amount, submits claim.
7. **Payslip Access**: Navigates to `/payroll` or dashboard to view and download monthly payslip PDF once published.
8. **Resignation**: Navigates to `/offboarding`, initiates resignation with desired LWD and reason.

---

### 3.2 Manager Journey (`manager`)
1. **Team Attendance Monitoring**: Navigates to `/attendance`, selects `Team View` to monitor check-in times and anomaly flags across direct reports.
2. **Unified Approvals**: Navigates to `/approvals`. Reviews pending items grouped by module:
   - Attendance tab: Approves / Rejects punch corrections.
   - Leave tab: Reviews team leave applications. **Parental Leave Privacy Masking**: Maternity/Paternity requests display type as `"Parental Leave"` and reason as `"[Redacted]"`.
   - Permissions / Comp-Off tab: Approves team short passes and comp-off claims.
   - Reimbursements tab: Conducts Stage 1 approval (claim status moves to `pending_hr`).
3. **Team Separation**: Initiates team member termination with reason and notice period.
4. **Salary Isolation Rule (FR §5.8)**: Navigation hides `/salary`. Direct URL access returns `403 Forbidden`.

---

### 3.3 HR Admin Journey (`hr`)
1. **Direct Admin Onboarding (ADR 0001)**: Opens `/onboarding`, enters candidate code, email, DOJ, and temporary password. Hands over credentials to new hire.
2. **Org & Hierarchy Configuration**: Creates departments (`/departments`), assigns managers, designations, and work calendar templates (`/calendar`).
3. **Leave Policy Management**: Sets leave types, sandwich rules, and annual allocations (`/leave`).
4. **HR Stage Approvals**: Approves Stage-2 expense reimbursements, leave encashment requests, and employee leave requests requiring HR approval.
5. **Alternate HR Approver Routing (FR §1.4)**: HR Admin's own leave requests automatically route to `alternate_hr_approver_id`, blocking self-approval.
6. **Offboarding & F&F Settlement**: Manages exit checklists (`/offboarding`), generates draft F&F settlement statement with EL encashment and asset recovery deduction, approves finalized settlement.
7. **Compliance & Reports**: Exports monthly attendance, leave utilization, and statutory compliance reports (`/reports`).

---

### 3.4 Payroll Admin Journey (`payroll_admin`)
1. **Read-Only Operational Data (Q11)**: Navigates to `/attendance`, `/leave`, and `/employees`. Views data with prominent amber `Read-Only` operational banner.
2. **Salary Structure Management**: Configures salary components (taxable, PF/ESI eligible) and assigns effective-dated structures to employees (`/salary`).
3. **Statutory Configuration**: Maintains `statutory_rule_version` (PF ₹15k wage cap, ESI 0.75%, State PT slabs, New Regime TDS) and updates employee statutory profiles (`/statutory`).
4. **Payroll Period Lifecycle**:
   - Opens `/payroll`, initiates monthly payroll period.
   - Verifies payable units (`worked_units + paid_leave_units`).
   - Runs `validate_payroll_lock()` to ensure no unresolved anomalies or pending leaves exist.
   - Executes draft bulk payroll run.
   - Reviews payslips and calculation breakdowns.
   - Finalizes payroll period and clicks `Publish Payslips`.
   - Reopens periods when necessary, creating versioned revisions (`payroll_revisions`).

---

### 3.5 System Admin Journey (`system_admin`)
1. **Bootstrap & Recovery**: Executes break-glass script `schema/bootstrap/01_system_admin.sql` outside RLS.
2. **Zero-Seed Gate Unlock**: Configures initial company settings (`is_configured = true`) to enable operational modules.
3. **RBAC Governance**: Assigns roles and manages role permissions. **Self-grant of approval permissions is blocked by trigger `trg_block_self_grant`**.
4. **Audit Trail & Background Jobs**: Inspects immutable audit logs (`/audit`) and triggers scheduled background jobs (`/jobs`).

---

## 4. Cross-Role Interaction & Handoff Matrix (15 Interaction Vectors)

| Vector # | Interacting Roles | Workflow Feature Area | Handoff Description & System Verification |
|---|---|---|---|
| **V-01** | Employee $\rightarrow$ Manager | Attendance Correction | Employee submits correction for `pending_review` punch $\rightarrow$ Manager receives notification $\rightarrow$ Manager approves $\rightarrow$ Record status updates to `present`. |
| **V-02** | Employee $\rightarrow$ Manager | Standard Leave Request | Employee applies for CL/EL $\rightarrow$ Manager reviews $\rightarrow$ Manager approves $\rightarrow$ Quota debited in `leave_allocations` & `leave_ledger`. |
| **V-03** | Employee $\rightarrow$ Manager | Masked Parental Leave | Employee applies for Maternity/Paternity $\rightarrow$ Manager view masks type as `"Parental Leave"` and reason as `"[Redacted]"` $\rightarrow$ Manager approves without privacy breach. |
| **V-04** | Employee $\rightarrow$ Manager | Comp-Off Claim | Employee logs holiday `extra_work` $\rightarrow$ Claims Comp-Off $\rightarrow$ Manager verifies and approves $\rightarrow$ 1.0 day comp-off credited with 90-day expiry. |
| **V-05** | Employee $\rightarrow$ Manager $\rightarrow$ HR | Multi-Stage Reimbursement | Employee submits claim under category `manager_then_hr` $\rightarrow$ Manager Stage-1 approves (`pending_hr`) $\rightarrow$ HR Stage-2 approves (`approved`) $\rightarrow$ Disbursed in Payroll. |
| **V-06** | HR Admin $\rightarrow$ Alternate HR | HR Self-Approval Bypass | HR Admin applies for leave $\rightarrow$ Route targets `company_settings.alternate_hr_approver_id` $\rightarrow$ Alternate HR approves $\rightarrow$ HR self-approval blocked (FR §1.4). |
| **V-07** | HR Admin $\rightarrow$ Employee | Direct Admin Onboarding | HR creates employee with temp password $\rightarrow$ Employee logs in $\rightarrow$ Forced password reset $\rightarrow$ Account activated (`invited` $\rightarrow$ `active`). |
| **V-08** | HR Admin $\rightarrow$ Payroll Admin | Salary Assignment Handoff | HR assigns effective-dated salary structure $\rightarrow$ Payroll Admin verifies component breakdowns for monthly calculation. |
| **V-09** | HR Admin $\rightarrow$ Payroll Admin | LOP & Unpaid Leave Handoff | Unapproved leave converts to LOP in `leave_ledger` $\rightarrow$ Payroll engine automatically deducts LOP from payable days. |
| **V-10** | HR Admin $\rightarrow$ Payroll Admin | F&F Clearance Handoff | HR drafts F&F statement with leave encashment & asset recovery $\rightarrow$ Payroll verifies payout $\rightarrow$ HR finalizes settlement. |
| **V-11** | Payroll Admin $\rightarrow$ System (Lock) | Anomaly Lock Verification | Payroll Admin initiates finalization $\rightarrow$ System scans for `pending_review` punches and pending leaves $\rightarrow$ Blocks finalization if anomalies exist. |
| **V-12** | Payroll Admin $\rightarrow$ Employee | Payslip Publication | Payroll Admin publishes period $\rightarrow$ Payslips unlocked in employee portal $\rightarrow$ Employee downloads official PDF. |
| **V-13** | Employee $\rightarrow$ HR Admin | Resignation & Notice Period | Employee submits resignation $\rightarrow$ Notice period (60 days) calculated $\rightarrow$ HR Admin manages offboarding checklist tasks. |
| **V-14** | Multi-Role User (`multi_hr_mgr`) | UI Context Filtering | User switches between "Manager View" and "HR View" $\rightarrow$ Sidebar navigation filters workspace focus while preserving union permissions. |
| **V-15** | System Admin $\rightarrow$ HR / Payroll | RBAC Role Provisioning | System Admin assigns roles to employees $\rightarrow$ Self-grant trigger blocks System Admin from granting approval permissions to self. |

---
