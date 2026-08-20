-- ============================================================================
-- HRMS v2.7 — Comprehensive Master Mock Data SQL Seeder Script
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/mock_seed.sql
-- Covers all 20 Modules, 5 Core Roles, Multi-Role Union & 14 Personas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System Settings & Unlock Gate (Module 00 & 03)
-- ----------------------------------------------------------------------------
insert into company_settings (
  id, company_name, timezone, currency, currency_symbol, rounding_mode,
  manager_sla_days, notice_period_days_default, is_configured
) values (
  '00000000-0000-0000-0000-000000000001', 'Acme Enterprise HRMS', 'Asia/Kolkata',
  'INR', '₹', 'half_up', 2, 60, true
) on conflict (id) do update set
  company_name = excluded.company_name,
  is_configured = true;

insert into policy_configurations (category, key, value, description) values
  ('leave', 'default_cl_quota', '{"days": 12}'::jsonb, 'Default annual Casual Leave quota'),
  ('leave', 'default_sl_quota', '{"days": 10}'::jsonb, 'Default annual Sick Leave quota'),
  ('leave', 'default_el_quota', '{"days": 15}'::jsonb, 'Default annual Earned Leave quota'),
  ('reimbursement', 'receipt_required_threshold', '{"amount": 500}'::jsonb, 'Minimum amount requiring physical receipt')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Baseline Roles & Permissions Catalog (Module 01)
-- ----------------------------------------------------------------------------
insert into roles (code, name, is_system) values
  ('employee', 'Employee', true),
  ('manager', 'Manager', true),
  ('hr', 'HR Admin', true),
  ('payroll_admin', 'Payroll Administrator', true),
  ('system_admin', 'System Administrator', true)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Departments (Module 02)
-- ----------------------------------------------------------------------------
insert into departments (name, active) values
  ('Engineering', true),
  ('Product', true),
  ('Human Resources', true),
  ('Finance & Payroll', true)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 4. 14 Test Personas in Employees Table (Module 02)
-- ----------------------------------------------------------------------------
insert into employees (
  id, employee_code, full_name, email, date_of_joining, status, must_change_password, is_deactivated
) values
  ('00000000-0000-0000-0000-000000000101', 'EMP-SYSADMIN', 'System Admin User', 'sysadmin@company.com', '2025-01-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000102', 'EMP-HRADMIN', 'HR Admin User', 'hradmin@company.com', '2025-01-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000103', 'EMP-004', 'Vikram Malhotra', 'hr.alt@company.com', '2025-02-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000104', 'EMP-PAYROLL', 'Payroll Admin User', 'payroll@company.com', '2025-01-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000105', 'EMP-MGR01', 'Rajesh Kumar', 'manager.m1@company.com', '2025-03-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000106', 'EMP-MGR02', 'Priya Deshmukh', 'manager.m2@company.com', '2025-04-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000107', 'EMP-002', 'Priya Sharma', 'employee.e1@company.com', '2026-01-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000108', 'EMP-003', 'Amit Patel', 'employee.e2@company.com', '2026-01-15', 'active', false, false),
  ('00000000-0000-0000-0000-000000000109', 'EMP-005', 'Sneha Reddy', 'employee.e3@company.com', '2026-02-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000110', 'EMP-MULTI', 'Sunita Verma', 'multi.hrmgr@company.com', '2025-05-01', 'active', false, false),
  ('00000000-0000-0000-0000-000000000111', 'EMP-INV01', 'Rohan Gupta', 'invited.emp@company.com', '2026-08-01', 'invited', true, false),
  ('00000000-0000-0000-0000-000000000112', 'EMP-SUS01', 'Rahul Verma', 'suspended.emp@company.com', '2025-06-01', 'suspended', false, true),
  ('00000000-0000-0000-0000-000000000113', 'EMP-NOT01', 'Ananya Roy', 'notice.emp@company.com', '2025-07-01', 'notice_period', false, false),
  ('00000000-0000-0000-0000-000000000114', 'EMP-OFF01', 'Karan Mehra', 'offboarded.emp@company.com', '2024-01-01', 'offboarded', false, false)
