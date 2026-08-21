-- ============================================================================
-- HRMS v2.7 — Module 09: Payroll Core Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/09_payroll.sql
-- Strictly aligned with FR §5.2, §5.3, §5.5–§5.9 & ADR 0003
-- Supports FR Revision/Supersede flow & §5.7 Blocking Checks
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id for RLS),
--               02_org.sql (employees table for FK references),
--               05_attendance.sql (attendance_records for §5.7 lock validation),
--               06_leave.sql (leave_requests for §5.7 pending leave check),
--               07_salary.sql (salary_components for payslip component breakdown),
--               08_payroll_eligibility.sql (payroll_eligibility_snapshots),
--               10_statutory.sql (statutory_profiles for §5.7 missing profile check)
--               Note: 10_statutory.sql also depends on payslips — applied after this file.
-- DEPENDENTS: 10_statutory.sql (statutory_calculation_snapshots FK → payslips),
--             11_reimbursements.sql (payroll_periods FK in claims),
--             12_leave_financial.sql (payroll_periods FK in encashment),
--             15_audit.sql (payroll_revisions for audit triggers),
--             18_search.sql (payroll_periods for global search),
--             19_reports.sql (v_payroll_register_summary view)
-- Provides: payroll_periods, payroll_revisions, payslips,
--           payslip_components, payroll_payment_items,
--           payroll_adjustments tables, validate_payroll_lock(),
--           reopen_payroll_period() functions========

-- 1. Enums
create type payroll_period_status as enum ('draft', 'processing', 'validated', 'finalized', 'published');
create type revision_status as enum ('draft', 'superseded', 'finalized');
create type adjustment_type as enum ('bonus', 'arrears', 'penalty', 'other_addition', 'other_deduction');

-- 2. Payroll Periods & Versioned Revisions (§5.2)
create table payroll_periods (
  id           uuid primary key default gen_random_uuid(),
  year         integer not null,
  month        integer not null,
  start_date   date not null,
  end_date     date not null,
  cutoff_date  date not null,
  status       payroll_period_status not null default 'draft',
  created_at   timestamptz not null default now(),
  unique (year, month)
);

create table payroll_revisions (
  id                 uuid primary key default gen_random_uuid(),
  payroll_period_id  uuid not null references payroll_periods(id) on delete cascade,
  revision_number    integer not null default 1,
  status             revision_status not null default 'draft',
  total_employees    integer not null default 0,
  total_gross        numeric(14,2) not null default 0.00,
  total_deductions   numeric(14,2) not null default 0.00,
  total_net          numeric(14,2) not null default 0.00,
  executed_by        uuid references employees(id),
  executed_at        timestamptz not null default now(),
  unique (payroll_period_id, revision_number)
);

