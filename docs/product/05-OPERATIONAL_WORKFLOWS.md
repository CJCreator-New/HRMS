# HRMS v2.7 — In-App Operational Workflows

> **Audience**: Product, Engineering, Operations, QA  
> **Authority**: FR v2.7, `docs/FLOW_MATRIX.md`  
> **Last Updated**: August 19, 2026

---

## 1. Overview

This document details the operational workflows within each module, describing the exact UI interactions, system responses, state transitions, and validation rules that govern day-to-day operations.

---

## 2. Module 00: Dashboard (`/`)

### Widget: Role-Aware Greeting

- **Component**: `RoleGreeting` (client island)
- **Behavior**: Displays greeting based on active role context
- **Server Resolution**: User roles and name resolved on server

### Widget: Quick Actions (Server-Rendered)

- **Visibility**: Permission-gated per action
- **Actions Shown**:
  - Employee: "Punch Attendance", "Apply for Leave"
  - Manager: Above + "Review Approvals"
  - HR: Above + "Direct Onboard"
  - Payroll Admin: Above + "Open Payroll"
  - System Admin: Above + "Company Settings"

### Widget: Punch Card

- **Component**: `PunchCard` (client island)
- **Data Source**: Server-resolved `getDashboardData()`
- **Actions**:
  - `Check In` → Records timestamp + geolocation → Starts timer
  - `Check Out` → Computes work duration → Saves record
- **State**: Local state only (known gap: no `router.refresh()`)

### Widget: Pending Approvals

- **Visibility**: Users with approval permissions
- **Data**: `pendingApprovalsCount` from RoleContext
- **Link**: `/approvals`

### Widget: Headcount Summary

- **Visibility**: Users with `employee.view.all`
- **Data**: Server-resolved active employee count + new-this-month count
- **Link**: `/employees`

---

## 3. Module 01: RBAC (`/permissions`, `/settings`)

### Role Assignment Flow

1. **Navigate to `/permissions`** (System Admin only)
2. **Select employee** from directory
3. **View assigned roles** (current state)
4. **Add/remove roles** via checkbox interface
5. **System validates**:
   - Self-grant prevention (`trg_block_self_grant` trigger)
   - Role existence in `roles` table
6. **Save changes** → Server Action `assignRole()` → Audit log created
7. **Permissions update immediately** (next request uses new union)

### Company Settings Management

1. **Navigate to `/settings`** (HR Admin / System Admin)
2. **Configure**:
   - Company name, logo
   - `alternate_hr_approver_id` (for FR §1.4)
   - `manager_sla_days`
   - `is_configured` (zero-seed gate)
3. **Save** → Server Action `updateSettings()` → Audit log created

---

## 4. Module 02: Employee Lifecycle

### 4.1 Direct Onboarding (`/onboarding`)

**Form Fields**:
| Field | Type | Required | Validation |
|---|---|---|---|
| Employee Code | Text | Yes | Unique, format: `EMP-XXX` |
| Full Name | Text | Yes | Min 2 characters |
| Email | Email | Yes | Unique, valid format |
| Phone | Tel | No | Valid phone format |
| Date of Joining | Date | Yes | Cannot be future |
| Initial Password | Password | Yes | Min 8 chars, complexity |
| Roles | Multi-select | Yes | At least one role |

**State Transitions**: `invited` → (forced reset) → `active`

**System Actions**:
- Creates employee record with `must_change_password = true`
- Creates Supabase Auth user with temporary password
- Assigns initial roles
- Logs audit event

### 4.2 CSV Bulk Import (`/employees/import`)

**Upload Process**:
1. Download CSV template
2. Fill employee data
3. Upload CSV file
4. System validates row-by-row:
   - Duplicate email detection
   - Required field validation
   - Role existence check
5. Validation report displayed:
   - ✅ Valid rows (ready to import)
   - ❌ Invalid rows (with error messages)
6. Confirm import → Bulk create employees

### 4.3 Employee Directory (`/employees`)

