-- ============================================================================
-- HRMS v2.7 — Module 02: Employee Lifecycle & Org Structure
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/02_org.sql
-- Strictly aligned with FR §2.1–§2.6 & ADR 0001
-- ============================================================================

-- 1. Employee Status Enum & Core Table
create type employee_status as enum (
  'invited', 'active', 'suspended', 'notice_period', 'offboarded', 'withdrawn'
);

create table employees (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique,
  employee_code        text not null unique,
  full_name            text not null,
  email                text not null unique,
  phone                text,
  date_of_birth        date,
  date_of_joining      date not null,
  status               employee_status not null default 'invited',
  must_change_password boolean not null default true, -- ADR 0001
  is_deactivated       boolean not null default false, -- Access revocation flag (§2.5)
  invitation_sent_at   timestamptz,
  activated_at         timestamptz,
  created_by           uuid references employees(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 2. Status Transition Matrix & Audit Log
create table employee_status_transition_log (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  from_status    employee_status,
  to_status      employee_status not null,
  performed_by   uuid references employees(id),
  reason         text,
  created_at     timestamptz not null default now()
);

create or replace function is_valid_employee_transition(p_from employee_status, p_to employee_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('invited','active'), ('invited','withdrawn'),
    ('active','suspended'), ('suspended','active'),
    ('suspended','offboarded'),
    ('active','notice_period'), ('notice_period','active'), ('notice_period','offboarded'),
    ('active','offboarded')
  )
$$;

create or replace function enforce_employee_transition() returns trigger
language plpgsql as $$
begin
  if old.status is distinct from new.status then
    if not is_valid_employee_transition(old.status, new.status) then
      raise exception 'Invalid employee status transition: % -> % (§2.1)', old.status, new.status;
    end if;
    insert into employee_status_transition_log(employee_id, from_status, to_status, performed_by)
      values (new.id, old.status, new.status, auth_employee_id());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_employee_status_transition
  before update on employees
  for each row execute function enforce_employee_transition();

-- 3. Departments
create table departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 4. Effective-Dated Assignments (Department, Manager, Designation)
create table employee_department_assignment (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  department_id  uuid not null references departments(id),
  effective_from date not null,
  effective_to   date,
  created_by     uuid references employees(id),
  created_at     timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

create table employee_manager_assignment (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  manager_id      uuid references employees(id),
  effective_from  date not null,
  effective_to    date,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

create table employee_designation_assignment (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  title           text not null,
  effective_from  date not null,
  effective_to    date,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

-- 5. Helper Views & Functions
create view employee_current_manager as
  select employee_id, manager_id
  from employee_manager_assignment
  where effective_from <= current_date
    and (effective_to is null or effective_to > current_date);

create or replace function is_current_manager_of(p_manager_id uuid, p_employee_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from employee_current_manager
    where employee_id = p_employee_id and manager_id = p_manager_id
  )
$$;

-- 6. Separation & Offboarding Workflow (§2.2, §2.3)
create type separation_type as enum ('resignation', 'termination');
create type separation_status as enum ('pending', 'active', 'rescinded', 'completed');
create type non_working_day_rule as enum ('previous_working_day', 'next_working_day');

create table separation_records (
  id                          uuid primary key default gen_random_uuid(),
  employee_id                 uuid not null references employees(id) on delete cascade,
  separation_type             separation_type not null,
  initiated_by                uuid not null references employees(id),
  separation_date              date not null,
  notice_period_days           integer not null default 0,
  last_working_day             date not null,
  non_working_day_rule_applied non_working_day_rule,
  status                       separation_status not null default 'pending',
  reason                       text,
  created_by                   uuid references employees(id),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create table offboarding_checklist (
  id                        uuid primary key default gen_random_uuid(),
  separation_id             uuid not null unique references separation_records(id) on delete cascade,
  attendance_verified       boolean not null default false,
  leave_balance_settled     boolean not null default false,
  ff_completed              boolean not null default false,
  access_revoked            boolean not null default false,
  employee_marked_offboarded boolean not null default false,
  updated_at                timestamptz not null default now()
);

-- 7. Bulk Import Tables (§2.6)
create type import_batch_status as enum ('processing', 'completed', 'completed_with_errors');
create type import_row_status as enum ('success', 'failed');

create table employee_import_batch (
  id             uuid primary key default gen_random_uuid(),
  uploaded_by    uuid not null references employees(id),
  file_name      text not null,
  total_rows     integer not null default 0,
  success_count  integer not null default 0,
  failure_count  integer not null default 0,
  status         import_batch_status not null default 'processing',
  created_at     timestamptz not null default now()
);

create table employee_import_row_result (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references employee_import_batch(id) on delete cascade,
  row_number     integer not null,
  status         import_row_status not null,
  error_message  text,
  employee_id    uuid references employees(id)
);

-- 8. Row Level Security Policies
alter table employees enable row level security;
alter table employee_status_transition_log enable row level security;
alter table departments enable row level security;
alter table employee_department_assignment enable row level security;
alter table employee_manager_assignment enable row level security;
alter table employee_designation_assignment enable row level security;
alter table separation_records enable row level security;
alter table offboarding_checklist enable row level security;
alter table employee_import_batch enable row level security;
alter table employee_import_row_result enable row level security;

create policy employees_read on employees for select
  using (id = auth_employee_id() or has_permission('employee.view', id));
create policy employees_update on employees for update
  using (has_permission('employee.edit', id));
create policy employees_insert on employees for insert
  with check (has_permission('employee.create'));

create policy departments_read on departments for select using (true);
create policy departments_write on departments for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy dept_assignment_read on employee_department_assignment for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy dept_assignment_write on employee_department_assignment for insert
  with check (has_permission('employee.edit', employee_id));

create policy manager_assignment_read on employee_manager_assignment for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy manager_assignment_write on employee_manager_assignment for insert
  with check (has_permission('employee.edit', employee_id));

create policy designation_assignment_read on employee_designation_assignment for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy designation_assignment_write on employee_designation_assignment for insert
  with check (has_permission('employee.edit', employee_id));

create policy separation_read on separation_records for select
  using (employee_id = auth_employee_id() or has_permission('separation.view', employee_id));
create policy separation_insert on separation_records for insert
  with check (
    employee_id = auth_employee_id()
    or has_permission('separation.create.all')
    or (separation_type = 'resignation' and is_current_manager_of(auth_employee_id(), employee_id))
  );
create policy separation_update on separation_records for update
  using (has_permission('separation.edit', employee_id));

create policy offboarding_checklist_hr on offboarding_checklist for all
  using (has_permission('offboarding.manage')) with check (has_permission('offboarding.manage'));

create policy import_batch_hr on employee_import_batch for all
  using (has_permission('employee.import')) with check (has_permission('employee.import'));
create policy import_row_hr on employee_import_row_result for select
  using (has_permission('employee.import'));
