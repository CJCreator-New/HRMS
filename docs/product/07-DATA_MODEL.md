# HRMS v2.7 — Data Model & Entity-Relationship Architecture

> **Audience**: Engineering, Backend, Database, QA  
> **Database**: PostgreSQL 15 (Supabase)  
> **Last Updated**: August 19, 2026

---

## 1. Overview

The HRMS data model is organized into **24 modular SQL files** (`schema/00_setup.sql` through `22_comprehensive_performance_indexes.sql` plus `bootstrap/01_system_admin.sql`) covering infrastructure, RBAC (8 roles, 62 permission codes), organization, settings, calendar, attendance, leave, salary, payroll, statutory, reimbursements, leave finance, F&F settlement, attachments, audit, notifications, scheduled jobs, search, reports, performance optimizations, and comprehensive indexes.

---

## 2. Core Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HRMS v2.7 Entity Model                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ employees │───▶│employee_roles│◀───│    roles     │───▶│role_perms    │      │
│  └────┬─────┘    └──────────────┘    └──────────────┘    └──────┬───────┘      │
│       │                                                          │              │
│       │         ┌────────────────────────────────────────────────┘              │
│       │         │                                                               │
│       │         ▼                                                               │
│       │    ┌──────────────┐                                                     │
│       │    │ permissions  │ (62 codes)                                          │
│       │    └──────────────┘                                                     │
│       │                                                                         │
│       ├─────────────────────────────────────────────────────────────────────┐   │
│       │                                                                     │   │
│       ▼                                                                     ▼   │
│  ┌──────────────────┐                                           ┌────────────┐ │
│  │employee_assignments│                                          │attendance  │ │
│  │• department_id    │                                           │_records    │ │
│  │• manager_id       │                                           └─────┬──────┘ │
│  │• designation      │                                                 │        │
│  │• effective dates  │                                                 ▼        │
│  └──────────────────┘                                           ┌────────────┐ │
│                                                                  │attendance  │ │
│  ┌──────────────────┐                                           │_punches    │ │
│  │company_settings  │                                           └────────────┘ │
│  │• alt_hr_approver │                                                            │
│  │• is_configured   │   ┌──────────────┐    ┌──────────────┐                    │
│  └──────────────────┘   │ leave_types  │───▶│leave_requests │                   │
│                          │• sandwich    │    │• status FSM  │                    │
│  ┌──────────────────┐   └──────────────┘    └──────┬───────┘                    │
│  │work_cal_templates│                              │                            │
│  │• holidays        │                              ▼                            │
│  │• assignments     │                      ┌──────────────┐                     │
│  └──────────────────┘                      │leave_request │                     │
│                                             │_approvals    │                     │
│  ┌──────────────────┐                      └──────────────┘                     │
│  │salary_components │                                                            │
│  └───────┬──────────┘   ┌──────────────┐    ┌──────────────┐                    │
│          │              │payroll_period│───▶│payroll_rev    │                   │
│          ▼              └──────────────┘    └──────┬───────┘                    │
│  ┌──────────────────┐                              │                            │
│  │emp_salary_struct │                              ▼                            │
│  │(versioned)       │                      ┌──────────────┐                     │
│  └───────┬──────────┘                      │  payslips    │                     │
│          │                                  └──────┬───────┘                    │
│          ▼                                         │                            │
│  ┌──────────────────┐                              ▼                            │
│  │emp_salary_items  │                      ┌──────────────┐                     │
│  └──────────────────┘                      │payslip_comp  │                     │
│                                             └──────────────┘                    │
│  ┌──────────────────┐                                                            │
│  │statutory_rule_ver│   ┌──────────────┐    ┌──────────────┐                    │
│  └───────┬──────────┘   │reimb_category│───▶│reimb_claims  │                   │
│          │              └──────────────┘    └──────┬───────┘                    │
│          ▼                                         │                            │
│  ┌──────────────────┐                              ▼                            │
│  │statutory_profiles│                      ┌──────────────┐                     │
│  └──────────────────┘                      │reimb_receipts│                     │
│                                             └──────────────┘                    │
│  ┌──────────────────┐                                                            │
│  │separation_records│   ┌──────────────┐    ┌──────────────┐                    │
│  └───────┬──────────┘   │ff_settlements│───▶│ff_clearances │                   │
│          │              └──────────────┘    └──────────────┘                    │
│          ▼                                                                       │
│  ┌──────────────────┐   ┌──────────────┐    ┌──────────────┐                    │
│  │offboard_checklist│   │ audit_logs   │    │ notifications│                    │
│  └──────────────────┘   └──────────────┘    └──────────────┘                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Tables