-- 3. Individual Employee Payslip Snapshots per Revision (§5.2)
create table payslips (
  id                  uuid primary key default gen_random_uuid(),
  payroll_revision_id uuid not null references payroll_revisions(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  year                integer not null,
  month               integer not null,
  payable_units       numeric(5,2) not null,
  lop_units           numeric(5,2) not null default 0.00,
  gross_earnings      numeric(14,2) not null,
  total_deductions    numeric(14,2) not null,
  net_pay             numeric(14,2) not null,
  is_published        boolean not null default false,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (payroll_revision_id, employee_id)
);

create table payslip_components (
  id                  uuid primary key default gen_random_uuid(),
  payslip_id          uuid not null references payslips(id) on delete cascade,
  salary_component_id uuid not null references salary_components(id),
  component_code      text not null,
  component_name      text not null,
  component_type      component_type not null,
  amount              numeric(14,2) not null
);

-- 4. Payment Items Breakdown Table (§5.2)
create table payroll_payment_items (
  id                  uuid primary key default gen_random_uuid(),
  payslip_id          uuid not null references payslips(id) on delete cascade,
  item_category       text not null, -- 'salary' | 'reimbursement_non_taxable' | 'reimbursement_taxable' | 'encashment' | 'adjustment'
  description         text not null,
  amount              numeric(14,2) not null,
  is_taxable          boolean not null default true,
  created_at          timestamptz not null default now()
);

-- 5. Payroll Adjustments (§5.2 Additions / Deductions)
create table payroll_adjustments (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references employees(id) on delete cascade,
  payroll_period_id  uuid not null references payroll_periods(id),
  adjustment_type    adjustment_type not null,
  amount             numeric(14,2) not null,
  reason             text not null,
  approved_by        uuid references employees(id),
  created_at         timestamptz not null default now()
);

-- 5. Strict Payroll Lock Verification Function (§5.7 Mandatory Checks)
create or replace function validate_payroll_lock(p_period_id uuid)
returns boolean language plpgsql stable as $$
declare
  v_start date;
  v_end date;
  v_pending_att_count integer;
  v_pending_leave_count integer;
  v_missing_statutory_count integer;
begin
  select start_date, end_date into v_start, v_end
  from payroll_periods where id = p_period_id;

  -- Check 1: Pending_review attendance anomalies (§5.7)
  select count(*) into v_pending_att_count
  from attendance_records
  where attendance_date between v_start and v_end
    and status = 'pending_review';

  if v_pending_att_count > 0 then
    raise exception 'Payroll finalization blocked: % unresolved pending_review attendance anomalies exist (§5.7)', v_pending_att_count;
  end if;

  -- Check 2: Unresolved pending leave requests in period (§5.7)
  select count(*) into v_pending_leave_count
  from leave_requests
  where status = 'pending'
    and start_date <= v_end and end_date >= v_start;

  if v_pending_leave_count > 0 then
    raise exception 'Payroll finalization blocked: % pending leave requests exist in period (§5.7)', v_pending_leave_count;
  end if;

  -- Check 3: Active employees missing statutory profile (§5.7)
  select count(*) into v_missing_statutory_count
  from employees e
  where e.status = 'active'
    and not exists (
      select 1 from statutory_profiles sp
      where sp.employee_id = e.id
        and sp.effective_from <= v_end
        and (sp.effective_to is null or sp.effective_to >= v_start)
    );

  if v_missing_statutory_count > 0 then
    raise exception 'Payroll finalization blocked: % active employees are missing statutory profiles (§5.7)', v_missing_statutory_count;
  end if;

  return true;
end;
$$;

-- 7. Reopen & Revision Supersede Workflow Function (§5.2)
create or replace function reopen_payroll_period(p_period_id uuid, p_actor_id uuid)
returns uuid language plpgsql as $$
declare
  v_latest_num integer;
  v_new_num integer;
  v_new_rev_id uuid;
begin
  -- Mark current active revision as superseded
  update payroll_revisions
  set status = 'superseded'
  where payroll_period_id = p_period_id and status != 'superseded';

  select coalesce(max(revision_number), 0) + 1 into v_new_num
  from payroll_revisions where payroll_period_id = p_period_id;

  -- Create new draft revision
  insert into payroll_revisions (payroll_period_id, revision_number, status, executed_by)
  values (p_period_id, v_new_num, 'draft', p_actor_id)
  returning id into v_new_rev_id;

  -- Reset period status to draft
  update payroll_periods set status = 'draft' where id = p_period_id;

  return v_new_rev_id;
end;
$$;

-- 6. Row Level Security
alter table payroll_periods enable row level security;
alter table payroll_revisions enable row level security;
alter table payslips enable row level security;
alter table payslip_components enable row level security;
alter table payroll_adjustments enable row level security;

create policy periods_read on payroll_periods for select using (true);
create policy periods_write on payroll_periods for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));

create policy revisions_read on payroll_revisions for select using (has_permission('payroll.view'));
create policy revisions_write on payroll_revisions for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));

create policy payslips_read on payslips for select
  using (employee_id = auth_employee_id() or has_permission('payroll.view'));
create policy payslips_write on payslips for all
  using (has_permission('payroll.finalize')) with check (has_permission('payroll.finalize'));

create policy payslip_components_read on payslip_components for select
  using (exists (select 1 from payslips p where p.id = payslip_id and (p.employee_id = auth_employee_id() or has_permission('payroll.view'))));

create policy adjustments_read on payroll_adjustments for select using (has_permission('payroll.view'));
create policy adjustments_write on payroll_adjustments for all
  using (has_permission('payroll.run')) with check (has_permission('payroll.run'));
