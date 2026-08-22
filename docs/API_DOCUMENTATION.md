# API & Server Actions Reference

This document provides a comprehensive reference for all 22 Server Action modules, PostgreSQL Stored Procedures (RPCs), and REST Route Handlers in the Enterprise HRMS (v2.7).

---

## 🏗️ 1. Architecture & Design Principles

The backend is built around **Next.js Server Actions** (`src/lib/actions/`) executing on the server in a Node.js runtime with direct database access via Supabase:

```typescript
// Standard Server Action Contract
export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

### Security Pattern & Defense-in-Depth
Every mutating action enforces three layers of defense:
1. **Authentication Check**: Verifies active session via Supabase Auth (`supabase.auth.getUser()`) or cryptographic Mock Session cookie (`resolveMockSession()`).
2. **Granular RBAC Authorization**: Validates permissions using `assertPermission(permCode)` or `assertAnyPermission([permCodes])`.
3. **Anti-Self-Approval & Identity Scoping**: Enforces that users cannot approve their own requests (leaves, corrections, claims, clearances) via `assertCallerIdentity()` or domain routing checks.

---

## 📦 2. Server Action Modules (22 Modules)

The application organizes backend logic into 22 dedicated Server Action modules in `src/lib/actions/`:

### 🔐 1. Authentication & Session (`auth.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `loginAction(formData)` | None (Public) | Authenticates user via email/password; handles temporary password reset flag (`must_change_password`) |
| `logoutAction()` | Authenticated | Terminates active session and clears session cookies |
| `resetPasswordAction(newPassword)` | Authenticated | Sets permanent password and clears `must_change_password` flag (`invited` → `active`) |
| `getCurrentUserRolesAction()` | Authenticated | Retrieves current user profile, assigned roles, and effective permission union |
| `switchPersonaAction(personaCode)` | Dev/Test Only | Switches active simulated persona when `NEXT_PUBLIC_MOCK_AUTH=true` |

---

### ⏱️ 2. Attendance & Punch Engine (`attendance.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `punchCheckInAction()` | `attendance.mark.self` | Records clock-in timestamp with geolocation and starts timer |
| `punchCheckOutAction()` | `attendance.mark.self` | Records clock-out timestamp and computes total worked duration |
| `submitCorrectionAction(data)` | `attendance.correct.self` | Submits punch adjustment request with reason and timing |
| `reviewCorrectionAction(data)` | `attendance.correct.approve` / `attendance.correct.override` | Approves or rejects punch adjustment; updates record to `present` or `half_day` |
| `getAttendanceRecordsAction(filter)` | `attendance.view.self` / `team` / `all` | Retrieves attendance records scoped to self, direct reports, or all employees |
| `getAttendanceStatsAction(params)` | `attendance.view.self` / `team` / `all` | Retrieves attendance summary aggregates (present, half-day, anomalies, LOP) |

---

### 🌴 3. Leave Management & Policy (`leave.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `applyLeaveAction(data)` | `leave.apply.self` | Submits leave request with sandwich policy calculation and reservation in `leave_ledger` |
| `cancelLeaveAction(requestId)` | `leave.cancel.self` | Cancels pending leave request; restores balance |
| `withdrawLeaveRequestAction(id)` | `leave.cancel.self` | Transitions pending leave to `withdrawn` state and restores quota |
| `reviewLeaveAction(requestId, status, note)` | `leave.approve.manager` / `leave.approve.hr` | Approves/rejects leave; enforces anti-self-approval and FR §1.4 alternate routing |
| `getLeaveBalancesAction(employeeId)` | `leave.view.self` / `team` / `all` | Returns available, used, pending, and accrued balances per leave type |
| `getLeaveRequestsAction(filter)` | `leave.view.self` / `team` / `all` | Returns leave requests with medical privacy masking for parental leaves (FR §4.7) |

---

