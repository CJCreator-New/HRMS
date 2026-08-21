-- ============================================================================
-- HRMS v2.7 — Master Combined Database Initializer Script
-- Generated Automatically via scripts/db-apply.mjs
-- Source: schema/00_setup.sql through 22_comprehensive_performance_indexes.sql + bootstrap
-- ============================================================================

-- BEGIN FILE: 00_setup.sql
-- ============================================================================
-- HRMS v2.7 — Module 00: Setup & Core Infrastructure
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/00_setup.sql
-- ============================================================================

-- 1. Required PostgreSQL Extensions
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- 2. Automatic Updated-At Timestamp Trigger Function
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 3. Idempotency Key Uniqueness Store & Enforcement Function (§8.4)
create table system_idempotency_keys (
  id             uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  scope          text not null, -- e.g. 'payroll_run', 'leave_application', 'employee_import'
  created_at     timestamptz not null default now(),
  unique (scope, idempotency_key)
);

create or replace function register_idempotency_key(p_key text, p_scope text) returns boolean
language plpgsql as $$
begin
  if p_key is null or trim(p_key) = '' then
    return true;
  end if;

  insert into system_idempotency_keys (idempotency_key, scope)
  values (trim(p_key), trim(p_scope));

  return true;
exception when unique_violation then
  raise exception 'Duplicate request detected for idempotency key % under scope % (§8.4)', p_key, p_scope;
end;
$$;


-- END FILE: 00_setup.sql

-- BEGIN FILE: 01_rbac.sql
-- ============================================================================
-- HRMS v2.7 — Module 01: Role-Based Access Control (RBAC)
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/01_rbac.sql
-- Strictly aligned with FR §1.1, §1.2, & §1.3
-- ============================================================================

-- 1. Core Tables
create table roles (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,   -- 'employee' | 'manager' | 'hr' | 'payroll_admin' | 'system_admin'
  name          text not null,
  is_system     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table permissions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text,
  created_at    timestamptz not null default now()
);

