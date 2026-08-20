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
