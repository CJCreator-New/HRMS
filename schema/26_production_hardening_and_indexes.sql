-- ============================================================================
-- HRMS v2.7 — Module 26: Production Hardening, Storage RLS & Realtime CDC
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/26_production_hardening_and_indexes.sql
-- Strictly aligned with Production DevOps & Performance Standards
-- ============================================================================
--
-- DEPENDENCIES: ALL preceding modules (00–25).
-- Provides:
--   1. Realtime Publication for inbox_notifications (CDC)
--   2. Storage RLS policies for attachments bucket
--   3. Partial indexes for pending workflows (leave, attendance, claims)
--   4. Composite indexes for high-write audit logs (deduplicated)
--   5. Active assignment lookup partial indexes
--   6. Elimination of multiple permissive policies flagged by DB advisors
-- ============================================================================

-- 1. Real-Time Change Data Capture (CDC) Publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_notifications'
  ) then
    alter publication supabase_realtime add table public.inbox_notifications;
  end if;
end $$;

alter table public.inbox_notifications replica identity full;

-- 2. Partial Performance Indexes for Pending Workflows
create index if not exists idx_leave_requests_pending_approver
  on public.leave_requests (current_approver_id, created_at desc)
  where status = 'pending';

create index if not exists idx_attendance_corrections_pending_approver
  on public.attendance_corrections (approver_id, created_at desc)
  where status in ('submitted', 'pending_manager');

create index if not exists idx_reimbursements_pending_approver
  on public.reimbursement_claims (approver_id, created_at desc)
  where status in ('submitted', 'pending_manager', 'pending_hr');

-- 3. Composite Indexes for High-Write Audit Logs
-- Ensure no duplicate index with idx_audit_logs_actor from module 22
drop index if exists idx_audit_logs_actor_created;
create index if not exists idx_audit_logs_entity_created
  on public.audit_logs (entity_type, created_at desc);

-- 4. Active Assignment Filter Indexes (where effective_to is null)
create index if not exists idx_dept_assignment_active_emp
  on public.employee_department_assignment (employee_id, department_id)
  where effective_to is null;

create index if not exists idx_mgr_assignment_active_emp
  on public.employee_manager_assignment (employee_id, manager_id)
  where effective_to is null;

create index if not exists idx_calendar_assignment_active_emp
  on public.employee_work_calendar_assignment (employee_id, calendar_template_id)
  where effective_to is null;

-- 5. Storage RLS Policies for `attachments` Bucket
drop policy if exists "storage_attachments_read" on storage.objects;
create policy "storage_attachments_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.employee_roles er
      join public.role_permissions rp on er.role_id = rp.role_id
      join public.permissions p on rp.permission_id = p.id
      join public.employees e on e.id = er.employee_id
      where e.auth_user_id = auth.uid()
        and p.code in ('employee.view.all', 'leave.view.all', 'settings.manage')
    )
  )
);

drop policy if exists "storage_attachments_insert" on storage.objects;
create policy "storage_attachments_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_attachments_delete" on storage.objects;
create policy "storage_attachments_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.employee_roles er
      join public.role_permissions rp on er.role_id = rp.role_id
      join public.permissions p on rp.permission_id = p.id
      join public.employees e on e.id = er.employee_id
      where e.auth_user_id = auth.uid()
        and p.code = 'settings.manage'
    )
  )
);

-- 6. Resolve Multiple Permissive Policies (Advisor Lint)
-- Drop overlapping "for all" write policies and replace with write-specific action policies

-- Roles Master
drop policy if exists roles_admin_write on public.roles;
drop policy if exists roles_admin_insert on public.roles;
drop policy if exists roles_admin_update on public.roles;
drop policy if exists roles_admin_delete on public.roles;

create policy roles_admin_insert on public.roles
  for insert with check (has_permission('settings.manage'));
create policy roles_admin_update on public.roles
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy roles_admin_delete on public.roles
  for delete using (has_permission('settings.manage'));