create table role_permissions (
  role_id        uuid not null references roles(id) on delete cascade,
  permission_id  uuid not null references permissions(id) on delete cascade,
  granted_by     uuid references employees(id),
  granted_at     timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table employee_roles (
  employee_id   uuid not null references employees(id) on delete cascade,
  role_id       uuid not null references roles(id) on delete cascade,
  assigned_by   uuid references employees(id),
  assigned_at   timestamptz not null default now(),
  primary key (employee_id, role_id)
);

-- Helper: Map auth.uid() to employees.id
create or replace function auth_employee_id() returns uuid
language sql stable as $$
  select id from employees where auth_user_id = auth.uid() limit 1;
$$;

-- 2. Permission Evaluation Function (§1.2 Scope Matching)
create or replace function has_permission(perm_code text, target_employee_id uuid default null)
returns boolean language plpgsql stable as $$
declare
  acting_id uuid := auth_employee_id();
  has_all boolean;
  has_team boolean;
  has_self boolean;
begin
  if acting_id is null then
    return false;
  end if;

  -- Exact permission match
  if exists (
    select 1 from employee_roles er
    join role_permissions rp on rp.role_id = er.role_id
    join permissions p on p.id = rp.permission_id
    where er.employee_id = acting_id and p.code = perm_code
  ) then
    return true;
  end if;

  if target_employee_id is null then
    return false;
  end if;

  -- Scoped checks: .all / .self / .team
  select exists (
    select 1 from employee_roles er
    join role_permissions rp on rp.role_id = er.role_id
    join permissions p on p.id = rp.permission_id
    where er.employee_id = acting_id and p.code = perm_code || '.all'
  ) into has_all;
  if has_all then return true; end if;

  if target_employee_id = acting_id then
    select exists (
      select 1 from employee_roles er
      join role_permissions rp on rp.role_id = er.role_id
      join permissions p on p.id = rp.permission_id
      where er.employee_id = acting_id and p.code = perm_code || '.self'
    ) into has_self;
    if has_self then return true; end if;
  end if;

  select exists (
    select 1 from employee_roles er
    join role_permissions rp on rp.role_id = er.role_id
    join permissions p on p.id = rp.permission_id
    where er.employee_id = acting_id and p.code = perm_code || '.team'
  ) into has_team;
  if has_team and is_current_manager_of(acting_id, target_employee_id) then
    return true;
  end if;

  return false;
end;
$$;

-- Batch permission check: returns true if the acting employee holds ANY of the
-- given permission codes (exact match only — no scope suffix). Replaces the
-- N+1 has_permission loop in middleware for routes with multiple required
-- permissions (union gate).
create or replace function has_any_permission(perm_codes text[])
returns boolean language plpgsql stable as $$
declare
  acting_id uuid := auth_employee_id();
begin
  if acting_id is null then
    return false;
  end if;

  return exists (
    select 1 from employee_roles er
    join role_permissions rp on rp.role_id = er.role_id
    join permissions p on p.id = rp.permission_id
    where er.employee_id = acting_id and p.code = any(perm_codes)
  );
end;
$$;

-- Historical approval access check (§1.3)
create or replace function acted_as_approver(acting_id uuid, approval_stage_table text, record_id uuid)
returns boolean language plpgsql stable as $$
begin
  if acting_id is null then return false; end if;

  if approval_stage_table = 'leave_request_approvals' then
    return exists (
      select 1 from leave_request_approvals
      where leave_request_id = record_id and approver_id = acting_id
    );
  elsif approval_stage_table = 'attendance_corrections' then
    return exists (
      select 1 from attendance_corrections
      where id = record_id and decided_by = acting_id
    );
  elsif approval_stage_table = 'reimbursement_claims' then
    return exists (
      select 1 from reimbursement_claims
      where id = record_id and (manager_approver_id = acting_id or hr_approver_id = acting_id)
    );
  elsif approval_stage_table = 'ff_clearances' then
    return exists (
      select 1 from ff_clearances
      where ff_settlement_id = record_id and cleared_by = acting_id
    );
  end if;

  return false;
end;
$$;

-- 3. Self-Grant Control Trigger (§1.3)
create or replace function block_self_grant_of_approval_permission() returns trigger
language plpgsql as $$
declare
  approval_perm boolean;
begin
  select exists (
    select 1 from permissions p
    where p.id = new.permission_id
      and (p.code like '%.approve%' or p.code like '%.finalize' or p.code like '%.publish' or p.code = 'ff.approve')
  ) into approval_perm;

  if approval_perm and exists (
    select 1 from employee_roles er
    where er.role_id = new.role_id and er.employee_id = auth_employee_id()
  ) then
    raise exception 'Self-grant of business-approval permission blocked (§1.3) — requires a second System Admin';
  end if;
  return new;
end;
$$;

create trigger trg_block_self_grant
  before insert on role_permissions
  for each row execute function block_self_grant_of_approval_permission();

-- 4. Row Level Security
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table employee_roles enable row level security;

create policy roles_read on roles for select using (true);
create policy roles_admin_write on roles for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy permissions_read on permissions for select using (true);
create policy permissions_admin_write on permissions for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy role_permissions_read on role_permissions for select using (true);
create policy role_permissions_admin_write on role_permissions for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy employee_roles_self_read on employee_roles for select
  using (employee_id = auth_employee_id() or has_permission('employee.view', employee_id));
create policy employee_roles_admin_write on employee_roles for insert
  with check (has_permission('settings.manage'));
create policy employee_roles_admin_update on employee_roles for update
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy employee_roles_admin_delete on employee_roles for delete
  using (has_permission('settings.manage'));

-- 5. Seeds: Baseline Roles (§1.1)
insert into roles (code, name, is_system) values
  ('employee', 'Employee', true),
  ('manager', 'Manager', true),
  ('hr', 'HR Admin', true),
  ('payroll_admin', 'Payroll Administrator', true),
  ('system_admin', 'System Administrator', true),
  ('statutory_admin', 'Statutory Administrator', true),
  ('finance_admin', 'Finance Administrator', true),
  ('it_admin', 'IT Administrator', true)
on conflict (code) do nothing;

-- 6. Seeds: Exact Permission Catalog (§1.2 & Rollout Plan §2)
insert into permissions (code, description) values
  ('employee.view.self', 'View own employee profile'),
  ('employee.view.team', 'View team employee profiles'),
  ('employee.view.all', 'View all employee profiles'),
  ('employee.create', 'Create new employee record'),
  ('employee.edit', 'Edit employee profile details'),
  ('employee.import', 'Perform bulk employee import'),
  ('employee.deactivate', 'Deactivate employee system access'),
  ('attendance.mark.self', 'Mark own attendance punch'),
  ('attendance.mark.team', 'Mark attendance for team member'),
  ('attendance.view.self', 'View own attendance records'),
  ('attendance.view.team', 'View team attendance records'),
  ('attendance.view.all', 'View all attendance records'),
  ('attendance.correct.self', 'Submit attendance correction for self'),
  ('attendance.correct.approve', 'Approve attendance corrections'),
  ('attendance.correct.override', 'HR override attendance records'),
  ('leave.view.self', 'View own leave requests and balances'),
  ('leave.view.team', 'View team leave requests'),
  ('leave.view.all', 'View all leave requests'),
  ('leave.apply.self', 'Apply for leave'),
  ('leave.approve.manager', 'Approve team leave requests as Manager'),
  ('leave.approve.hr', 'Approve leave requests as HR Admin'),
  ('leave.cancel.self', 'Cancel own leave request'),
  ('leave.cancel.approve', 'Approve cancellation of approved leave'),
  ('leave.manage_types', 'Configure leave types and quotas'),
  ('leave.encash.apply.self', 'Apply for leave encashment'),
  ('leave.encash.approve', 'Approve leave encashment'),
  ('compoff.apply.self', 'Apply for Comp-Off grant'),
  ('compoff.approve', 'Approve Comp-Off grant'),
  ('compoff.credit.manual', 'Manually credit Comp-Off days'),
  ('compoff.revoke', 'Revoke Comp-Off grant'),
  ('permission.apply.self', 'Apply for short permission'),
  ('permission.approve', 'Approve short permission'),
  ('permission.override.quota', 'Override short permission monthly quota'),
  ('salary.view.self', 'View own salary structure'),
  ('salary.view.all', 'View all employee salary structures'),
  ('salary.edit', 'Edit salary structures and assignments'),
  ('salary.bulk_assign', 'Bulk assign salary structures and revisions'),
  ('payroll.view', 'View payroll summary and runs'),
  ('payroll.run', 'Initiate payroll run'),
  ('payroll.reopen', 'Reopen payroll run for revision'),
  ('payroll.finalize', 'Finalize payroll run'),
  ('payroll.publish', 'Publish payslips to employees'),
  ('payroll.schedule', 'Manage payroll schedule'),
  ('statutory.view', 'View statutory profiles'),
  ('statutory.edit', 'Manage statutory profiles'),
  ('statutory.bulk_upsert', 'Bulk upsert employee statutory profiles'),
  ('department.bulk_assign', 'Bulk assign employee departments and hierarchy'),
  ('calendar.bulk_assign', 'Bulk assign employee work calendar templates'),
  ('reimbursement.apply.self', 'Submit reimbursement claim'),
  ('reimbursement.view.team', 'View team reimbursement claims'),
  ('reimbursement.view.all', 'View all reimbursement claims'),
  ('reimbursement.approve', 'Approve reimbursement claim'),
  ('reimbursement.cancel.self', 'Cancel reimbursement claim'),
  ('separation.view', 'View separation records'),
  ('separation.create', 'Initiate resignation or termination'),
  ('separation.edit', 'Manage separation notice period and LWD'),
  ('offboarding.manage', 'Manage offboarding checklist tasks'),
  ('ff.view', 'View full and final settlement'),
  ('ff.create', 'Draft full and final settlement statement'),
  ('ff.approve', 'Approve full and final settlement'),
  ('attachment.upload', 'Upload document attachments'),
  ('attachment.view', 'View document attachments'),
  ('settings.manage', 'Manage system settings and RBAC'),
  ('audit.view', 'View audit logs'),
  ('job.view', 'View background job status'),
  ('job.rerun', 'Trigger manual background job execution'),
  ('reports.export', 'Export executive and compliance reports')
on conflict (code) do nothing;

-- 7. Seeds: Baseline Role Permissions Mapping (§1.3 & Rollout Plan §2.3)
-- Employee Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'employee' and p.code in (
  'employee.view.self', 'attendance.mark.self', 'attendance.view.self', 'attendance.correct.self',
  'leave.view.self', 'leave.apply.self', 'leave.cancel.self', 'leave.encash.apply.self',
  'compoff.apply.self', 'permission.apply.self', 'salary.view.self', 'reimbursement.apply.self',
  'reimbursement.cancel.self', 'separation.view', 'attachment.upload', 'attachment.view'
) on conflict do nothing;

-- Manager Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'manager' and p.code in (
  'employee.view.self', 'attendance.mark.self', 'attendance.view.self', 'attendance.correct.self',
  'leave.view.self', 'leave.apply.self', 'leave.cancel.self', 'leave.encash.apply.self',
  'compoff.apply.self', 'permission.apply.self', 'salary.view.self', 'reimbursement.apply.self',
  'reimbursement.cancel.self', 'attachment.upload', 'attachment.view',
  'employee.view.team', 'attendance.mark.team', 'attendance.view.team', 'attendance.correct.approve',
  'leave.view.team', 'leave.approve.manager', 'leave.cancel.approve', 'permission.approve',
  'permission.override.quota', 'compoff.approve', 'reimbursement.approve', 'reimbursement.view.team',
  'separation.create', 'separation.view', 'job.view'
) on conflict do nothing;

-- HR Admin Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'hr' and p.code in (
  'employee.view.all', 'employee.create', 'employee.edit', 'employee.import', 'employee.deactivate',
  'attendance.view.all', 'attendance.correct.override', 'leave.view.all', 'leave.approve.hr',
  'leave.cancel.approve', 'leave.manage_types', 'leave.encash.approve', 'salary.view.all', 'salary.edit',
  'salary.bulk_assign', 'statutory.view', 'statutory.edit', 'statutory.bulk_upsert', 'department.bulk_assign',
  'calendar.bulk_assign', 'reimbursement.approve', 'reimbursement.view.all', 'separation.view',
  'separation.create', 'separation.edit', 'offboarding.manage', 'ff.create', 'ff.view', 'ff.approve',
  'compoff.credit.manual', 'compoff.revoke', 'attachment.upload', 'attachment.view', 'reports.export',
  'audit.view', 'settings.manage', 'job.view', 'job.rerun'
) on conflict do nothing;

-- Payroll Admin Role Grants (Read-Only on Ops Data, No Approval Perms per Q11 / FR §5.7)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'payroll_admin' and p.code in (
  'salary.view.all', 'salary.edit', 'salary.bulk_assign', 'payroll.view', 'payroll.run', 'payroll.reopen',
  'payroll.finalize', 'payroll.publish', 'payroll.schedule', 'statutory.view', 'statutory.edit',
  'statutory.bulk_upsert', 'ff.view', 'reports.export', 'employee.view.all', 'attendance.view.all',
  'leave.view.all', 'reimbursement.view.all', 'attachment.view'
) on conflict do nothing;

-- System Admin Role Grants (Technical-Only Seed per Q5)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'system_admin' and p.code in (
  'settings.manage', 'audit.view', 'job.view', 'job.rerun', 'employee.view.all',
  'department.bulk_assign', 'calendar.bulk_assign'
) on conflict do nothing;

-- Statutory Admin Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'statutory_admin' and p.code in (
  'statutory.view', 'statutory.edit', 'employee.view.all', 'salary.view.all',
  'payroll.view', 'reports.export', 'attachment.view'
) on conflict do nothing;

-- Finance Admin Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'finance_admin' and p.code in (
  'reimbursement.approve', 'reimbursement.view.all', 'ff.view', 'ff.approve',
  'payroll.view', 'reports.export', 'employee.view.all', 'attachment.view'
) on conflict do nothing;

-- IT Admin Role Grants
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.code = 'it_admin' and p.code in (
  'attachment.upload', 'attachment.view', 'audit.view', 'job.view', 'job.rerun',
  'employee.view.all', 'settings.manage'
) on conflict do nothing;


-- END FILE: 01_rbac.sql

-- BEGIN FILE: 02_org.sql
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
create type separation_status as enum ('pending', 'active', 'rescinded', 'completed', 'withdrawn');
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


-- END FILE: 02_org.sql

-- BEGIN FILE: 03_settings.sql
-- ============================================================================
-- HRMS v2.7 — Module 03: System Settings & Policy Configuration
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/03_settings.sql
-- Strictly aligned with FR §1.4, §3.7, §5.3, §9 & ADR 0003
-- ============================================================================

-- 1. Core Company Settings Table
create table company_settings (
  id                        uuid primary key default gen_random_uuid(),
  company_name              text not null default 'My Company',
  timezone                  text not null default 'Asia/Kolkata',
  currency                  text not null default 'INR',
  currency_symbol           text not null default '₹',
  rounding_mode             text not null default 'half_up', -- 'half_up' | 'truncate' | 'round'
  invitation_expiry_days    integer default 7,
  notice_period_days_default integer,
  manager_sla_days          integer default 2, -- FR §4.2 window in days
  alternate_hr_approver_id  uuid references employees(id), -- FR §1.4 singular HR alternate
  is_configured             boolean not null default false, -- Engine unlock gate flag
  updated_by                uuid references employees(id),
  updated_at                timestamptz not null default now()
);

-- 2. Flexible Policy Configurations (JSONB structured settings)
create table policy_configurations (
  id             uuid primary key default gen_random_uuid(),
  category       text not null, -- 'leave' | 'attendance' | 'payroll' | 'reimbursement'
  key            text not null unique,
  value          jsonb not null,
  description    text,
  updated_by     uuid references employees(id),
  updated_at     timestamptz not null default now()
);

-- 3. Engine Unlock Gate Helper Function
create or replace function is_system_configured() returns boolean
language sql stable as $$
  select coalesce((select is_configured from company_settings limit 1), false);
$$;

-- 4. Row Level Security
alter table company_settings enable row level security;
alter table policy_configurations enable row level security;

create policy company_settings_read on company_settings for select using (true);
create policy company_settings_write on company_settings for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy policy_config_read on policy_configurations for select using (true);
create policy policy_config_write on policy_configurations for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

-- Seed single container row in company_settings
insert into company_settings (company_name, timezone, currency, currency_symbol, rounding_mode, is_configured)
select 'My Organization', 'Asia/Kolkata', 'INR', '₹', 'half_up', false
where not exists (select 1 from company_settings);

-- Seed default policy configurations (§4.1 leave defaults)
insert into policy_configurations (category, key, value, description) values
  ('leave', 'default_cl_quota', '{"days": 12}'::jsonb, 'Default annual Casual Leave quota'),
  ('leave', 'default_sl_quota', '{"days": 12}'::jsonb, 'Default annual Sick Leave quota'),
  ('leave', 'default_el_quota', '{"days": 15}'::jsonb, 'Default annual Earned Leave quota')
on conflict (key) do nothing;


-- END FILE: 03_settings.sql

-- BEGIN FILE: 04_work_calendar.sql
-- ============================================================================
-- HRMS v2.7 — Module 04: Work Calendar & Holiday Management
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/04_work_calendar.sql
-- Strictly aligned with FR §3.5, §7, §9 & ADR 0003
-- ============================================================================

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


-- END FILE: 04_work_calendar.sql

-- BEGIN FILE: 05_attendance.sql
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



-- END FILE: 05_attendance.sql

-- BEGIN FILE: 06_leave.sql
-- ============================================================================
-- HRMS v2.7 — Module 06: Leave Management Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/06_leave.sql
-- Strictly aligned with FR §4.1–§4.9 & ADR 0003
-- ============================================================================

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


-- END FILE: 06_leave.sql

-- BEGIN FILE: 07_salary.sql
-- ============================================================================
-- HRMS v2.7 — Module 07: Salary Structure & Component Master
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/07_salary.sql
-- Effective-dated per-employee versioned salary structure per FR §5.1
-- ============================================================================

-- 1. Component Enums
create type component_type as enum ('earning', 'deduction', 'reimbursement', 'statutory_deduction');
create type calculation_type as enum ('flat_amount', 'percentage_of_basic', 'percentage_of_ctc', 'variable');

-- 2. Salary Components Master
create table salary_components (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique, -- 'BASIC', 'HRA', 'SPECIAL_ALLOWANCE', 'PF_EMP', 'ESI_EMP', 'PT', 'TDS'
  name                text not null,
  component_type      component_type not null,
  calculation_type    calculation_type not null default 'flat_amount',
  is_taxable          boolean not null default true,
  is_pf_component     boolean not null default false,
  is_esi_component    boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- 3. Per-Employee Versioned Salary Structure (§5.1)
create table employee_salary_structures (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  annual_ctc      numeric(14,2) not null,
  monthly_gross   numeric(14,2) not null,
  basic_monthly   numeric(14,2) not null,
  effective_from  date not null,
  effective_to    date,
  version_number  integer not null default 1,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

create table employee_salary_structure_items (
  id                          uuid primary key default gen_random_uuid(),
  employee_salary_structure_id uuid not null references employee_salary_structures(id) on delete cascade,
  salary_component_id         uuid not null references salary_components(id),
  amount                      numeric(14,2) not null,
  percentage_value            numeric(5,2),
  unique (employee_salary_structure_id, salary_component_id)
);

-- 4. Row Level Security Policies
alter table salary_components enable row level security;
alter table employee_salary_structures enable row level security;
alter table employee_salary_structure_items enable row level security;

create policy components_read on salary_components for select using (true);
create policy components_write on salary_components for all
  using (has_permission('salary.edit')) with check (has_permission('salary.edit'));

create policy salary_structure_read on employee_salary_structures for select
  using (employee_id = auth_employee_id() or has_permission('salary.view.all'));
create policy salary_structure_write on employee_salary_structures for insert
  with check (has_permission('salary.edit'));

create policy salary_items_read on employee_salary_structure_items for select
  using (exists (select 1 from employee_salary_structures s where s.id = employee_salary_structure_id and (s.employee_id = auth_employee_id() or has_permission('salary.view.all'))));

-- Seed Standard Indian Salary Components
insert into salary_components (code, name, component_type, calculation_type, is_taxable, is_pf_component, is_esi_component) values
  ('BASIC', 'Basic Salary', 'earning', 'percentage_of_ctc', true, true, true),
  ('HRA', 'House Rent Allowance', 'earning', 'percentage_of_basic', true, false, true),
  ('SPECIAL_ALLOWANCE', 'Special Allowance', 'earning', 'flat_amount', true, false, true),
  ('PF_EMP', 'Employee PF Deduction', 'statutory_deduction', 'percentage_of_basic', false, false, false),
  ('ESI_EMP', 'Employee ESI Deduction', 'statutory_deduction', 'percentage_of_basic', false, false, false),
  ('PT', 'Professional Tax', 'statutory_deduction', 'flat_amount', false, false, false),
  ('TDS', 'Income Tax TDS', 'statutory_deduction', 'flat_amount', false, false, false)
on conflict (code) do nothing;


-- END FILE: 07_salary.sql

-- BEGIN FILE: 08_payroll_eligibility.sql
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


-- END FILE: 08_payroll_eligibility.sql

-- BEGIN FILE: 09_payroll.sql
-- ============================================================================
-- HRMS v2.7 — Module 09: Payroll Core Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/09_payroll.sql
-- Strictly aligned with FR §5.2, §5.3, §5.5–§5.9 & ADR 0003
-- Supports FR Revision/Supersede flow & §5.7 Blocking Checks
-- ============================================================================

-- 1. Enums
create type payroll_period_status as enum ('draft', 'processing', 'validated', 'finalized', 'published');
create type revision_status as enum ('draft', 'superseded', 'finalized');
create type adjustment_type as enum ('bonus', 'arrears', 'penalty', 'other_addition', 'other_deduction');

-- 2. Payroll Periods & Versioned Revisions (§5.2)
create table payroll_periods (
  id           uuid primary key default gen_random_uuid(),
  year         integer not null,
  month        integer not null,
  start_date   date not null,
  end_date     date not null,
  cutoff_date  date not null,
  status       payroll_period_status not null default 'draft',
  created_at   timestamptz not null default now(),
  unique (year, month)
);

create table payroll_revisions (
  id                 uuid primary key default gen_random_uuid(),
  payroll_period_id  uuid not null references payroll_periods(id) on delete cascade,
  revision_number    integer not null default 1,
  status             revision_status not null default 'draft',
  total_employees    integer not null default 0,
  total_gross        numeric(14,2) not null default 0.00,
  total_deductions   numeric(14,2) not null default 0.00,
  total_net          numeric(14,2) not null default 0.00,
  executed_by        uuid references employees(id),
  executed_at        timestamptz not null default now(),
  unique (payroll_period_id, revision_number)
);

-- 3. Individual Employee Payslip Snapshots per Revision (§5.2)
create table payslips (
  id                  uuid primary key default gen_random_uuid(),
  payroll_revision_id uuid not null references payroll_revisions(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  year                integer not null,
  month               integer not null,
  payable_units       numeric(5,2) not null,
  lop_units           numeric(5,2) not null default 0.00,
  gross_earnings      numeric(14,2) not null,
  total_deductions    numeric(14,2) not null,
  net_pay             numeric(14,2) not null,
  is_published        boolean not null default false,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (payroll_revision_id, employee_id)
);

create table payslip_components (
  id                  uuid primary key default gen_random_uuid(),
  payslip_id          uuid not null references payslips(id) on delete cascade,
  salary_component_id uuid not null references salary_components(id),
  component_code      text not null,
  component_name      text not null,
  component_type      component_type not null,
  amount              numeric(14,2) not null
);

-- 4. Payment Items Breakdown Table (§5.2)
create table payroll_payment_items (
  id                  uuid primary key default gen_random_uuid(),
  payslip_id          uuid not null references payslips(id) on delete cascade,
  item_category       text not null, -- 'salary' | 'reimbursement_non_taxable' | 'reimbursement_taxable' | 'encashment' | 'adjustment'
  description         text not null,
  amount              numeric(14,2) not null,
  is_taxable          boolean not null default true,
  created_at          timestamptz not null default now()
);

-- 5. Payroll Adjustments (§5.2 Additions / Deductions)
create table payroll_adjustments (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references employees(id) on delete cascade,
  payroll_period_id  uuid not null references payroll_periods(id),
  adjustment_type    adjustment_type not null,
  amount             numeric(14,2) not null,
  reason             text not null,
  approved_by        uuid references employees(id),
  created_at         timestamptz not null default now()
);

-- 5. Strict Payroll Lock Verification Function (§5.7 Mandatory Checks)
create or replace function validate_payroll_lock(p_period_id uuid)
returns boolean language plpgsql stable as $$
declare
  v_start date;
  v_end date;
  v_pending_att_count integer;
  v_pending_leave_count integer;
  v_missing_statutory_count integer;
begin
  select start_date, end_date into v_start, v_end
  from payroll_periods where id = p_period_id;

  -- Check 1: Pending_review attendance anomalies (§5.7)
  select count(*) into v_pending_att_count
  from attendance_records
  where attendance_date between v_start and v_end
    and status = 'pending_review';

  if v_pending_att_count > 0 then
    raise exception 'Payroll finalization blocked: % unresolved pending_review attendance anomalies exist (§5.7)', v_pending_att_count;
  end if;

  -- Check 2: Unresolved pending leave requests in period (§5.7)
  select count(*) into v_pending_leave_count
  from leave_requests
  where status = 'pending'
    and start_date <= v_end and end_date >= v_start;

  if v_pending_leave_count > 0 then
    raise exception 'Payroll finalization blocked: % pending leave requests exist in period (§5.7)', v_pending_leave_count;
  end if;

  -- Check 3: Active employees missing statutory profile (§5.7)
  select count(*) into v_missing_statutory_count
  from employees e
  where e.status = 'active'
    and not exists (
      select 1 from statutory_profiles sp
      where sp.employee_id = e.id
        and sp.effective_from <= v_end
        and (sp.effective_to is null or sp.effective_to >= v_start)
    );

  if v_missing_statutory_count > 0 then
    raise exception 'Payroll finalization blocked: % active employees are missing statutory profiles (§5.7)', v_missing_statutory_count;
  end if;

  return true;
end;
$$;

-- 7. Reopen & Revision Supersede Workflow Function (§5.2)
create or replace function reopen_payroll_period(p_period_id uuid, p_actor_id uuid)
returns uuid language plpgsql as $$
declare
  v_latest_num integer;
  v_new_num integer;
  v_new_rev_id uuid;
begin
  -- Mark current active revision as superseded
  update payroll_revisions
  set status = 'superseded'
  where payroll_period_id = p_period_id and status != 'superseded';

  select coalesce(max(revision_number), 0) + 1 into v_new_num
  from payroll_revisions where payroll_period_id = p_period_id;

  -- Create new draft revision
  insert into payroll_revisions (payroll_period_id, revision_number, status, executed_by)
  values (p_period_id, v_new_num, 'draft', p_actor_id)
  returning id into v_new_rev_id;

  -- Reset period status to draft
  update payroll_periods set status = 'draft' where id = p_period_id;

  return v_new_rev_id;
end;
$$;

-- 6. Row Level Security
alter table payroll_periods enable row level security;
alter table payroll_revisions enable row level security;
alter table payslips enable row level security;
alter table payslip_components enable row level security;
alter table payroll_adjustments enable row level security;

create policy periods_read on payroll_periods for select using (true);
create policy periods_write on payroll_periods for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));

create policy revisions_read on payroll_revisions for select using (has_permission('payroll.view'));
create policy revisions_write on payroll_revisions for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));

