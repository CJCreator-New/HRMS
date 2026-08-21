// HRMS v2.7 Core Domain Interfaces & Types

export type EmployeeStatus =
  | "invited"
  | "active"
  | "suspended"
  | "notice_period"
  | "offboarded"
  | "withdrawn";

export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "withdrawn";

export type SeparationStatus =
  | "pending"
  | "active"
  | "rescinded"
  | "completed"
  | "withdrawn";

export type FFStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "paid"
  | "reopened"
  | "cancelled"
  | "withdrawn";

export type RoleCode =
  | "employee"
  | "manager"
  | "hr"
  | "payroll_admin"
  | "system_admin"
  | "statutory_admin"
  | "finance_admin"
  | "it_admin";

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

export interface EmployeeItem {
  id: string;
  code: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  manager: string;
  status: "invited" | "active" | "suspended" | "notice_period" | "offboarded";
  is_deactivated: boolean;
  doj: string;
}

export interface EmployeeDbRow {
  id: string;
  employee_code?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  manager_name?: string | null;
  status?: "invited" | "active" | "suspended" | "notice_period" | "offboarded" | string | null;
  is_deactivated?: boolean | null;
  date_of_joining?: string | null;
  [key: string]: unknown;
}

export function toEmployeeItem(e: EmployeeDbRow): EmployeeItem {
  return {
    id: e.id,
    code: e.employee_code || "",
    name: e.full_name || "",
    email: e.email || "",
    department: e.department || "",
    designation: e.designation || "",
    manager: e.manager_name || "",
    status: (e.status as EmployeeItem["status"]) || "active",
    is_deactivated: Boolean(e.is_deactivated),
    doj: e.date_of_joining || "",
  };
}
