-- ============================================================================
-- HRMS v2.7 — Module 17: Scheduled & Automated Background Jobs
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/17_scheduled_jobs.sql
-- Strictly aligned with FR §5.12 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission for RLS),
--               02_org.sql (employees table for EL accrual),
--               06_leave.sql (leave_types, leave_allocations for EL accrual,
--                            comp_off_grants, leave_ledger for expiry job)
-- DEPENDENTS: None (leaf module — job functions reference existing tables)
-- Provides: scheduled_job_logs table,
--           job_accrue_monthly_earned_leave(),
--           job_expire_comp_off_grants() functions========

-- 1. Job Execution Audit Log
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('running', 'success', 'failed');
  end if;
end $$;

create table if not exists scheduled_job_logs (
  id                       uuid primary key default gen_random_uuid(),
  job_name                 text not null,
  status                   job_status not null default 'running',
  records_processed_count  integer default 0,
  error_details            text,
  started_at               timestamptz not null default now(),
  completed_at             timestamptz
);

-- 2. Monthly Earned Leave (EL) Accrual Job Function (Set-based, transactional)
create or replace function job_accrue_monthly_earned_leave(p_accrual_rate numeric default 1.25)
returns void language plpgsql as $$
declare
  v_job_id uuid;
  v_el_type_id uuid;
  v_curr_year integer := extract(year from current_date);
  v_processed integer := 0;
begin
  insert into scheduled_job_logs (job_name) values ('monthly_el_accrual') returning id into v_job_id;
  select id into v_el_type_id from leave_types where code = 'EL';

  if v_el_type_id is null then
    update scheduled_job_logs set status = 'failed', error_details = 'EL leave type missing' where id = v_job_id;
    return;
  end if;

  with inserted as (
    insert into leave_allocations (employee_id, leave_type_id, year, allocated_days)
    select id, v_el_type_id, v_curr_year, p_accrual_rate
    from employees
    where status = 'active'
    on conflict (employee_id, leave_type_id, year) do update set
      allocated_days = leave_allocations.allocated_days + p_accrual_rate,
      updated_at = now()
    returning id
  )
  select count(*) into v_processed from inserted;

  update scheduled_job_logs
  set status = 'success', records_processed_count = v_processed, completed_at = now()
  where id = v_job_id;
exception when others then
  update scheduled_job_logs
  set status = 'failed', error_details = SQLERRM, completed_at = now()
  where id = v_job_id;
end;
$$;

-- 3. Comp-Off Expiry Job Function (§4.6 Fixed 90-Day Expiry & Ledger Forfeiture)
create or replace function job_expire_comp_off_grants()
returns void language plpgsql as $$
declare
  v_job_id uuid;
  v_count integer := 0;
  r record;
begin
  insert into scheduled_job_logs (job_name) values ('comp_off_expiry') returning id into v_job_id;

  for r in select id, employee_id, days_granted from comp_off_grants where expiry_date < current_date and status = 'pending' loop
    update comp_off_grants set status = 'rejected' where id = r.id;

    insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after, reference_id)
    select r.employee_id, id, 'comp_off_expiry', -r.days_granted, 0, r.id
    from leave_types where code = 'COMP_OFF';

    v_count := v_count + 1;
  end loop;

  update scheduled_job_logs
  set status = 'success', records_processed_count = v_count, completed_at = now()
  where id = v_job_id;
exception when others then
  update scheduled_job_logs
  set status = 'failed', error_details = SQLERRM, completed_at = now()
  where id = v_job_id;
end;
$$;

-- 4. Annual Year-End Leave Carry-Forward Job Function (§4.3, §4.6)
create or replace function job_year_end_carry_forward(p_year integer default extract(year from current_date)::integer - 1)
returns void language plpgsql as $$
declare
  v_job_id uuid;
  v_count integer := 0;
  r record;
  v_remaining numeric(5,2);
  v_carried numeric(5,2);
  v_lapsed numeric(5,2);
  v_cap numeric(5,2) := 30.00;
