-- ============================================================================
-- HRMS v2.7 — System Bootstrap: Initial System Admin Break-Glass Script
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/bootstrap/01_system_admin.sql
-- Run once by database administrator (bypassing RLS) to seed initial System Admin
-- ============================================================================

-- 1. Create Initial System Admin Employee
insert into employees (
  employee_code,
  full_name,
  email,
  date_of_joining,
  status,
  must_change_password
) values (
  'ADM-001',
  'System Administrator',
  'admin@company.local',
  current_date,
  'active',
  true
) on conflict (employee_code) do nothing;

-- 2. Grant System Admin Role
insert into employee_roles (employee_id, role_id)
select e.id, r.id
from employees e, roles r
where e.employee_code = 'ADM-001' and r.code = 'system_admin'
on conflict (employee_id, role_id) do nothing;
