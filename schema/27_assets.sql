-- ============================================================================
-- HRMS v2.8 — Module 27: Asset Management & Offboarding Hardware Clearance
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/27_assets.sql
-- Strictly aligned with FR §5.4 & Enterprise Compliance Standards
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id),
--               02_org.sql (employees table),
--               13_ff_settlement.sql (ff_clearances)
-- Provides:
--   1. asset_status enum ('available', 'allocated', 'maintenance', 'decommissioned', 'lost')
--   2. company_assets table (hardware & peripheral inventory master)
--   3. employee_asset_assignments table (assignment lifecycle and condition tracking)
--   4. pending_unreturned_assets_count() helper for separation clearance enforcement
--   5. Partial performance indexes & RLS policies
-- ============================================================================

-- 1. Asset Status Enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'asset_status') then
    create type asset_status as enum ('available', 'allocated', 'maintenance', 'decommissioned', 'lost');
  end if;
end $$;

-- 2. Company Assets Inventory Master
create table if not exists company_assets (
  id             uuid primary key default gen_random_uuid(),
  asset_tag      text not null unique,
  name           text not null,
  category       text not null default 'laptop', -- 'laptop' | 'monitor' | 'mobile' | 'access_card' | 'peripheral' | 'other'
  serial_number  text,
  model          text,
  status         asset_status not null default 'available',
  purchase_date  date,
  cost           numeric(12,2) not null default 0.00,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3. Employee Asset Assignments Lifecycle
create table if not exists employee_asset_assignments (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  asset_id        uuid not null references company_assets(id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  returned_at     timestamptz,
  condition_notes text,
  created_at      timestamptz not null default now()
);

-- 4. Helper: Count Unreturned Active Assets for Separation Clearance
create or replace function pending_unreturned_assets_count(p_employee_id uuid)
returns integer language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from employee_asset_assignments
  where employee_id = p_employee_id and returned_at is null;
$$;

-- 5. Row Level Security
alter table company_assets enable row level security;
alter table employee_asset_assignments enable row level security;

-- Read policies
create policy assets_read on company_assets for select
  using (has_permission('settings.manage') or has_permission('employee.view.all') or has_permission('offboarding.manage'));

create policy asset_assignments_read on employee_asset_assignments for select
  using (
    employee_id = auth_employee_id()
    or has_permission('settings.manage')
    or has_permission('employee.view.all')
    or has_permission('offboarding.manage')
  );

-- Write policies
create policy assets_write on company_assets for all
  using (has_permission('settings.manage') or has_permission('offboarding.manage'))
  with check (has_permission('settings.manage') or has_permission('offboarding.manage'));

create policy asset_assignments_write on employee_asset_assignments for all
  using (has_permission('settings.manage') or has_permission('offboarding.manage'))
  with check (has_permission('settings.manage') or has_permission('offboarding.manage'));

-- 6. Performance Indexes
create index if not exists idx_assets_status on company_assets (status);
create index if not exists idx_assets_tag on company_assets (asset_tag);
create index if not exists idx_asset_assignments_emp_active on employee_asset_assignments (employee_id) where returned_at is null;
create index if not exists idx_asset_assignments_asset on employee_asset_assignments (asset_id);