create policy payslips_read on payslips for select
  using (employee_id = auth_employee_id() or has_permission('payroll.view'));
create policy payslips_write on payslips for all
  using (has_permission('payroll.finalize')) with check (has_permission('payroll.finalize'));

create policy payslip_components_read on payslip_components for select
  using (exists (select 1 from payslips p where p.id = payslip_id and (p.employee_id = auth_employee_id() or has_permission('payroll.view'))));

create policy adjustments_read on payroll_adjustments for select using (has_permission('payroll.view'));
create policy adjustments_write on payroll_adjustments for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));


-- END FILE: 09_payroll.sql

-- BEGIN FILE: 10_statutory.sql
-- ============================================================================
-- HRMS v2.7 — Module 10: Statutory Payroll Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/10_statutory.sql
-- Strictly aligned with FR §5.10 & ADR 0003
-- Versioned statutory rule definitions & reproducible revision snapshots
-- ============================================================================

-- 1. Enums
create type tax_regime as enum ('new_regime', 'old_regime');

-- 2. Versioned Statutory Rules Engine Container (§5.10)
create table statutory_rule_versions (
  id                  uuid primary key default gen_random_uuid(),
  rule_name           text not null, -- 'India_PF_ESI_PT_FY2025_26'
  effective_from      date not null,
  effective_to        date,
  pf_wage_ceiling     numeric(14,2) not null default 15000.00,
  pf_employee_pct     numeric(5,2) not null default 12.00,
  esi_gross_ceiling   numeric(14,2) not null default 21000.00,
  esi_employee_pct    numeric(5,2) not null default 0.75,
  rule_config         jsonb not null, -- Tax slab structures & state PT maps
  created_at          timestamptz not null default now(),
  exclude using gist (
    rule_name with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

-- 3. Statutory Profiles (Per-Employee Registrations)
create table statutory_profiles (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  pan_number      text,
  uan_number      text,
  pf_number       text,
  esi_number      text,
  pf_applicable   boolean not null default true,
  esi_applicable  boolean not null default true,
  pt_state        text default 'Karnataka',
  tax_regime      tax_regime not null default 'new_regime',
  effective_from  date not null,
  effective_to    date,
  created_at      timestamptz not null default now(),
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);

-- 4. Reproducible Statutory Calculation Snapshots (§5.10 Linked to Revision)
create table statutory_calculation_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  payslip_id            uuid not null references payslips(id) on delete cascade,
  statutory_rule_id     uuid references statutory_rule_versions(id),
  pf_wage               numeric(14,2) not null default 0.00,
  pf_employee_amount    numeric(14,2) not null default 0.00,
  pf_employer_amount    numeric(14,2) not null default 0.00,
  esi_wage              numeric(14,2) not null default 0.00,
  esi_employee_amount   numeric(14,2) not null default 0.00,
  esi_employer_amount   numeric(14,2) not null default 0.00,
  pt_amount             numeric(14,2) not null default 0.00,
  tds_amount            numeric(14,2) not null default 0.00,
  calculated_at         timestamptz not null default now()
);

-- 5. Row Level Security
alter table statutory_rule_versions enable row level security;
alter table statutory_profiles enable row level security;
alter table statutory_calculation_snapshots enable row level security;

create policy statutory_rules_read on statutory_rule_versions for select using (true);
create policy statutory_rules_write on statutory_rule_versions for all
  using (has_permission('statutory.edit')) with check (has_permission('statutory.edit'));

create policy statutory_profile_read on statutory_profiles for select
  using (employee_id = auth_employee_id() or has_permission('statutory.view'));
create policy statutory_profile_write on statutory_profiles for all
  using (has_permission('statutory.edit')) with check (has_permission('statutory.edit'));

create policy statutory_snapshots_read on statutory_calculation_snapshots for select
  using (exists (select 1 from payslips p where p.id = payslip_id and (p.employee_id = auth_employee_id() or has_permission('payroll.view'))));

-- Seed Initial FY 2025-26 Versioned Rule Metadata Container
insert into statutory_rule_versions (rule_name, effective_from, pf_wage_ceiling, pf_employee_pct, esi_gross_ceiling, esi_employee_pct, rule_config)
values (
  'India_Statutory_FY2025_26',
  '2025-04-01',
  15000.00,
  12.00,
  21000.00,
  0.75,
  '{"pt_slabs": {"Karnataka": [{"max": 24999, "tax": 0}, {"min": 25000, "tax": 200}]}}'::jsonb
) on conflict do nothing;


-- END FILE: 10_statutory.sql

-- BEGIN FILE: 11_reimbursements.sql
-- ============================================================================
-- HRMS v2.7 — Module 11: Expense Reimbursement Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/11_reimbursements.sql
-- Strictly aligned with FR §5.11 & ADR 0003
-- Supports category taxable boolean, split amounts, and approval routes.
-- ============================================================================

-- 1. Enums
create type duplicate_policy_mode as enum ('block', 'warn_and_allow', 'allow_always');
create type claim_status as enum ('draft', 'submitted', 'pending_manager', 'pending_hr', 'approved', 'rejected', 'paid');
create type approval_route_type as enum ('manager_only', 'manager_then_hr');

-- 2. Expense Categories Master (§5.11)
create table reimbursement_categories (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  description       text,
  max_limit_per_claim numeric(14,2),
  duplicate_policy  duplicate_policy_mode not null default 'warn_and_allow',
  approval_route    approval_route_type not null default 'manager_only',
  requires_receipt  boolean not null default true,
  is_taxable        boolean not null default false, -- FR §5.11 category taxability
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- 3. Reimbursement Claims (§5.11)
create table reimbursement_claims (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  category_id           uuid not null references reimbursement_categories(id),
  claim_date            date not null,
  vendor_name           text,
  requested_amount      numeric(14,2) not null,
  approved_amount       numeric(14,2),
  description           text not null,
  is_duplicate_warning  boolean not null default false,
  status                claim_status not null default 'submitted',
  approver_id           uuid references employees(id),
  decided_at            timestamptz,
  payroll_period_id     uuid references payroll_periods(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 4. Receipts & Attachments Link
create table reimbursement_receipts (
  id             uuid primary key default gen_random_uuid(),
  claim_id       uuid not null references reimbursement_claims(id) on delete cascade,
  file_url       text not null,
  file_name      text not null,
  uploaded_at    timestamptz not null default now()
);

-- 5. Duplicate Claim Policy Enforcement Trigger
create or replace function check_reimbursement_duplicate() returns trigger
language plpgsql as $$
declare
  v_policy duplicate_policy_mode;
  v_duplicate_exists boolean;
begin
  select duplicate_policy into v_policy
  from reimbursement_categories where id = new.category_id;

  if v_policy = 'allow_always' then
    return new;
  end if;

  select exists (
    select 1 from reimbursement_claims
    where employee_id = new.employee_id
      and category_id = new.category_id
      and requested_amount = new.requested_amount
      and claim_date = new.claim_date
      and id is distinct from new.id
      and status not in ('rejected')
  ) into v_duplicate_exists;

  if v_duplicate_exists then
    if v_policy = 'block' then
      raise exception 'Duplicate reimbursement claim detected: Matching amount and date already exists (§5.11)';
    elsif v_policy = 'warn_and_allow' then
      new.is_duplicate_warning := true;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_reimbursement_dup
  before insert or update on reimbursement_claims
  for each row execute function check_reimbursement_duplicate();

-- 5b. Two-Stage Approval Routing Enforcement Trigger (FR §11.3 / ADR 0003)
create or replace function check_reimbursement_approval_flow() returns trigger
language plpgsql as $$
declare
  v_route approval_route_type;
begin
  if new.status = 'approved' and (old is null or old.status not in ('approved', 'pending_hr')) then
    select approval_route into v_route
    from reimbursement_categories where id = new.category_id;

    if v_route = 'manager_then_hr' and (old is null or old.status in ('submitted', 'pending_manager')) then
      raise exception 'Two-stage approval required: Manager approval must precede HR approval (§11.3)';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_reimbursement_route
  before update on reimbursement_claims
  for each row execute function check_reimbursement_approval_flow();

-- 6. Row Level Security
alter table reimbursement_categories enable row level security;
alter table reimbursement_claims enable row level security;
alter table reimbursement_receipts enable row level security;

create policy categories_read on reimbursement_categories for select using (true);
create policy categories_write on reimbursement_categories for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy claims_read on reimbursement_claims for select
  using (employee_id = auth_employee_id() or has_permission('reimbursement.approve.hr') or has_permission('reimbursement.approve.manager') or is_current_manager_of(auth_employee_id(), employee_id));
create policy claims_insert on reimbursement_claims for insert
  with check (employee_id = auth_employee_id());
create policy claims_update on reimbursement_claims for update
  using (has_permission('reimbursement.approve.hr') or has_permission('reimbursement.approve.manager') or is_current_manager_of(auth_employee_id(), employee_id));

create policy receipts_read on reimbursement_receipts for select
  using (exists (select 1 from reimbursement_claims c where c.id = claim_id and (c.employee_id = auth_employee_id() or has_permission('reimbursement.approve.hr'))));
create policy receipts_insert on reimbursement_receipts for insert
  with check (exists (select 1 from reimbursement_claims c where c.id = claim_id and c.employee_id = auth_employee_id()));


-- END FILE: 11_reimbursements.sql

-- BEGIN FILE: 12_leave_financial.sql
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


-- END FILE: 12_leave_financial.sql

-- BEGIN FILE: 13_ff_settlement.sql
-- ============================================================================
-- HRMS v2.7 — Module 13: Full & Final (F&F) Settlement
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/13_ff_settlement.sql
-- Strictly aligned with FR §5.4 & ADR 0003
-- ============================================================================

create type ff_status as enum ('draft', 'pending_approval', 'approved', 'paid', 'reopened', 'cancelled', 'withdrawn');

-- 2. Master Full & Final Settlement Table (§5.4)
create table ff_settlement_records (
  id                       uuid primary key default gen_random_uuid(),
  separation_id            uuid not null unique references separation_records(id) on delete cascade,
  employee_id              uuid not null references employees(id) on delete cascade,
  last_working_day         date not null,
  leave_encashment_amount  numeric(14,2) not null default 0.00,
  other_earnings           numeric(14,2) not null default 0.00,
  asset_recovery_amount    numeric(14,2) not null default 0.00, -- Direct numeric entry per ADR 0003
  asset_recovery_note      text,
  tax_deduction_amount     numeric(14,2) not null default 0.00,
  other_deductions         numeric(14,2) not null default 0.00,
  net_settlement_amount    numeric(14,2) not null,
  status                   ff_status not null default 'draft',
  approved_by              uuid references employees(id),
  approved_at              timestamptz,
  disbursed_at             timestamptz,
  is_stale                 boolean not null default false, -- FR §5.4 stale-input invalidation
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- 3. Offboarding Clearances (§2.3 Integration)
create table ff_clearances (
  id                uuid primary key default gen_random_uuid(),
  ff_settlement_id  uuid not null references ff_settlement_records(id) on delete cascade,
  department_name   text not null, -- 'IT', 'Finance', 'Admin', 'HR'
  is_cleared        boolean not null default false,
  cleared_by        uuid references employees(id),
  comments          text,
  updated_at        timestamptz not null default now(),
  unique (ff_settlement_id, department_name)
);

-- 4. Stale-Input Invalidation Function (§5.4)
create or replace function invalidate_stale_ff_settlement() returns trigger
language plpgsql as $$
begin
  -- If leave encashment or LOP records change after draft F&F creation, mark F&F stale
  update ff_settlement_records
  set is_stale = true, updated_at = now()
  where employee_id = new.employee_id and status = 'draft';
  return new;
end;
$$;

create trigger trg_invalidate_ff_leave
  after insert or update on leave_ledger
  for each row execute function invalidate_stale_ff_settlement();

create trigger trg_invalidate_ff_attendance
  after insert or update on attendance_records
  for each row execute function invalidate_stale_ff_settlement();

-- 5. Row Level Security
alter table ff_settlement_records enable row level security;
alter table ff_clearances enable row level security;

create policy ff_read on ff_settlement_records for select
  using (employee_id = auth_employee_id() or has_permission('ff.view'));
create policy ff_write on ff_settlement_records for all
  using (has_permission('ff.approve')) with check (has_permission('ff.approve'));

create policy clearance_read on ff_clearances for select
  using (exists (select 1 from ff_settlement_records f where f.id = ff_settlement_id and (f.employee_id = auth_employee_id() or has_permission('ff.view'))));
create policy clearance_write on ff_clearances for all
  using (has_permission('offboarding.manage')) with check (has_permission('offboarding.manage'));


-- END FILE: 13_ff_settlement.sql

-- BEGIN FILE: 14_attachments.sql
-- ============================================================================
-- HRMS v2.7 — Module 14: Document Attachments & Malware Scanning
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/14_attachments.sql
-- Strictly aligned with FR §6 & ADR 0003
-- ============================================================================

-- 1. Scan Status Enum
create type scan_status_enum as enum ('pending', 'clean', 'flagged');

-- 2. Polymorphic Document Attachments Master Table (§6)
create table document_attachments (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null, -- 'employee_profile', 'leave_attachment', 'reimbursement_receipt', 'separation_doc'
  entity_id       uuid not null,
  file_name       text not null,
  file_size_bytes bigint not null,
  mime_type       text not null,
  storage_path    text not null,
  scan_status     scan_status_enum not null default 'pending',
  uploaded_by     uuid not null references employees(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. File Security & MIME Whitelist Validation Trigger (§6)
create or replace function validate_attachment_security() returns trigger
language plpgsql as $$
begin
  if new.file_size_bytes > 10485760 then
    raise exception 'File size exceeds maximum allowed limit of 10MB (§6)';
  end if;

  if new.mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'Unsupported or invalid file MIME type: % (§6)', new.mime_type;
  end if;

  return new;
end;
$$;

create trigger trg_validate_attachment
  before insert on document_attachments
  for each row execute function validate_attachment_security();

-- 4. Row Level Security
alter table document_attachments enable row level security;

create policy attachments_read on document_attachments for select
  using (uploaded_by = auth_employee_id() or has_permission('employee.view', uploaded_by) or has_permission('leave.view.team') or has_permission('leave.view.all'));
create policy attachments_insert on document_attachments for insert
  with check (uploaded_by = auth_employee_id());
create policy attachments_delete on document_attachments for delete
  using (uploaded_by = auth_employee_id() or has_permission('settings.manage'));


-- END FILE: 14_attachments.sql

-- BEGIN FILE: 15_audit.sql
-- ============================================================================
-- HRMS v2.7 — Module 15: Centralized Immutable Audit Trail
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/15_audit.sql
-- Strictly aligned with FR §8.1
-- ============================================================================

-- 1. Immutable Audit Trail Table (§8.1)
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null,
  entity_id      uuid not null,
  action         text not null, -- 'INSERT', 'UPDATE', 'DELETE'
  old_values     jsonb,
  new_values     jsonb,
  reason         text,
  correlation_id uuid,
  source         text default 'application',
  performed_by   uuid references employees(id),
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created_at on audit_logs(created_at desc);

-- 2. Generic Entity Audit Trigger Function
create or replace function log_entity_audit() returns trigger
language plpgsql as $$
declare
  v_actor_id uuid := auth_employee_id();
begin
  if (TG_OP = 'DELETE') then
    insert into audit_logs(entity_type, entity_id, action, old_values, performed_by)
    values (TG_TABLE_NAME, old.id, 'DELETE', to_jsonb(old), v_actor_id);
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into audit_logs(entity_type, entity_id, action, old_values, new_values, performed_by)
    values (TG_TABLE_NAME, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), v_actor_id);
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into audit_logs(entity_type, entity_id, action, new_values, performed_by)
    values (TG_TABLE_NAME, new.id, 'INSERT', to_jsonb(new), v_actor_id);
    return new;
  end if;
  return null;
end;
$$;

-- 3. Attach Audit Triggers to Sensitive Tables
create trigger trg_audit_employees
  after insert or update or delete on employees
  for each row execute function log_entity_audit();

create trigger trg_audit_salary
  after insert or update or delete on employee_salary_structures
  for each row execute function log_entity_audit();

create trigger trg_audit_payroll_revisions
  after insert or update or delete on payroll_revisions
  for each row execute function log_entity_audit();

-- 4. Row Level Security
alter table audit_logs enable row level security;

create policy audit_logs_read on audit_logs for select
  using (has_permission('audit.view'));


-- END FILE: 15_audit.sql

-- BEGIN FILE: 16_notifications.sql
-- ============================================================================
-- HRMS v2.7 — Module 16: Event-Driven Notifications Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/16_notifications.sql
-- Strictly aligned with FR §8.2
-- ============================================================================

-- 1. Enums
create type notification_channel as enum ('in_app', 'email');

-- 2. Inbox Notifications Table (§8.2)
create table inbox_notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references employees(id) on delete cascade,
  title         text not null,
  message       text not null,
  action_url    text,
  channel       notification_channel not null default 'in_app',
  is_read       boolean not null default false,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_notifications_recipient on inbox_notifications(recipient_id, is_read);

-- 3. Helper Function to Emit Notifications (§8.2 Event Matrix)
create or replace function create_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_action_url text default null
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into inbox_notifications (recipient_id, title, message, action_url)
  values (p_recipient_id, p_title, p_message, p_action_url)
  returning id into v_id;
  return v_id;
end;
$$;

-- 4. Row Level Security
alter table inbox_notifications enable row level security;

create policy notifications_read on inbox_notifications for select
  using (recipient_id = auth_employee_id());
create policy notifications_update on inbox_notifications for update
  using (recipient_id = auth_employee_id());


-- END FILE: 16_notifications.sql

-- BEGIN FILE: 17_scheduled_jobs.sql
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


-- END FILE: 17_scheduled_jobs.sql

-- BEGIN FILE: 18_search.sql
-- ============================================================================
-- HRMS v2.7 — Module 18: Global Search & Cursor Pagination
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/18_search.sql
-- Strictly aligned with FR §5.13
-- ============================================================================

-- Global Search RPC Function (§5.13)
create or replace function search_global(p_query text)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  action_url text
) language plpgsql stable as $$
declare
  v_cleaned text := replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_');
  v_q text := '%' || v_cleaned || '%';
  v_actor_id uuid := auth_employee_id();
begin
  if p_query is null or trim(p_query) = '' then
    return;
  end if;

  -- 1. Search Employees
  return query
  select
    'employee'::text as entity_type,
    e.id as entity_id,
    e.full_name as title,
    e.employee_code as subtitle,
    '/employees/' || e.id::text as action_url
  from employees e
  where (e.full_name ilike v_q or e.employee_code ilike v_q or e.email ilike v_q)
    and (e.id = v_actor_id or has_permission('employee.view', e.id))
  limit 10;

  -- 2. Search Departments
  return query
  select
    'department'::text as entity_type,
    d.id as entity_id,
    d.name as title,
    'Department'::text as subtitle,
    '/departments/' || d.id::text as action_url
  from departments d
  where d.name ilike v_q and d.active = true
  limit 5;

  -- 3. Search Payroll Periods
  return query
  select
    'payroll_period'::text as entity_type,
    pp.id as entity_id,
    (pp.year::text || '-' || lpad(pp.month::text, 2, '0')) as title,
    ('Payroll Period (' || pp.status::text || ')') as subtitle,
    '/payroll/periods/' || pp.id::text as action_url
  from payroll_periods pp
  where (pp.year::text || '-' || lpad(pp.month::text, 2, '0')) ilike v_q
    and has_permission('payroll.view')
  limit 5;
end;
$$;

-- Trigram Extension & Performance Indexes for Search
create extension if not exists pg_trgm;

create index if not exists idx_employees_name_trgm on employees using gin (full_name gin_trgm_ops);
create index if not exists idx_employees_code_trgm on employees using gin (employee_code gin_trgm_ops);
create index if not exists idx_employees_email_trgm on employees using gin (email gin_trgm_ops);
create index if not exists idx_departments_name_trgm on departments using gin (name gin_trgm_ops);


-- END FILE: 18_search.sql

-- BEGIN FILE: 19_reports.sql
-- ============================================================================
-- HRMS v2.7 — Module 19: Reports, Dashboards & Aggregated Views
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/19_reports.sql
-- Strictly aligned with FR §10
-- ============================================================================

-- 1. Monthly Attendance Summary View
create view v_monthly_attendance_summary as
select
  ar.employee_id,
  e.full_name,
  e.employee_code,
  to_char(ar.attendance_date, 'YYYY-MM') as month_year,
  count(case when ar.status = 'present' then 1 end) as present_count,
  count(case when ar.status = 'half_day' then 1 end) as half_day_count,
  count(case when ar.status = 'absent' then 1 end) as absent_count,
  count(case when ar.status = 'extra_work' then 1 end) as extra_work_count,
  count(case when ar.status = 'pending_review' then 1 end) as pending_review_count,
  sum(ar.total_work_minutes) / 60 as total_work_hours
from attendance_records ar
join employees e on e.id = ar.employee_id
group by ar.employee_id, e.full_name, e.employee_code, to_char(ar.attendance_date, 'YYYY-MM');

-- 2. Leave Utilization Aggregation View
create view v_leave_utilization_summary as
select
  la.employee_id,
  e.full_name,
  e.employee_code,
  lt.code as leave_type_code,
  lt.name as leave_type_name,
  la.year,
  la.allocated_days,
  la.used_days,
  la.pending_days,
  (la.allocated_days + la.carry_forward_days - la.used_days) as current_balance
from leave_allocations la
join employees e on e.id = la.employee_id
join leave_types lt on lt.id = la.leave_type_id;

-- 3. Payroll Register Summary View
create view v_payroll_register_summary as
select
  pr.revision_number,
  e.employee_code,
  e.full_name,
  p.payable_units,
  p.lop_units,
  p.gross_earnings,
  p.total_deductions,
  p.net_pay,
  p.is_published
from payslips p
join payroll_revisions pr on pr.id = p.payroll_revision_id
join employees e on e.id = p.employee_id;

-- 4. My Approvals Unified Dashboard View (§10 Complete Aggregation)
create view v_pending_approvals_dashboard as
select
  'leave_request'::text as request_type,
  lr.id as request_id,
  lr.employee_id,
  e.full_name as employee_name,
  case
    when lt.code in ('MATERNITY', 'PATERNITY') then 'Parental Leave'
    else lt.name
  end as item_name,
  lr.created_at,
  lr.status::text as status
from leave_requests lr
join employees e on e.id = lr.employee_id
join leave_types lt on lt.id = lr.leave_type_id
where lr.status = 'pending'

union all

select
  'attendance_correction'::text as request_type,
  ac.id as request_id,
  ac.employee_id,
  e.full_name as employee_name,
  'Attendance Correction'::text as item_name,
  ac.created_at,
  ac.status::text as status
from attendance_corrections ac
join employees e on e.id = ac.employee_id
where ac.status in ('submitted', 'pending_manager')

union all

select
  'reimbursement_claim'::text as request_type,
  rc.id as request_id,
  rc.employee_id,
  e.full_name as employee_name,
  cat.name as item_name,
  rc.created_at,
  rc.status::text as status
from reimbursement_claims rc
join employees e on e.id = rc.employee_id
join reimbursement_categories cat on cat.id = rc.category_id
where rc.status in ('submitted', 'pending_manager', 'pending_hr')

union all

select
  'leave_encashment'::text as request_type,
  er.id as request_id,
  er.employee_id,
  e.full_name as employee_name,
  'Leave Encashment'::text as item_name,
  er.created_at,
  er.status::text as status
from leave_encashment_requests er
join employees e on e.id = er.employee_id
where er.status = 'pending'

union all

select
  'ff_settlement'::text as request_type,
  ff.id as request_id,
  ff.employee_id,
  e.full_name as employee_name,
  'F&F Settlement'::text as item_name,
  ff.created_at,
  ff.status::text as status
from ff_settlement_records ff
join employees e on e.id = ff.employee_id
where ff.status = 'pending_approval'

union all

select
  'permission_request'::text as request_type,
  pr.id as request_id,
  pr.employee_id,
  e.full_name as employee_name,
  'Short Permission'::text as item_name,
  pr.created_at,
  pr.status::text as status
from permission_requests pr
join employees e on e.id = pr.employee_id
where pr.status = 'pending'

union all

select
  'comp_off_grant'::text as request_type,
  cog.id as request_id,
  cog.employee_id,
  e.full_name as employee_name,
  'Comp-Off Grant'::text as item_name,
  cog.created_at,
  cog.status::text as status
from comp_off_grants cog
join employees e on e.id = cog.employee_id
where cog.status = 'pending';


-- END FILE: 19_reports.sql

-- BEGIN FILE: 20_performance_optimizations.sql
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


-- END FILE: 20_performance_optimizations.sql

-- BEGIN FILE: 21_rbac_scope_fallback.sql
-- Migration: 21_rbac_scope_fallback.sql
-- Description: Adds scope hierarchy fallback (.all > .team > .self) and system_admin bypass to has_any_permission RPC
-- Security: Uses SECURITY DEFINER with fixed search_path = public to safely inspect RBAC mappings without recursive RLS checks

CREATE OR REPLACE FUNCTION has_any_permission(perm_codes text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_id uuid := auth_employee_id();
  req_code text;
BEGIN
  IF acting_id IS NULL THEN
    RETURN false;
  END IF;

  -- System Admin bypass
  IF EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN roles r ON r.id = er.role_id
    WHERE er.employee_id = acting_id AND r.code = 'system_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Fast path: exact match in held permissions
  IF EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE er.employee_id = acting_id AND p.code = ANY(perm_codes)
  ) THEN
    RETURN true;
  END IF;

  -- Scope fallback: check if any held permission satisfies the requested codes with scope hierarchy
  FOREACH req_code IN ARRAY perm_codes LOOP
    IF EXISTS (
      SELECT 1 FROM employee_roles er
      JOIN role_permissions rp ON rp.role_id = er.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE er.employee_id = acting_id
        AND (
          p.code = req_code
          OR p.code = req_code || '.all'
          OR p.code = req_code || '.team'
          OR p.code = req_code || '.self'
          OR (req_code LIKE '%.self' AND p.code = REPLACE(req_code, '.self', '.all'))
          OR (req_code LIKE '%.self' AND p.code = REPLACE(req_code, '.self', '.team'))
          OR (req_code LIKE '%.team' AND p.code = REPLACE(req_code, '.team', '.all'))
        )
    ) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;


-- END FILE: 21_rbac_scope_fallback.sql

-- BEGIN FILE: 22_comprehensive_performance_indexes.sql
-- ============================================================================
-- HRMS v2.7 — Module 22: Comprehensive Database Performance Indexes
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/22_comprehensive_performance_indexes.sql
-- ============================================================================

-- 1. Org & Employee Relationships
create index if not exists idx_employees_manager_id
  on employees (manager_id);

create index if not exists idx_employee_dept_assign_lookup
  on employee_department_assignment (department_id, effective_to);

create index if not exists idx_employee_dept_assign_emp
  on employee_department_assignment (employee_id, effective_to);

create index if not exists idx_employee_mgr_assign_lookup
  on employee_manager_assignment (manager_id, effective_to);

create index if not exists idx_employee_mgr_assign_emp
  on employee_manager_assignment (employee_id, effective_to);

create index if not exists idx_employee_desig_assign_emp
  on employee_designation_assignment (employee_id, effective_to);

-- 2. Calendar & Holidays
create index if not exists idx_employee_calendar_assign
  on employee_work_calendar_assignment (employee_id, effective_to);

create index if not exists idx_holidays_template_date
  on holidays (calendar_template_id, holiday_date);

create index if not exists idx_opt_holiday_emp
  on employee_optional_holiday_selections (employee_id, holiday_id);

-- 3. Attendance & Corrections
create index if not exists idx_attendance_punches_record_id
  on attendance_punches (attendance_record_id);

create index if not exists idx_attendance_corrections_emp_status
  on attendance_corrections (employee_id, status);

create index if not exists idx_attendance_corrections_status_created
  on attendance_corrections (status, created_at desc);

create index if not exists idx_attendance_corrections_approver
  on attendance_corrections (approver_id, status);

-- 4. Leave & Approvals Dashboard Union Optimization
create index if not exists idx_leave_allocations_emp_type
  on leave_allocations (employee_id, leave_type_id);

create index if not exists idx_leave_requests_approver_status
  on leave_requests (current_approver_id, status);

create index if not exists idx_leave_requests_status_created
  on leave_requests (status, created_at desc);

create index if not exists idx_leave_request_approvals_lookup
  on leave_request_approvals (leave_request_id, approver_id, status);

create index if not exists idx_comp_off_grants_emp_status
  on comp_off_grants (employee_id, status);

create index if not exists idx_comp_off_grants_status_created
  on comp_off_grants (status, created_at desc);

create index if not exists idx_permission_requests_emp_date
  on permission_requests (employee_id, permission_date);

create index if not exists idx_permission_requests_status_created
  on permission_requests (status, created_at desc);

-- 5. Salary, Statutory & Payroll
create index if not exists idx_salary_structures_emp_dates
  on employee_salary_structures (employee_id, effective_from, effective_to);

create index if not exists idx_salary_structure_items_struct_id
  on employee_salary_structure_items (salary_structure_id);

create index if not exists idx_payroll_eligibility_emp_dates
  on payroll_eligibility (employee_id, effective_from);

create index if not exists idx_statutory_profiles_emp
  on statutory_profiles (employee_id);

-- 6. Reimbursements, Encashment & Offboarding
create index if not exists idx_reimbursements_status_created
  on reimbursement_claims (status, created_at desc);

create index if not exists idx_reimbursements_emp_date
  on reimbursement_claims (employee_id, claim_date);

create index if not exists idx_encashment_status_created
  on leave_encashment_requests (status, created_at desc);

create index if not exists idx_encashment_emp_status
  on leave_encashment_requests (employee_id, status);

create index if not exists idx_separation_emp_status
  on separation_records (employee_id, status);

create index if not exists idx_ff_settlement_separation
  on ff_settlement_records (separation_id);

create index if not exists idx_ff_settlement_status_created
  on ff_settlement_records (status, created_at desc);

create index if not exists idx_ff_clearances_settlement
  on ff_clearances (ff_settlement_id);

-- 7. Attachments & Audit Logs
create index if not exists idx_attachments_entity
  on document_attachments (entity_type, entity_id);

create index if not exists idx_attachments_uploaded_by
  on document_attachments (uploaded_by);

create index if not exists idx_audit_logs_actor
  on audit_logs (performed_by, created_at desc);

create index if not exists idx_audit_logs_correlation
  on audit_logs (correlation_id);


-- END FILE: 22_comprehensive_performance_indexes.sql

-- BEGIN FILE: bootstrap/01_system_admin.sql
-- ============================================================================
-- HRMS v2.7 — System Bootstrap: Initial System Admin Break-Glass Script
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/bootstrap/01_system_admin.sql
-- Run once by database administrator (bypassing RLS) to seed initial System Admin
-- ============================================================================

-- 1. Create Initial System Admin Employee
insert into employees (
  employee_code,
  full_name,
  email,
  date_of_joining,
  status,
  must_change_password
) values (
  'ADM-001',
  'System Administrator',
  'admin@company.local',
  current_date,
  'active',
  true
) on conflict (employee_code) do nothing;

-- 2. Grant System Admin Role
insert into employee_roles (employee_id, role_id)
select e.id, r.id
from employees e, roles r
where e.employee_code = 'ADM-001' and r.code = 'system_admin'
on conflict (employee_id, role_id) do nothing;


-- END FILE: bootstrap/01_system_admin.sql

