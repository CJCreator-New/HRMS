# HRMS v2.7 — Backend Architecture Documentation

> **Audience**: Engineering, Backend Team, DevOps, Security  
> **Stack**: Supabase / PostgreSQL 15, Next.js Server Actions, Row-Level Security  
> **Last Updated**: August 19, 2026

---

## 1. Architecture Overview

The HRMS v2.7 backend is built on **Supabase** (PostgreSQL 15) with a **defense-in-depth** security model:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                         │
│  Next.js App Router → Server Components / Client Islands    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP Request
┌──────────────────────▼──────────────────────────────────────┐
│                  Next.js Middleware                          │
│  Route Gating → Permission Check → CSP Nonce → Auth Guard   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               Server Actions Layer                           │
│  assertPermission() → Business Logic → Supabase Client      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              PostgreSQL / Supabase Database                  │
│  RLS Policies → Stored Procedures → Triggers → Constraints  │
└─────────────────────────────────────────────────────────────┘
```

### Security Layers (Defense-in-Depth)

| Layer | Mechanism | Purpose |
|---|---|---|
| **Layer 1: Middleware** | Route gating with permission check | Block unauthorized route access |
| **Layer 2: Server Actions** | `assertPermission()` call | Block unauthorized data mutations |
| **Layer 3: RLS Policies** | Row-Level Security on tables | Prevent data access at database level |
| **Layer 4: Triggers** | Business rule enforcement | Prevent invalid state transitions |

---

## 2. Database Schema Architecture

### Schema Organization (24 Modular Files)

The database is organized into 24 modular SQL files, combined into `schema/combined_init.sql` via `npm run db:sync`:

| File | Module | Purpose |
|---|---|---|
| `00_setup.sql` | Infrastructure | Extensions (`pgcrypto`, `btree_gist`), `auth_employee_id()`, `set_updated_at()`, idempotency keys |
| `01_rbac.sql` | RBAC | Roles (8 total: 5 active + 3 dormant), permissions (62 codes), `role_permissions`, `employee_roles`, `has_permission()` & `has_any_permission()` RPCs, `block_self_grant` trigger |
| `02_org.sql` | Organization | Employees, status transitions (`enforce_employee_transition`), departments, assignments, separation records, offboarding checklists |
| `03_settings.sql` | Settings | Company settings (`alternate_hr_approver_id`), policy configurations, zero-seed gate (`is_system_configured`) |
| `04_work_calendar.sql` | Calendar | Calendar templates, holidays, employee assignments, optional holiday selections, `is_working_day()` |
| `05_attendance.sql` | Attendance | Attendance records (two-layer model), punches, corrections, `v_employee_on_leave` view |
| `06_leave.sql` | Leave | Leave types, allocations, requests, approvals, ledger, permissions, comp-off grants, `prevent_overlapping_leave_requests()` trigger, `v_leave_requests_masked` |
| `07_salary.sql` | Salary | Salary components, per-employee versioned structures, structure items, GiST daterange no-overlap |
| `08_payroll_eligibility.sql` | Eligibility | Effective-dated binary payroll eligibility flags, snapshots |
| `09_payroll.sql` | Payroll | Payroll periods, revisions, payslips, payslip components, adjustments, `validate_payroll_lock()` |
| `10_statutory.sql` | Statutory | Statutory rule versions, profiles, calculation snapshots |
| `11_reimbursements.sql` | Reimbursements | Reimbursement categories, claims, receipts, duplicate detection trigger |
| `12_leave_financial.sql` | Leave Finance | Leave encashment requests, carry-forward logs |
| `13_ff_settlement.sql` | F&F | F&F settlement records, clearances, `invalidate_stale_ff_settlement()` trigger |
| `14_attachments.sql` | Attachments | Document attachments with malware scan status |
| `15_audit.sql` | Audit | Immutable audit logs |
| `16_notifications.sql` | Notifications | Inbox notifications |
| `17_scheduled_jobs.sql` | Jobs | Scheduled job logs, comp-off expiry job |
| `18_search.sql` | Search | `search_global()` function |
| `19_reports.sql` | Reports | `v_pending_approvals_dashboard` view |
| `20_performance_optimizations.sql` | Optimization | Compound indexes, partial indexes, optimized RLS query paths |
| `21_rbac_scope_fallback.sql` | RBAC Fallback | Scope resolution helper functions (`has_scoped_permission`) |
| `22_comprehensive_performance_indexes.sql` | Indexes | High-concurrency covering indexes and foreign key indexes |
| `bootstrap/01_system_admin.sql` | Bootstrap | Break-glass initial System Admin setup outside RLS |

### Combined Schema Application

```bash
# Merge 24 modular files into combined_init.sql
npm run db:sync

