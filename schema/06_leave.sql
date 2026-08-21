-- ============================================================================
-- HRMS v2.7 — Module 06: Leave Management Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/06_leave.sql
-- Strictly aligned with FR §4.1–§4.9 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id for RLS),
--               02_org.sql (employees table for FK references),
--               04_work_calendar.sql (is_working_day for sandwich calc & working day check),
--               05_attendance.sql (attendance_records for comp_off linkage)
-- DEPENDENTS: 08_payroll_eligibility.sql (leave_requests/leave_types for paid leave units),
--             09_payroll.sql (leave_requests for pending leave validation),
--             12_leave_financial.sql (leave_types, leave_allocations, leave_ledger),
--             13_ff_settlement.sql (leave_ledger for stale FF invalidation),
--             17_scheduled_jobs.sql (leave_types, leave_allocations, comp_off_grants),
--             19_reports.sql (v_leave_utilization_summary view)
-- Provides: leave_types, leave_allocations, leave_requests,
--           leave_request_approvals, leave_ledger, permission_requests,
--           comp_off_grants tables, calculate_leave_days(),
--           prevent_overlapping_leave_requests() trigger,
--           process_leave_request_state_change() trigger,
--           recover_negative_leave_balances(), v_leave_requests_masked view,
--           v_employee_on_leave view========

create type leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn');
create type leave_duration_type as enum ('full_day', 'first_half', 'second_half'); -- FR §3.6a
create type leave_ledger_transaction as enum (
  'opening', 'accrual', 'usage', 'reservation', 'encashment', 'carry_forward', 'comp_off_expiry', 'lop_conversion', 'manual_adjustment'
);

-- 2. Leave Types Master
create table leave_types (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique, -- 'CL', 'SL', 'EL', 'MATERNITY', 'PATERNITY', 'COMP_OFF', 'LOP'
  name                    text not null,
  is_sandwich_enabled     boolean not null default false,
  requires_attachment     boolean not null default false,
  allow_negative_balance  boolean not null default false,
  is_paid                 boolean not null default true,
  max_consecutive_days    integer,
  created_at              timestamptz not null default now()
);

