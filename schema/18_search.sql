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
  v_q text := '%' || trim(p_query) || '%';
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
