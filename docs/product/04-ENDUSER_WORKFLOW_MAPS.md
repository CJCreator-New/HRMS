# HRMS v2.7 — End-User Workflow Maps & Journey Flows

> **Audience**: Product, Design, Engineering, QA  
> **Authority**: FR v2.7, `docs/FLOW_MATRIX.md`, `docs/journey-maps/`  
> **Last Updated**: August 19, 2026

---

## 1. Overview

This document maps every end-to-end user journey across all system roles, showing the complete flow from entry to completion, including decision points, handoffs, and system responses.

---

## 2. Employee Journey (`employee`)

### 2.1 First Login & Password Activation

```
┌─────────────────────────────────────────────────────────────┐
│  START: Employee receives temp credentials from HR Admin     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Navigate to /login  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Enter email + temp  │
                    │  password            │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System detects          │
                    │  must_change_password    │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  ForcePasswordResetModal  │
                    │  appears (blocking)       │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Enter new password       │
                    │  (min 8 chars, complexity)│
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Status: invited → active │
                    │  Full access granted      │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Redirect to / dashboard │
                    └─────────────────────────┘
```

### 2.2 Daily Attendance Punch

```
┌─────────────────────────────────────────────────────────────┐
│  START: Employee arrives at work                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Open /attendance or      │
                    │  dashboard PunchCard      │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Click "Check In"         │
                    │  (records timestamp +     │
                    │   geolocation)            │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Work duration timer      │
                    │  starts running           │
                    └──────────┬──────────────┘
                               │
                    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                    │   End of work day        │
                    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Click "Check Out"        │
                    │  (auto-computes duration) │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Attendance record saved  │
                    │  Status: present          │
                    └─────────────────────────┘

  ⚠️ ANOMALY PATH: If check-out missed
                    │
                    ▼
                    ┌─────────────────────────┐
                    │  Record flagged           │
                    │  "Pending Review"         │
                    │  Notification sent        │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Submit Correction Request│
                    │  (missing time + reason)  │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Manager reviews &        │
                    │  approves/rejects         │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Status: pending_review   │
                    │  → present / half_day     │
                    └─────────────────────────┘
```

### 2.3 Leave Application

```
┌─────────────────────────────────────────────────────────────┐
│  START: Employee needs time off                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Open /leave              │
                    │  View balance cards       │
                    │  (CL, SL, EL, Comp-off)  │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Select leave type        │
                    │  (CL, SL, EL)             │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Select dates             │
                    │  (start_date, end_date)   │
                    │  Select duration type     │
                    │  (full_day/first_half/    │
                    │   second_half)            │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System validates:        │
                    │  ✅ No overlapping dates   │
                    │  ✅ Sufficient balance     │
                    │  ✅ Sandwich rule applied  │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Submit request           │
                    │  Status: pending          │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Manager      │  │  HR Admin    │  │  HR Admin    │
     │  approves     │  │  (HR leave)  │  │  (HR leave)  │
     │  (FR §1.4)   │  │  routes to   │  │  fallback to │
     │               │  │  alt approver│  │  sysadmin    │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Status: pending →        │
                    │  approved / rejected      │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Leave quota debited      │
                    │  Leave ledger updated     │
                    │  on_leave derived view    │
                    │  updated automatically    │
                    └─────────────────────────┘
```

### 2.4 Expense Reimbursement

```
┌─────────────────────────────────────────────────────────────┐
│  START: Employee has business expense to claim              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Open /reimbursements    │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Select expense category  │
                    │  (Travel, Internet, etc.) │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Enter details:           │
                    │  • Vendor name            │
                    │  • Amount                 │
                    │  • Date                   │
                    │  • Description            │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Upload receipt           │
                    │  (PDF/JPEG/PNG ≤10MB)    │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System validates:        │
                    │  ✅ Duplicate detection    │
                    │  ✅ Policy limit check     │
                    │  ✅ Taxability classify    │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Submit claim             │
                    │  Status: pending          │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │  manager_then_hr               │  hr_only     │
     │  Stage 1: Manager approves     │  Direct to   │
     │  → pending_hr                  │  HR          │
     │  Stage 2: HR approves          │              │
     │  → approved                    │              │
     └──────┬───────┘                  └──────┬───────┘
              │                                 │
              └────────────────┬────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Approved amount included │
                    │  in monthly payroll run   │
                    │  (non-taxable/taxable)    │
                    └─────────────────────────┘
```

---

## 3. Manager Journey (`manager`)

### 3.1 Team Attendance Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│  START: Manager opens /attendance                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Select "Team View"       │
                    │  (default for managers)   │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  View team attendance     │
                    │  • Check-in times         │
                    │  • Anomaly flags          │
                    │  • Pending corrections    │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌──────────────┐      ┌──────────────┐
          │  Approve      │      │  Reject       │
          │  correction   │      │  correction   │
          │  (with reason)│      │  (with reason)│
          └──────┬───────┘      └──────┬───────┘
                 │                     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────────┐
                 │  Employee notified       │
                 │  Status updated           │
                 └─────────────────────────┘