### 💰 4. Payroll Execution & Revisions (`payroll.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `initiatePayrollPeriodAction(month, year)` | `payroll.run` | Initializes a draft monthly payroll run for active eligible employees |
| `runPayrollCalculationAction(periodId)` | `payroll.run` | Executes pro-rata earnings and statutory deduction batch calculation |
| `finalizePayrollPeriodAction(periodId)` | `payroll.finalize` | Validates pre-flight locks (FR §5.7) and finalizes payroll period |
| `reopenPayrollPeriodAction(periodId, reason)` | `payroll.reopen` | Reopens a finalized payroll run, generating a new versioned `payroll_revision` |
| `publishPayslipsAction(periodId)` | `payroll.publish` | Releases published payslips to employee self-service portal |
| `getPayslipAction(payslipId)` | `salary.view.self` / `payroll.view` | Retrieves formatted payslip breakdown for view and download |
| `getPayrollPeriodsAction()` | `payroll.view` | Retrieves list of all payroll periods with status, revisions, and counts |

---

### ⚖️ 5. Statutory Compliance Engine (`statutory.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getStatutoryProfilesAction()` | `statutory.view` | Retrieves employee statutory profiles (PAN, UAN, PF/ESI numbers, PT State, Tax Regime) |
| `updateStatutoryProfileAction(id, data)` | `statutory.edit` | Updates employee statutory profile data |
| `getStatutoryRuleVersionsAction()` | `statutory.view` | Retrieves effective-dated PF, ESI, PT, and TDS statutory rule versions |
| `createStatutoryRuleVersionAction(data)` | `statutory.edit` | Creates a new effective-dated statutory rule version |

---

### 👥 6. Employee Directory & Lifecycle (`employees.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `createEmployeeAction(data)` | `employee.create` | Onboards new employee with temporary password and initial assignments |
| `updateEmployeeAction(id, data)` | `employee.edit` | Updates employee profile, department, manager, or designation |
| `getEmployeesAction(filter)` | `employee.view.self` / `team` / `all` | Returns paginated employee list scoped by caller permissions |
| `getEmployeeByIdAction(id)` | `employee.view.self` / `team` / `all` | Retrieves comprehensive employee record with assignment history |
| `importEmployeesAction(fileData)` | `employee.import` | Validates and bulk imports employees from CSV file |
| `toggleEmployeeDeactivationAction(id, deactivated)` | `employee.deactivate` | Toggles employee access without mutating employment lifecycle status |

---

### 🧾 7. Expense Reimbursements (`reimbursements.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `submitReimbursementClaimAction(data)` | `reimbursement.apply.self` | Submits expense claim with category, receipt attachments, and duplicate detection |
| `reviewReimbursementClaimAction(id, status, note)` | `reimbursement.approve` | Executes multi-stage review (`manager_then_hr` → `pending_manager` → `pending_hr` → `approved`) |
| `cancelReimbursementClaimAction(id)` | `reimbursement.cancel.self` | Cancels pending reimbursement claim |
| `getReimbursementClaimsAction(filter)` | `reimbursement.apply.self` / `view.team` / `view.all` | Retrieves claims scoped by caller permissions |
| `getReimbursementCategoriesAction()` | Authenticated | Retrieves configured reimbursement categories with policy caps and taxability flags |

---

### 🚪 8. Offboarding & F&F Settlement (`offboarding.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `submitResignationAction(data)` | `separation.view` / `separation.create` | Submits resignation and calculates standard Last Working Day (LWD) |
| `rescindResignationAction(id, reason)` | `separation.edit` / `offboarding.manage` | Rescinds resignation before LWD, restoring active employee status |
| `reviewResignationAction(id, status, lwd)` | `separation.edit` / `offboarding.manage` | Reviews resignation and approves/adjusts Last Working Day |
| `updateClearanceTaskAction(taskId, status, notes)` | `offboarding.manage` | Updates department clearance checklist (IT, Finance, Admin, HR) |
| `createFFSettlementAction(separationId)` | `ff.create` | Generates draft F&F settlement (encashment, asset recovery, deductions) |
| `approveFFSettlementAction(settlementId)` | `ff.approve` | Finalizes and signs off on F&F settlement payout |
| `getSeparationRecordsAction()` | `separation.view` | Retrieves separation records and clearance statuses |

---

