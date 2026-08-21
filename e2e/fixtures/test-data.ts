export interface TestPersona {
  id: string;
  email: string;
  name: string;
  code: string;
  roles: string[];
}

export const TEST_PERSONAS: Record<string, TestPersona> = {
  sys_admin: {
    id: "00000000-0000-0000-0000-000000000101",
    email: "sysadmin@company.com",
    name: "System Admin User",
    code: "EMP-SYSADMIN",
    roles: ["system_admin"],
  },
  hr_admin: {
    id: "00000000-0000-0000-0000-000000000102",
    email: "hradmin@company.com",
    name: "HR Admin User",
    code: "EMP-HRADMIN",
    roles: ["hr"],
  },
  payroll_admin: {
    id: "00000000-0000-0000-0000-000000000104",
    email: "payroll@company.com",
    name: "Payroll Admin User",
    code: "EMP-PAYROLL",
    roles: ["payroll_admin"],
  },
  manager_m1: {
    id: "00000000-0000-0000-0000-000000000105",
    email: "manager.m1@company.com",
    name: "Rajesh Kumar",
    code: "EMP-MGR01",
    roles: ["manager"],
  },
  employee_e1: {
    id: "00000000-0000-0000-0000-000000000107",
    email: "employee.e1@company.com",
    name: "Priya Sharma",
    code: "EMP-002",
    roles: ["employee"],
  },
  employee_e2: {
    id: "00000000-0000-0000-0000-000000000108",
    email: "employee.e2@company.com",
    name: "Amit Patel",
    code: "EMP-003",
    roles: ["employee"],
  },
  multi_hr_mgr: {
    id: "00000000-0000-0000-0000-000000000110",
    email: "multi.hrmgr@company.com",
    name: "Sunita Verma",
    code: "EMP-MULTI",
    roles: ["hr", "manager"],
  },
  hr_alt_approver: {
    id: "00000000-0000-0000-0000-000000000103",
    email: "hr.alt@company.com",
    name: "Vikram Malhotra",
    code: "EMP-004",
    roles: ["hr"],
  },
  manager_m2: {
    id: "00000000-0000-0000-0000-000000000106",
    email: "manager.m2@company.com",
    name: "Priya Deshmukh",
    code: "EMP-MGR02",
    roles: ["manager"],
  },
  employee_e3: {
    id: "00000000-0000-0000-0000-000000000109",
    email: "employee.e3@company.com",
    name: "Sneha Reddy",
    code: "EMP-005",
    roles: ["employee"],
  },
  emp_invited: {
    id: "00000000-0000-0000-0000-000000000111",
    email: "invited.emp@company.com",
    name: "Rohan Gupta",
    code: "EMP-INV01",
    roles: ["employee"],
  },
  emp_suspended: {
    id: "00000000-0000-0000-0000-000000000112",
    email: "suspended.emp@company.com",
    name: "Rahul Verma",
    code: "EMP-SUS01",
    roles: ["employee"],
  },
  emp_notice: {
    id: "00000000-0000-0000-0000-000000000113",
    email: "notice.emp@company.com",
    name: "Ananya Roy",
    code: "EMP-NOT01",
    roles: ["employee"],
  },
  emp_offboarded: {
    id: "00000000-0000-0000-0000-000000000114",
    email: "offboarded.emp@company.com",
    name: "Karan Mehra",
    code: "EMP-OFF01",
    roles: ["employee"],
  },
  statutory_admin: {
    id: "00000000-0000-0000-0000-000000000115",
    email: "statutory.admin@company.com",
    name: "Deepa Nair",
    code: "EMP-STATADM",
    roles: ["statutory_admin"],
  },
  finance_admin: {
    id: "00000000-0000-0000-0000-000000000116",
    email: "finance.admin@company.com",
    name: "Arjun Mehta",
    code: "EMP-FINADM",
    roles: ["finance_admin"],
  },
  it_admin: {
    id: "00000000-0000-0000-0000-000000000117",
    email: "it.admin@company.com",
    name: "Nikhil Joshi",
    code: "EMP-ITADM",
    roles: ["it_admin"],
  },
};

export const DEFAULT_PASSWORD = "Password123!";
