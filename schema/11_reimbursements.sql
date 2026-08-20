-- ============================================================================
-- HRMS v2.7 — Module 11: Expense Reimbursement Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/11_reimbursements.sql
-- Strictly aligned with FR §5.11 & ADR 0003
-- Supports category taxable boolean, split amounts, and approval routes.
-- ============================================================================

-- 1. Enums
create type duplicate_policy_mode as enum ('block', 'warn_and_allow', 'allow_always');
create type claim_status as enum ('draft', 'submitted', 'pending_manager', 'pending_hr', 'approved', 'rejected', 'paid');
create type approval_route_type as enum ('manager_only', 'manager_then_hr');

-- 2. Expense Categories Master (§5.11)
create table reimbursement_categories (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  description       text,
  max_limit_per_claim numeric(14,2),
  duplicate_policy  duplicate_policy_mode not null default 'warn_and_allow',
  approval_route    approval_route_type not null default 'manager_only',
  requires_receipt  boolean not null default true,
  is_taxable        boolean not null default false, -- FR §5.11 category taxability
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- 3. Reimbursement Claims (§5.11)
create table reimbursement_claims (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references employees(id) on delete cascade,
  category_id           uuid not null references reimbursement_categories(id),
  claim_date            date not null,
  vendor_name           text,
  requested_amount      numeric(14,2) not null,
  approved_amount       numeric(14,2),
  description           text not null,
  is_duplicate_warning  boolean not null default false,
  status                claim_status not null default 'submitted',
  approver_id           uuid references employees(id),
  decided_at            timestamptz,
  payroll_period_id     uuid references payroll_periods(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 4. Receipts & Attachments Link
create table reimbursement_receipts (
  id             uuid primary key default gen_random_uuid(),
  claim_id       uuid not null references reimbursement_claims(id) on delete cascade,
  file_url       text not null,
  file_name      text not null,
  uploaded_at    timestamptz not null default now()
);

-- 5. Duplicate Claim Policy Enforcement Trigger
create or replace function check_reimbursement_duplicate() returns trigger
language plpgsql as $$
declare
  v_policy duplicate_policy_mode;
  v_duplicate_exists boolean;
begin
  select duplicate_policy into v_policy
  from reimbursement_categories where id = new.category_id;

  if v_policy = 'allow_always' then
    return new;
  end if;

  select exists (
    select 1 from reimbursement_claims
    where employee_id = new.employee_id
      and category_id = new.category_id
      and requested_amount = new.requested_amount
      and claim_date = new.claim_date
      and id is distinct from new.id
      and status not in ('rejected')
  ) into v_duplicate_exists;

  if v_duplicate_exists then
    if v_policy = 'block' then
      raise exception 'Duplicate reimbursement claim detected: Matching amount and date already exists (§5.11)';
    elsif v_policy = 'warn_and_allow' then
      new.is_duplicate_warning := true;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_reimbursement_dup
  before insert or update on reimbursement_claims
  for each row execute function check_reimbursement_duplicate();

-- 5b. Two-Stage Approval Routing Enforcement Trigger (FR §11.3 / ADR 0003)
create or replace function check_reimbursement_approval_flow() returns trigger
language plpgsql as $$
declare
  v_route approval_route_type;
begin
  if new.status = 'approved' and (old is null or old.status not in ('approved', 'pending_hr')) then
    select approval_route into v_route
    from reimbursement_categories where id = new.category_id;

    if v_route = 'manager_then_hr' and (old is null or old.status in ('submitted', 'pending_manager')) then
      raise exception 'Two-stage approval required: Manager approval must precede HR approval (§11.3)';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_reimbursement_route
  before update on reimbursement_claims
  for each row execute function check_reimbursement_approval_flow();

-- 6. Row Level Security
alter table reimbursement_categories enable row level security;
alter table reimbursement_claims enable row level security;
alter table reimbursement_receipts enable row level security;

create policy categories_read on reimbursement_categories for select using (true);
create policy categories_write on reimbursement_categories for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy claims_read on reimbursement_claims for select
  using (employee_id = auth_employee_id() or has_permission('reimbursement.approve.hr') or has_permission('reimbursement.approve.manager') or is_current_manager_of(auth_employee_id(), employee_id));
create policy claims_insert on reimbursement_claims for insert
  with check (employee_id = auth_employee_id());
create policy claims_update on reimbursement_claims for update
  using (has_permission('reimbursement.approve.hr') or has_permission('reimbursement.approve.manager') or is_current_manager_of(auth_employee_id(), employee_id));

create policy receipts_read on reimbursement_receipts for select
  using (exists (select 1 from reimbursement_claims c where c.id = claim_id and (c.employee_id = auth_employee_id() or has_permission('reimbursement.approve.hr'))));
create policy receipts_insert on reimbursement_receipts for insert
  with check (exists (select 1 from reimbursement_claims c where c.id = claim_id and c.employee_id = auth_employee_id()));