### 3.1 Employees (`employees`)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| `auth_user_id` | UUID | UNIQUE, FK → auth.users | Supabase Auth link |
| `employee_code` | TEXT | UNIQUE, NOT NULL | Business key (EMP-XXX) |
| `full_name` | TEXT | NOT NULL | Employee full name |
| `email` | TEXT | UNIQUE, NOT NULL | Login email |
| `phone` | TEXT | | Contact phone |
| `date_of_birth` | DATE | | Birth date |
| `date_of_joining` | DATE | NOT NULL | Employment start |
| `status` | employee_status | NOT NULL, DEFAULT 'invited' | Lifecycle state |
| `must_change_password` | BOOLEAN | DEFAULT true | Force reset flag |
| `is_deactivated` | BOOLEAN | DEFAULT false | Access revoked flag |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Status Enum** (`employee_status`):
```
invited → active → suspended → notice_period → offboarded → (completed)
                                                    ↓
                                                withdrawn
```

### 3.2 Roles & Permissions

**`roles`**:
| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | Unique role code |
| `name` | TEXT | Display name |
| `is_system` | BOOLEAN | System-seeded flag |

**`permissions`**:
| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | Unique permission code |
| `description` | TEXT | Human-readable description |

**`role_permissions`**:
| Column | Type | Description |
|---|---|---|
| `role_id` | UUID | FK → roles |
| `permission_id` | UUID | FK → permissions |

**`employee_roles`**:
| Column | Type | Description |
|---|---|---|
| `employee_id` | UUID | FK → employees |
| `role_id` | UUID | FK → roles |

### 3.3 Employee Assignments (`employee_assignments`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `department_id` | UUID | FK → departments |
| `manager_id` | UUID | FK → employees |
| `designation` | TEXT | Job title |
| `effective_start_date` | DATE | Assignment start |
| `effective_end_date` | DATE | Assignment end (NULL = current) |

**Constraint**: Exclusion constraint prevents overlapping assignments per employee.

---

## 4. Attendance Tables

### 4.1 Attendance Records (`attendance_records`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `date` | DATE | Attendance date |
| `status` | attendance_status | present/half_day/absent/pending_review/extra_work |
| `check_in_time` | TIMESTAMPTZ | Punch-in timestamp |
| `check_out_time` | TIMESTAMPTZ | Punch-out timestamp |
| `work_duration` | INTERVAL | Auto-calculated |
| `payroll_period_id` | UUID | FK → payroll_periods |

**Two-Layer Model**:
- **Base Calendar Layer**: Resolves day status (working day, holiday, weekly off)
- **Attendance Event Layer**: Records actual attendance (present, absent, etc.)

### 4.2 Attendance Punches (`attendance_punches`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `attendance_record_id` | UUID | FK → attendance_records |
| `punch_type` | TEXT | 'check_in' or 'check_out' |
| `timestamp` | TIMESTAMPTZ | Punch timestamp |
| `latitude` | DECIMAL | Geolocation |
| `longitude` | DECIMAL | Geolocation |

### 4.3 Attendance Corrections (`attendance_corrections`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `attendance_record_id` | UUID | FK → attendance_records |
| `employee_id` | UUID | FK → employees |
| `requested_status` | TEXT | Desired status |
| `reason` | TEXT | Correction reason |
| `status` | TEXT | pending/approved/rejected |
| `reviewer_id` | UUID | FK → employees (manager/HR) |

---

## 5. Leave Tables

