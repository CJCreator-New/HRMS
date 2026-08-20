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
