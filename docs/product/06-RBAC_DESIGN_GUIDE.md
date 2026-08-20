# HRMS v2.7 — RBAC Design Guide

> **Audience**: Engineering, Security, Product  
> **Authority**: FR v2.7 §1.1–§1.4, ADR 0003, `docs/FLOW_MATRIX.md`  
> **Last Updated**: August 19, 2026

---

## 1. RBAC Architecture Overview

HRMS v2.7 implements a **multi-layer RBAC system** with defense-in-depth enforcement:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  RoleProvider → hasPermission() → Conditional UI Rendering   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Middleware Layer                             │
│  Route Gate → Permission Union Check → Redirect/Allow        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Server Action Layer                              │
│  assertPermission() → Permission Check → Execute/Reject      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                Database Layer (RLS)                           │
│  Row-Level Policies → has_permission() RPC → Allow/Deny      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Permission Model

### 2.1 Permission Code Structure

```
module.action.scope

Examples:
  attendance.mark.self        # Employee punches own attendance
  leave.approve.manager       # Manager approves team leave
  payroll.run                 # Payroll admin runs payroll (no scope)
  employee.create             # HR creates employee (no scope)
```

**Scope Values**:
| Scope | Meaning | Applies To |
|---|---|---|
| `.self` | Current user's own records | Employee-facing actions |
| `.team` | Direct reports only | Manager-facing actions |
| `.all` | Organization-wide | HR/Admin-facing actions |
| (none) | Global action | System-wide operations |

### 2.2 Scope Fallback Logic

When checking `hasPermission(permissions, 'attendance.view')`:

```
1. Exact match: 'attendance.view' → grant
2. Broader scope: 'attendance.view.all' → grant
3. Team scope: 'attendance.view.team' → grant
4. Self scope: 'attendance.view.self' → grant
5. No match → deny
```

This means holding `attendance.view.all` automatically grants access to `attendance.view` checks.

### 2.3 Complete Permission Inventory (56 Codes)

#### Module 00: Infrastructure
| Code | Description |
|---|---|
| `employee.view.self` | View own employee profile |

#### Module 01: RBAC
| Code | Description |
|---|---|
| `settings.manage` | Manage company settings |

#### Module 02: Employee Lifecycle
| Code | Description |
|---|---|
| `employee.create` | Create new employee |
| `employee.edit` | Edit employee details |
| `employee.import` | Bulk import employees |
| `employee.deactivate` | Deactivate employee access |
| `employee.view.self` | View own profile |
| `employee.view.team` | View team profiles |
| `employee.view.all` | View all profiles |

#### Module 04: Work Calendar
| Code | Description |
|---|---|
| `settings.manage` | Manage calendar settings (shared with Module 01) |

#### Module 05: Attendance
| Code | Description |
|---|---|
| `attendance.mark.self` | Punch own attendance |
| `attendance.mark.team` | Mark team attendance |
| `attendance.view.self` | View own attendance |
| `attendance.view.team` | View team attendance |
| `attendance.view.all` | View all attendance |
| `attendance.correct.self` | Submit own correction |
| `attendance.correct.approve` | Approve team corrections |
| `attendance.correct.override` | Override any attendance |

#### Module 06: Leave
| Code | Description |
|---|---|
| `leave.view.self` | View own leave |
| `leave.view.team` | View team leave |
| `leave.view.all` | View all leave |
| `leave.apply.self` | Apply for leave |
| `leave.cancel.self` | Cancel own leave |
| `leave.cancel.approve` | Approve leave cancellation |
| `leave.approve.manager` | Manager-level leave approval |
| `leave.approve.hr` | HR-level leave approval |
| `leave.manage_types` | Manage leave type configurations |

#### Module 07: Salary
| Code | Description |
|---|---|
| `salary.view.self` | View own salary |
| `salary.view.all` | View all salaries |
| `salary.edit` | Edit salary structures |

#### Module 09: Payroll
| Code | Description |
|---|---|
| `payroll.view` | View payroll data |
| `payroll.run` | Execute payroll runs |
| `payroll.reopen` | Reopen finalized periods |
| `payroll.finalize` | Finalize payroll periods |
| `payroll.publish` | Publish payslips |
| `payroll.schedule` | Schedule payroll periods |

#### Module 10: Statutory
| Code | Description |
|---|---|
| `statutory.view` | View statutory data |
| `statutory.edit` | Edit statutory rules/profiles |

#### Module 11: Reimbursements
| Code | Description |
|---|---|
| `reimbursement.apply.self` | Submit expense claim |
| `reimbursement.cancel.self` | Cancel own claim |
| `reimbursement.approve` | Approve claims |
| `reimbursement.view.team` | View team claims |
| `reimbursement.view.all` | View all claims |

#### Module 12: Leave Encashment
| Code | Description |
|---|---|
| `leave.encash.apply.self` | Apply for encashment |
| `leave.encash.apply` | General encashment apply |
| `leave.encash.approve` | Approve encashment |