# Apply to PostgreSQL
psql -h localhost -U postgres -d hrms -f schema/combined_init.sql
```

---

## 3. Core Database Patterns

### 3.1 Effective-Dated Versioning

Multiple entities use effective-dated versioning for historical traceability:

```sql
-- Pattern: effective_start_date + effective_end_date
CREATE TABLE employee_salary_structures (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  -- ... structure fields
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_start_date, effective_end_date, '[]') WITH &&
  )
);
```

**Applied to**:
- `employee_salary_structures` (FR §5.1)
- `statutory_rule_versions` (FR §5.10)
- `payroll_eligibility` (effective-dated boolean)
- `employee_assignments` (department/designation/manager)

### 3.2 Status Transition Matrix

Employee status transitions are enforced by database triggers:

```sql
-- Valid transitions enforced by enforce_employee_transition()
invited → active       (on password reset)
active → suspended     (admin action)
active → notice_period (resignation)
active → offboarded    (termination)
suspended → active     (reinstatement)
notice_period → active (rescission)
notice_period → offboarded (LWD reached)
offboarded → completed (F&F approved)
```

### 3.3 Triggers & Constraints

| Trigger | Table | Purpose |
|---|---|---|
| `trg_block_self_grant` | `employee_roles` | Prevents users from granting approval permissions to themselves |
| `prevent_overlapping_leave_requests()` | `leave_requests` | Blocks duplicate leave date ranges using `btree_gist` exclusion |
| `check_reimbursement_duplicate()` | `reimbursement_claims` | Detects duplicate expense claims |
| `invalidate_stale_ff_settlement()` | `ff_settlement_records` | Marks F&F drafts as stale when leave/attendance change |
| `enforce_employee_transition()` | `employees` | Validates status transition matrix |
| `set_updated_at()` | All tables | Auto-updates `updated_at` timestamp |
| `register_idempotency_key()` | `system_idempotency_keys` | Prevents duplicate operations |

---

## 4. Row-Level Security (RLS)

### RLS Architecture

Every table has RLS enabled with policies scoped by role:

```sql
-- Example: employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Employee can view own record
CREATE POLICY "employees_self_view" ON employees
  FOR SELECT USING (
    auth_employee_id() = id
  );

-- Manager can view team records
CREATE POLICY "employees_team_view" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = employees.id
      AND ea.manager_id = auth_employee_id()
    )
  );

-- HR can view all records
CREATE POLICY "employees_all_view" ON employees
  FOR SELECT USING (
    has_permission(auth_employee_id(), 'employee.view.all')
  );