```

### 3.2 Unified Approvals Inbox

```
┌─────────────────────────────────────────────────────────────┐
│  START: Manager opens /approvals                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  View unified inbox       │
                    │  with module filter tabs: │
                    │  • All Items              │
                    │  • Leave Requests         │
                    │  • Attendance             │
                    │  • Reimbursements         │
                    │  • Comp-Off / Permissions │
                    │  • F&F Settlements        │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Leave        │  │  Attendance   │  │  Reimbursement│
     │  Request      │  │  Correction   │  │  Claim        │
     │               │  │               │  │               │
     │  ⚠️ Parental  │  │  Missing punch│  │  Stage 1      │
     │  leave masked │  │  correction   │  │  review       │
     │  as "Parental │  │  details      │  │  (manager     │
     │  Leave"       │  │               │  │   approve)    │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Approve /    │  │  Approve /    │  │  Approve /    │
     │  Reject       │  │  Reject       │  │  Reject       │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Employee notified       │
                    │  Status updated           │
                    │  Audit log created        │
                    └─────────────────────────┘
```

---

## 4. HR Admin Journey (`hr`)

### 4.1 Direct Admin Onboarding

```
┌─────────────────────────────────────────────────────────────┐
│  START: HR Admin needs to onboard new employee               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Open /onboarding        │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Enter employee details:  │
                    │  • Employee code          │
                    │  • Full name              │
                    │  • Email                  │
                    │  • Phone                  │
                    │  • Date of joining        │
                    │  • Initial password       │
                    │  • Role(s) assignment     │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System validates:        │
                    │  ✅ No duplicate email     │
                    │  ✅ Valid employee code    │
                    │  ✅ Password meets policy  │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Employee created:        │
                    │  • Status: invited        │
                    │  • must_change_password   │
                    │  • Initial password set   │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  HR hands over credentials│
                    │  to new hire              │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Employee logs in →       │
                    │  Forced password reset →  │
                    │  Status: invited → active │
                    └─────────────────────────┘
```

### 4.2 Offboarding & F&F Settlement

```
┌─────────────────────────────────────────────────────────────┐
│  START: Employee submits resignation                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Employee navigates to   │
                    │  /offboarding             │
                    │  Submits resignation      │
                    │  (desired LWD + reason)   │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Status: active →         │
                    │  notice_period            │
                    │  LWD calculated (60 days) │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  HR Admin creates         │
                    │  offboarding checklist:   │
                    │  • IT clearance           │
                    │  • Finance clearance      │
                    │  • Admin clearance        │
                    │  • HR clearance           │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  HR drafts F&F settlement │
                    │  • EL encashment earnings │
                    │  • Asset recovery deduct  │
                    │  • Tax deductions         │
                    │  Status: draft            │
                    └──────────┬──────────────┘
                               │
              ⚠️ STALE DETECTION PATH:
              ┌────────────────┴────────────────┐
              │  If leave/attendance records     │
              │  change before approval:         │
              │  → Settlement marked "stale"     │
              │  → Must be re-verified           │
              └────────────────┬────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  HR approves F&F          │
                    │  Status: draft → approved │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Separation status:       │
                    │  offboarded + F&F approved│
                    │  → completed              │
                    └─────────────────────────┘
```

---

## 5. Payroll Admin Journey (`payroll_admin`)

### 5.1 Monthly Payroll Execution

```
┌─────────────────────────────────────────────────────────────┐
│  START: New month begins, payroll admin initiates payroll    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Open /payroll           │
                    │  Click "Initiate Period"  │
                    │  (select month/year)     │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System creates:         │
                    │  • Payroll period record  │
                    │  • Initial draft status   │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Verify payroll lock:     │
                    │  ✅ No pending_review      │
                    │     attendance records     │
                    │  ✅ No pending leave       │
                    │     requests               │
                    │  ✅ All statutory profiles │
                    │     present                │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │  Lock passed  │                  │  Lock failed  │
     │  ✅            │                  │  ❌            │
     └──────┬───────┘                  └──────┬───────┘
              │                                 │
              ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │  Execute      │                  │  View blocking│
     │  bulk payroll │                  │  reasons      │
     │  run          │                  │  Resolve      │
     └──────┬───────┘                  │  issues       │
              │                         └──────────────┘
              ▼
     ┌──────────────┐
     │  Review       │
     │  payslips:    │
     │  • Earnings   │
     │  • Deductions │
     │  • Net pay    │
     └──────┬───────┘
              │
              ▼
     ┌──────────────┐
     │  Finalize     │
     │  period       │
     │  (draft →     │
     │   finalized)  │
     └──────┬───────┘
              │
              ▼
     ┌──────────────┐
     │  Publish      │
     │  payslips     │
     │  (finalized → │
     │   published)  │
     └──────┬───────┘
              │
              ▼
     ┌──────────────┐
     │  Employees    │
     │  can view &   │
     │  download     │
     │  payslips     │
     └──────────────┘