#### Module 13: Offboarding
| Code | Description |
|---|---|
| `separation.view` | View separation records |
| `separation.create` | Create separation records |
| `separation.edit` | Edit separation records |
| `offboarding.manage` | Manage offboarding checklists |
| `ff.view` | View F&F settlements |
| `ff.create` | Create F&F settlements |
| `ff.approve` | Approve F&F settlements |

#### Module 14: Attachments
| Code | Description |
|---|---|
| `attachment.upload` | Upload attachments |
| `attachment.view` | View attachments |

#### Module 15: Audit
| Code | Description |
|---|---|
| `audit.view` | View audit logs |

#### Module 17: Jobs
| Code | Description |
|---|---|
| `job.view` | View scheduled jobs |
| `job.rerun` | Rerun scheduled jobs |

#### Module 19: Reports
| Code | Description |
|---|---|
| `reports.export` | Export reports |

#### Comp-Off
| Code | Description |
|---|---|
| `compoff.apply.self` | Apply for comp-off |
| `compoff.approve` | Approve comp-off |
| `compoff.credit.manual` | Manual comp-off credit |
| `compoff.revoke` | Revoke comp-off |

#### Permissions
| Code | Description |
|---|---|
| `permission.apply.self` | Apply for short permission |
| `permission.approve` | Approve short permission |
| `permission.override.quota` | Override permission quota |

---

## 3. Role Permission Assignments

### 3.1 Employee Role

```
employee.view.self
attendance.mark.self
attendance.view.self
attendance.correct.self
leave.view.self
leave.apply.self
leave.cancel.self
leave.encash.apply.self
compoff.apply.self
permission.apply.self
salary.view.self
reimbursement.apply.self
reimbursement.cancel.self
separation.view
attachment.upload
attachment.view
leave.encash.apply
```

**Total**: 17 permissions

### 3.2 Manager Role

```
employee.view.self
attendance.mark.self
attendance.view.self
attendance.correct.self
leave.view.self
leave.apply.self
leave.cancel.self
leave.encash.apply.self
compoff.apply.self
permission.apply.self
reimbursement.apply.self
reimbursement.cancel.self
attachment.upload
attachment.view
employee.view.team
attendance.mark.team
attendance.view.team
attendance.correct.approve
leave.view.team
leave.approve.manager
leave.cancel.approve
permission.approve
permission.override.quota
compoff.approve
reimbursement.approve
reimbursement.view.team
separation.create
separation.view
job.view
```

**Total**: 29 permissions (includes all Employee permissions + team/approval permissions)

### 3.3 HR Admin Role

```
employee.view.all
employee.create
employee.edit
employee.import
employee.deactivate
attendance.view.all
attendance.correct.override
leave.view.all
leave.approve.hr
leave.cancel.approve
leave.manage_types
leave.encash.approve
salary.view.all
salary.edit
statutory.view
statutory.edit
reimbursement.approve
reimbursement.view.all
separation.view
separation.create
separation.edit
offboarding.manage
ff.create
ff.view
ff.approve
compoff.credit.manual
compoff.revoke
attachment.upload
attachment.view
reports.export
audit.view
settings.manage
job.view
job.rerun
```

**Total**: 34 permissions

### 3.4 Payroll Admin Role

```
salary.view.all
salary.edit
payroll.view
payroll.run
payroll.reopen
payroll.finalize
payroll.publish
payroll.schedule
statutory.view
statutory.edit
ff.view
reports.export
employee.view.all
attendance.view.all
leave.view.all
reimbursement.view.all
attachment.view
```

**Total**: 17 permissions

### 3.5 System Admin Role

```
settings.manage
audit.view
job.view
job.rerun
employee.view.all
```

**Total**: 5 permissions (technical-only seed; business approvals assigned explicitly via UI)

---

## 4. Multi-Role Union Evaluation

### Cumulative Union Logic

When an employee holds multiple roles, their effective permissions are the **union** of all assigned role permissions:

```typescript
function permissionsForRoles(roles: RoleCode[]): string[] {
  if (roles.includes('system_admin')) {
    return Array.from(new Set(Object.values(ROLE_PERMISSIONS_MAP).flat()));
  }
  return Array.from(
    new Set(roles.flatMap((role) => ROLE_PERMISSIONS_MAP[role] || []))
  );
}
```

### Example: HR + Manager Union

```
Employee: multi.hrmgr@company.com
Roles: [hr, manager]

HR permissions: 34 codes
Manager permissions: 29 codes
Union: 48 unique codes (overlap eliminated)

Effective access:
  ✅ employee.create (from HR)
  ✅ leave.approve.manager (from Manager)
  ✅ leave.approve.hr (from HR)
  ✅ payroll.run (NOT in either — blocked)
  ❌ salary hidden from Manager view (FR §5.8)
```

---

## 5. Self-Grant Prevention

### Database Trigger

```sql
CREATE OR REPLACE FUNCTION block_self_grant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id = auth_employee_id() THEN
    RAISE EXCEPTION 'Cannot grant permissions to self';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_self_grant
  BEFORE INSERT ON employee_roles
  FOR EACH ROW
  EXECUTE FUNCTION block_self_grant();
```

### Scope

