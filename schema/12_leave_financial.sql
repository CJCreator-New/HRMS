-- ============================================================================
-- HRMS v2.7 — Module 12: Leave Encashment & Carry-Forward Operations
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/12_leave_financial.sql
-- Strictly aligned with FR §4.10, §4.11 & ADR 0003
-- ============================================================================

-- 1. Enums
create type encashment_status as enum ('pending', 'approved', 'rejected', 'processed');
create type encashment_trigger_type as enum ('annual_window', 'fnf');

-- 2. Leave Encashment Requests (§4.10)
create table leave_encashment_requests (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references employees(id) on delete cascade,
  leave_type_id      uuid not null references leave_types(id),
  days_to_encash     numeric(5,2) not null,
  encashment_trigger encashment_trigger_type not null default 'annual_window',
  daily_rate         numeric(14,2) not null,
  total_amount       numeric(14,2) not null,
  status             encashment_status not null default 'pending',
  approver_id        uuid references employees(id),
  decided_at         timestamptz,
  payroll_period_id  uuid references payroll_periods(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 3. Year-End Carry Forward & Lapse Audit Log (§4.11)
create table leave_carry_forward_logs (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references employees(id) on delete cascade,
  leave_type_id       uuid not null references leave_types(id),
  year                integer not null,
  unused_days         numeric(5,2) not null,
  carry_forward_days  numeric(5,2) not null,
  lapsed_days         numeric(5,2) not null,
  processed_at        timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

-- 4. Row Level Security
alter table leave_encashment_requests enable row level security;
alter table leave_carry_forward_logs enable row level security;

create policy encashment_read on leave_encashment_requests for select
  using (employee_id = auth_employee_id() or has_permission('leave.encash.approve'));
create policy encashment_insert on leave_encashment_requests for insert
  with check (employee_id = auth_employee_id());
create policy encashment_update on leave_encashment_requests for update
  using (has_permission('leave.encash.approve'));

create policy carry_forward_read on leave_carry_forward_logs for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));
