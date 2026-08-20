-- ============================================================================
-- HRMS v2.7 — Module 13: Full & Final (F&F) Settlement
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/13_ff_settlement.sql
-- Strictly aligned with FR §5.4 & ADR 0003
-- ============================================================================

create type ff_status as enum ('draft', 'pending_approval', 'approved', 'paid', 'reopened', 'cancelled', 'withdrawn');

-- 2. Master Full & Final Settlement Table (§5.4)
create table ff_settlement_records (
  id                       uuid primary key default gen_random_uuid(),
  separation_id            uuid not null unique references separation_records(id) on delete cascade,
  employee_id              uuid not null references employees(id) on delete cascade,
  last_working_day         date not null,
  leave_encashment_amount  numeric(14,2) not null default 0.00,
  other_earnings           numeric(14,2) not null default 0.00,
  asset_recovery_amount    numeric(14,2) not null default 0.00, -- Direct numeric entry per ADR 0003
  asset_recovery_note      text,
  tax_deduction_amount     numeric(14,2) not null default 0.00,
  other_deductions         numeric(14,2) not null default 0.00,
  net_settlement_amount    numeric(14,2) not null,
  status                   ff_status not null default 'draft',
  approved_by              uuid references employees(id),
  approved_at              timestamptz,
  disbursed_at             timestamptz,
  is_stale                 boolean not null default false, -- FR §5.4 stale-input invalidation
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- 3. Offboarding Clearances (§2.3 Integration)
create table ff_clearances (
  id                uuid primary key default gen_random_uuid(),
  ff_settlement_id  uuid not null references ff_settlement_records(id) on delete cascade,
  department_name   text not null, -- 'IT', 'Finance', 'Admin', 'HR'
  is_cleared        boolean not null default false,
  cleared_by        uuid references employees(id),
  comments          text,
  updated_at        timestamptz not null default now(),
  unique (ff_settlement_id, department_name)
);

-- 4. Stale-Input Invalidation Function (§5.4)
create or replace function invalidate_stale_ff_settlement() returns trigger
language plpgsql as $$
begin
  -- If leave encashment or LOP records change after draft F&F creation, mark F&F stale
  update ff_settlement_records
  set is_stale = true, updated_at = now()
  where employee_id = new.employee_id and status = 'draft';
  return new;
end;
$$;

create trigger trg_invalidate_ff_leave
  after insert or update on leave_ledger
  for each row execute function invalidate_stale_ff_settlement();

create trigger trg_invalidate_ff_attendance
  after insert or update on attendance_records
  for each row execute function invalidate_stale_ff_settlement();

-- 5. Row Level Security
alter table ff_settlement_records enable row level security;
alter table ff_clearances enable row level security;

create policy ff_read on ff_settlement_records for select
  using (employee_id = auth_employee_id() or has_permission('ff.view'));
create policy ff_write on ff_settlement_records for all
  using (has_permission('ff.approve')) with check (has_permission('ff.approve'));

create policy clearance_read on ff_clearances for select
  using (exists (select 1 from ff_settlement_records f where f.id = ff_settlement_id and (f.employee_id = auth_employee_id() or has_permission('ff.view'))));
create policy clearance_write on ff_clearances for all
  using (has_permission('offboarding.manage')) with check (has_permission('offboarding.manage'));
