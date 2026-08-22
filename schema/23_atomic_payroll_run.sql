-- ============================================================================
-- HRMS v2.7 — Module 23: Atomic Payroll Run Stored Procedure
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/23_atomic_payroll_run.sql
-- Strictly aligned with FR §5.2, §5.3, §5.7 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 09_payroll.sql (payroll_periods, payroll_revisions, payslips)
-- Provides: execute_atomic_payroll_run() function========

create or replace function execute_atomic_payroll_run(
  p_period_id uuid,
  p_revision_id uuid,
  p_payslips jsonb[]
) returns table (
  success boolean,
  processed_count integer,
  error_message text
) language plpgsql security definer as $$
declare
  v_processed integer := 0;
  v_item jsonb;
  v_period_status payroll_period_status;
  v_rev_status revision_status;
  v_emp_id uuid;
begin
  -- 1. Acquire row-level lock on period to prevent concurrent processing
  select status into v_period_status
  from payroll_periods
  where id = p_period_id
  for update;

  if not found then
    return query select false, 0, 'Payroll period not found';
    return;
  end if;

  if v_period_status in ('finalized', 'published') then
    return query select false, 0, 'Cannot execute payroll on finalized or published period';
    return;
  end if;

  -- 2. Verify revision row lock
  select status into v_rev_status
  from payroll_revisions
  where id = p_revision_id and payroll_period_id = p_period_id
  for update;

  if not found then
    return query select false, 0, 'Payroll revision not found for this period';
    return;
  end if;

  -- 3. Upsert each payslip inside the atomic transaction
  if p_payslips is not null and array_length(p_payslips, 1) > 0 then
    foreach v_item in array p_payslips loop
      v_emp_id := (v_item->>'employee_id')::uuid;

      if v_emp_id is null then
        raise exception 'Employee ID is missing in payslip payload';
      end if;

      insert into payslips (
        payroll_revision_id, employee_id, year, month,
        payable_units, lop_units, gross_earnings, total_deductions, net_pay, is_published
      ) values (
        p_revision_id,
        v_emp_id,
        (v_item->>'year')::integer,
        (v_item->>'month')::integer,
        coalesce((v_item->>'payable_units')::numeric, 0),
        coalesce((v_item->>'lop_units')::numeric, 0),
        coalesce((v_item->>'gross_earnings')::numeric, 0),
        coalesce((v_item->>'total_deductions')::numeric, 0),
        coalesce((v_item->>'net_pay')::numeric, 0),
        false
      ) on conflict (payroll_revision_id, employee_id) do update set
        payable_units = excluded.payable_units,
        lop_units = excluded.lop_units,
        gross_earnings = excluded.gross_earnings,
        total_deductions = excluded.total_deductions,
        net_pay = excluded.net_pay;

      v_processed := v_processed + 1;
    end loop;
  end if;

  -- 4. Update revision aggregate totals from individual payslips
  update payroll_revisions set
    total_employees = v_processed,
    total_gross = coalesce((select sum(gross_earnings) from payslips where payroll_revision_id = p_revision_id), 0),
    total_deductions = coalesce((select sum(total_deductions) from payslips where payroll_revision_id = p_revision_id), 0),
    total_net = coalesce((select sum(net_pay) from payslips where payroll_revision_id = p_revision_id), 0),
    executed_at = now()
  where id = p_revision_id;

  -- 5. Transition period status to 'validated'
  update payroll_periods
  set status = 'validated'
  where id = p_period_id;

  return query select true, v_processed, null::text;
exception when others then
  return query select false, 0, sqlerrm::text;
end;
$$;