```

---

## 6. System Admin Journey (`system_admin`)

### 6.1 Initial System Bootstrap

```
┌─────────────────────────────────────────────────────────────┐
│  START: Fresh installation, zero-seed gate active            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Execute break-glass     │
                    │  script:                 │
                    │  schema/bootstrap/       │
                    │  01_system_admin.sql     │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System Admin account    │
                    │  created outside RLS     │
                    │  admin@company.com       │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Login → forced password  │
                    │  reset → account active   │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Configure company        │
                    │  settings:                │
                    │  • Company name           │
                    │  • is_configured = true   │
                    │  → Zero-seed gate opened  │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Operational modules      │
                    │  now accessible           │
                    └─────────────────────────┘
```

### 6.2 RBAC Role Provisioning

```
┌─────────────────────────────────────────────────────────────┐
│  START: System Admin assigns role to employee                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Navigate to /permissions│
                    │  or /settings            │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Select employee          │
                    │  Select role(s) to assign │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  System validates:        │
                    │  ✅ Self-grant prevention  │
                    │  (trigger blocks granting  │
                    │   approval perms to self)  │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │  Grant valid  │                  │  Self-grant   │
     │  (other user) │                  │  attempted    │
     │  ✅ Success    │                  │  ❌ Blocked    │
     └──────┬───────┘                  └──────┬───────┘
              │                                 │
              ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │  Employee     │                  │  Error:       │
     │  receives new │                  │  "Cannot grant│
     │  permissions  │                  │   approval    │
     │  immediately  │                  │   to self"    │
     └──────────────┘                  └──────────────┘
```

---

## 7. Cross-Role Interaction Workflows

### 7.1 Hire-to-Payslip (Complete Chain)

```
HR Admin → Employee → Manager → Payroll Admin → Employee
    │          │          │            │            │
    ▼          ▼          ▼            ▼            ▼
 Onboard   Punch      Apply      Run Payroll   Download
 with temp → Login → Attendance → Leave → → Finalize → Payslip
 password   Reset    Check-in   Approve  Publish
```

### 7.2 Attendance Anomaly Resolution

```
Employee → Manager → Payroll Admin
    │          │            │
    ▼          ▼            ▼
 Missed    Submit     Approve    Lock Verified
 Punch-out → Correction → Correction → → Payroll Runs
    │          │            │
    ▼          ▼            ▼
 Flagged   Manager    Status:
 pending   notified   present
 review
```

### 7.3 Expense-to-Payslip

```
Employee → Manager → HR Admin → Payroll Admin
    │          │          │            │
    ▼          ▼          ▼            ▼
 Submit    Stage 1    Stage 2     Include in
 Claim → Approve → Approve → → Monthly Run
    │          │          │            │
    ▼          ▼          ▼            ▼
 Receipt   pending_hr  approved   Disbursed
 uploaded  (D11: unenforced)
```

### 7.4 HR Self-Approval Bypass (FR §1.4)

```
HR Admin → Alternate HR Approver (or System Admin)
    │                    │
    ▼                    ▼
 Apply for          Approve HR's
 Leave ────────→    Leave Request
    │                    │
    ▼                    ▼
 Routes to          Self-approval
 alt_approver_id    prevented
 or sysadmin
```

---

## 8. Navigation & Access Patterns

### Sidebar Navigation Structure

```
MY WORK
├── Dashboard (/)
├── My Approvals (/approvals)     [managers/HR only]
├── Attendance & Punch (/attendance)
├── Leave Engine (/leave)
├── Expense Claims (/reimbursements)
├── Short Permissions (/permissions)
└── Work Calendar (/calendar)

PEOPLE
├── Employee Directory (/employees)
├── Bulk Import (/employees/import)    [HR only]
├── Direct Onboarding (/onboarding)    [HR only]
├── Departments (/departments)         [HR only]
└── Offboarding & F&F (/offboarding)

PAY
├── Salary Structures (/salary)        [hidden from managers]
├── Payroll Operations (/payroll)      [payroll admin only]
├── Payroll Eligibility (/eligibility) [payroll admin only]
├── Statutory Engine (/statutory)
└── Leave Encashment (/encashment)

ADMIN
├── Documents (/documents)
├── Company Settings (/settings)       [HR/sysadmin only]
├── Audit Trail (/audit)               [HR/sysadmin only]
├── Scheduled Jobs (/jobs)
└── Executive Reports (/reports)
```

### Role-Based Navigation Visibility

| Route | Employee | Manager | HR Admin | Payroll Admin | System Admin |
|---|---|---|---|---|---|
| `/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/approvals` | — | ✓ | ✓ | — | ✓ |
| `/attendance` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/leave` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/reimbursements` | ✓ | ✓ | ✓ | ✓ view | ✓ |
| `/employees` | self | team | all | all RO | all |
| `/onboarding` | — | — | ✓ | — | ✓ |
| `/salary` | own | **hidden** | ✓ | ✓ | ✓ |
| `/payroll` | — | — | — | ✓ | ✓ |
| `/settings` | — | — | ✓ | — | ✓ |

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
