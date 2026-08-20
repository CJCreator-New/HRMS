-- ============================================================================
-- HRMS v2.7 — Module 05: Attendance Tracking & Punch Correction
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/05_attendance.sql
-- Strictly aligned with FR §3.1–§3.5 & ADR 0003
-- ============================================================================

-- 1. Enums
create type attendance_event_status as enum ('present', 'absent', 'half_day', 'extra_work', 'pending_review');
create type punch_type as enum ('check_in', 'check_out');
create type correction_fsm_status as enum ('submitted', 'pending_manager', 'approved', 'rejected');

-- 2. Daily Attendance Records (Attendance Event Layer §3.5)
create table attendance_records (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references employees(id) on delete cascade,
  attendance_date     date not null,
  status              attendance_event_status not null default 'pending_review',
  check_in_time       timestamptz,
  check_out_time      timestamptz,
  total_work_minutes  integer default 0,
  remarks             text,
  is_locked           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

-- 3. Raw Punch Logs (§3.1)
create table attendance_punches (
  id                    uuid primary key default gen_random_uuid(),
  attendance_record_id  uuid not null references attendance_records(id) on delete cascade,
  punch_type            punch_type not null,
  punch_timestamp       timestamptz not null default now(),
  device_id             text,
  ip_address            text,
  created_at            timestamptz not null default now()
);

-- 4. Attendance Correction Requests (§3.4 FSM)
create table attendance_corrections (
  id                    uuid primary key default gen_random_uuid(),
  attendance_record_id  uuid not null references attendance_records(id) on delete cascade,
  employee_id           uuid not null references employees(id) on delete cascade,
  requested_status      attendance_event_status not null,
  requested_check_in    timestamptz,
  requested_check_out   timestamptz,
  reason                text not null,
  status                correction_fsm_status not null default 'submitted',
  approver_id           uuid references employees(id),
  decided_at            timestamptz,
  rejection_reason      text,
  is_hr_override        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 5. Derived Read-Only View: Employee On-Leave Status (§3.5)
create view v_employee_on_leave as
select
  lr.employee_id,
  d.day_date as leave_date,
  lt.code as leave_type_code,
  lt.name as leave_type_name,
  lr.id as leave_request_id
from leave_requests lr
join leave_types lt on lt.id = lr.leave_type_id
cross join generate_series(lr.start_date::timestamp, lr.end_date::timestamp, '1 day'::interval) d(day_date)
where lr.status = 'approved';

-- 6. Auto-Calculate Punch Duration & Event Status Function
create or replace function process_attendance_record_update() returns trigger
language plpgsql as $$
begin
  if new.check_in_time is not null and new.check_out_time is not null then
    new.total_work_minutes := extract(epoch from (new.check_out_time - new.check_in_time)) / 60;
    if new.total_work_minutes >= 480 then
      new.status := 'present';
    elsif new.total_work_minutes >= 240 then
      new.status := 'half_day';
    else
      new.status := 'pending_review';
    end if;
  elsif new.check_in_time is not null or new.check_out_time is not null then
    new.status := 'pending_review';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_attendance_record_calc
  before insert or update on attendance_records
  for each row execute function process_attendance_record_update();

-- 7. Row Level Security
alter table attendance_records enable row level security;
alter table attendance_punches enable row level security;
alter table attendance_corrections enable row level security;

create policy attendance_read on attendance_records for select
  using (employee_id = auth_employee_id() or has_permission('attendance.view', employee_id));
create policy attendance_write on attendance_records for insert
  with check (employee_id = auth_employee_id() or has_permission('attendance.mark.self'));
create policy attendance_update on attendance_records for update
  using (has_permission('attendance.correct.override') or is_current_manager_of(auth_employee_id(), employee_id));

create policy punches_read on attendance_punches for select
  using (exists (select 1 from attendance_records r where r.id = attendance_record_id and (r.employee_id = auth_employee_id() or has_permission('attendance.view', r.employee_id))));
create policy punches_insert on attendance_punches for insert
  with check (exists (select 1 from attendance_records r where r.id = attendance_record_id and r.employee_id = auth_employee_id()));

create policy corrections_read on attendance_corrections for select
  using (employee_id = auth_employee_id() or has_permission('attendance.view', employee_id));
create policy corrections_insert on attendance_corrections for insert
  with check (employee_id = auth_employee_id());
create policy corrections_update on attendance_corrections for update
  using (has_permission('attendance.correct.override') or has_permission('attendance.correct.approve') or is_current_manager_of(auth_employee_id(), employee_id));

-- 8. Read-only Derived On-Leave View (§3.5)
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