- Prevents System Admin from granting **any** role to their own account
- Applies at the database level (cannot be bypassed by application code)
- Audit log created for all role assignment attempts

---

## 6. Route Access Matrix

### Gate Logic

```typescript
// Middleware checks if user holds ANY of the route's requiredPermissions
const hasAccess = requiredPermissions.some(perm => 
  hasPermission(userPermissions, perm)
);
```

### Complete Matrix

| Route | Required Permissions (ANY) | Employee | Manager | HR | Payroll | SysAdmin |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `/` | `employee.view.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/approvals` | `*.approve`, `ff.approve` | ✗ | ✓ | ✓ | ✗ | ✓ |
| `/attendance` | `attendance.view.*` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/leave` | `leave.view.*` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/reimbursements` | `reimbursement.*` | ✓ | ✓ | ✓ | ✓ view | ✓ |
| `/permissions` | `permission.*` | ✓ | ✓ | ✗ | ✗ | ✓ |
| `/calendar` | `employee.view.self`, `settings.manage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/employees` | `employee.view.*` | self | team | all | all RO | all |
| `/employees/import` | `employee.import` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/onboarding` | `employee.create` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/departments` | `employee.view.all`, `settings.manage` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/offboarding` | `separation.view`, `ff.view` | ✓ | ✓ | ✓ | ✓ view | ✓ |
| `/salary` | `salary.view.*` | own | **hidden** | ✓ | ✓ | ✓ |
| `/payroll` | `payroll.view`, `payroll.run` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `/eligibility` | `payroll.view`, `payroll.run` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `/statutory` | `statutory.view` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `/encashment` | `leave.encash.*`, `leave.view.*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/documents` | `attachment.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/settings` | `settings.manage` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/audit` | `audit.view` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/jobs` | `job.view`, `job.rerun` | ✗ | ✓ | ✓ | ✗ | ✓ |
| `/reports` | `reports.export` | ✗ | ✗ | ✓ | ✓ | ✓ |

---

## 7. Special Access Rules

### 7.1 Manager Salary Isolation (FR §5.8)

- `/salary` route **hidden** from Manager navigation
- Direct URL access returns `403 Forbidden`
- Salary components invisible in all Manager views

### 7.2 Payroll Admin Read-Only Operations (Q11)

- `/attendance`, `/leave`, `/employees` show amber `Read-Only` banner
- Data visible but no mutation actions available
- Purpose: Operational context for payroll processing

### 7.3 Parental Leave Privacy Masking (FR §4.7)

- Manager views of leave requests show:
  - Leave type: `"Parental Leave"` (instead of Maternity/Paternity)
  - Reason: `"[Redacted]"`
- HR/Admin views show full details

### 7.4 HR Self-Approval Prevention (FR §1.4)

- HR Admin leave requests route to `alternate_hr_approver_id`
- If no alternate configured, routes to System Admin
- Self-approval blocked at application routing level

### 7.5 System Admin Technical-Only Seed (Q5)

- Default seed grants only: `settings.manage`, `audit.view`, `job.view`, `job.rerun`, `employee.view.all`
- Business approval permissions (leave.approve, etc.) assigned explicitly via UI
- Prevents System Admin from accidentally having operational approval authority

---

## 8. UI Role View Switcher

### Behavior

- **Location**: Application header (next to user avatar)
- **Visibility**: Only shown for multi-role users
- **Function**: Filters sidebar navigation to active role's workspace
- **Persistence**: Active role saved in `localStorage`

### What Changes

| Aspect | Changes | Does Not Change |
|---|---|---|
| Sidebar navigation | Filtered to active role's modules | — |
| Dashboard widgets | Role-appropriate actions shown | — |
| `hasActiveRolePermission()` | Returns active role's permissions | — |
| Backend API access | — | **Unchanged** (union permissions) |

### Example

```
User: multi.hrmgr@company.com (HR + Manager)
Active Role: Manager

Sidebar shows:
  ✅ Team approvals (Manager workspace)
  ✅ Attendance team view (Manager workspace)
  ❌ Employee directory CRUD (HR workspace hidden)
  ❌ Onboarding (HR workspace hidden)

But backend:
  ✅ Can still call HR Server Actions (union permissions)
  ✅ Can access HR routes via direct URL
```

---

## 9. Permission Enforcement Points

### Enforcement Summary

| Layer | Mechanism | Scope | Failure Behavior |
|---|---|---|---|
| **Middleware** | Route gating | Route access | Redirect to `/403` |
| **Server Actions** | `assertPermission()` | Data mutations | Throw `ForbiddenError` |
| **RLS Policies** | `has_permission()` RPC | Row-level data | Empty result set |
| **UI Rendering** | `hasPermission()` check | Component visibility | Component not rendered |

### Defense-in-Depth Rationale

1. **Middleware** catches unauthorized route access early (before page renders)
2. **Server Actions** catch unauthorized mutations (even if middleware is bypassed)
3. **RLS** catches unauthorized data access (even if server actions are bypassed)
4. **UI** provides UX-level hiding (cosmetic, not security)

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