**Views**:
- **Employee**: Own profile only (`self` scope)
- **Manager**: Team members (`team` scope)
- **HR/Admin**: All employees (`all` scope)
- **Payroll Admin**: Read-only with amber banner

**Actions**:
- View employee details (Drawer)
- Edit employee (HR/Admin only)
- Deactivate employee (HR/Admin only)
- View separation status

---

## 5. Module 04: Work Calendar (`/calendar`)

### Calendar Template Management

1. **Create template**:
   - Name (e.g., "5-Day Week", "6-Day Week")
   - Working days configuration
   - Save → Template available for assignment

2. **Configure holidays**:
   - Compulsory holidays (all employees)
   - Optional holidays (employee selection)
   - Save → Holidays recognized by attendance/leave engines

3. **Assign to employees**:
   - Select template
   - Assign to employee(s) or department
   - Effective date range
   - Save → Assignment active from effective date

### Optional Holiday Selection

1. **Employee opens `/calendar`**
2. **Views default optional holiday list** (HR-curated)
3. **Selects holidays** before deadline
4. **Save selections** → Credited to employee
5. **Post-deadline**: System auto-allocates default set

---

## 6. Module 05: Attendance (`/attendance`)

### Punch Check-In/Out Flow

**Check-In**:
1. Click "Check In" button
2. System records:
   - Timestamp (server time)
   - Geolocation (browser API)
   - Employee ID
3. Create/update `attendance_records` with `status = 'present'`
4. Create `attendance_punches` record
5. Start work duration timer

**Check-Out**:
1. Click "Check Out" button
2. System records check-out timestamp
3. Auto-compute work duration:
   - `work_duration = check_out_time - check_in_time`
4. Update `attendance_records`
5. Stop timer

### Attendance Correction Flow

**Trigger**: Missing check-out or insufficient work duration

1. **System flags record**: `status = 'pending_review'`
2. **Notification sent** to employee
3. **Employee submits correction**:
   - Missing time (check-in or check-out)
   - Reason for correction
   - Supporting details
4. **Manager reviews**:
   - View correction details
   - Approve → Status updates to `present` or `half_day`
   - Reject → Status remains `pending_review` with rejection reason
5. **Audit log created** for both approval and rejection

### Manager Override (HR Admin)

1. **HR navigates to `/attendance`**
2. **Selects any employee** (all scope)
3. **Overrides record** directly:
   - Set status (`present`, `half_day`, `absent`)
   - Set work duration
   - Add override reason
4. **Save** → Record updated, audit log created

---

## 7. Module 06: Leave (`/leave`)

### Leave Application Flow

1. **View balances**:
   - CL: X/Y remaining
   - SL: X/Y remaining
   - EL: X/Y remaining
   - Comp-Off: X remaining (with expiry dates)

2. **Apply for leave**:
   - Select leave type
   - Select start date
   - Select end date (auto-populated for full-day)
   - Select duration type:
     - `full_day` (1.0 day)
     - `first_half` (0.5 day)
     - `second_half` (0.5 day)
   - Add reason (optional)
   - Attach supporting document (optional)

3. **System validates**:
   - ✅ No overlapping leave requests (DB trigger)
   - ✅ Sufficient balance
   - ✅ Sandwich rule applied (if enabled)
   - ✅ Leave type allows this duration

4. **Submit** → Status: `pending`
5. **Routing**:
   - Standard employee → Manager
   - HR Admin → `alternate_hr_approver_id` or System Admin
6. **Approver reviews**:
   - View leave details
   - View employee's leave history
   - Approve → Quota debited, ledger updated
   - Reject → Status: `rejected`, notification sent

### Sandwich Rule Calculation

```
Example: Employee applies leave Mon-Fri (5 days)
Weekend (Sat-Sun) falls within range

Sandwich ENABLED:
  Leave days = 7 (Mon-Sun all counted)
  Quota debited: 7 days

Sandwich DISABLED:
  Leave days = 5 (only working days counted)
  Quota debited: 5 days
```

### Comp-Off Grant Flow

1. **Employee works weekend/holiday** → `extra_work` attendance recorded
2. **Employee requests comp-off**:
   - Links to specific `extra_work` record
   - Select date range (1 day)
