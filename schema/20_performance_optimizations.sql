-- ============================================================================
-- HRMS v2.7 — Module 20: Performance Optimizations & Aggregation Functions
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/20_performance_optimizations.sql
-- ============================================================================

-- 1. Optimized Headcount Aggregation RPC Function
-- Collapses two separate exact count queries (active and activated_this_month)
-- into a single roundtrip server-side query.
-- Security: SECURITY DEFINER with fixed search_path = public allows all authenticated dashboard users to view aggregate headcount without leaking individual employee records.
create or replace function get_dashboard_headcount()
returns table(active bigint, new_this_month bigint)
language sql stable security definer
set search_path = public as $$
  select
    count(*) filter (where status = 'active') as active,
    count(*) filter (
      where status = 'active'
        and activated_at >= date_trunc('month', current_date)
    ) as new_this_month
  from employees;
$$;

-- 2. Performance Indexes on `employees`
-- Speeds up status filtering and monthly headcount calculation
create index if not exists idx_employees_status
  on employees (status);

create index if not exists idx_employees_status_activated_at
  on employees (status, activated_at);

-- 3. Performance Indexes on `attendance_records`
-- Optimizes daily punch state lookup per employee and payroll period validation
create index if not exists idx_attendance_records_employee_date
  on attendance_records (employee_id, attendance_date);

create index if not exists idx_attendance_records_date_status
  on attendance_records (attendance_date, status);

-- 4. Foreign Key and RLS Evaluation Performance Indexes
create index if not exists idx_payslips_employee_id
  on payslips (employee_id);

create index if not exists idx_reimbursement_claims_employee_id
  on reimbursement_claims (employee_id);

create index if not exists idx_employee_roles_employee_id
  on employee_roles (employee_id);

create index if not exists idx_payroll_revisions_period_status
  on payroll_revisions (payroll_period_id, status);