begin
  insert into scheduled_job_logs (job_name) values ('year_end_carry_forward') returning id into v_job_id;

  for r in
    select la.employee_id, la.leave_type_id, la.allocated_days, la.carry_forward_days, la.used_days, lt.code
    from leave_allocations la
    join leave_types lt on lt.id = la.leave_type_id
    join employees e on e.id = la.employee_id
    where la.year = p_year
      and e.status = 'active'
      and lt.code in ('EL', 'PL')
  loop
    v_remaining := greatest(0.00, (r.allocated_days + r.carry_forward_days - r.used_days));
    v_carried := least(v_remaining, v_cap);
    v_lapsed := v_remaining - v_carried;

    if v_carried > 0 then
      insert into leave_allocations (employee_id, leave_type_id, year, allocated_days, carry_forward_days)
      values (r.employee_id, r.leave_type_id, p_year + 1, 0.00, v_carried)
      on conflict (employee_id, leave_type_id, year) do update set
        carry_forward_days = v_carried,
        updated_at = now();

      insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after, remarks)
      values (r.employee_id, r.leave_type_id, 'carry_forward', v_carried, v_carried, 'Annual year-end carry forward from year ' || p_year);

      v_count := v_count + 1;
    end if;

    if v_lapsed > 0 then
      insert into leave_ledger (employee_id, leave_type_id, transaction_type, days, balance_after, remarks)
      values (r.employee_id, r.leave_type_id, 'manual_adjustment', -v_lapsed, v_carried, 'Lapsed leave days exceeding annual carry forward cap for year ' || p_year);
    end if;
  end loop;

  update scheduled_job_logs
  set status = 'success', records_processed_count = v_count, completed_at = now()
  where id = v_job_id;
exception when others then
  update scheduled_job_logs
  set status = 'failed', error_details = SQLERRM, completed_at = now()
  where id = v_job_id;
end;
$$;

-- 5. Optional Holiday Deadline Auto-Allocation Job Function (§3.2)
create or replace function job_allocate_default_optional_holidays()
returns void language plpgsql as $$
declare
  v_job_id uuid;
  v_count integer := 0;
  v_default_tpl_id uuid;
  r_emp record;
  r_hol record;
begin
  insert into scheduled_job_logs (job_name) values ('optional_holiday_auto_allocation') returning id into v_job_id;

  select id into v_default_tpl_id from work_calendar_templates where is_default = true limit 1;

  if v_default_tpl_id is null then
    update scheduled_job_logs set status = 'failed', error_details = 'Default work calendar template missing' where id = v_job_id;
    return;
  end if;

  for r_emp in
    select e.id
    from employees e
    where e.status = 'active'
      and not exists (
        select 1 from employee_optional_holiday_selections s where s.employee_id = e.id
      )
  loop
    for r_hol in
      select id from holidays
      where calendar_template_id = v_default_tpl_id
        and is_optional = true
      order by holiday_date asc
      limit 2
    loop
      insert into employee_optional_holiday_selections (employee_id, holiday_id, calendar_template_id)
      values (r_emp.id, r_hol.id, v_default_tpl_id)
      on conflict do nothing;

      v_count := v_count + 1;
    end loop;
  end loop;

  update scheduled_job_logs
  set status = 'success', records_processed_count = v_count, completed_at = now()
  where id = v_job_id;
exception when others then
  update scheduled_job_logs
  set status = 'failed', error_details = SQLERRM, completed_at = now()
  where id = v_job_id;
end;
$$;

-- 4. Performance Indexes
create index if not exists idx_comp_off_grants_expiry_status
  on comp_off_grants (expiry_date, status);

-- 5. Row Level Security
alter table scheduled_job_logs enable row level security;

drop policy if exists job_logs_read on scheduled_job_logs;
create policy job_logs_read on scheduled_job_logs for select
  using (has_permission('job.view'));