on conflict (email) do update set
  full_name = excluded.full_name,
  status = excluded.status,
  must_change_password = excluded.must_change_password;

-- Update alternate HR approver ID in company settings
update company_settings
set alternate_hr_approver_id = '00000000-0000-0000-0000-000000000103'
where id = '00000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------
-- 5. Role Assignments (Module 01)
-- ----------------------------------------------------------------------------
insert into employee_roles (employee_id, role_id)
select e.id, r.id from employees e, roles r
where (
  (e.email = 'sysadmin@company.com' and r.code = 'system_admin') or
  (e.email = 'hradmin@company.com' and r.code = 'hr') or
  (e.email = 'hr.alt@company.com' and r.code = 'hr') or
  (e.email = 'payroll@company.com' and r.code = 'payroll_admin') or
  (e.email = 'manager.m1@company.com' and r.code = 'manager') or
  (e.email = 'manager.m2@company.com' and r.code = 'manager') or
  (e.email = 'employee.e1@company.com' and r.code = 'employee') or
  (e.email = 'employee.e2@company.com' and r.code = 'employee') or
  (e.email = 'employee.e3@company.com' and r.code = 'employee') or
  (e.email = 'multi.hrmgr@company.com' and r.code in ('hr', 'manager')) or
  (e.email in ('invited.emp@company.com', 'suspended.emp@company.com', 'notice.emp@company.com', 'offboarded.emp@company.com') and r.code = 'employee')
) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 6. Department & Manager Assignments (Module 02)
-- ----------------------------------------------------------------------------
insert into employee_department_assignment (employee_id, department_id, effective_from)
select e.id, d.id, '2025-01-01'::date from employees e, departments d
where (
  (e.email in ('employee.e1@company.com', 'employee.e2@company.com', 'manager.m1@company.com') and d.name = 'Engineering') or
  (e.email in ('employee.e3@company.com', 'manager.m2@company.com') and d.name = 'Product') or
  (e.email in ('hradmin@company.com', 'hr.alt@company.com', 'multi.hrmgr@company.com') and d.name = 'Human Resources') or
  (e.email = 'payroll@company.com' and d.name = 'Finance & Payroll')
) on conflict do nothing;

insert into employee_manager_assignment (employee_id, manager_id, effective_from)
select e.id, m.id, '2025-01-01'::date
from employees e, employees m
where (
  (e.email in ('employee.e1@company.com', 'employee.e2@company.com') and m.email = 'manager.m1@company.com') or
  (e.email = 'employee.e3@company.com' and m.email = 'manager.m2@company.com') or
  (e.email in ('manager.m1@company.com', 'manager.m2@company.com', 'hradmin@company.com', 'payroll@company.com') and m.email = 'sysadmin@company.com')
) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 7. Work Calendar Templates & Holidays 2026 (Module 04)
-- ----------------------------------------------------------------------------
insert into work_calendar_templates (id, code, name, standard_working_days, is_default) values
  ('00000000-0000-0000-0000-000000000201', '5-day-week', '5 Day Work Week (Mon-Fri)', '{1,2,3,4,5}', true),
  ('00000000-0000-0000-0000-000000000202', '6-day-week', '6 Day Work Week (Mon-Sat)', '{1,2,3,4,5,6}', false)
on conflict (code) do nothing;

insert into holidays (calendar_template_id, name, holiday_date, is_optional) values
  ('00000000-0000-0000-0000-000000000201', 'Republic Day', '2026-01-26', false),
  ('00000000-0000-0000-0000-000000000201', 'May Day', '2026-05-01', false),
  ('00000000-0000-0000-0000-000000000201', 'Independence Day', '2026-08-15', false),
  ('00000000-0000-0000-0000-000000000201', 'Gandhi Jayanti', '2026-10-02', false),
  ('00000000-0000-0000-0000-000000000201', 'Christmas', '2026-12-25', false),
  ('00000000-0000-0000-0000-000000000201', 'Holi', '2026-03-17', true),
  ('00000000-0000-0000-0000-000000000201', 'Eid al-Fitr', '2026-04-11', true),
  ('00000000-0000-0000-0000-000000000201', 'Dussehra', '2026-10-20', true)
