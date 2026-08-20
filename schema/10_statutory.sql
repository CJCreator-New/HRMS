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
