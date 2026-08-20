/**
 * Realistic, Non-Sensitive Mock Seed Data & Database Seeder
 * 
 * Provides mock employee profiles, org structure, and attendance records
 * for local testing, offline demo flows, and development environments.
 */

export interface MockEmployeeSeed {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  date_of_birth?: string;
  date_of_joining: string;
  status: "active" | "invited" | "notice_period" | "suspended" | "offboarded";
  must_change_password: boolean;
  is_deactivated: boolean;
  role: "system_admin" | "hr" | "payroll_admin" | "manager" | "employee";
}

export interface MockAttendanceSeed {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: "present" | "absent" | "half_day" | "extra_work" | "pending_review";
  check_in_time?: string;
  check_out_time?: string;
  total_work_minutes: number;
  remarks?: string;
  is_locked?: boolean;
}

export const MOCK_EMPLOYEES: MockEmployeeSeed[] = [
  {
    id: "persona-sysadmin-001",
    employee_code: "EMP-SYSADMIN",
    full_name: "Alexander Vance",
    email: "sysadmin@company.com",
    phone: "+1-555-0100",
    department: "Information Technology",
    designation: "Principal Infrastructure Architect",
    date_of_birth: "1988-04-12",
    date_of_joining: "2024-01-15",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "system_admin",
  },
  {
    id: "persona-hradmin-001",
    employee_code: "EMP-HRADMIN",
    full_name: "Sarah Jenkins",
    email: "hradmin@company.com",
    phone: "+1-555-0101",
    department: "Human Resources",
    designation: "VP of People Operations",
    date_of_birth: "1990-08-23",
    date_of_joining: "2024-02-01",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "hr",
  },
  {
    id: "persona-hralt-001",
    employee_code: "EMP-004",
    full_name: "Vikram Malhotra",
    email: "hr.alt@company.com",
    phone: "+1-555-0102",
    department: "Human Resources",
    designation: "Senior HR Business Partner",
    date_of_birth: "1992-11-05",
    date_of_joining: "2024-03-15",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "hr",
  },
  {
    id: "persona-payroll-001",
    employee_code: "EMP-PAYROLL",
    full_name: "Marcus Chen",
    email: "payroll@company.com",
    phone: "+1-555-0103",
    department: "Finance & Payroll",
    designation: "Lead Payroll Controller",
    date_of_birth: "1989-06-17",
    date_of_joining: "2024-01-20",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "payroll_admin",
  },
  {
    id: "persona-mgr-001",
    employee_code: "EMP-MGR01",
    full_name: "Rajesh Kumar",
    email: "manager.m1@company.com",
    phone: "+1-555-0104",
    department: "Engineering",
    designation: "Engineering Director",
    date_of_birth: "1987-02-19",
    date_of_joining: "2024-04-01",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "manager",
  },
  {
    id: "persona-mgr-002",
    employee_code: "EMP-MGR02",
    full_name: "Priya Deshmukh",
    email: "manager.m2@company.com",
    phone: "+1-555-0105",
    department: "Product & Design",
    designation: "Head of Product",
    date_of_birth: "1991-09-30",
    date_of_joining: "2024-05-10",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "manager",
  },
  {
    id: "persona-emp-001",
    employee_code: "EMP-002",
    full_name: "Priya Sharma",
    email: "employee.e1@company.com",
    phone: "+1-555-0106",
    department: "Engineering",
    designation: "Senior Full Stack Engineer",
    date_of_birth: "1995-12-14",
    date_of_joining: "2025-01-08",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "employee",
  },
  {
    id: "persona-emp-002",
    employee_code: "EMP-003",
    full_name: "Amit Patel",
    email: "employee.e2@company.com",
    phone: "+1-555-0107",
    department: "Engineering",
    designation: "DevOps Engineer",
    date_of_birth: "1994-03-22",
    date_of_joining: "2025-02-01",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "employee",
  },
  {
    id: "persona-emp-003",
    employee_code: "EMP-005",
    full_name: "Sneha Reddy",
    email: "employee.e3@company.com",
    phone: "+1-555-0108",
    department: "Quality Assurance",
    designation: "Lead QA Automation Engineer",
    date_of_birth: "1996-07-09",
    date_of_joining: "2025-03-15",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "employee",
  },
  {
    id: "persona-multirole-001",
    employee_code: "EMP-MULTI",
    full_name: "Sunita Verma",
    email: "multi.hrmgr@company.com",
    phone: "+1-555-0109",
    department: "Operations",
    designation: "Operations Manager & HR Partner",
    date_of_birth: "1988-10-04",
    date_of_joining: "2024-06-01",
    status: "active",
    must_change_password: false,
    is_deactivated: false,
    role: "hr",
  },
];