on conflict do nothing;

insert into employee_work_calendar_assignment (employee_id, calendar_template_id, effective_from)
select e.id, '00000000-0000-0000-0000-000000000201'::uuid, '2025-01-01'::date
from employees e where e.status in ('active', 'notice_period')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 8. Leave Types & Allocations 2026 (Module 06)
-- ----------------------------------------------------------------------------
insert into leave_types (code, name, is_paid, is_sandwich_enabled) values
  ('CL', 'Casual Leave', true, false),
  ('SL', 'Sick Leave', true, false),
  ('EL', 'Earned Leave', true, true),
  ('MATERNITY', 'Maternity Leave', true, false),
  ('PATERNITY', 'Paternity Leave', true, false),
  ('COMP_OFF', 'Compensatory Off', true, false),
  ('LOP', 'Loss of Pay', false, false)
on conflict (code) do nothing;

insert into leave_allocations (employee_id, leave_type_id, year, allocated_days)
select e.id, lt.id, 2026,
  case lt.code
    when 'CL' then 12
    when 'SL' then 10
    when 'EL' then 15
    when 'MATERNITY' then 182
    when 'PATERNITY' then 15
    else 0
  end
from employees e, leave_types lt
where e.status in ('active', 'notice_period')
  and lt.code in ('CL', 'SL', 'EL', 'MATERNITY', 'PATERNITY')
on conflict (employee_id, leave_type_id, year) do nothing;

-- ----------------------------------------------------------------------------
-- 9. Attendance Records & Anomaly (Module 05)
-- ----------------------------------------------------------------------------
-- Normal present records for E1
insert into attendance_records (employee_id, attendance_date, status, check_in_time, check_out_time, total_work_minutes)
select
  '00000000-0000-0000-0000-000000000107'::uuid,
  ('2026-08-0' || i)::date,
  'present',
  ('2026-08-0' || i || ' 09:00:00+00')::timestamptz,
  ('2026-08-0' || i || ' 18:00:00+00')::timestamptz,
  540
from generate_series(1, 9) i
on conflict (employee_id, attendance_date) do nothing;

-- Aug 10 Missing Check-out Anomaly (Pending Review)
insert into attendance_records (employee_id, attendance_date, status, check_in_time, check_out_time, total_work_minutes, remarks)
values (
  '00000000-0000-0000-0000-000000000107',
  '2026-08-10',
  'pending_review',
  '2026-08-10 09:00:00+00',
  null,
  0,
  'Missing checkout punch'
) on conflict (employee_id, attendance_date) do update set
  status = 'pending_review',
  remarks = excluded.remarks;

-- Aug 15 Extra Work punch on Holiday
insert into attendance_records (employee_id, attendance_date, status, check_in_time, check_out_time, total_work_minutes, remarks)
values (
  '00000000-0000-0000-0000-000000000107',
  '2026-08-15',
  'extra_work',
  '2026-08-15 10:00:00+00',
  '2026-08-15 17:00:00+00',
  420,
  'Weekend production release support'
) on conflict (employee_id, attendance_date) do nothing;

-- ----------------------------------------------------------------------------
-- 10. Leave Requests & Approvals (Module 06)
-- ----------------------------------------------------------------------------
-- Approved CL for E1
insert into leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, duration_type, reason, status, current_approver_id)
select
  '00000000-0000-0000-0000-000000000301'::uuid,
  '00000000-0000-0000-0000-000000000107'::uuid,
  lt.id, '2026-08-03', '2026-08-04', 2, 'full_day', 'Family function', 'approved', '00000000-0000-0000-0000-000000000105'::uuid
from leave_types lt where lt.code = 'CL'
on conflict do nothing;

-- Pending Sandwich EL for E1 (Fri Aug 21 - Mon Aug 24)
insert into leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, duration_type, reason, status, current_approver_id)
select
  '00000000-0000-0000-0000-000000000302'::uuid,
  '00000000-0000-0000-0000-000000000107'::uuid,
  lt.id, '2026-08-21', '2026-08-24', 4, 'full_day', 'Long weekend travel', 'pending', '00000000-0000-0000-0000-000000000105'::uuid
