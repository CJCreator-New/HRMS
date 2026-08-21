# API & Server Actions Reference

This document provides a comprehensive reference for the Server Actions, PostgreSQL Stored Procedures (RPCs), and REST Route Handlers in the Enterprise HRMS.

---

## 🏗️ 1. Architecture & Design Principles

The backend is built around **Next.js Server Actions** (`src/lib/actions/`) that execute on the server inside NodeJS runtime with full direct database access via Supabase:

```typescript
// Standard Server Action Contract
export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

### Security Pattern
Every mutating action enforces two layers of defense:
1. **Authentication Check**: Verifies active session (via Supabase Auth or verified Mock Session cookie).
2. **Granular RBAC Authorization**: Validates permissions using `assertPermission(user, 'required.permission')`.

---

## 📦 2. Server Action Modules

The application organizes backend logic into 22 dedicated Server Action modules in `src/lib/actions/`:

### 🔐 1. Authentication & Session (`auth.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `login(formData)` | None (Public) | Authenticates user via email/password; handles temporary password reset redirection |
| `logout()` | Authenticated | Terminates active session and clears session cookies |
| `resetPassword(newPassword)` | Authenticated | Sets permanent password and clears `must_reset_password` flag |
| `switchPersona(personaCode)` | Dev/Test Only | Switches active simulated role when `NEXT_PUBLIC_MOCK_AUTH=true` |
| `getCurrentUser()` | Authenticated | Retrieves current user profile, roles, and effective permission list |

---

### ⏱️ 2. Attendance & Punch Engine (`attendance.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `punchIn()` | `attendance.punch` | Records clock-in timestamp with client IP and validation |
| `punchOut()` | `attendance.punch` | Records clock-out timestamp and computes total worked hours |
| `submitAttendanceCorrection(data)` | `attendance.correct` | Submits punch adjustment request with justification |
| `reviewAttendanceCorrection(data)` | `attendance.approve` | Approves or rejects an employee's punch correction |
| `getAttendanceRecords(filter)` | `attendance.view` | Retrieves historical attendance logs for employee or team |

---

### 🌴 3. Leave Management & Policy (`leave.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `applyLeave(data)` | `leave.apply` | Submits leave request with automated sandwich policy deduction calculation |
| `cancelLeave(requestId)` | `leave.cancel` | Cancels pending or upcoming approved leave; restores balance |
| `reviewLeave(requestId, status, note)`| `leave.approve` | Approves/rejects leave; enforces anti-self-approval |
| `grantCompOff(data)` | `leave.manage_policy` | Awards compensatory off balance linked to worked weekend attendance |
| `getLeaveBalances(employeeId)` | `leave.view` | Returns real-time available, used, and accrued balances by leave type |

---

### 💰 4. Payroll Execution & Revisions (`payroll.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `createPayrollRun(month, year)` | `payroll.create` | Initializes a draft monthly payroll run for active employees |
| `computePayrollRun(runId)` | `payroll.compute` | Executes pro-rata earnings and statutory deduction batch calculation |
| `finalizePayrollRun(runId)` | `payroll.finalize` | Locks payroll run against further edits and triggers payslip generation |
| `publishPayslips(runId)` | `payroll.publish` | Releases published payslips to employee self-service portal |
| `getPayslip(payslipId)` | `payroll.view` | Retrieves formatted payslip breakdown for download/view |

---

### ⚖️ 5. Statutory Compliance Engine (`statutory.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getStatutoryConfigs()` | `statutory.view` | Retrieves PF, ESI, Professional Tax (PT), and TDS tax slab configurations |
| `updateStatutoryConfig(data)` | `statutory.manage` | Updates statutory contribution rates and wage ceilings |
| `calculateStatutoryDeductions(salary)`| `payroll.compute` | Computes employer and employee PF/ESI/PT/TDS contributions |

---

### 👥 6. Employee Directory & Lifecycle (`employees.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `createEmployee(data)` | `employee.create` | Creates new employee record with initial department and designation |
| `updateEmployee(id, data)` | `employee.edit` | Updates employee details, reporting manager, or contact info |
| `getEmployeeById(id)` | `employee.view` | Retrieves comprehensive employee profile |
| `listEmployees(params)` | `employee.view` | Returns paginated employee list with search and filter capabilities |

---

### 🧾 7. Expense Reimbursements (`reimbursements.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `submitClaim(data)` | `reimbursement.apply` | Submits expense claim with category and attached receipt |
| `reviewClaim(claimId, status, note)` | `reimbursement.approve`| Approves or rejects reimbursement claim |
| `getClaims(filter)` | `reimbursement.view` | Retrieves claims list for employee, team, or finance queue |

---

### 🚪 8. Offboarding & F&F Settlement (`offboarding.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `submitResignation(data)` | `separation.apply` | Submits resignation and calculates standard Last Working Day (LWD) |
| `reviewResignation(id, status)` | `separation.approve`| Manager/HR approval of resignation date and handover |
| `updateClearanceTask(taskId, status)`| `separation.clearance`| Updates department clearance checklist (IT, Finance, Admin, HR) |
| `generateFFDraft(separationId)` | `separation.manage_ff`| Computes draft F&F settlement (encashment, recovery, deductions) |
| `finalizeFFSettlement(settlementId)`| `separation.finalize_ff`| Finalizes and signs off on settlement payout |

---

### 💵 9. Leave Encashment (`encashment.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `requestEncashment(data)` | `leave.encash` | Submits leave balance encashment request |
| `reviewEncashment(id, status)` | `leave.approve_encash`| Reviews encashment request against policy balance limits |

---

### 📅 10. Organization & Calendar (`calendar.ts`, `departments.ts`)
| Action | Module | Description |
|---|---|---|
| `getCalendars()` | `calendar.ts` | Retrieves work calendars (Metro, Regional, Shift) |
| `addHoliday(data)` | `calendar.ts` | Adds public or optional holiday to specific calendar |
| `getDepartments()` | `departments.ts` | Retrieves company department hierarchy |
| `createDepartment(data)` | `departments.ts` | Creates new department entity |

---

## 🗄️ 3. PostgreSQL Stored Procedures (RPCs)

The database exposes core business logic functions called via Supabase RPC:

```sql
-- 1. Check if user has permission
SELECT has_permission('user-uuid-1234', 'leave.approve');

-- 2. Calculate net leave days with sandwich policy
SELECT calculate_leave_days('2026-09-01', '2026-09-05', 'leave-type-uuid', 'emp-uuid');

-- 3. Execute bulk payroll run calculation
SELECT compute_payroll('payroll-run-uuid');
```

---

## 🌐 4. REST Route Handlers

### `GET /api/health`
System diagnostic and readiness health check.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "2.7.0",
  "timestamp": "2026-08-21T12:00:00.000Z",
  "environment": "development",
  "database": {
    "status": "connected",
    "latencyMs": 42
  }
}
```
