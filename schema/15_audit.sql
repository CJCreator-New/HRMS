-- ============================================================================
-- HRMS v2.7 — Module 15: Centralized Immutable Audit Trail
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/15_audit.sql
-- Strictly aligned with FR §8.1
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id for RLS & trigger),
--               02_org.sql (employees table — audit trigger),
--               07_salary.sql (employee_salary_structures — audit trigger),
--               09_payroll.sql (payroll_revisions — audit trigger)
-- DEPENDENTS: None (leaf module — triggers fire on existing tables)
-- Provides: audit_logs table, log_entity_audit() generic trigger function,
--           trg_audit_employees, trg_audit_salary, trg_audit_payroll_revisions triggers========

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

-- 5. User Active Sessions Tracking (§8.1, P2-8)
create table if not exists user_sessions (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  session_token   text not null,
  ip_address      text,
  user_agent      text,
  device_type     text default 'desktop',
  is_active       boolean not null default true,
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_user_sessions_emp on user_sessions(employee_id, is_active);

alter table user_sessions enable row level security;

create policy sessions_read on user_sessions for select
  using (employee_id = auth_employee_id() or has_permission('settings.manage'));

create policy sessions_write on user_sessions for all
  using (employee_id = auth_employee_id() or has_permission('settings.manage'))
  with check (employee_id = auth_employee_id() or has_permission('settings.manage'));

-- 6. Audit Log Archival Stored Procedure (P3-6)
create or replace function archive_old_audit_logs(p_retention_days integer default 365)
returns table (archived_count bigint) language plpgsql security definer as $$
declare
  v_count bigint;
begin
  with deleted as (
    delete from audit_logs
    where created_at < (now() - (p_retention_days || ' days')::interval)
    returning 1
  )
  select count(*) into v_count from deleted;

  return query select v_count;
end;
$$;