from leave_types lt where lt.code = 'EL'
on conflict do nothing;

-- Pending HR Admin Leave Request (Self-Approval bypass to Alternate HR Approver)
insert into leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, duration_type, reason, status, current_approver_id)
select
  '00000000-0000-0000-0000-000000000303'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  lt.id, '2026-08-25', '2026-08-25', 1, 'full_day', 'Personal consultation', 'pending', '00000000-0000-0000-0000-000000000103'::uuid
from leave_types lt where lt.code = 'CL'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 11. Salary Master & Versioned Structures (Module 07)
-- ----------------------------------------------------------------------------
insert into salary_components (code, name, component_type, calculation_type, is_taxable, is_pf_component, is_esi_component) values
  ('BASIC', 'Basic Salary', 'earning', 'percentage_of_ctc', true, true, true),
  ('HRA', 'House Rent Allowance', 'earning', 'percentage_of_basic', true, false, true),
  ('SPECIAL_ALLOWANCE', 'Special Allowance', 'earning', 'flat_amount', true, false, true),
  ('PF_EMP', 'Employee PF Deduction', 'statutory_deduction', 'percentage_of_basic', false, false, false),
  ('ESI_EMP', 'Employee ESI Deduction', 'statutory_deduction', 'percentage_of_basic', false, false, false),
  ('PT', 'Professional Tax', 'statutory_deduction', 'flat_amount', false, false, false),
  ('TDS', 'Income Tax TDS', 'statutory_deduction', 'flat_amount', false, false, false)
on conflict (code) do nothing;

insert into employee_salary_structures (
  id, employee_id, annual_ctc, monthly_gross, basic_monthly, effective_from, version_number
) values (
  '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000107',
  1200000, 100000, 50000, '2026-01-01', 1
) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 12. Statutory Rule Versions (FY 2025-26) & Profiles (Module 10)
-- ----------------------------------------------------------------------------
insert into statutory_rule_versions (
  id, rule_name, effective_from, pf_wage_ceiling, pf_employee_pct, esi_gross_ceiling, esi_employee_pct, rule_config
) values (
  '00000000-0000-0000-0000-000000000501', 'India_Statutory_FY2025_26', '2025-04-01',
  15000.00, 12.00, 21000.00, 0.75,
  '{"pt_slabs": {"Karnataka": [{"max": 24999, "tax": 0}, {"min": 25000, "tax": 200}]}}'::jsonb
) on conflict do nothing;

insert into statutory_profiles (
  employee_id, pan_number, uan_number, pf_number, esi_number, pt_state, tax_regime, effective_from
) values
  ('00000000-0000-0000-0000-000000000107', 'ABCDE1234F', '100123456789', 'PF-001', 'ESI-001', 'Karnataka', 'new_regime', '2025-01-01'),
  ('00000000-0000-0000-0000-000000000108', 'BCDEF2345G', '100123456790', 'PF-002', 'ESI-002', 'Karnataka', 'new_regime', '2025-01-01'),
  ('00000000-0000-0000-0000-000000000105', 'CDEFG3456H', '100123456791', 'PF-003', 'ESI-003', 'Karnataka', 'old_regime', '2025-01-01')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 13. Payroll Eligibility (Module 08)
-- ----------------------------------------------------------------------------
insert into payroll_eligibility (employee_id, is_eligible, effective_from, source)
select e.id, true, '2025-01-01'::date, 'system_default'
from employees e where e.status in ('active', 'notice_period')
on conflict do nothing;

-- Suspended employee exclusion
insert into payroll_eligibility (employee_id, is_eligible, effective_from, reason, source)
values (
  '00000000-0000-0000-0000-000000000112', false, '2026-01-01',
  'Administrative Review Suspension', 'hr_override'
) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 14. Payroll Periods & Payslips (Module 09)
-- ----------------------------------------------------------------------------
-- July 2026 Finalized Period
insert into payroll_periods (id, year, month, start_date, end_date, cutoff_date, status)
values (
  '00000000-0000-0000-0000-000000000601', 2026, 7, '2026-07-01', '2026-07-31', '2026-07-25', 'finalized'
) on conflict (year, month) do nothing;