### 💵 9. Leave Encashment (`encashment.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `applyLeaveEncashmentAction(data)` | `leave.encash.apply.self` | Submits leave encashment request (calculated via 26-day statutory divisor) |
| `reviewLeaveEncashmentAction(id, status, note)` | `leave.encash.approve` | Reviews and approves/rejects leave encashment request |
| `getEncashmentRequestsAction()` | `leave.view.self` / `leave.view.all` | Retrieves encashment requests scoped to caller |

---

### 📅 10. Organization & Work Calendar (`calendar.ts`, `departments.ts`)
| Action | Module | Required Permission | Description |
|---|---|---|---|
| `getCalendarTemplatesAction()` | `calendar.ts` | Authenticated | Retrieves work calendar templates (5-Day, 6-Day, Shift) |
| `createCalendarTemplateAction(data)` | `calendar.ts` | `settings.manage` | Creates a new work calendar template |
| `assignCalendarTemplateAction(data)` | `calendar.ts` | `calendar.bulk_assign` / `settings.manage` | Assigns calendar template to employee or department |
| `addHolidayAction(data)` | `calendar.ts` | `settings.manage` | Adds compulsory or optional holiday to template |
| `selectOptionalHolidayAction(holidayId)`| `calendar.ts` | `employee.view.self` | Employee selects optional floating holiday before annual cutoff |
| `getDepartmentsAction()` | `departments.ts` | Authenticated | Retrieves company departments and hierarchy |
| `createDepartmentAction(data)` | `departments.ts` | `department.bulk_assign` / `settings.manage` | Creates a new department |
| `updateDepartmentAction(id, data)` | `departments.ts` | `settings.manage` | Updates department details or department head |
| `getDesignationsAction()` | `departments.ts` | Authenticated | Retrieves company designations master |

---

### 📥 11. Unified Approvals Inbox (`approvals.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getUnifiedApprovalsAction(params)` | `leave.approve.*`, `attendance.correct.approve`, `reimbursement.approve`, `ff.approve`, `compoff.approve` | Aggregates all pending approval items across modules with unpaginated count |
| `decideApprovalAction(module, id, decision, note)` | Module-specific approval permission | Approves or rejects an item from the unified inbox |
| `getApprovalDetailAction(module, id)` | Module-specific view permission | Retrieves comprehensive request context, history, and applicant info |

---

### 📎 12. Document Attachments (`attachments.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `uploadAttachmentAction(formData)` | `attachment.upload` | Uploads file to Supabase Storage with type/size validation and malware scan tracking |
| `getAttachmentsAction(entityType, entityId)` | `attachment.view` | Retrieves attachments linked to a specific entity |
| `deleteAttachmentAction(attachmentId)` | `attachment.upload` | Deletes an attachment |

---

### 📜 13. System Audit Trail (`audit.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getAuditLogsAction(filter)` | `audit.view` | Retrieves filterable, immutable audit log events with actor, old/new values, and correlation IDs |
| `logAuditEventAction(eventData)` | Internal / Authenticated | Emits structured audit log record |

---

### 🔍 14. Global Data & Search (`data.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `globalSearchAction(query)` | Authenticated (Caller Scoped) | Scoped global search (Ctrl+K); admins search all entities, managers search direct reports, employees search self |
| `getDashboardDataAction()` | Authenticated | Resolves dashboard metrics, active punch state, and pending approvals |
| `seedInitialDataAction()` | `system_admin` | Populates mock catalog and test data in dev/test mode |

---

### 📋 15. Payroll Eligibility (`eligibility.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getPayrollEligibilityAction()` | `payroll.view` | Retrieves effective-dated binary payroll eligibility records |
| `setPayrollEligibilityAction(empId, eligible, reason)` | `payroll.run` | Sets payroll eligibility inclusion/exclusion flag with effective dates |
| `getEligibilitySnapshotsAction(periodId)` | `payroll.view` | Retrieves payroll eligibility snapshot data for a specific period |

---

### ⚙️ 16. Scheduled Jobs Governance (`jobs.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getScheduledJobLogsAction()` | `job.view` | Retrieves execution history and status of automated background jobs |
| `rerunScheduledJobAction(jobName)` | `job.rerun` | Triggers immediate manual re-execution of a scheduled job (e.g. comp-off expiry) |