-- Permissions Master
drop policy if exists permissions_admin_write on public.permissions;
drop policy if exists permissions_admin_insert on public.permissions;
drop policy if exists permissions_admin_update on public.permissions;
drop policy if exists permissions_admin_delete on public.permissions;

create policy permissions_admin_insert on public.permissions
  for insert with check (has_permission('settings.manage'));
create policy permissions_admin_update on public.permissions
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy permissions_admin_delete on public.permissions
  for delete using (has_permission('settings.manage'));

-- Role Permissions Junction
drop policy if exists role_permissions_admin_write on public.role_permissions;
drop policy if exists role_permissions_admin_insert on public.role_permissions;
drop policy if exists role_permissions_admin_update on public.role_permissions;
drop policy if exists role_permissions_admin_delete on public.role_permissions;

create policy role_permissions_admin_insert on public.role_permissions
  for insert with check (has_permission('settings.manage'));
create policy role_permissions_admin_update on public.role_permissions
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy role_permissions_admin_delete on public.role_permissions
  for delete using (has_permission('settings.manage'));

-- Statutory Rules
drop policy if exists statutory_rules_write on public.statutory_rule_versions;
drop policy if exists statutory_rules_insert on public.statutory_rule_versions;
drop policy if exists statutory_rules_update on public.statutory_rule_versions;
drop policy if exists statutory_rules_delete on public.statutory_rule_versions;

create policy statutory_rules_insert on public.statutory_rule_versions
  for insert with check (has_permission('statutory.edit'));
create policy statutory_rules_update on public.statutory_rule_versions
  for update using (has_permission('statutory.edit')) with check (has_permission('statutory.edit'));
create policy statutory_rules_delete on public.statutory_rule_versions
  for delete using (has_permission('statutory.edit'));

-- Statutory Profiles
drop policy if exists statutory_profile_write on public.statutory_profiles;
drop policy if exists statutory_profile_insert on public.statutory_profiles;
drop policy if exists statutory_profile_update on public.statutory_profiles;
drop policy if exists statutory_profile_delete on public.statutory_profiles;

create policy statutory_profile_insert on public.statutory_profiles
  for insert with check (has_permission('statutory.edit'));
create policy statutory_profile_update on public.statutory_profiles
  for update using (has_permission('statutory.edit')) with check (has_permission('statutory.edit'));
create policy statutory_profile_delete on public.statutory_profiles
  for delete using (has_permission('statutory.edit'));

-- Work Calendar Templates
drop policy if exists templates_write on public.work_calendar_templates;
drop policy if exists templates_insert on public.work_calendar_templates;
drop policy if exists templates_update on public.work_calendar_templates;
drop policy if exists templates_delete on public.work_calendar_templates;

create policy templates_insert on public.work_calendar_templates
  for insert with check (has_permission('settings.manage'));
create policy templates_update on public.work_calendar_templates
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy templates_delete on public.work_calendar_templates
  for delete using (has_permission('settings.manage'));

-- Holidays
drop policy if exists holidays_write on public.holidays;
drop policy if exists holidays_insert on public.holidays;
drop policy if exists holidays_update on public.holidays;
drop policy if exists holidays_delete on public.holidays;

create policy holidays_insert on public.holidays
  for insert with check (has_permission('settings.manage'));
create policy holidays_update on public.holidays
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy holidays_delete on public.holidays
  for delete using (has_permission('settings.manage'));

-- Salary Components
drop policy if exists components_write on public.salary_components;
drop policy if exists components_insert on public.salary_components;
drop policy if exists components_update on public.salary_components;
drop policy if exists components_delete on public.salary_components;

create policy components_insert on public.salary_components
  for insert with check (has_permission('salary.edit'));
create policy components_update on public.salary_components
  for update using (has_permission('salary.edit')) with check (has_permission('salary.edit'));
create policy components_delete on public.salary_components
  for delete using (has_permission('salary.edit'));

-- 7. Add Profile Details and Account Lockout Columns (P1-6 & P2-1)
alter table public.employees
  add column if not exists personal_address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