### 5.1 Leave Types (`leave_types`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | CL, SL, EL, etc. |
| `name` | TEXT | Display name |
| `annual_allocation` | NUMERIC | Days per year |
| `sandwich_enabled` | BOOLEAN | Sandwich rule toggle |
| `max_carry_forward` | NUMERIC | Carry-forward limit |
| `is_active` | BOOLEAN | Enabled flag |

### 5.2 Leave Allocations (`leave_allocations`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `leave_type_id` | UUID | FK → leave_types |
| `year` | INTEGER | Allocation year |
| `allocated` | NUMERIC | Total allocated |
| `used` | NUMERIC | Total used |
| `carried_forward` | NUMERIC | From previous year |

### 5.3 Leave Requests (`leave_requests`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `leave_type_id` | UUID | FK → leave_types |
| `start_date` | DATE | Leave start |
| `end_date` | DATE | Leave end |
| `duration_type` | TEXT | full_day/first_half/second_half |
| `reason` | TEXT | Leave reason |
| `status` | TEXT | pending/approved/rejected/cancelled |
| `approver_id` | UUID | FK → employees |

**Trigger**: `prevent_overlapping_leave_requests()` blocks overlapping date ranges.

### 5.4 Leave Ledger (`leave_ledger`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `leave_type_id` | UUID | FK → leave_types |
| `transaction_type` | TEXT | allocation/usage/carry_forward/lapse |
| `days` | NUMERIC | Transaction amount |
| `reference_id` | UUID | FK to source record |
| `created_at` | TIMESTAMPTZ | Transaction timestamp |

### 5.5 Comp-Off Grants (`comp_off_grants`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `attendance_record_id` | UUID | FK → attendance_records (extra_work) |
| `granted_date` | DATE | Grant date |
| `expiry_date` | DATE | 90-day expiry |
| `status` | TEXT | granted/used/expired/revoked |

---

## 6. Payroll Tables

### 6.1 Salary Components (`salary_components`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | Component name |
| `component_type` | TEXT | earning/deduction/statutory |
| `calculation_type` | TEXT | fixed/percentage |
| `is_taxable` | BOOLEAN | Tax classification |
| `is_pf_component` | BOOLEAN | PF contribution flag |
| `is_esi_component` | BOOLEAN | ESI contribution flag |

### 6.2 Employee Salary Structures (`employee_salary_structures`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `effective_start_date` | DATE | Version start |
| `effective_end_date` | DATE | Version end (NULL = current) |

**Constraint**: Exclusion constraint prevents overlapping versions per employee.

### 6.3 Payroll Periods (`payroll_periods`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `month` | INTEGER | 1-12 |
| `year` | INTEGER | FY year |
| `status` | TEXT | draft/finalized/published |
| `initiated_by` | UUID | FK → employees |
| `finalized_at` | TIMESTAMPTZ | Finalization timestamp |
| `published_at` | TIMESTAMPTZ | Publication timestamp |

### 6.4 Payslips (`payslips`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `payroll_period_id` | UUID | FK → payroll_periods |
| `employee_id` | UUID | FK → employees |
| `gross_earnings` | NUMERIC | Total earnings |
| `total_deductions` | NUMERIC | Total deductions |
| `net_pay` | NUMERIC | Gross - deductions |
| `payable_days` | NUMERIC | worked + paid leave |
| `lop_days` | NUMERIC | Loss of pay days |

### 6.5 Payslip Components (`payslip_components`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `payslip_id` | UUID | FK → payslips |
| `salary_component_id` | UUID | FK → salary_components |
| `amount` | NUMERIC | Calculated amount |
| `is_earning` | BOOLEAN | Earning or deduction |

---

## 7. Statutory Tables

### 7.1 Statutory Rule Versions (`statutory_rule_versions`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `rule_type` | TEXT | PF/ESI/PT/TDS |
| `effective_start_date` | DATE | Rule effective start |
| `effective_end_date` | DATE | Rule effective end |
| `parameters` | JSONB | Rule parameters (rates, caps) |

**Example Parameters**:
```json
{
  "PF": { "employee_rate": 0.12, "employer_rate": 0.12, "wage_ceiling": 15000 },
  "ESI": { "employee_rate": 0.0075, "employer_rate": 0.0325, "gross_threshold": 21000 },
  "PT": { "state": "Karnataka", "slabs": [...] },
  "TDS": { "regime": "new", "slabs": [...] }
}
```

