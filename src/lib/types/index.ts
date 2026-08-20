// HRMS v2.7 Core Domain Interfaces & Types

export type EmployeeStatus =
  | "invited"
  | "active"
  | "suspended"
  | "notice_period"
  | "offboarded"
  | "withdrawn";

export type RoleCode =
  | "employee"
  | "manager"
  | "hr"
  | "payroll_admin"
  | "system_admin";

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  is_system: boolean;
}

export interface Permission {
  id: string;
  code: string;
  description?: string;
}

export interface Employee {
  id: string;
  auth_user_id?: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  date_of_joining: string;
  status: EmployeeStatus;
  must_change_password: boolean;
  is_deactivated: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectOnboardingInput {
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_joining: string;
  initial_password: string;
  roles: RoleCode[];
}

export interface RoleContext {
  activeRole: RoleCode;
  assignedRoles: RoleCode[];
  unionPermissions: string[];
}
