-- ============================================================================
-- HRMS v2.7 — Module 22: Comprehensive Database Performance Indexes
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/22_comprehensive_performance_indexes.sql
-- ============================================================================

-- 1. Org & Employee Relationships
create index if not exists idx_employees_manager_id
  on employees (manager_id);

create index if not exists idx_employee_dept_assign_lookup
  on employee_department_assignment (department_id, effective_to);

create index if not exists idx_employee_dept_assign_emp
  on employee_department_assignment (employee_id, effective_to);

create index if not exists idx_employee_mgr_assign_lookup
  on employee_manager_assignment (manager_id, effective_to);

create index if not exists idx_employee_mgr_assign_emp
  on employee_manager_assignment (employee_id, effective_to);

create index if not exists idx_employee_desig_assign_emp
  on employee_designation_assignment (employee_id, effective_to);

-- 2. Calendar & Holidays
create index if not exists idx_employee_calendar_assign
  on employee_work_calendar_assignment (employee_id, effective_to);

create index if not exists idx_holidays_template_date
  on holidays (calendar_template_id, holiday_date);

create index if not exists idx_opt_holiday_emp
  on employee_optional_holiday_selections (employee_id, holiday_id);

-- 3. Attendance & Corrections
create index if not exists idx_attendance_punches_record_id
  on attendance_punches (attendance_record_id);

create index if not exists idx_attendance_corrections_emp_status
  on attendance_corrections (employee_id, status);

create index if not exists idx_attendance_corrections_status_created
  on attendance_corrections (status, created_at desc);

create index if not exists idx_attendance_corrections_approver
  on attendance_corrections (approver_id, status);

-- 4. Leave & Approvals Dashboard Union Optimization
create index if not exists idx_leave_allocations_emp_type
  on leave_allocations (employee_id, leave_type_id);

create index if not exists idx_leave_requests_approver_status
  on leave_requests (current_approver_id, status);

create index if not exists idx_leave_requests_status_created
  on leave_requests (status, created_at desc);

create index if not exists idx_leave_request_approvals_lookup
  on leave_request_approvals (leave_request_id, approver_id, status);

create index if not exists idx_comp_off_grants_emp_status
  on comp_off_grants (employee_id, status);

create index if not exists idx_comp_off_grants_status_created
  on comp_off_grants (status, created_at desc);

create index if not exists idx_permission_requests_emp_date
  on permission_requests (employee_id, permission_date);

create index if not exists idx_permission_requests_status_created
  on permission_requests (status, created_at desc);

-- 5. Salary, Statutory & Payroll
create index if not exists idx_salary_structures_emp_dates
  on employee_salary_structures (employee_id, effective_from, effective_to);

create index if not exists idx_salary_structure_items_struct_id
  on employee_salary_structure_items (salary_structure_id);

create index if not exists idx_payroll_eligibility_emp_dates
  on payroll_eligibility (employee_id, effective_from);

create index if not exists idx_statutory_profiles_emp
  on statutory_profiles (employee_id);

-- 6. Reimbursements, Encashment & Offboarding
create index if not exists idx_reimbursements_status_created
  on reimbursement_claims (status, created_at desc);

create index if not exists idx_reimbursements_emp_date
  on reimbursement_claims (employee_id, claim_date);

create index if not exists idx_encashment_status_created
  on leave_encashment_requests (status, created_at desc);

create index if not exists idx_encashment_emp_status
  on leave_encashment_requests (employee_id, status);

create index if not exists idx_separation_emp_status
  on separation_records (employee_id, status);

create index if not exists idx_ff_settlement_separation
  on ff_settlement_records (separation_id);

create index if not exists idx_ff_settlement_status_created
  on ff_settlement_records (status, created_at desc);

create index if not exists idx_ff_clearances_settlement
  on ff_clearances (ff_settlement_id);

-- 7. Attachments & Audit Logs
create index if not exists idx_attachments_entity
  on document_attachments (entity_type, entity_id);

create index if not exists idx_attachments_uploaded_by
  on document_attachments (uploaded_by);

create index if not exists idx_audit_logs_actor
  on audit_logs (performed_by, created_at desc);

create index if not exists idx_audit_logs_correlation
  on audit_logs (correlation_id);
