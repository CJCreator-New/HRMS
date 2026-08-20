> **Superseded** — retained by user decision (wayfinder ticket `06`). The
> canonical living matrix is [`docs/FLOW_MATRIX.md`](FLOW_MATRIX.md); this
> file carries stale claims (e.g. "24 routes" vs the verified 22 gated +
> `/login` + `/403`) and is kept only for reference.

# HRMS v2.7 — Living RBAC Access Control Matrix

> **Authority**: FR v2.7 §1.1, §1.2, §1.3 & ADR 0003  
> **Target File**: `docs/RBAC_ACCESS_MATRIX.md`  

---

## 1. Route Access Matrix (All 24 Routes)

User passes route gate if they hold **ANY** listed permission in their assigned permission union.

| Route | Section | Minimum Gate Permissions | Employee | Manager | HR Admin | Payroll Admin | System Admin |
|-------|---------|--------------------------|:--------:|:-------:|:--------:|:-------------:|:------------:|
| `/login` | — | public | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/` | MY WORK | `employee.view.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/approvals` | MY WORK | `*.approve`, `leave.cancel.approve`, `ff.approve` | — | ✓ | ✓ | —* | if granted |
| `/attendance` | MY WORK | `attendance.view.self\|team\|all` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/leave` | MY WORK | `leave.view.self\|team\|all` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/permissions` | MY WORK | `permission.apply.self`, `permission.approve` | ✓ | ✓ | ✓ | — | if granted |
| `/calendar` | MY WORK | `employee.view.self` (read); `settings.manage` (edit) | ✓ read | ✓ read | ✓ edit | ✓ read | ✓ edit |
| `/reimbursements` | MY WORK | `reimbursement.apply.self`, `reimbursement.view.team\|all` | ✓ | ✓ | ✓ | ✓ view | if granted |
| `/employees` | PEOPLE | `employee.view.self\|team\|all` | self | team | all | all RO | all |
| `/employees/import` | PEOPLE | `employee.import` | — | — | ✓ | — | ✓ |
| `/onboarding` | PEOPLE | `employee.create` | — | — | ✓ | — | ✓ |
| `/departments` | PEOPLE | `employee.view.all`, `settings.manage` | — | — | ✓ | — | ✓ |
| `/offboarding` | PEOPLE | `separation.view`, `ff.view`, `offboarding.manage` | own sep | team | ✓ | ✓ view | if granted |
| `/salary` | PAY | `salary.view.self\|all` | own | —** | ✓ | ✓ | if granted |
| `/payroll` | PAY | `payroll.view`, `payroll.run`, `salary.view.self` | payslip | — | — | ✓ | if granted |
| `/eligibility` | PAY | `payroll.view`, `payroll.run` | — | — | — | ✓ | if granted |
| `/statutory` | PAY | `statutory.view` | — | — | ✓ | ✓ | if granted |
| `/encashment` | PAY | `leave.encash.apply.self`, `leave.encash.approve` | apply | — | approve | — | if granted |
| `/documents` | ADMIN | `attachment.view` | own | team | all | all | all |
| `/reports` | ADMIN | `reports.export` | — | — | ✓ | ✓ | if granted |
| `/settings` | ADMIN | `settings.manage` | — | — | ✓ | — | ✓ |
| `/audit` | ADMIN | `audit.view` | — | — | ✓ | — | ✓ |
| `/jobs` | ADMIN | `job.view`, `job.rerun` | — | — | ✓ | — | ✓ |
| `/403` | SYSTEM | public | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Payroll Admin: no business approval routes unless explicitly granted (Q5)  
\*\* Manager: **no salary visibility** (FR §5.8) — route hidden entirely from Manager view

---

## 2. Explicit Access Rules & Constraints

1. **Manager No Salary Visibility (FR §5.8)**: `/salary` route and salary components are strictly hidden from Manager role view.
2. **Payroll Admin Read-Only Operations Data (Q11)**: Displays an Amber Read-Only banner on `/attendance`, `/leave`, and `/employees` pages.
3. **Maternity/Paternity Medical Privacy Masking (FR §4.7)**: Managers viewing leave requests see type masked as `"Parental Leave"` and reason masked as `"[Redacted]"`.
4. **Self-Approval Prohibited (FR §1.4)**: HR Admin leave applications route to `alternate_hr_approver_id` or System Admin.
5. **System Admin Technical-Only Seed (Q5)**: Default seed grants `settings.manage`, `audit.view`, `job.view`, `job.rerun`, `employee.view.all`. Business approval permissions are assigned explicitly via UI.
6. **Focus-Filtered Navigation**: The UI Role View Switcher filters sidebar navigation to match the workspace focus of the selected active role without restricting underlying backend API permissions.
7. **Granular Row-Level Approval Gate**: In the Unified Approvals Dashboard (`/approvals`), action buttons (`Approve` / `Reject`) are enabled per-row only if the user possesses the specific module approval permission code.

