export interface TestPersona {
  id: string;
  email: string;
  name: string;
  code: string;
  roles: string[];
}

export const TEST_PERSONAS: Record<string, TestPersona> = {
  sys_admin: {
    id: "persona-sysadmin-001",
    email: "sysadmin@company.com",
    name: "System Admin User",
    code: "EMP-SYSADMIN",
    roles: ["system_admin"],
  },
  hr_admin: {
    id: "persona-hradmin-001",
    email: "hradmin@company.com",
    name: "HR Admin User",
    code: "EMP-HRADMIN",
    roles: ["hr"],
  },
  payroll_admin: {
    id: "persona-payroll-001",
    email: "payroll@company.com",
    name: "Payroll Admin User",
    code: "EMP-PAYROLL",
    roles: ["payroll_admin"],
  },
  manager_m1: {
    id: "persona-mgr-001",
    email: "manager.m1@company.com",
    name: "Rajesh Kumar",
    code: "EMP-MGR01",
    roles: ["manager"],
  },
  employee_e1: {
    id: "persona-emp-001",
    email: "employee.e1@company.com",
    name: "Priya Sharma",
    code: "EMP-002",
    roles: ["employee"],
  },
  employee_e2: {
    id: "persona-emp-002",
    email: "employee.e2@company.com",
    name: "Amit Patel",
    code: "EMP-003",
    roles: ["employee"],
  },
  multi_hr_mgr: {
    id: "persona-multirole-001",
    email: "multi.hrmgr@company.com",
    name: "Sunita Verma",
    code: "EMP-MULTI",
    roles: ["hr", "manager"],
  },
  hr_alt_approver: {
    id: "persona-hralt-001",
    email: "hr.alt@company.com",
    name: "Vikram Malhotra",
    code: "EMP-004",
    roles: ["hr"],
  },
  manager_m2: {
    id: "persona-mgr-002",
    email: "manager.m2@company.com",
    name: "Priya Deshmukh",
    code: "EMP-MGR02",
    roles: ["manager"],
  },
  employee_e3: {
    id: "persona-emp-003",
    email: "employee.e3@company.com",
    name: "Sneha Reddy",
    code: "EMP-005",
    roles: ["employee"],
  },
  emp_invited: {
    id: "persona-invited-001",
    email: "invited.emp@company.com",
    name: "Rohan Gupta",
    code: "EMP-INV01",
    roles: ["employee"],
  },
  emp_suspended: {
    id: "persona-suspended-001",
    email: "suspended.emp@company.com",
    name: "Rahul Verma",
    code: "EMP-SUS01",
    roles: ["employee"],
  },
  emp_notice: {
    id: "persona-notice-001",
    email: "notice.emp@company.com",
    name: "Ananya Roy",
    code: "EMP-NOT01",
    roles: ["employee"],
  },
  emp_offboarded: {
    id: "persona-offboarded-001",
    email: "offboarded.emp@company.com",
    name: "Karan Mehra",
    code: "EMP-OFF01",
    roles: ["employee"],
  },
};

export const DEFAULT_PASSWORD = "Password123!";