---

### 🔔 17. Notifications Inbox (`notifications.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getNotificationsAction()` | Authenticated | Retrieves current user's in-app notifications with unread count |
| `markNotificationReadAction(id)` | Authenticated | Marks a specific notification as read |
| `markAllNotificationsReadAction()` | Authenticated | Marks all unread notifications as read |

---

### 🛡️ 18. Role & Permission Governance (`permissions.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `assignEmployeeRoleAction(empId, roleCode)` | `settings.manage` | Assigns an enterprise role to an employee (enforces `block_self_grant` trigger) |
| `removeEmployeeRoleAction(empId, roleCode)` | `settings.manage` | Removes an assigned role from an employee |
| `applyShortPermissionAction(data)` | `permission.apply.self` | Submits short-permission pass request (enforces 120-minute monthly quota) |
| `reviewShortPermissionAction(id, status, note)` | `permission.approve` | Approves or rejects short-permission pass request |
| `manualCreditCompOffAction(empId, days, reason)` | `compoff.credit.manual` | Grants manual comp-off balance credit with 90-day expiry |
| `revokeCompOffAction(grantId, reason)` | `compoff.revoke` | Revokes an active comp-off credit balance |

---

### 📊 19. Executive Reports Export (`reports.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `exportAttendanceReportAction(params)` | `reports.export` | Generates and exports Attendance Summary report as CSV |
| `exportLeaveReportAction(params)` | `reports.export` | Generates and exports Leave Utilization report as CSV |
| `exportPayrollReportAction(params)` | `reports.export` | Generates and exports Monthly Payroll Register as CSV |
| `exportStatutoryReportAction(params)` | `reports.export` | Generates and exports EPFO / ESIC Statutory Compliance Register as CSV |

---

### 💵 20. Compensation & Salary Structures (`salary.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `createSalaryComponentAction(data)` | `salary.edit` | Creates salary component (earning, deduction, statutory, PF/ESI flags) |
| `updateSalaryComponentAction(id, data)` | `salary.edit` | Updates salary component configuration |
| `assignSalaryStructureAction(data)` | `salary.edit` / `salary.bulk_assign` | Assigns per-employee versioned salary structure with effective date range |
| `getSalaryStructuresAction(empId)` | `salary.view.self` / `salary.view.all` | Retrieves salary structures (hidden from Manager per FR §5.8) |
| `getSalaryComponentsAction()` | `salary.view.all` | Retrieves all active salary components master list |

---

### ⚙️ 21. Company Settings (`settings.ts`)
| Action | Required Permission | Description |
|---|---|---|
| `getCompanySettingsAction()` | Authenticated | Retrieves company profile and policy toggles |
| `updateCompanySettingsAction(data)` | `settings.manage` | Updates company configuration, `alternate_hr_approver_id`, and policy settings |

---

## 🗄️ 3. PostgreSQL Stored Procedures (RPCs)

The database exposes core business logic functions called via Supabase RPC:

```sql
-- 1. Check if user holds a specific permission
SELECT has_permission('emp-uuid-1234', 'leave.approve.manager');

-- 2. Batch permission check for middleware (avoids N+1 query patterns)
SELECT has_any_permission(ARRAY['payroll.view', 'payroll.run']);

-- 3. Calculate net leave days with sandwich policy
SELECT calculate_leave_days('2026-09-01', '2026-09-05', 'full_day', true);

-- 4. Validate pre-flight payroll finalization locks (FR §5.7)
SELECT * FROM validate_payroll_lock('payroll-period-uuid');

-- 5. Execute bulk payroll run calculation
SELECT compute_payroll('payroll-period-uuid');

-- 6. Global search across permitted entities
SELECT * FROM search_global('John');
```

---

## 🌐 4. REST Route Handlers

### `GET /api/health`
System diagnostic and readiness health check endpoint.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "2.7.0",
  "timestamp": "2026-08-22T09:00:00.000Z",
  "environment": "development",
  "database": {
    "status": "connected",
    "latencyMs": 35
  }
}
```