-- August 2026 Open Draft Period
insert into payroll_periods (id, year, month, start_date, end_date, cutoff_date, status)
values (
  '00000000-0000-0000-0000-000000000602', 2026, 8, '2026-08-01', '2026-08-31', '2026-08-25', 'draft'
) on conflict (year, month) do nothing;

-- July 2026 Revision & Payslip
insert into payroll_revisions (id, payroll_period_id, revision_number, status, total_employees, total_gross, total_deductions, total_net)
values (
  '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000601',
  1, 'finalized', 3, 350000, 25000, 325000
) on conflict (payroll_period_id, revision_number) do nothing;

insert into payslips (
  id, payroll_revision_id, employee_id, year, month, payable_units, lop_units, gross_earnings, total_deductions, net_pay, is_published, published_at
) values (
  '00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000611',
  '00000000-0000-0000-0000-000000000107', 2026, 7, 31, 0, 100000, 7200, 92800, true, '2026-08-01 00:00:00+00'
) on conflict (payroll_revision_id, employee_id) do nothing;

-- ----------------------------------------------------------------------------
-- 15. Expense Reimbursements (Module 11)
-- ----------------------------------------------------------------------------
insert into reimbursement_categories (id, code, name, duplicate_policy, approval_route, requires_receipt, is_taxable) values
  ('00000000-0000-0000-0000-000000000701', 'TRAVEL', 'Travel & Fuel', 'block', 'manager_then_hr', true, false),
  ('00000000-0000-0000-0000-000000000702', 'INTERNET', 'Internet & Phone', 'warn_and_allow', 'manager_only', true, false),
  ('00000000-0000-0000-0000-000000000703', 'MEALS', 'Client Meals & Entertainment', 'allow_always', 'manager_then_hr', true, true)
on conflict (code) do nothing;

-- Approved Travel Claim for E1 (₹4,500)
insert into reimbursement_claims (
  id, employee_id, category_id, claim_date, vendor_name, requested_amount, approved_amount, description, status, approver_id
) values (
  '00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000107',
  '00000000-0000-0000-0000-000000000701', '2026-08-05', 'Uber Rides', 4500, 4500,
  'Client on-site travel meeting in Bangalore', 'approved', '00000000-0000-0000-0000-000000000102'
) on conflict do nothing;

-- Pending Manager Review Claim for E1 (₹1,200)
insert into reimbursement_claims (
  id, employee_id, category_id, claim_date, vendor_name, requested_amount, description, status
) values (
  '00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000107',
  '00000000-0000-0000-0000-000000000702', '2026-08-08', 'Airtel Broadband', 1200,
  'Monthly WFH fiber internet connection', 'pending_manager'
) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 16. Separations & Full & Final Settlement (Module 13)
-- ----------------------------------------------------------------------------
-- Notice Period Separation
insert into separation_records (id, employee_id, separation_type, initiated_date, last_working_day, notice_period_days, status, reason)
values (
  '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000113',
  'resignation', '2026-08-01', '2026-09-30', 60, 'active', 'Career growth opportunity'
) on conflict do nothing;

-- Completed Separation & Approved F&F
insert into separation_records (id, employee_id, separation_type, initiated_date, last_working_day, notice_period_days, status, reason)
values (
  '00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000114',
  'resignation', '2026-06-01', '2026-07-31', 60, 'completed', 'Relocation'
) on conflict do nothing;

insert into ff_settlement_records (
  separation_id, employee_id, last_working_day, leave_encashment_amount, other_earnings, asset_recovery_amount, tax_deduction_amount, net_settlement_amount, status, approved_by
) values (
  '00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000114',
  '2026-07-31', 25000, 0, 0, 2500, 22500, 'approved', '00000000-0000-0000-0000-000000000102'
) on conflict (separation_id) do nothing;
