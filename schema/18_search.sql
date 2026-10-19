-- ============================================================================
-- HRMS v2.7 — Module 18: Global Search & Cursor Pagination
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/18_search.sql
-- Strictly aligned with FR §5.13
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id in search_global),
--               02_org.sql (employees, departments tables),
--               09_payroll.sql (payroll_periods for search)
-- DEPENDENTS: None (leaf module — search RPC reads from existing tables)
-- Provides: search_global() RPC function,
--           pg_trgm extension, trigram GIN indexes on employees/departments========

-- Global Search RPC Function (§5.13)
create or replace function search_global(p_query text)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  action_url text
) language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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

  -- 4. Search Reimbursements
  return query
  select
    'reimbursement'::text as entity_type,
    rc.id as entity_id,
    ('Claim: ' || coalesce(rc.vendor_name, cat.name, 'Expense')) as title,
    ('₹' || rc.requested_amount::text || ' (' || rc.status::text || ')') as subtitle,
    '/reimbursements'::text as action_url
  from reimbursement_claims rc
  left join reimbursement_categories cat on cat.id = rc.category_id
  where (coalesce(rc.vendor_name, '') ilike v_q or coalesce(cat.name, '') ilike v_q)
    and (rc.employee_id = v_actor_id or has_permission('reimbursement.approve.manager') or has_permission('reimbursement.approve.hr'))
  limit 5;

  -- 5. Search Separations
  return query
  select
    'separation'::text as entity_type,
    sr.id as entity_id,
    ('Separation: ' || e.full_name) as title,
    ('Status: ' || sr.status::text || ' (LWD: ' || coalesce(sr.last_working_day::text, 'TBD') || ')') as subtitle,
    '/offboarding'::text as action_url
  from separation_records sr
  join employees e on e.id = sr.employee_id
  where (e.full_name ilike v_q or coalesce(sr.reason, '') ilike v_q)
    and (sr.employee_id = v_actor_id or has_permission('offboarding.manage'))
  limit 5;
end;
$$;

-- Trigram Extension & Performance Indexes for Search
create extension if not exists pg_trgm;

create index if not exists idx_employees_name_trgm on employees using gin (full_name gin_trgm_ops);
create index if not exists idx_employees_code_trgm on employees using gin (employee_code gin_trgm_ops);
create index if not exists idx_employees_email_trgm on employees using gin (email gin_trgm_ops);
create index if not exists idx_departments_name_trgm on departments using gin (name gin_trgm_ops);
