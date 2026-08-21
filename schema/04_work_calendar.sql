-- ============================================================================
-- HRMS v2.7 — Module 04: Work Calendar & Holiday Management
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/04_work_calendar.sql
-- Strictly aligned with FR §3.5, §7, §9 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id for RLS),
--               02_org.sql (employees table, separation_records for LWD lookup)
-- DEPENDENTS: 05_attendance.sql (is_working_day used in attendance triggers),
--             06_leave.sql (is_working_day used in leave sandwich calc)
-- Provides: work_calendar_templates, holidays, employee_work_calendar_assignment,
--           employee_optional_holiday_selections tables,
--           is_working_day() function========

-- 1. Calendar Templates (e.g. 5-Day Week, 6-Day Week, Alternate Saturday)
create table work_calendar_templates (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null unique,
  name                        text not null,
  description                 text,
  standard_working_days       integer[] not null default '{1,2,3,4,5}', -- 1=Mon .. 7=Sun
  alt_saturday_rule           text default 'none', -- 'none' | '2nd_4th_off' | '1st_3rd_off'
  total_optional_holidays_allowed integer default 2,
  optional_selection_deadline_date date,
  is_default                  boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- 2. Holidays Master
create table holidays (
  id                    uuid primary key default gen_random_uuid(),
  calendar_template_id  uuid not null references work_calendar_templates(id) on delete cascade,
  name                  text not null,
  holiday_date          date not null,
  is_optional           boolean not null default false,
  description           text,
  created_at            timestamptz not null default now(),
  unique (calendar_template_id, holiday_date, name)
);

-- 3. Effective-Dated Per-Employee Calendar Assignment
create table employee_work_calendar_assignment (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  calendar_template_id  uuid not null references work_calendar_templates(id),
  effective_from        date not null,
  effective_to          date,
  created_by            uuid references employees(id),
  created_at            timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

-- 4. Employee Optional Holiday Selections (FR §9)
create table employee_optional_holiday_selections (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  holiday_id     uuid not null references holidays(id) on delete cascade,
  selected_at    timestamptz not null default now(),
  auto_assigned  boolean not null default false,
  unique (employee_id, holiday_id)
);

-- 5. Helper Function: Check if a date is a working day for an employee (§2.4, §3.5)
create or replace function is_working_day(p_employee_id uuid, p_date date)
returns boolean language plpgsql stable as $$
declare
  v_template_id uuid;
  v_dow integer;
  v_working_days integer[];
  v_is_compulsory_holiday boolean;
  v_is_selected_optional boolean;
  v_doj date;
  v_lwd date;
begin
  -- Check employee DOJ & LWD boundaries (§2.4)
  select date_of_joining into v_doj from employees where id = p_employee_id;
  if v_doj is null or p_date < v_doj then
    return false;
  end if;

  select last_working_day into v_lwd
  from separation_records
  where employee_id = p_employee_id and status in ('active', 'completed')
  order by created_at desc limit 1;

  if v_lwd is not null and p_date > v_lwd then
    return false;
  end if;

  -- Fetch current calendar template for employee
  select calendar_template_id into v_template_id
  from employee_work_calendar_assignment
  where employee_id = p_employee_id
    and effective_from <= p_date
    and (effective_to is null or effective_to >= p_date)
  limit 1;

  if v_template_id is null then
    select id into v_template_id from work_calendar_templates where is_default = true limit 1;
  end if;

  if v_template_id is null then
    v_dow := extract(isodow from p_date);
    return v_dow between 1 and 5;
  end if;

  -- Check compulsory holiday
  select exists (
    select 1 from holidays
    where calendar_template_id = v_template_id
      and holiday_date = p_date
      and is_optional = false
  ) into v_is_compulsory_holiday;

  if v_is_compulsory_holiday then
    return false;
  end if;

  -- Check selected optional holiday
  select exists (
    select 1 from employee_optional_holiday_selections s
    join holidays h on h.id = s.holiday_id
    where s.employee_id = p_employee_id
      and h.holiday_date = p_date
  ) into v_is_selected_optional;

  if v_is_selected_optional then
    return false;
  end if;

  -- Check standard working day of week (1=Mon..7=Sun)
  v_dow := extract(isodow from p_date);
  select standard_working_days into v_working_days
  from work_calendar_templates where id = v_template_id;

  return v_dow = any(v_working_days);
end;
$$;

-- 6. Row Level Security
alter table work_calendar_templates enable row level security;
alter table holidays enable row level security;
alter table employee_work_calendar_assignment enable row level security;
alter table employee_optional_holiday_selections enable row level security;

create policy templates_read on work_calendar_templates for select using (true);
create policy templates_write on work_calendar_templates for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy holidays_read on holidays for select using (true);
create policy holidays_write on holidays for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy calendar_assignment_read on employee_work_calendar_assignment for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy calendar_assignment_write on employee_work_calendar_assignment for insert
  with check (has_permission('settings.manage'));

create policy optional_selections_read on employee_optional_holiday_selections for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy optional_selections_write on employee_optional_holiday_selections for insert
  with check (employee_id = auth_employee_id() or has_permission('employee.edit', employee_id));

-- Seed baseline Default Calendar Template
insert into work_calendar_templates (code, name, description, standard_working_days, is_default)
values ('DEFAULT_5DAY', 'Standard 5-Day Work Week', 'Monday to Friday working, Saturday and Sunday off', '{1,2,3,4,5}', true)
on conflict (code) do nothing;
