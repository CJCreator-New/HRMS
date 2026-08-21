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
