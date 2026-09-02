-- ============================================================================
-- HRMS v2.7 — Module 00_auth_helpers: Authentication & Identity Helpers
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/00_auth_helpers.sql
-- Strictly breaks circular dependency between 01_rbac and 02_org (P0-2)
-- ============================================================================
--
-- DEPENDENCY GRAPH:
--   00_setup.sql -> 00_auth_helpers.sql -> 01_rbac.sql -> 02_org.sql -> subsequent modules
--
-- DEPENDENCIES: 00_setup.sql
-- DEPENDENTS: 01_rbac.sql, 02_org.sql, and all subsequent modules
-- Provides: auth_employee_id() base helper (safe against unmigrated schema)
-- ============================================================================

-- Minimal, non-circular helper: Resolves employee ID from auth.uid().
-- If the employees table does not yet exist or is being created, gracefully
-- returns auth.uid() without failing with relation missing errors.
create or replace function auth_employee_id() returns uuid
language plpgsql stable as $$
declare
  v_emp_id uuid;
begin
  -- If employees table exists, query it; otherwise safely return auth.uid()
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employees'
  ) then
    select id into v_emp_id from employees where auth_user_id = auth.uid() limit 1;
    if v_emp_id is not null then
      return v_emp_id;
    end if;
  end if;

  return auth.uid();
end;
$$;