### 7.2 Statutory Profiles (`statutory_profiles`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees, UNIQUE |
| `pan_number` | TEXT | PAN card number |
| `uan_number` | TEXT | Universal Account Number |
| `pf_number` | TEXT | PF account number |
| `esi_number` | TEXT | ESI account number |
| `pt_state` | TEXT | Professional Tax state |
| `tax_regime` | TEXT | old/new |

---

## 8. Offboarding Tables

### 8.1 Separation Records (`separation_records`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID | FK → employees |
| `type` | TEXT | resignation/termination |
| `resignation_date` | DATE | When resignation submitted |
| `notice_period_days` | INTEGER | Notice period length |
| `last_working_day` | DATE | Calculated LWD |
| `status` | TEXT | active/completed/rescinded |
| `reason` | TEXT | Resignation reason |

### 8.2 F&F Settlement Records (`ff_settlement_records`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `separation_record_id` | UUID | FK → separation_records |
| `employee_id` | UUID | FK → employees |
| `status` | TEXT | draft/approved/rejected |
| `total_earnings` | NUMERIC | Encashment + balances |
| `total_deductions` | NUMERIC | Asset recovery + tax |
| `net_settlement` | NUMERIC | Earnings - deductions |
| `asset_recovery_amount` | NUMERIC | Asset deduction |
| `is_stale` | BOOLEAN | Auto-invalidated flag |

**Trigger**: `invalidate_stale_ff_settlement()` sets `is_stale = true` when leave/attendance records change.

---

## 9. Cross-Cutting Tables

### 9.1 Document Attachments (`document_attachments`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `entity_type` | TEXT | Polymorphic type |
| `entity_id` | UUID | Polymorphic ID |
| `file_name` | TEXT | Original filename |
| `file_path` | TEXT | Storage path |
| `file_size` | INTEGER | Size in bytes |
| `mime_type` | TEXT | PDF/JPEG/PNG |
| `scan_status` | TEXT | pending/clean/flagged |

### 9.2 Audit Logs (`audit_logs`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `entity_type` | TEXT | Entity being audited |
| `entity_id` | UUID | Entity ID |
| `action` | TEXT | create/update/delete/approve |
| `actor_id` | UUID | Who performed action |
| `old_values` | JSONB | Previous state |
| `new_values` | JSONB | New state |
| `reason` | TEXT | Change reason |
| `correlation_id` | UUID | Links related changes |
| `created_at` | TIMESTAMPTZ | Timestamp |

### 9.3 Inbox Notifications (`inbox_notifications`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `recipient_id` | UUID | FK → employees |
| `type` | TEXT | Notification type |
| `title` | TEXT | Notification title |
| `message` | TEXT | Notification body |
| `entity_type` | TEXT | Related entity type |
| `entity_id` | UUID | Related entity ID |
| `is_read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

## 10. Key Database Functions

| Function | Purpose |
|---|---|
| `auth_employee_id()` | Returns current employee ID from auth context |
| `has_permission(emp_id, code)` | Checks single permission |
| `has_any_permission(perm_codes[])` | Batch permission check (middleware) |
| `calculate_leave_days(start, end, type, sandwich)` | Leave day calculation |
| `validate_payroll_lock(period_id)` | Payroll blocking condition check |
| `compute_statutory_deductions(emp_id, gross, period_id)` | Statutory calculations |
| `search_global(query)` | Global search across entities |
| `set_updated_at()` | Auto-update timestamp trigger |
| `register_idempotency_key()` | Duplicate operation prevention |

---

## 11. Indexes & Performance

### Key Indexes

```sql
-- Employee lookups
CREATE INDEX idx_employees_auth_user ON employees(auth_user_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_status ON employees(status);

-- Attendance queries
CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, date);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- Leave queries
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests USING gist (
  daterange(start_date, end_date, '[]')
);

-- Payroll queries
CREATE INDEX idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);

-- Audit queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