3. **Manager reviews**:
   - Verifies extra work record exists
   - Approves → 1-day comp-off credited
4. **Comp-off credit**:
   - Valid for 90 days from work date
   - Auto-expires if unused
   - Added to leave balance

---

## 8. Module 07: Salary (`/salary`)

### Salary Component Management

1. **Create component**:
   - Name (e.g., "Basic", "HRA", "Special Allowance")
   - Component type: `earning` / `deduction` / `statutory`
   - Calculation type: `fixed` / `percentage`
   - Taxability: `taxable` / `non_taxable`
   - PF component: `yes` / `no`
   - ESI component: `yes` / `no`
2. **Save** → Component available for structure assignment

### Per-Employee Versioned Structure

1. **Select employee**
2. **Create new structure version**:
   - Effective start date
   - Effective end date (optional)
   - Assign components with amounts/percentages
3. **Save** → New version created
4. **System enforces**:
   - No overlapping versions per employee (exclusion constraint)
   - Mid-month pro-ration automatically calculated
   - Historical versions preserved

---

## 9. Module 09: Payroll (`/payroll`)

### Payroll Period Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Initiate │ →  │  Draft    │ →  │ Finalized │ →  │ Published │
│  Period   │    │  Run      │    │           │    │           │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                                │
                     │  Recalculate                    │  Employees
                     │  (after corrections)            │  download
                     └────────────────────────────────┘  payslips
