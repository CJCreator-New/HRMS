-- ============================================================================
-- HRMS v2.7 — Module 19: Reports, Dashboards & Aggregated Views
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/19_reports.sql
-- Strictly aligned with FR §10
-- ============================================================================

-- 1. Monthly Attendance Summary View
create view v_monthly_attendance_summary as
select
  ar.employee_id,
  e.full_name,
  e.employee_code,
  to_char(ar.attendance_date, 'YYYY-MM') as month_year,
  count(case when ar.status = 'present' then 1 end) as present_count,
  count(case when ar.status = 'half_day' then 1 end) as half_day_count,
  count(case when ar.status = 'absent' then 1 end) as absent_count,
  count(case when ar.status = 'extra_work' then 1 end) as extra_work_count,
  count(case when ar.status = 'pending_review' then 1 end) as pending_review_count,
  sum(ar.total_work_minutes) / 60 as total_work_hours
from attendance_records ar
join employees e on e.id = ar.employee_id
group by ar.employee_id, e.full_name, e.employee_code, to_char(ar.attendance_date, 'YYYY-MM');

-- 2. Leave Utilization Aggregation View
create view v_leave_utilization_summary as
select
  la.employee_id,
  e.full_name,
  e.employee_code,
  lt.code as leave_type_code,
  lt.name as leave_type_name,
  la.year,
  la.allocated_days,
  la.used_days,
  la.pending_days,
  (la.allocated_days + la.carry_forward_days - la.used_days) as current_balance
from leave_allocations la
join employees e on e.id = la.employee_id
join leave_types lt on lt.id = la.leave_type_id;

-- 3. Payroll Register Summary View
create view v_payroll_register_summary as
select
  pr.revision_number,
  e.employee_code,
  e.full_name,
  p.payable_units,
  p.lop_units,
  p.gross_earnings,
  p.total_deductions,
  p.net_pay,
  p.is_published
from payslips p
join payroll_revisions pr on pr.id = p.payroll_revision_id
join employees e on e.id = p.employee_id;

-- 4. My Approvals Unified Dashboard View (§10 Complete Aggregation)
create view v_pending_approvals_dashboard as
select
  'leave_request'::text as request_type,
  lr.id as request_id,
  lr.employee_id,
  e.full_name as employee_name,
  case
    when lt.code in ('MATERNITY', 'PATERNITY') then 'Parental Leave'
    else lt.name
  end as item_name,
  lr.created_at,
  lr.status::text as status
from leave_requests lr
join employees e on e.id = lr.employee_id
join leave_types lt on lt.id = lr.leave_type_id
where lr.status = 'pending'

union all

select
  'attendance_correction'::text as request_type,
  ac.id as request_id,
  ac.employee_id,
  e.full_name as employee_name,
  'Attendance Correction'::text as item_name,
  ac.created_at,
  ac.status::text as status
from attendance_corrections ac
join employees e on e.id = ac.employee_id
where ac.status in ('submitted', 'pending_manager')

union all

select
  'reimbursement_claim'::text as request_type,
  rc.id as request_id,
  rc.employee_id,
  e.full_name as employee_name,
  cat.name as item_name,
  rc.created_at,
  rc.status::text as status
from reimbursement_claims rc
join employees e on e.id = rc.employee_id
join reimbursement_categories cat on cat.id = rc.category_id
where rc.status in ('submitted', 'pending_manager', 'pending_hr')

union all

select
  'leave_encashment'::text as request_type,
  er.id as request_id,
  er.employee_id,
  e.full_name as employee_name,
  'Leave Encashment'::text as item_name,
  er.created_at,
  er.status::text as status
from leave_encashment_requests er
join employees e on e.id = er.employee_id
where er.status = 'pending'

union all

select
  'ff_settlement'::text as request_type,
  ff.id as request_id,
  ff.employee_id,
  e.full_name as employee_name,
  'F&F Settlement'::text as item_name,
  ff.created_at,
  ff.status::text as status
from ff_settlement_records ff
join employees e on e.id = ff.employee_id
where ff.status = 'pending_approval'

union all

select
  'permission_request'::text as request_type,
  pr.id as request_id,
  pr.employee_id,
  e.full_name as employee_name,
  'Short Permission'::text as item_name,
  pr.created_at,
  pr.status::text as status
from permission_requests pr
join employees e on e.id = pr.employee_id
where pr.status = 'pending'

union all

select
  'comp_off_grant'::text as request_type,
  cog.id as request_id,
  cog.employee_id,
  e.full_name as employee_name,
  'Comp-Off Grant'::text as item_name,
  cog.created_at,
  cog.status::text as status
from comp_off_grants cog
join employees e on e.id = cog.employee_id
where cog.status = 'pending';
