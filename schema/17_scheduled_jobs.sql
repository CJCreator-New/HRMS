-- ============================================================================
-- HRMS v2.7 — Module 17: Scheduled & Automated Background Jobs
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/17_scheduled_jobs.sql
-- Strictly aligned with FR §5.12 & ADR 0003
-- ============================================================================

-- 1. Job Execution Audit Log
create type job_status as enum ('running', 'success', 'failed');

create table scheduled_job_logs (
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

-- 4. Performance Indexes
create index if not exists idx_comp_off_grants_expiry_status
  on comp_off_grants (expiry_date, status);

-- 5. Row Level Security
alter table scheduled_job_logs enable row level security;

create policy job_logs_read on scheduled_job_logs for select
  using (has_permission('job.view'));
