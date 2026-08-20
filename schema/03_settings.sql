-- ============================================================================
-- HRMS v2.7 — Module 03: System Settings & Policy Configuration
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/03_settings.sql
-- Strictly aligned with FR §1.4, §3.7, §5.3, §9 & ADR 0003
-- ============================================================================

-- 1. Core Company Settings Table
create table company_settings (
  id                        uuid primary key default gen_random_uuid(),
  company_name              text not null default 'My Company',
  timezone                  text not null default 'Asia/Kolkata',
  currency                  text not null default 'INR',
  currency_symbol           text not null default '₹',
  rounding_mode             text not null default 'half_up', -- 'half_up' | 'truncate' | 'round'
  invitation_expiry_days    integer default 7,
  notice_period_days_default integer,
  manager_sla_days          integer default 2, -- FR §4.2 window in days
  alternate_hr_approver_id  uuid references employees(id), -- FR §1.4 singular HR alternate
  is_configured             boolean not null default false, -- Engine unlock gate flag
  updated_by                uuid references employees(id),
  updated_at                timestamptz not null default now()
);

-- 2. Flexible Policy Configurations (JSONB structured settings)
create table policy_configurations (
  id             uuid primary key default gen_random_uuid(),
  category       text not null, -- 'leave' | 'attendance' | 'payroll' | 'reimbursement'
  key            text not null unique,
  value          jsonb not null,
  description    text,
  updated_by     uuid references employees(id),
  updated_at     timestamptz not null default now()
);

-- 3. Engine Unlock Gate Helper Function
create or replace function is_system_configured() returns boolean
language sql stable as $$
  select coalesce((select is_configured from company_settings limit 1), false);
$$;

-- 4. Row Level Security
alter table company_settings enable row level security;
alter table policy_configurations enable row level security;

create policy company_settings_read on company_settings for select using (true);
create policy company_settings_write on company_settings for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy policy_config_read on policy_configurations for select using (true);
create policy policy_config_write on policy_configurations for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

-- Seed single container row in company_settings
insert into company_settings (company_name, timezone, currency, currency_symbol, rounding_mode, is_configured)
select 'My Organization', 'Asia/Kolkata', 'INR', '₹', 'half_up', false
where not exists (select 1 from company_settings);

-- Seed default policy configurations (§4.1 leave defaults)
insert into policy_configurations (category, key, value, description) values
  ('leave', 'default_cl_quota', '{"days": 12}'::jsonb, 'Default annual Casual Leave quota'),
  ('leave', 'default_sl_quota', '{"days": 12}'::jsonb, 'Default annual Sick Leave quota'),
  ('leave', 'default_el_quota', '{"days": 15}'::jsonb, 'Default annual Earned Leave quota')
on conflict (key) do nothing;