-- 3. Employee Leave Balance Allocations
create table leave_allocations (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  leave_type_id         uuid not null references leave_types(id) on delete cascade,
  year                  integer not null,
  allocated_days        numeric(5,2) not null default 0.00,
  used_days             numeric(5,2) not null default 0.00,
  pending_days          numeric(5,2) not null default 0.00,
  carry_forward_days    numeric(5,2) not null default 0.00,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

-- 4. Leave Applications (§4.2)
create table leave_requests (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  leave_type_id         uuid not null references leave_types(id),
  start_date            date not null,
  end_date              date not null,
  total_days            numeric(5,2) not null,
  duration_type         leave_duration_type not null default 'full_day', -- FR §3.6a
  reason                text not null,
  status                leave_request_status not null default 'pending',
  current_approver_id   uuid references employees(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table leave_request_approvals (
  id                    uuid primary key default gen_random_uuid(),
  leave_request_id      uuid not null references leave_requests(id) on delete cascade,
  approver_id           uuid not null references employees(id),
  stage                 text not null default 'manager', -- 'manager' | 'hr' | 'alternate_hr'
  status                leave_request_status not null default 'pending',
  remarks               text,
  decided_at            timestamptz,
  created_at            timestamptz not null default now()
);

-- 5. Immutable Leave Ledger Audit Trail (§4.3)
create table leave_ledger (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  leave_type_id         uuid not null references leave_types(id),
  transaction_type      leave_ledger_transaction not null,
  days                  numeric(5,2) not null,
  balance_after         numeric(5,2) not null,
  reference_id          uuid,
  created_at            timestamptz not null default now()
);

-- 6. Short Permission Requests (2 Hours Max per FR §4.4)
create table permission_requests (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  permission_date       date not null,
  start_time            time not null,
  end_time              time not null,
  duration_minutes      integer not null,
  reason                text not null,
  status                leave_request_status not null default 'pending',
  approver_id           uuid references employees(id),
  created_at            timestamptz not null default now()
);

-- 7. Comp-Off Grants (§4.6 — Linked to Extra Work Attendance Event)
create table comp_off_grants (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  attendance_record_id  uuid references attendance_records(id), -- Linked to extra_work event
  worked_date           date not null,
  days_granted          numeric(3,1) not null default 1.0,
  expiry_date           date not null, -- Fixed 90-day expiry per FR §4.6
  is_used               boolean not null default false,
  status                leave_request_status not null default 'pending',
  approver_id           uuid references employees(id),
  created_at            timestamptz not null default now()
);

-- 8. Leave Sandwich Calculation Helper
create or replace function calculate_leave_days(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_duration_type text default 'full_day' -- 'full_day' | 'first_half' | 'second_half'
) returns numeric language plpgsql stable as $$
declare
  v_sandwich boolean;
  v_curr date := p_start_date;
  v_days numeric := 0;
  -- Guard against invalid or excessively large date ranges (> 365 days)
  if p_end_date < p_start_date then
    raise exception 'End date cannot precede start date in calculate_leave_days';
  end if;
  if p_end_date - p_start_date > 365 then
    raise exception 'Leave duration cannot exceed 365 days in calculate_leave_days';
  end if;

  select is_sandwich_enabled into v_sandwich from leave_types where id = p_leave_type_id;

  -- Single-day half-day leave: return 0.5 directly
  if v_is_single_day and p_duration_type in ('first_half', 'second_half') then
    return 0.5;
  end if;

  while v_curr <= p_end_date loop
    if v_sandwich or is_working_day(p_employee_id, v_curr) then
      v_days := v_days + 1;
    end if;
    v_curr := v_curr + 1;
  end loop;

  return v_days;
end;
$$;

-- 9. Overlapping Leave Request Validation Trigger
create or replace function prevent_overlapping_leave_requests() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from leave_requests
    where employee_id = new.employee_id
      and status not in ('rejected', 'cancelled')
      and id is distinct from new.id
      and (start_date <= new.end_date and end_date >= new.start_date)
  ) then
    raise exception 'Overlapping leave request detected: An active or pending leave request already exists for this date range (§4.2)';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_leave_overlap
  before insert or update on leave_requests
  for each row execute function prevent_overlapping_leave_requests();

-- 10. Leave Pending-Balance Reservation & Ledger Lifecycle Trigger (§4.2)
create or replace function process_leave_request_state_change() returns trigger
language plpgsql as $$
declare
  v_year integer := extract(year from new.start_date);
  v_alloc_id uuid;
begin
  -- Get or create allocation row
  select id into v_alloc_id from leave_allocations
  where employee_id = new.employee_id and leave_type_id = new.leave_type_id and year = v_year;

  if v_alloc_id is null then
    insert into leave_allocations (employee_id, leave_type_id, year, allocated_days)
    values (new.employee_id, new.leave_type_id, v_year, 0)
    returning id into v_alloc_id;
  end if;

  if (tg_op = 'INSERT' and new.status = 'pending') then
    -- Reserve pending days
    update leave_allocations
    set pending_days = pending_days + new.total_days, updated_at = now()
    where id = v_alloc_id;

    insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after, reference_id)
    select new.employee_id, new.leave_type_id, 'reservation', new.total_days,
           (allocated_days + carry_forward_days - used_days - pending_days), new.id
    from leave_allocations where id = v_alloc_id;

  elsif (tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved') then
    -- Convert reservation to usage
    update leave_allocations
    set pending_days = greatest(0, pending_days - new.total_days),
        used_days = used_days + new.total_days,
        updated_at = now()
    where id = v_alloc_id;

    insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after, reference_id)
    select new.employee_id, new.leave_type_id, 'usage', new.total_days,
           (allocated_days + carry_forward_days - used_days), new.id
    from leave_allocations where id = v_alloc_id;

  elsif (tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('rejected', 'cancelled')) then
    -- Release pending reservation
    update leave_allocations
    set pending_days = greatest(0, pending_days - new.total_days), updated_at = now()
    where id = v_alloc_id;
  end if;

  return new;
end;
$$;

create trigger trg_process_leave_reservation
  after insert or update on leave_requests
  for each row execute function process_leave_request_state_change();

-- 11. FR §4.9 Negative-Balance LOP Recovery Converter
create or replace function recover_negative_leave_balances(p_employee_id uuid, p_year integer)
returns numeric language plpgsql as $$
declare
  v_rec record;
  v_total_recovered numeric := 0;
begin
  for v_rec in
    select la.id, la.leave_type_id, (la.allocated_days + la.carry_forward_days - la.used_days) as net_bal
    from leave_allocations la
    join leave_types lt on lt.id = la.leave_type_id
    where la.employee_id = p_employee_id and la.year = p_year
      and (la.allocated_days + la.carry_forward_days - la.used_days) < 0
  loop
    -- Convert negative excess into LOP
    insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after)
    values (p_employee_id, v_rec.leave_type_id, 'lop_conversion', abs(v_rec.net_bal), 0);

    update leave_allocations
    set used_days = allocated_days + carry_forward_days, updated_at = now()
    where id = v_rec.id;

    v_total_recovered := v_total_recovered + abs(v_rec.net_bal);
  end loop;

  return v_total_recovered;
