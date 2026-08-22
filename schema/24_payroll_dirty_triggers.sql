-- ============================================================================
-- HRMS v2.7 — Module 24: Payroll Dirty State Tracking Triggers
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/24_payroll_dirty_triggers.sql
-- Strictly aligned with FR §5.2, §5.7 & ADR 0003
-- ============================================================================
--
-- Automatically marks validated/finalized/published payroll periods as is_dirty = true
-- with dirty_reason when retroactive attendance punches or leave requests occur.

create or replace function flag_payroll_period_dirty_on_attendance() returns trigger
language plpgsql as $$
declare
  v_att_date date;
  v_emp_id uuid;
begin
  v_att_date := coalesce(new.attendance_date, old.attendance_date);
  v_emp_id := coalesce(new.employee_id, old.employee_id);

  update payroll_periods
  set is_dirty = true,
      dirty_reason = format('Retroactive attendance change for employee %s on date %s', v_emp_id, v_att_date),
      dirty_at = now()
  where v_att_date between start_date and end_date
    and status in ('validated', 'finalized', 'published');

  return new;
end;
$$;

drop trigger if exists trg_attendance_payroll_dirty on attendance_records;
create trigger trg_attendance_payroll_dirty
  after insert or update or delete on attendance_records
  for each row execute function flag_payroll_period_dirty_on_attendance();

create or replace function flag_payroll_period_dirty_on_leave() returns trigger
language plpgsql as $$
declare
  v_start date;
  v_end date;
  v_emp_id uuid;
begin
  v_start := coalesce(new.start_date, old.start_date);
  v_end := coalesce(new.end_date, old.end_date);
  v_emp_id := coalesce(new.employee_id, old.employee_id);

  update payroll_periods
  set is_dirty = true,
      dirty_reason = format('Retroactive leave change for employee %s for range %s..%s', v_emp_id, v_start, v_end),
      dirty_at = now()
  where (start_date <= v_end and end_date >= v_start)
    and status in ('validated', 'finalized', 'published');

  return new;
end;
$$;

drop trigger if exists trg_leave_payroll_dirty on leave_requests;
create trigger trg_leave_payroll_dirty
  after insert or update or delete on leave_requests
  for each row execute function flag_payroll_period_dirty_on_leave();

-- 3. Salary Structure Change Trigger
create or replace function flag_payroll_period_dirty_on_salary() returns trigger
language plpgsql as $$
declare
  v_emp_id uuid;
begin
  v_emp_id := coalesce(new.employee_id, old.employee_id);

  update payroll_periods
  set is_dirty = true,
      dirty_reason = format('Salary structure modified for employee %s', v_emp_id),
      dirty_at = now()
  where status in ('validated', 'finalized', 'published');

  return new;
end;
$$;

drop trigger if exists trg_salary_payroll_dirty on employee_salary_structures;
create trigger trg_salary_payroll_dirty
  after insert or update or delete on employee_salary_structures
  for each row execute function flag_payroll_period_dirty_on_salary();