/**
 * Generates realistic attendance logs for the mock employees across recent dates
 */
export function generateMockAttendanceRecords(): MockAttendanceSeed[] {
  const records: MockAttendanceSeed[] = [];
  const baseDays = [
    { day: "01", status: "present" as const, inTime: "09:02:00Z", outTime: "18:05:00Z", mins: 543 },
    { day: "02", status: "present" as const, inTime: "08:58:00Z", outTime: "18:12:00Z", mins: 554 },
    { day: "03", status: "present" as const, inTime: "09:10:00Z", outTime: "18:00:00Z", mins: 530 },
    { day: "04", status: "present" as const, inTime: "09:00:00Z", outTime: "18:30:00Z", mins: 570 },
    { day: "05", status: "present" as const, inTime: "09:05:00Z", outTime: "18:02:00Z", mins: 537 },
    { day: "08", status: "present" as const, inTime: "09:00:00Z", outTime: "18:00:00Z", mins: 540 },
    { day: "09", status: "present" as const, inTime: "09:15:00Z", outTime: "18:15:00Z", mins: 540 },
    { day: "10", status: "pending_review" as const, inTime: "09:00:00Z", outTime: undefined, mins: 0, remarks: "Missing check-out punch" },
    { day: "11", status: "half_day" as const, inTime: "09:00:00Z", outTime: "13:30:00Z", mins: 270, remarks: "Approved half-day afternoon medical" },
    { day: "12", status: "present" as const, inTime: "08:55:00Z", outTime: "18:00:00Z", mins: 545 },
    { day: "15", status: "extra_work" as const, inTime: "10:00:00Z", outTime: "17:00:00Z", mins: 420, remarks: "Weekend critical deployment support" },
    { day: "16", status: "present" as const, inTime: "09:01:00Z", outTime: "18:03:00Z", mins: 542 },
    { day: "17", status: "present" as const, inTime: "09:04:00Z", outTime: "18:00:00Z", mins: 536 },
    { day: "18", status: "absent" as const, inTime: undefined, outTime: undefined, mins: 0, remarks: "Unplanned leave" },
    { day: "19", status: "present" as const, inTime: "09:00:00Z", outTime: "18:10:00Z", mins: 550 },
  ];

  const yearMonth = "2026-08";

  for (const emp of MOCK_EMPLOYEES) {
    for (const item of baseDays) {
      const dateStr = `${yearMonth}-${item.day}`;
      records.push({
        id: `att-${emp.employee_code.toLowerCase()}-${item.day}`,
        employee_id: emp.id,
        attendance_date: dateStr,
        status: item.status,
        check_in_time: item.inTime ? `${dateStr}T${item.inTime}` : undefined,
        check_out_time: item.outTime ? `${dateStr}T${item.outTime}` : undefined,
        total_work_minutes: item.mins,
        remarks: item.remarks || null as any,
        is_locked: false,
      });
    }
  }

  return records;
}

export const MOCK_ATTENDANCE_RECORDS: MockAttendanceSeed[] = generateMockAttendanceRecords();
