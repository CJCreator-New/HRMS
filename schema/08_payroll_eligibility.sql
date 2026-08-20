-- ============================================================================
-- HRMS v2.7 — Module 08: Payroll Eligibility Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/08_payroll_eligibility.sql
-- Strictly aligned with FR §2.1, §3.6, §5.3 & ADR 0003
-- Effective-dated binary eligibility status (system_default vs hr_override)
-- ============================================================================

-- 1. Enums
create type eligibility_source as enum ('system_default', 'hr_override');

-- 2. Effective-Dated Payroll Eligibility Table (§2.1, §5.3)
create table payroll_eligibility (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  is_eligible     boolean not null default true,
  reason          text,
  source          eligibility_source not null default 'system_default',
  effective_from  date not null,
  effective_to    date,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

-- 3. Monthly Payroll Eligibility Snapshot (§5.3 Day-Unit Equation)
create table payroll_eligibility_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  employee_id            uuid not null references employees(id) on delete cascade,
  year                   integer not null,
  month                  integer not null,
  total_days_in_month    integer not null,
  working_days           integer not null,
  worked_units           numeric(5,2) not null default 0,
  paid_leave_units       numeric(5,2) not null default 0,
  lop_units              numeric(5,2) not null default 0,
  payable_units          numeric(5,2) not null,
  is_eligible            boolean not null default true,
  calculated_at          timestamptz not null default now(),
  unique (employee_id, year, month)
);

-- 4. Payroll Eligibility Computation Function (FR §3.6, §5.3)
create or replace function compute_payroll_eligibility(
  p_employee_id uuid,
  p_year integer,
  p_month integer
) returns uuid language plpgsql as $$
declare
  v_start_date date := make_date(p_year, p_month, 1);
  v_end_date date := (v_start_date + interval '1 month' - interval '1 day')::date;
  v_total_days integer := extract(day from v_end_date);
  v_worked numeric(5,2) := 0;
  v_paid_leave numeric(5,2) := 0;
  v_lop numeric(5,2) := 0;
  v_payable numeric(5,2) := 0;
  v_eligible boolean := true;
  v_record_id uuid;
begin
  -- Check effective binary eligibility status
  select is_eligible into v_eligible
  from payroll_eligibility
  where employee_id = p_employee_id
    and effective_from <= v_end_date
    and (effective_to is null or effective_to >= v_start_date)
  order by effective_from desc limit 1;

  if v_eligible is null then
    v_eligible := true;
  end if;

  -- Aggregate worked units from attendance_records
  select coalesce(sum(case status
    when 'present' then 1.0
    when 'half_day' then 0.5
    else 0.0 end), 0) into v_worked
  from attendance_records
  where employee_id = p_employee_id
    and attendance_date between v_start_date and v_end_date;

  -- Aggregate paid leave units
  select coalesce(sum(lr.total_days), 0) into v_paid_leave
  from leave_requests lr
  join leave_types lt on lt.id = lr.leave_type_id
  where lr.employee_id = p_employee_id
    and lr.status = 'approved'
    and lt.is_paid = true
    and lr.start_date <= v_end_date and lr.end_date >= v_start_date;

  -- Aggregate LOP units
  select coalesce(sum(lr.total_days), 0) into v_lop
  from leave_requests lr
  join leave_types lt on lt.id = lr.leave_type_id
  where lr.employee_id = p_employee_id
    and lr.status = 'approved'
    and lt.is_paid = false
    and lr.start_date <= v_end_date and lr.end_date >= v_start_date;

  v_payable := greatest(0, v_worked + v_paid_leave);

  insert into payroll_eligibility_snapshots (
    employee_id, year, month, total_days_in_month, working_days,
    worked_units, paid_leave_units, lop_units, payable_units, is_eligible
  ) values (
    p_employee_id, p_year, p_month, v_total_days, v_total_days,
    v_worked, v_paid_leave, v_lop, v_payable, v_eligible
  )
  on conflict (employee_id, year, month) do update set
    worked_units = excluded.worked_units,
    paid_leave_units = excluded.paid_leave_units,
    lop_units = excluded.lop_units,
    payable_units = excluded.payable_units,
    is_eligible = excluded.is_eligible,
    calculated_at = now()
  returning id into v_record_id;

  return v_record_id;
end;
$$;

-- 5. Row Level Security
alter table payroll_eligibility enable row level security;
alter table payroll_eligibility_snapshots enable row level security;

create policy eligibility_read on payroll_eligibility for select
  using (employee_id = auth_employee_id() or has_permission('payroll.view'));
create policy eligibility_write on payroll_eligibility for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));

create policy snapshots_read on payroll_eligibility_snapshots for select
  using (employee_id = auth_employee_id() or has_permission('payroll.view'));