```

### Step 1: Initiate Period

1. **Click "Initiate Payroll Period"**
2. **Select month/year**
3. **System creates**:
   - `payroll_periods` record
   - Status: `draft`
   - Period dates calculated

### Step 2: Verify Lock (FR §5.7)

System checks for blocking conditions:

| Check | Blocking Condition |
|---|---|
| Attendance anomalies | Any `pending_review` records in period |
| Pending leaves | Any unresolved leave requests |
| Missing statutory profiles | Any eligible employee without statutory profile |

**If blocked**: Display blocking reasons with counts
**If clear**: Allow payroll execution

### Step 3: Execute Bulk Run

1. **Click "Run Payroll"**
2. **System calculates per employee**:
   - Worked units (from attendance)
   - Paid leave units (from leave ledger)
   - Payable days = worked + paid leave
   - Earnings (salary components, pro-rated)
   - Deductions (statutory, LOP)
   - Net pay
3. **Creates payslips** with component breakdowns
4. **Status**: `draft` with payslips generated

### Step 4: Review & Finalize

1. **Review payslips** in table view
2. **Check component breakdowns** (expandable rows)
3. **Finalize period**:
   - Status: `draft` → `finalized`
   - Payslips locked for editing
   - Revision log created

### Step 5: Publish

1. **Click "Publish Payslips"**
2. **Status**: `finalized` → `published`
3. **Employees can now view/download** their payslips
4. **Notification sent** to all employees

### Recalculation Flow

1. **Attendance/leave correction approved** after draft created
2. **Payroll Admin clicks "Recalculate"**
3. **System recalculates** affected payslips
4. **New payslip versions** created (historical preserved)
5. **`payroll_revision_logs`** entry recorded

### Period Reopening

1. **Click "Reopen Period"**
2. **System creates new revision** (`payroll_revisions` table)
3. **Historical payslips preserved** (not destroyed)
4. **New draft run** can be executed

---

## 10. Module 10: Statutory (`/statutory`)

### Statutory Rule Version Management

1. **Create rule version**:
   - Effective date range
   - Rule type (PF, ESI, PT, TDS)
   - Parameters (rates, caps, thresholds)
2. **Save** → Version active from effective date
3. **System uses** the version active during the payroll period

### Employee Statutory Profile

1. **Select employee**
2. **Configure profile**:
   - PAN number
   - UAN number
   - PF number
   - ESI number
   - PT state
   - Tax regime (Old/New)
3. **Save** → Profile linked to employee
4. **Missing profile** → Blocks payroll finalization (FR §5.7)

---

## 11. Module 11: Reimbursements (`/reimbursements`)

### Claim Submission Flow

1. **Select expense category** (Travel, Internet, etc.)
2. **Enter claim details**:
   - Vendor name
   - Amount
   - Date
   - Description
3. **Upload receipt** (PDF/JPEG/PNG ≤10MB)
4. **System validates**:
   - Duplicate detection (same vendor + amount + date)
   - Policy limit check
   - Taxability classification
5. **Submit** → Status: `pending`

### Approval Routing

| Route | Flow | Status Transitions |
|---|---|---|
| `manager_then_hr` | Employee → Manager → HR | `pending` → `pending_manager` → `pending_hr` → `approved` |
| `hr_only` | Employee → HR | `pending` → `pending_hr` → `approved` |

**Note**: D11 gap — two-stage routing unenforced in code

### Policy Modes

| Mode | Behavior |
|---|---|
| `block` | Claim blocked if over policy limit |
| `warn_and_allow` | Warning shown, claim allowed |
| `allow_always` | No limit enforcement |

---

## 12. Module 12: Leave Encashment (`/encashment`)

### Encashment Request Flow

1. **Employee selects eligible EL days**
2. **System calculates**:
   - Encashment amount = (Monthly basic / 26) × days
3. **Submit request** → Status: `pending`
4. **HR reviews**:
   - View encashment details
   - Approve → Amount added to next payroll run
   - Reject → Status: `rejected`

### Carry-Forward Log

- Year-end background job processes:
  - Leave balances carried forward (per type rules)
  - Leave balances lapsed (per type rules)
- Log entries created in `leave_carry_forward_logs`

---

## 13. Module 13: Offboarding (`/offboarding`)

### Resignation Flow

1. **Employee submits resignation**:
   - Desired LWD
   - Reason
2. **System calculates**:
   - Notice period (60 days)
   - Actual LWD
3. **Status transition**: `active` → `notice_period`
4. **Employee retains access** during notice period

### Rescission Flow

1. **HR navigates to `/offboarding`**
2. **Selects resignation record**
3. **Clicks "Rescind"**
4. **System**:
   - Restores status: `notice_period` → `active`
   - Logs audit event
   - Employee access restored

### F&F Settlement Flow

1. **HR creates settlement record**:
   - Leave encashment earnings
   - Asset recovery deductions (numeric amount)
   - Tax deductions
2. **Status**: `draft`
3. **System monitors for stale inputs**:
   - If leave ledger changes → `is_stale = true`
   - If attendance changes → `is_stale = true`
4. **HR reviews and approves**:
   - Status: `draft` → `approved`
5. **Separation completion**:
   - Employee at LWD + F&F approved
   - Status: `offboarded` + `completed`

---

## 14. Module 14: Documents (`/documents`)

### File Upload Flow

1. **Select file** (PDF, JPEG, PNG ≤10MB)
2. **Upload to Supabase Storage**
3. **System creates attachment record**:
   - `scan_status`: `pending`
4. **Malware scan initiated** (background)
5. **Scan completes**:
   - `scan_status`: `clean` or `flagged`
6. **File available** for viewing/download

---

## 15. Module 15: Audit (`/audit`)

### Audit Log Viewing

1. **Navigate to `/audit`** (HR Admin / System Admin)
2. **View logs** with filters:
   - Entity type
   - Action type
   - Actor
   - Date range
3. **View details**:
   - Old values (JSON)
   - New values (JSON)
   - Reason
   - Correlation ID
   - Actor ID
   - Timestamp

---

## 16. Module 16: Notifications (Header Bell)

### Notification Types

| Type | Trigger | Recipients |
|---|---|---|
| Leave pending | Leave application submitted | Manager / HR |
| Attendance correction | Correction submitted | Manager |
| Reimbursement pending | Claim submitted | Manager / HR |
| Payroll published | Payslips published | All employees |
| Comp-off approved | Comp-off granted | Employee |
| F&F ready | Settlement draft created | HR |

### Notification Display

- **Bell icon** in header with unread count badge
- **Click** opens notification dropdown
- **Mark as read** on click
- **Link to relevant module** for action

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
