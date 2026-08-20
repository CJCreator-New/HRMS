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