end;
$$;

-- 10. Masked Leave Requests View for Managers (§4.7 Maternity/Paternity Redaction)
create view v_leave_requests_masked as
select
  lr.id,
  lr.employee_id,
  lr.start_date,
  lr.end_date,
  lr.total_days,
  lr.status,
  case
    when lt.code in ('MATERNITY', 'PATERNITY') and auth_employee_id() != lr.employee_id and not has_permission('leave.approve.hr') then 'Parental Leave'
    else lt.name
  end as leave_type_name,
  case
    when lt.code in ('MATERNITY', 'PATERNITY') and auth_employee_id() != lr.employee_id and not has_permission('leave.approve.hr') then '[Redacted]'
    else lr.reason
  end as reason
from leave_requests lr
join leave_types lt on lt.id = lr.leave_type_id;

-- 11. Row Level Security
alter table leave_types enable row level security;
alter table leave_allocations enable row level security;
alter table leave_requests enable row level security;
alter table leave_request_approvals enable row level security;
alter table leave_ledger enable row level security;
alter table permission_requests enable row level security;
alter table comp_off_grants enable row level security;

create policy leave_types_read on leave_types for select using (true);
create policy leave_types_write on leave_types for all
  using (has_permission('leave.manage_types')) with check (has_permission('leave.manage_types'));

create policy allocations_read on leave_allocations for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));
create policy allocations_write on leave_allocations for all
  using (has_permission('leave.manage_types')) with check (has_permission('leave.manage_types'));

create policy requests_read on leave_requests for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));
create policy requests_insert on leave_requests for insert
  with check (employee_id = auth_employee_id());
create policy requests_update on leave_requests for update
  using (has_permission('leave.approve.hr') or has_permission('leave.approve.manager') or is_current_manager_of(auth_employee_id(), employee_id));

create policy ledger_read on leave_ledger for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));

create policy permissions_read on permission_requests for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));
create policy permissions_insert on permission_requests for insert
  with check (employee_id = auth_employee_id());

create policy comp_off_read on comp_off_grants for select
  using (employee_id = auth_employee_id() or has_permission('leave.view', employee_id));
create policy comp_off_insert on comp_off_grants for insert
  with check (employee_id = auth_employee_id());

-- Performance Indexes
create index if not exists idx_leave_requests_emp_status_dates
  on leave_requests (employee_id, status, start_date, end_date);
create index if not exists idx_leave_requests_leave_type_id
  on leave_requests (leave_type_id);
create index if not exists idx_leave_ledger_emp_created
  on leave_ledger (employee_id, created_at desc);

-- Seed Standard Leave Types Master
insert into leave_types (code, name, is_sandwich_enabled, requires_attachment, allow_negative_balance) values
  ('CL', 'Casual Leave', false, false, false),
  ('SL', 'Sick Leave', false, false, false),
  ('EL', 'Earned Leave / Privilege Leave', false, false, false),
  ('MATERNITY', 'Maternity Leave', false, true, false),
  ('PATERNITY', 'Paternity Leave', false, true, false),
  ('COMP_OFF', 'Compensatory Off', false, false, true),
  ('LOP', 'Loss of Pay / Unpaid Leave', false, false, true)
on conflict (code) do nothing;

-- Cross-module view: Employee On-Leave Status (referenced by 05_attendance but depends on leave_requests)
create or replace view v_employee_on_leave as
select
  lr.employee_id,
  lt.id as leave_type_id,
  lt.code as leave_type_code,
  lt.name as leave_type_name,
  lr.start_date,
  lr.end_date,
  lr.duration_type,
  lr.status as leave_status
from leave_requests lr
join leave_types lt on lt.id = lr.leave_type_id
where lr.status = 'approved';