```

### RLS Scope Model

| Scope | Meaning | Example |
|---|---|---|
| `.self` | Current user's own records only | `attendance.view.self` |
| `.team` | Direct reports only | `attendance.view.team` |
| `.all` | Organization-wide access | `attendance.view.all` |

### `has_permission()` RPC

```sql
-- Core permission check function
CREATE FUNCTION has_permission(
  p_employee_id UUID,
  p_permission_code TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM employee_roles er
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE er.employee_id = p_employee_id
    AND p.code = p_permission_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `has_any_permission()` RPC (Batch Check)

```sql
-- Batch permission check for middleware (resolves N+1 query pattern)
CREATE FUNCTION has_any_permission(
  p_perm_codes TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM employee_roles er
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE er.employee_id = auth_employee_id()
    AND p.code = ANY(p_perm_codes)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Stored Procedures & Business Logic

### 5.1 Leave Calculation Engine

```sql
-- Calculate leave days considering sandwich rule
CREATE FUNCTION calculate_leave_days(
  p_start_date DATE,
  p_end_date DATE,
  p_duration_type TEXT,  -- 'full_day', 'first_half', 'second_half'
  p_sandwich_enabled BOOLEAN
) RETURNS INTEGER;
```

**Sandwich Rule Logic**:
- If enabled: weekends/holidays inside leave range consume quota
- If disabled: only working days consume quota
- Half-day requests count as 0.5 days

### 5.2 Payroll Lock Verification

```sql
-- Enforce FR §5.7 blocking conditions
CREATE FUNCTION validate_payroll_lock(
  p_payroll_period_id UUID
) RETURNS TABLE (
  blocking_reason TEXT,
  blocking_count INTEGER
) AS $$
BEGIN
  -- Check 1: Unresolved attendance anomalies
  RETURN QUERY SELECT 'pending_review_attendance'::TEXT, COUNT(*)
  FROM attendance_records
  WHERE payroll_period_id = p_payroll_period_id
  AND status = 'pending_review';

  -- Check 2: Pending leave requests
  RETURN QUERY SELECT 'pending_leave_requests'::TEXT, COUNT(*)
  FROM leave_requests
  WHERE status = 'pending'
  AND date_range && (SELECT date_range FROM payroll_periods WHERE id = p_payroll_period_id);

  -- Check 3: Missing statutory profiles
  RETURN QUERY SELECT 'missing_statutory_profiles'::TEXT, COUNT(*)
  FROM employees e
  WHERE e.id IN (SELECT employee_id FROM payroll_eligibility WHERE is_eligible = true)
  AND NOT EXISTS (SELECT 1 FROM statutory_profiles sp WHERE sp.employee_id = e.id);
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Statutory Deduction Engine

```sql
-- Calculate statutory deductions using versioned rules
CREATE FUNCTION compute_statutory_deductions(
  p_employee_id UUID,
  p_gross_earnings NUMERIC,
  p_payroll_period_id UUID
) RETURNS TABLE (
  deduction_type TEXT,
  amount NUMERIC,
  rule_version_id UUID
);
```

**Deduction Rules**:
- **PF**: 12% of (Basic + DA), capped at ₹15,000 wage ceiling
- **ESI**: 0.75% of gross (employee), 3.25% (employer), above ₹21,000 threshold
- **PT**: State-specific slabs (Karnataka, Maharashtra, etc.)
- **TDS**: Old Regime / New Regime tax calculation

### 5.4 F&F Settlement Calculation

```sql
-- Calculate Full & Final settlement
CREATE FUNCTION compute_ff_settlement(
  p_employee_id UUID,
  p_separation_record_id UUID
) RETURNS TABLE (
  component_type TEXT,  -- 'earnings' or 'deductions'
  component_name TEXT,
  amount NUMERIC
);
```

**Components**:
- **Earnings**: Earned Leave encashment (26-day divisor), unused balances
- **Deductions**: Asset recovery, LOP days, advances (future)
- **Tax**: Statutory deductions on exit

---

## 6. Server Actions Layer

### 22 Server Action Files

| File | Purpose | Key Actions |
|---|---|---|
| `approvals.ts` | Unified approval inbox | `getPendingApprovals()`, `approveItem()`, `rejectItem()` |
| `attendance.ts` | Attendance operations | `punchCheckIn()`, `punchCheckOut()`, `submitCorrection()` |
| `auth.ts` | Authentication | `login()`, `logout()`, `resetPassword()`, `getCurrentUserRoles()` |
| `calendar.ts` | Calendar management | `createTemplate()`, `assignCalendar()`, `selectOptionalHoliday()` |
| `departments.ts` | Department CRUD | `createDepartment()`, `updateDepartment()` |
| `eligibility.ts` | Payroll eligibility | `setEligibility()`, `getEligibilitySnapshots()` |
| `employees.ts` | Employee management | `createEmployee()`, `importCSV()`, `deactivateEmployee()` |
| `encashment.ts` | Leave encashment | `applyEncashment()`, `approveEncashment()` |
| `jobs.ts` | Scheduled jobs | `getJobLogs()`, `rerunJob()` |
| `leave.ts` | Leave operations | `applyLeave()`, `cancelLeave()`, `approveLeave()` |
| `notifications.ts` | Notifications | `getNotifications()`, `markRead()` |
| `offboarding.ts` | Offboarding workflow | `submitResignation()`, `rescindResignation()`, `createFFSettlement()` |
| `payroll.ts` | Payroll operations | `initiatePeriod()`, `runPayroll()`, `finalizePeriod()`, `publishPayslips()` |
| `permissions.ts` | Permission management | `assignRole()`, `removeRole()` |
| `reimbursements.ts` | Expense claims | `submitClaim()`, `approveClaim()` |
| `reports.ts` | Report generation | `exportAttendance()`, `exportLeave()`, `exportPayroll()` |
| `salary.ts` | Salary management | `createComponent()`, `assignStructure()` |
| `settings.ts` | Company settings | `updateSettings()`, `configurePolicies()` |
| `statutory.ts` | Statutory management | `createRuleVersion()`, `updateProfile()` |

### Permission Gating Pattern

Every Server Action follows this pattern:

```typescript
"use server";

import { assertPermission } from "@/lib/auth/assertPermission";

export async function someAction(data: SomeInput) {
  // 1. Permission gate
  await assertPermission('module.action.scope');
  
  // 2. Validate input
  validateInput(data);
  
  // 3. Execute business logic
  const result = await executeBusinessLogic(data);
  
  // 4. Log audit trail
  await logAuditEvent(result);
  
  // 5. Send notifications
  await sendNotifications(result);
  
  return result;
}
```

### `assertPermission()` Implementation

```typescript
// src/lib/auth/assertPermission.ts
export async function assertPermission(permissionCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const employee = await getEmployee(user.id);
  if (!employee) throw new Error('Employee not found');
  
  const { data: allowed } = await supabase.rpc('has_permission', {
    p_employee_id: employee.id,
    p_permission_code: permissionCode,
  });
  
  if (!allowed) throw new ForbiddenError(permissionCode);
}
```

---

## 7. Middleware Architecture

### Request Processing Pipeline

```
Request → CSP Nonce Generation → Route Gate Resolution → Auth Check → Permission Check → Response
```

### Mock Mode vs Real Mode

| Mode | Auth | Permission Check | Use Case |
|---|---|---|---|
| **Mock** (`NEXT_PUBLIC_MOCK_AUTH=true`) | Cookie-based email token | Static RBAC table (`mock-rbac.ts`) | Local development, E2E tests |
| **Real** (Supabase configured) | Supabase Auth session | DB queries via `has_any_permission()` RPC | Production, live testing |

### Middleware Optimizations

| Optimization | Description | Status |
|---|---|---|
| **Batch permission RPC** | Single `has_any_permission()` call instead of N sequential `has_permission()` calls | ✅ Implemented |
| **Route gate caching** | `getRouteConfig()` resolves route once per request | ✅ Implemented |
| **System Admin bypass** | Skip permission check for `system_admin` role | ✅ Implemented |

---

## 8. Authentication Flow

### Login Flow

```
1. User submits credentials to /login
2. Supabase Auth verifies email/password
3. Session cookie set (sb-access-token)
4. Middleware resolves user → employee → roles
5. Dashboard rendered with role-appropriate content
```

### First-Login Password Reset (ADR 0001)

```
1. HR creates employee with temporary password
2. Employee logs in with temp credentials
3. ForcePasswordResetModal appears (must_change_password = true)
4. Employee enters new password
5. Account status: invited → active
6. Full access granted
```

### Session Management

- **Cookie-based**: `sb-access-token` cookie for SSR sessions
- **Mock token**: Email-based token for development/testing
- **Session resolution**: Middleware resolves employee and roles on every request

---

## 9. Background Jobs

### Scheduled Jobs

| Job | Purpose | Schedule |
|---|---|---|
| **Year-end carry-forward** | Process leave balance carry-forward and lapse | Annual (Dec 31) |
| **Comp-off expiry** | Forfeit expired comp-off credits (90-day expiry) | Daily |
| **Optional holiday auto-allocation** | Allocate default holiday set for employees who missed selection deadline | Annual (post-deadline) |
| **Malware scan** | Scan uploaded attachments for threats | On upload |

### Job Execution

- Triggered via `/jobs` route (System Admin / HR Admin)
- Logged in `scheduled_job_logs` table
- Manual rerun capability via `job.rerun` permission

---

## 10. Audit Trail

### Immutable Audit Logs

Every administrative mutation creates an audit log entry:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,      -- 'employee', 'leave_request', 'payroll_period'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,            -- 'create', 'update', 'delete', 'approve'
  actor_id UUID NOT NULL,         -- Employee who performed the action
  old_values JSONB,                -- Previous state
  new_values JSONB,                -- New state
  reason TEXT,                     -- Optional reason for change
  correlation_id UUID,             -- Links related changes
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Coverage

| Module | Mutations Audited |
|---|---|
| Employee lifecycle | Onboarding, status changes, deactivation |
| Attendance | Punch events, corrections, approvals |
| Leave | Applications, cancellations, approvals |
| Payroll | Period initiation, run execution, finalization |
| Salary | Component creation, structure assignment |
| Statutory | Rule version creation, profile updates |
| Reimbursements | Claim submission, approval/rejection |
| Offboarding | Resignation, rescission, F&F settlement |
| Settings | Company configuration changes |
| RBAC | Role assignments, permission changes |

---

## 11. Data Integrity Patterns

### Exclusion Constraints

```sql
-- Prevent overlapping salary structures per employee
EXCLUDE USING gist (
  employee_id WITH =,
  daterange(effective_start_date, effective_end_date, '[]') WITH &&
);

-- Prevent overlapping leave requests per employee
EXCLUDE USING gist (
  employee_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
);
```

### Foreign Key Relationships

```
employees → employee_assignments (department, manager, designation)
employees → employee_roles → roles → role_permissions → permissions
employees → leave_requests → leave_request_approvals
employees → attendance_records → attendance_punches
employees → payroll_eligibility
employees → employee_salary_structures → employee_salary_structure_items
employees → statutory_profiles
employees → separation_records → offboarding_checklists → ff_settlement_records
employees → reimbursement_claims → reimbursement_receipts
```

### Cascading Rules

- **ON DELETE CASCADE**: Child records removed when parent deleted
- **ON DELETE SET NULL**: Optional references nullified on parent delete
- **ON UPDATE CASCADE**: ID changes propagate to children

---

## 12. Environment Configuration

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Mock Mode (Development/Testing)
NEXT_PUBLIC_MOCK_AUTH=true  # Enable mock authentication

# Rate Limiting (Optional - Upstash)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Database Bootstrap

```bash
# Initial System Admin setup (break-glass)
psql -f schema/bootstrap/01_system_admin.sql

# Seed mock data for development
npm run seed:mock
```

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
