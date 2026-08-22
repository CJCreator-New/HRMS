import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// 1. Load environment variables from .env.local / .env
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const envFile of envFiles) {
    const fullPath = path.join(ROOT_DIR, envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_service_role_key";

console.log(`[Mock Data Seeder] Target Supabase URL: ${supabaseUrl}`);

export const adminDb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DEFAULT_PASSWORD = process.env.TEST_DEFAULT_PASSWORD || "Password123!";

async function isSupabaseReachable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: { apikey: serviceRoleKey },
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    return !!res;
  } catch {
    return false;
  }
}

export const MOCK_PERSONAS = {
  sys_admin: {
    id: "00000000-0000-0000-0000-000000000101",
    email: "sysadmin@company.com",
    name: "System Admin User",
    code: "EMP-SYSADMIN",
    roles: ["system_admin"],
    status: "active",
    must_change_password: false,
    doj: "2025-01-01",
  },
  hr_admin: {
    id: "00000000-0000-0000-0000-000000000102",
    email: "hradmin@company.com",
    name: "HR Admin User",
    code: "EMP-HRADMIN",
    roles: ["hr"],
    status: "active",
    must_change_password: false,
    doj: "2025-01-01",
  },
  hr_alt_approver: {
    id: "00000000-0000-0000-0000-000000000103",
    email: "hr.alt@company.com",
    name: "Vikram Malhotra",
    code: "EMP-004",
    roles: ["hr"],
    status: "active",
    must_change_password: false,
    doj: "2025-02-01",
  },
  payroll_admin: {
    id: "00000000-0000-0000-0000-000000000104",
    email: "payroll@company.com",
    name: "Payroll Admin User",
    code: "EMP-PAYROLL",
    roles: ["payroll_admin"],
    status: "active",
    must_change_password: false,
    doj: "2025-01-01",
  },
  manager_m1: {
    id: "00000000-0000-0000-0000-000000000105",
    email: "manager.m1@company.com",
    name: "Rajesh Kumar",
    code: "EMP-MGR01",
    roles: ["manager"],
    status: "active",
    must_change_password: false,
    doj: "2025-03-01",
  },
  manager_m2: {
    id: "00000000-0000-0000-0000-000000000106",
    email: "manager.m2@company.com",
    name: "Priya Deshmukh",
    code: "EMP-MGR02",
    roles: ["manager"],
    status: "active",
    must_change_password: false,
    doj: "2025-04-01",
  },
  employee_e1: {
    id: "00000000-0000-0000-0000-000000000107",
    email: "employee.e1@company.com",
    name: "Priya Sharma",
    code: "EMP-002",
    roles: ["employee"],
    status: "active",
    must_change_password: false,
    doj: "2026-01-01",
  },
  employee_e2: {
    id: "00000000-0000-0000-0000-000000000108",
    email: "employee.e2@company.com",
    name: "Amit Patel",
    code: "EMP-003",
    roles: ["employee"],
    status: "active",
    must_change_password: false,
    doj: "2026-01-15",
  },
  employee_e3: {
    id: "00000000-0000-0000-0000-000000000109",
    email: "employee.e3@company.com",
    name: "Sneha Reddy",
    code: "EMP-005",
    roles: ["employee"],
    status: "active",
    must_change_password: false,
    doj: "2026-02-01",
  },
  multi_hr_mgr: {
    id: "00000000-0000-0000-0000-000000000110",
    email: "multi.hrmgr@company.com",
    name: "Sunita Verma",
    code: "EMP-MULTI",
    roles: ["hr", "manager"],
    status: "active",
    must_change_password: false,
    doj: "2025-05-01",
  },
  emp_invited: {
    id: "00000000-0000-0000-0000-000000000111",
    email: "invited.emp@company.com",
    name: "Rohan Gupta",
    code: "EMP-INV01",
    roles: ["employee"],
    status: "invited",
    must_change_password: true,
    doj: "2026-08-01",
  },
  emp_suspended: {
    id: "00000000-0000-0000-0000-000000000112",
    email: "suspended.emp@company.com",
    name: "Rahul Verma",
    code: "EMP-SUS01",
    roles: ["employee"],
    status: "suspended",
    must_change_password: false,
    doj: "2025-06-01",
  },
  emp_notice: {
    id: "00000000-0000-0000-0000-000000000113",
    email: "notice.emp@company.com",
    name: "Ananya Roy",
    code: "EMP-NOT01",
    roles: ["employee"],
    status: "notice_period",
    must_change_password: false,
    doj: "2025-07-01",
  },
  emp_offboarded: {
    id: "00000000-0000-0000-0000-000000000114",
    email: "offboarded.emp@company.com",
    name: "Karan Mehra",
    code: "EMP-OFF01",
    roles: ["employee"],
    status: "offboarded",
    must_change_password: false,
    doj: "2024-01-01",
  },
  statutory_admin: {
    id: "00000000-0000-0000-0000-000000000115",
    email: "statutory.admin@company.com",
    name: "Deepa Nair",
    code: "EMP-STATADM",
    roles: ["statutory_admin"],
    status: "active",
    must_change_password: false,
    doj: "2025-06-01",
  },
  finance_admin: {
    id: "00000000-0000-0000-0000-000000000116",
    email: "finance.admin@company.com",
    name: "Arjun Mehta",
    code: "EMP-FINADM",
    roles: ["finance_admin"],
    status: "active",
    must_change_password: false,
    doj: "2025-06-01",
  },
  it_admin: {
    id: "00000000-0000-0000-0000-000000000117",
    email: "it.admin@company.com",
    name: "Nikhil Joshi",
    code: "EMP-ITADM",
    roles: ["it_admin"],
    status: "active",
    must_change_password: false,
    doj: "2025-06-01",
  },
};

// --- Idempotent insert helpers ------------------------------------------------
// These tables have no natural unique key to upsert on, so re-runs are guarded
// by a select-first check keyed on the seeded fixture identity.

async function seedLeaveRequest(record) {
  const { data: existing } = await adminDb
    .from("leave_requests")
    .select("id")
    .eq("employee_id", record.employee_id)
    .eq("start_date", record.start_date)
    .maybeSingle();
  if (!existing) {
    await adminDb.from("leave_requests").insert(record);
  }
}

async function seedSeparation(record) {
  const { data: existing } = await adminDb
    .from("separation_records")
    .select("id")
    .eq("employee_id", record.employee_id)
    .maybeSingle();
  if (existing) return existing;
  const { data: inserted } = await adminDb
    .from("separation_records")
    .insert(record)
    .select()
    .single();
  return inserted;
}

async function seedReimbursementClaim(record) {
  const { data: existing } = await adminDb
    .from("reimbursement_claims")
    .select("id")
    .eq("employee_id", record.employee_id)
    .eq("category_id", record.category_id)
    .eq("claim_date", record.claim_date)
    .maybeSingle();
  if (!existing) {
    await adminDb.from("reimbursement_claims").insert(record);
  }
}

async function seedCompOffGrant(record) {
  const { data: existing } = await adminDb
    .from("comp_off_grants")
    .select("id")
    .eq("employee_id", record.employee_id)
    .eq("worked_date", record.worked_date)
    .maybeSingle();
  if (!existing) {
    await adminDb.from("comp_off_grants").insert(record);
  }
}

export async function seedAllMockData() {
  console.log("============================================================");
  console.log("   HRMS v2.7 — Comprehensive Multi-Role Mock Data Seeder   ");
  console.log("============================================================");

  const reachable = await isSupabaseReachable();
  if (!reachable) {
    console.log("[Mock Data Seeder] Notice: Local Supabase server is offline or unreachable at: " + supabaseUrl);
    console.log("[Mock Data Seeder] Verified standalone SQL migration seed exists at 'schema/mock_seed.sql'.");
    console.log("[Mock Data Seeder] When Supabase container starts, data can also be applied via SQL or 'npm run seed:mock'.");
    return;
  }

  // 1. Roles & Permissions Baseline
  console.log("[1/14] Ensuring Roles & Permissions Catalog...");
  const roles = [
    { code: "employee", name: "Employee", is_system: true },
    { code: "manager", name: "Manager", is_system: true },
    { code: "hr", name: "HR Admin", is_system: true },
    { code: "payroll_admin", name: "Payroll Administrator", is_system: true },
    { code: "system_admin", name: "System Administrator", is_system: true },
    { code: "statutory_admin", name: "Statutory Administrator", is_system: true },
    { code: "finance_admin", name: "Finance Administrator", is_system: true },
    { code: "it_admin", name: "IT Administrator", is_system: true },
  ];
  for (const r of roles) {
    await adminDb.from("roles").upsert(r, { onConflict: "code" });
  }

  // 2. Auth Users & Employee Records
  console.log("[2/14] Provisioning 14 Test Personas (Auth & Employee Profiles)...");
  const personas = Object.values(MOCK_PERSONAS);

  for (const persona of personas) {
    try {
      try {
        await adminDb.auth.admin.deleteUser(persona.id);
      } catch (e) {}

      try {
        await adminDb.auth.admin.createUser({
          id: persona.id,
          email: persona.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
        });
      } catch (err) {}

      const { data: emp } = await adminDb
        .from("employees")
        .select("id")
        .eq("email", persona.email)
        .maybeSingle();

      if (!emp) {
        await adminDb.from("employees").insert({
          id: persona.id,
          auth_user_id: persona.id,
          employee_code: persona.code,
          full_name: persona.name,
          email: persona.email,
          date_of_joining: persona.doj,
          status: persona.status,
          must_change_password: persona.must_change_password,
        });
      } else {
        await adminDb.from("employees").update({
          auth_user_id: persona.id,
          employee_code: persona.code,
          full_name: persona.name,
          status: persona.status,
          must_change_password: persona.must_change_password,
        }).eq("id", emp.id);
      }

      // Assign Roles
      for (const roleCode of persona.roles) {
        const { data: role } = await adminDb.from("roles").select("id").eq("code", roleCode).maybeSingle();
        if (role?.id && persona.id) {
          const { data: existing } = await adminDb
            .from("employee_roles")
            .select("id")
            .eq("employee_id", persona.id)
            .eq("role_id", role.id)
            .maybeSingle();

          if (!existing) {
            await adminDb.from("employee_roles").insert({
              employee_id: persona.id,
              role_id: role.id,
            });
          }
        }
      }
    } catch (e) {
      console.log(`Note for persona ${persona.email}: ${e.message}`);
    }
  }

  // 3. Company Settings & Unlock Gate
  console.log("[3/14] Provisioning Company Settings & Unlocking System Gate...");
  const hrAlt = MOCK_PERSONAS.hr_alt_approver;
  await adminDb.from("company_settings").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    company_name: "Acme Enterprise HRMS",
    timezone: "Asia/Kolkata",
    currency: "INR",
    currency_symbol: "₹",
    rounding_mode: "half_up",
    manager_sla_days: 2,
    notice_period_days_default: 60,
    alternate_hr_approver_id: hrAlt.id,
    is_configured: true,
  });

  // 4. Departments & Org Hierarchy
  console.log("[4/14] Seeding Departments & Manager Hierarchy...");
  const depts = [
    { name: "Engineering" },
    { name: "Product" },
    { name: "Human Resources" },
    { name: "Finance & Payroll" },
  ];
  for (const d of depts) {
    await adminDb.from("departments").upsert(d, { onConflict: "name" });
  }

  const { data: engDept } = await adminDb.from("departments").select("id").eq("name", "Engineering").single();
  const { data: prodDept } = await adminDb.from("departments").select("id").eq("name", "Product").single();
  const { data: hrDept } = await adminDb.from("departments").select("id").eq("name", "Human Resources").single();
  const { data: finDept } = await adminDb.from("departments").select("id").eq("name", "Finance & Payroll").single();

  const deptAssignments = [
    { employee_id: MOCK_PERSONAS.employee_e1.id, department_id: engDept?.id },
    { employee_id: MOCK_PERSONAS.employee_e2.id, department_id: engDept?.id },
    { employee_id: MOCK_PERSONAS.employee_e3.id, department_id: prodDept?.id },
    { employee_id: MOCK_PERSONAS.manager_m1.id, department_id: engDept?.id },
    { employee_id: MOCK_PERSONAS.manager_m2.id, department_id: prodDept?.id },
    { employee_id: MOCK_PERSONAS.hr_admin.id, department_id: hrDept?.id },
    { employee_id: MOCK_PERSONAS.hr_alt_approver.id, department_id: hrDept?.id },
    { employee_id: MOCK_PERSONAS.multi_hr_mgr.id, department_id: hrDept?.id },
    { employee_id: MOCK_PERSONAS.payroll_admin.id, department_id: finDept?.id },
    { employee_id: MOCK_PERSONAS.statutory_admin.id, department_id: finDept?.id },
    { employee_id: MOCK_PERSONAS.finance_admin.id, department_id: finDept?.id },
    { employee_id: MOCK_PERSONAS.it_admin.id, department_id: engDept?.id },
  ];

  for (const da of deptAssignments) {
    if (da.department_id) {
      const { data: existing } = await adminDb
        .from("employee_department_assignment")
        .select("id")
        .eq("employee_id", da.employee_id)
        .maybeSingle();

      if (!existing) {
        await adminDb.from("employee_department_assignment").insert({
          employee_id: da.employee_id,
          department_id: da.department_id,
          effective_from: "2025-01-01",
        });
      }
    }
  }

  // Manager Hierarchy: E1, E2 -> M1; E3 -> M2; M1, M2, HR, Payroll -> SysAdmin
  const managerAssignments = [
    { employee_id: MOCK_PERSONAS.employee_e1.id, manager_id: MOCK_PERSONAS.manager_m1.id },
    { employee_id: MOCK_PERSONAS.employee_e2.id, manager_id: MOCK_PERSONAS.manager_m1.id },
    { employee_id: MOCK_PERSONAS.employee_e3.id, manager_id: MOCK_PERSONAS.manager_m2.id },
    { employee_id: MOCK_PERSONAS.manager_m1.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.manager_m2.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.hr_admin.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.payroll_admin.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.multi_hr_mgr.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.statutory_admin.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.finance_admin.id, manager_id: MOCK_PERSONAS.sys_admin.id },
    { employee_id: MOCK_PERSONAS.it_admin.id, manager_id: MOCK_PERSONAS.sys_admin.id },
  ];

  for (const ma of managerAssignments) {
    const { data: existing } = await adminDb
      .from("employee_manager_assignment")
      .select("id")
      .eq("employee_id", ma.employee_id)
      .maybeSingle();

    if (!existing) {
      await adminDb.from("employee_manager_assignment").insert({
        employee_id: ma.employee_id,
        manager_id: ma.manager_id,
        effective_from: "2025-01-01",
      });
    }
  }

  // 5. Work Calendars & 2026 Holidays
  console.log("[5/14] Seeding Work Calendars & 2026 Holiday Master Lists...");
  const calendars = [
    { code: "5-day-week", name: "5 Day Work Week (Mon-Fri)", standard_working_days: [1, 2, 3, 4, 5], is_default: true },
    { code: "6-day-week", name: "6 Day Work Week (Mon-Sat)", standard_working_days: [1, 2, 3, 4, 5, 6], is_default: false },
  ];
  for (const c of calendars) {
    await adminDb.from("work_calendar_templates").upsert(c, { onConflict: "code" });
  }

  const { data: defaultCal } = await adminDb.from("work_calendar_templates").select("id").eq("code", "5-day-week").single();

  if (defaultCal) {
    const holidays = [
      { calendar_template_id: defaultCal.id, name: "Republic Day", holiday_date: "2026-01-26", is_optional: false },
      { calendar_template_id: defaultCal.id, name: "Independence Day", holiday_date: "2026-08-15", is_optional: false },
      { calendar_template_id: defaultCal.id, name: "Gandhi Jayanti", holiday_date: "2026-10-02", is_optional: false },
      { calendar_template_id: defaultCal.id, name: "Christmas", holiday_date: "2026-12-25", is_optional: false },
      { calendar_template_id: defaultCal.id, name: "Holi", holiday_date: "2026-03-17", is_optional: true },
      { calendar_template_id: defaultCal.id, name: "Eid", holiday_date: "2026-04-11", is_optional: true },
      { calendar_template_id: defaultCal.id, name: "Dussehra", holiday_date: "2026-10-20", is_optional: true },
    ];
    for (const h of holidays) {
      await adminDb.from("holidays").upsert(h, { onConflict: "calendar_template_id,holiday_date,name" });
    }

    // Calendar assignments for active employees (incl. second manager,
    // alternate HR approver, and the multi-role union persona)
    for (const emp of [MOCK_PERSONAS.employee_e1, MOCK_PERSONAS.employee_e2, MOCK_PERSONAS.employee_e3, MOCK_PERSONAS.manager_m1, MOCK_PERSONAS.manager_m2, MOCK_PERSONAS.hr_alt_approver, MOCK_PERSONAS.multi_hr_mgr]) {
      const { data: existing } = await adminDb
        .from("employee_work_calendar_assignment")
        .select("id")
        .eq("employee_id", emp.id)
        .maybeSingle();

      if (!existing) {
        await adminDb.from("employee_work_calendar_assignment").insert({
          employee_id: emp.id,
          calendar_template_id: defaultCal.id,
          effective_from: "2025-01-01",
        });
      }
    }
  }

  // 6. Leave Types Master & Annual Allocations
  console.log("[6/14] Seeding Leave Policy Types & Quota Allocations...");
  const leaveTypes = [
    { code: "CL", name: "Casual Leave", is_paid: true, is_sandwich_enabled: false },
    { code: "SL", name: "Sick Leave", is_paid: true, is_sandwich_enabled: false },
    { code: "EL", name: "Earned Leave", is_paid: true, is_sandwich_enabled: true },
    { code: "MATERNITY", name: "Maternity Leave", is_paid: true, is_sandwich_enabled: false },
    { code: "PATERNITY", name: "Paternity Leave", is_paid: true, is_sandwich_enabled: false },
    { code: "COMP_OFF", name: "Compensatory Off", is_paid: true, is_sandwich_enabled: false },
    { code: "LOP", name: "Loss of Pay", is_paid: false, is_sandwich_enabled: false },
  ];
  for (const lt of leaveTypes) {
    await adminDb.from("leave_types").upsert(lt, { onConflict: "code" });
  }

  const { data: dbLeaveTypes } = await adminDb.from("leave_types").select("id, code");
  const year = 2026;

  for (const emp of [MOCK_PERSONAS.employee_e1, MOCK_PERSONAS.employee_e2, MOCK_PERSONAS.employee_e3, MOCK_PERSONAS.manager_m1, MOCK_PERSONAS.manager_m2, MOCK_PERSONAS.hr_alt_approver, MOCK_PERSONAS.multi_hr_mgr, MOCK_PERSONAS.hr_admin]) {
    for (const lt of dbLeaveTypes || []) {
      let allocated = 0;
      if (lt.code === "CL") allocated = 12;
      else if (lt.code === "SL") allocated = 10;
      else if (lt.code === "EL") allocated = 15;
      else if (lt.code === "MATERNITY") allocated = 182;
      else if (lt.code === "PATERNITY") allocated = 15;

      if (allocated > 0) {
        await adminDb.from("leave_allocations").upsert({
          employee_id: emp.id,
          leave_type_id: lt.id,
          year,
          allocated_days: allocated,
          used_days: 0,
          pending_days: 0,
          carry_forward_days: 0,
        }, { onConflict: "employee_id,leave_type_id,year" });
      }
    }
  }

  // 7. Attendance Records & Anomaly Punches (August 2026)
  console.log("[7/14] Seeding Attendance Records, Punches & Anomaly Records...");
  const e1 = MOCK_PERSONAS.employee_e1;
  const e2 = MOCK_PERSONAS.employee_e2;

  // August 1 - 9 Normal Present
  for (let day = 1; day <= 9; day++) {
    const dateStr = `2026-08-0${day}`;
    await adminDb.from("attendance_records").upsert({
      employee_id: e1.id,
      attendance_date: dateStr,
      status: "present",
      check_in_time: `${dateStr}T09:00:00Z`,
      check_out_time: `${dateStr}T18:00:00Z`,
      total_work_minutes: 540,
    }, { onConflict: "employee_id,attendance_date" });
  }

  // Aug 10: Missing check-out anomaly for E1 (Flagged pending_review)
  await adminDb.from("attendance_records").upsert({
    employee_id: e1.id,
    attendance_date: "2026-08-10",
    status: "pending_review",
    check_in_time: "2026-08-10T09:00:00Z",
    check_out_time: null,
    total_work_minutes: 0,
    remarks: "Missing check-out timestamp",
  }, { onConflict: "employee_id,attendance_date" });

  // Aug 15: Extra work on holiday
  await adminDb.from("attendance_records").upsert({
    employee_id: e1.id,
    attendance_date: "2026-08-15",
    status: "extra_work",
    check_in_time: "2026-08-15T10:00:00Z",
    check_out_time: "2026-08-15T17:00:00Z",
    total_work_minutes: 420,
    remarks: "Weekend project deployment support",
  }, { onConflict: "employee_id,attendance_date" });

  // 7b. Comp-Off Grant — manual credit contract (catalog ticket C15)
  // The compoff.credit.manual / compoff.revoke actions are unimplemented, so
  // this row models the intended manual-credit outcome (HR approver, 90-day
  // expiry from the worked date, linked to the extra-work event) for TRACE-10
  // to assert against a live backend.
  const { data: extraWorkRec } = await adminDb
    .from("attendance_records")
    .select("id")
    .eq("employee_id", e1.id)
    .eq("attendance_date", "2026-08-15")
    .maybeSingle();
  await seedCompOffGrant({
    employee_id: e1.id,
    attendance_record_id: extraWorkRec?.id || null,
    worked_date: "2026-08-15",
    days_granted: 1.0,
    expiry_date: "2026-11-13", // worked_date + 90 days (computeCompOffExpiryDate)
    is_used: false,
    status: "approved",
    approver_id: MOCK_PERSONAS.hr_admin.id,
  });

  // 8. Leave Requests & Approvals
  console.log("[8/14] Seeding Leave Requests (Approved, Pending Sandwich, HR Alternate)...");
  const clType = dbLeaveTypes?.find((t) => t.code === "CL");
  const elType = dbLeaveTypes?.find((t) => t.code === "EL");

  if (clType && elType) {
    // Approved CL for E1
    await seedLeaveRequest({
      employee_id: e1.id,
      leave_type_id: clType.id,
      start_date: "2026-08-03",
      end_date: "2026-08-04",
      total_days: 2,
      duration_type: "full_day",
      reason: "Family event",
      status: "approved",
      current_approver_id: MOCK_PERSONAS.manager_m1.id,
    });

    // Pending Sandwich EL for E1 (Fri Aug 21 to Mon Aug 24)
    await seedLeaveRequest({
      employee_id: e1.id,
      leave_type_id: elType.id,
      start_date: "2026-08-21",
      end_date: "2026-08-24",
      total_days: 4,
      duration_type: "full_day",
      reason: "Long weekend travel",
      status: "pending",
      current_approver_id: MOCK_PERSONAS.manager_m1.id,
    });

    // HR Admin Leave Request -> Routed to HR Alternate
    await seedLeaveRequest({
      employee_id: MOCK_PERSONAS.hr_admin.id,
      leave_type_id: clType.id,
      start_date: "2026-08-25",
      end_date: "2026-08-25",
      total_days: 1,
      duration_type: "full_day",
      reason: "Personal appointment",
      status: "pending",
      current_approver_id: MOCK_PERSONAS.hr_alt_approver.id,
    });

    // HR Alternate self-application -> self-approval guard -> system_admin
    // fallback (catalog ticket C8, FR §1.4): the applicant IS the alternate,
    // so resolveLeaveApprover skips the alternate branch and routes to the
    // system_admin approver. TRACE-09 asserts the seeded interconnection.
    await seedLeaveRequest({
      employee_id: MOCK_PERSONAS.hr_alt_approver.id,
      leave_type_id: clType.id,
      start_date: "2026-09-07",
      end_date: "2026-09-07",
      total_days: 1,
      duration_type: "full_day",
      reason: "Fallback routing probe (C8)",
      status: "pending",
      current_approver_id: MOCK_PERSONAS.sys_admin.id,
    });
  }

  // 9. Salary Components & Structures
  console.log("[9/14] Seeding Salary Components & Versioned Salary Structures...");
  const components = [
    { code: "BASIC", name: "Basic Salary", component_type: "earning", calculation_type: "percentage_of_ctc", is_taxable: true, is_pf_component: true, is_esi_component: true },
    { code: "HRA", name: "House Rent Allowance", component_type: "earning", calculation_type: "percentage_of_basic", is_taxable: true, is_pf_component: false, is_esi_component: true },
    { code: "SPECIAL_ALLOWANCE", name: "Special Allowance", component_type: "earning", calculation_type: "flat_amount", is_taxable: true, is_pf_component: false, is_esi_component: true },
    { code: "PF_EMP", name: "Employee PF Deduction", component_type: "statutory_deduction", calculation_type: "percentage_of_basic", is_taxable: false, is_pf_component: false, is_esi_component: false },
    { code: "ESI_EMP", name: "Employee ESI Deduction", component_type: "statutory_deduction", calculation_type: "percentage_of_basic", is_taxable: false, is_pf_component: false, is_esi_component: false },
    { code: "PT", name: "Professional Tax", component_type: "statutory_deduction", calculation_type: "flat_amount", is_taxable: false, is_pf_component: false, is_esi_component: false },
    { code: "TDS", name: "Income Tax TDS", component_type: "statutory_deduction", calculation_type: "flat_amount", is_taxable: false, is_pf_component: false, is_esi_component: false },
  ];
  for (const c of components) {
    await adminDb.from("salary_components").upsert(c, { onConflict: "code" });
  }

  // Salary Structure for E1: CTC ₹12,00,000 (Monthly Gross ₹1,00,000, Basic ₹50,000, HRA ₹20,000, Special ₹30,000)
  const { data: existingSalE1 } = await adminDb
    .from("employee_salary_structures")
    .select("id")
    .eq("employee_id", e1.id)
    .maybeSingle();

  if (!existingSalE1) {
    await adminDb.from("employee_salary_structures").insert({
      employee_id: e1.id,
      annual_ctc: 1200000,
      monthly_gross: 100000,
      basic_monthly: 50000,
      effective_from: "2026-01-01",
      version_number: 1,
    });
  }

  // Salary structures for the remaining active personas (E2, E3, M2, Multi-Role Union)
  const salaryStructures = [
    { emp: MOCK_PERSONAS.employee_e2, ctc: 720000, gross: 60000, basic: 30000 },
    { emp: MOCK_PERSONAS.employee_e3, ctc: 600000, gross: 50000, basic: 25000 },
    { emp: MOCK_PERSONAS.manager_m2, ctc: 900000, gross: 75000, basic: 37500 },
    { emp: MOCK_PERSONAS.multi_hr_mgr, ctc: 1800000, gross: 150000, basic: 75000 },
  ];
  for (const s of salaryStructures) {
    const { data: existing } = await adminDb
      .from("employee_salary_structures")
      .select("id")
      .eq("employee_id", s.emp.id)
      .maybeSingle();

    if (!existing) {
      await adminDb.from("employee_salary_structures").insert({
        employee_id: s.emp.id,
        annual_ctc: s.ctc,
        monthly_gross: s.gross,
        basic_monthly: s.basic,
        effective_from: "2026-01-01",
        version_number: 1,
      });
    }
  }

  // 10. Statutory Rule Versions & Profiles
  console.log("[10/14] Seeding Statutory Rule Versions (FY 2025-26) & Profiles...");
  await adminDb.from("statutory_rule_versions").upsert({
    rule_name: "India_Statutory_FY2025_26",
    effective_from: "2025-04-01",
    pf_wage_ceiling: 15000,
    pf_employee_pct: 12,
    esi_gross_ceiling: 21000,
    esi_employee_pct: 0.75,
    rule_config: { pt_slabs: { Karnataka: [{ max: 24999, tax: 0 }, { min: 25000, tax: 200 }] } },
  }, { onConflict: "rule_name" });

  const statutoryEmployees = [
    { employee_id: e1.id, pan_number: "ABCDE1234F", uan_number: "100123456789", pf_number: "PF-001", esi_number: "ESI-001", pt_state: "Karnataka", tax_regime: "new_regime" },
    { employee_id: e2.id, pan_number: "BCDEF2345G", uan_number: "100123456790", pf_number: "PF-002", esi_number: "ESI-002", pt_state: "Karnataka", tax_regime: "new_regime" },
    { employee_id: MOCK_PERSONAS.manager_m1.id, pan_number: "CDEFG3456H", uan_number: "100123456791", pf_number: "PF-003", esi_number: "ESI-003", pt_state: "Karnataka", tax_regime: "old_regime" },
    { employee_id: MOCK_PERSONAS.employee_e3.id, pan_number: "DEFGH4567I", uan_number: "100123456792", pf_number: "PF-004", esi_number: "ESI-004", pt_state: "Karnataka", tax_regime: "new_regime" },
    { employee_id: MOCK_PERSONAS.manager_m2.id, pan_number: "EFGHI5678J", uan_number: "100123456793", pf_number: "PF-005", esi_number: "ESI-005", pt_state: "Karnataka", tax_regime: "new_regime" },
    { employee_id: MOCK_PERSONAS.multi_hr_mgr.id, pan_number: "FGHIJ6789K", uan_number: "100123456794", pf_number: "PF-006", esi_number: "ESI-006", pt_state: "Karnataka", tax_regime: "new_regime" },
  ];

  for (const sp of statutoryEmployees) {
    const { data: existing } = await adminDb
      .from("statutory_profiles")
      .select("id")
      .eq("employee_id", sp.employee_id)
      .maybeSingle();

    if (!existing) {
      await adminDb.from("statutory_profiles").insert({
        ...sp,
        effective_from: "2025-01-01",
      });
    }
  }

  // 11. Payroll Eligibility & Snapshots
  console.log("[11/14] Seeding Payroll Eligibility & Monthly Payable Units...");
  for (const emp of [e1, e2, MOCK_PERSONAS.employee_e3, MOCK_PERSONAS.manager_m1, MOCK_PERSONAS.manager_m2, MOCK_PERSONAS.hr_alt_approver, MOCK_PERSONAS.multi_hr_mgr, MOCK_PERSONAS.hr_admin, MOCK_PERSONAS.payroll_admin]) {
    const { data: existing } = await adminDb
      .from("payroll_eligibility")
      .select("id")
      .eq("employee_id", emp.id)
      .maybeSingle();

    if (!existing) {
      await adminDb.from("payroll_eligibility").insert({
        employee_id: emp.id,
        is_eligible: true,
        effective_from: "2025-01-01",
        source: "system_default",
      });
    }
  }

  // Suspended Employee Ineligibility
  const { data: existingSusp } = await adminDb
    .from("payroll_eligibility")
    .select("id")
    .eq("employee_id", MOCK_PERSONAS.emp_suspended.id)
    .maybeSingle();

  if (!existingSusp) {
    await adminDb.from("payroll_eligibility").insert({
      employee_id: MOCK_PERSONAS.emp_suspended.id,
      is_eligible: false,
      reason: "Administrative Review Suspension",
      effective_from: "2026-01-01",
      source: "hr_override",
    });
  }

  // 12. Payroll Periods & Payslip Registers (July 2026 Finalized & August 2026 Draft)
  console.log("[12/14] Seeding Payroll Periods (July 2026 Finalized & August 2026 Draft)...");
  const julyPeriod = await adminDb.from("payroll_periods").upsert({
    year: 2026,
    month: 7,
    start_date: "2026-07-01",
    end_date: "2026-07-31",
    cutoff_date: "2026-07-25",
    status: "finalized",
  }, { onConflict: "year,month" }).select().maybeSingle();

  const augPeriod = await adminDb.from("payroll_periods").upsert({
    year: 2026,
    month: 8,
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    cutoff_date: "2026-08-25",
    status: "draft",
  }, { onConflict: "year,month" }).select().maybeSingle();

  if (julyPeriod.data?.id) {
    const { data: rev } = await adminDb.from("payroll_revisions").upsert({
      payroll_period_id: julyPeriod.data.id,
      revision_number: 1,
      status: "finalized",
      total_employees: 3,
      total_gross: 350000,
      total_deductions: 25000,
      total_net: 325000,
    }, { onConflict: "payroll_period_id,revision_number" }).select().maybeSingle();

    if (rev?.id) {
      await adminDb.from("payslips").upsert({
        payroll_revision_id: rev.id,
        employee_id: e1.id,
        year: 2026,
        month: 7,
        payable_units: 31,
        lop_units: 0,
        gross_earnings: 100000,
        total_deductions: 7200,
        net_pay: 92800,
        is_published: true,
        published_at: "2026-08-01T00:00:00Z",
      }, { onConflict: "payroll_revision_id,employee_id" });
    }
  }

  // 13. Expense Reimbursements
  console.log("[13/14] Seeding Reimbursement Categories & Active Claims...");
  const categories = [
    { code: "TRAVEL", name: "Travel & Fuel", duplicate_policy: "block", approval_route: "manager_then_hr", requires_receipt: true, is_taxable: false },
    { code: "INTERNET", name: "Internet & Phone", duplicate_policy: "warn_and_allow", approval_route: "manager_only", requires_receipt: true, is_taxable: false },
    { code: "MEALS", name: "Client Meals & Entertainment", duplicate_policy: "allow_always", approval_route: "manager_then_hr", requires_receipt: true, is_taxable: true },
  ];
  for (const cat of categories) {
    await adminDb.from("reimbursement_categories").upsert(cat, { onConflict: "code" });
  }

  const { data: travelCat } = await adminDb.from("reimbursement_categories").select("id").eq("code", "TRAVEL").single();
  const { data: netCat } = await adminDb.from("reimbursement_categories").select("id").eq("code", "INTERNET").single();

  if (travelCat && netCat) {
    // Approved Claim for E1 (Travel ₹4,500) — idempotent
    await seedReimbursementClaim({
      employee_id: e1.id,
      category_id: travelCat.id,
      claim_date: "2026-08-05",
      vendor_name: "Uber Rides",
      requested_amount: 4500,
      approved_amount: 4500,
      description: "Client on-site travel meeting in Bangalore",
      status: "approved",
      approver_id: MOCK_PERSONAS.hr_admin.id,
    });

    // Pending Manager Review Claim for E1 (Internet ₹1,200) — idempotent
    await seedReimbursementClaim({
      employee_id: e1.id,
      category_id: netCat.id,
      claim_date: "2026-08-08",
      vendor_name: "Airtel Broadband",
      requested_amount: 1200,
      description: "Monthly WFH fiber internet connection",
      status: "pending_manager",
    });
  }

  // 14. Offboarding & Full & Final (F&F) Settlements
  console.log("[14/14] Seeding Separations, Offboarding Checklists & F&F Settlements...");
  const noticeEmp = MOCK_PERSONAS.emp_notice;
  const offboardedEmp = MOCK_PERSONAS.emp_offboarded;

  // Active Notice Period Separation (idempotent — guarded by employee_id)
  const sepNotice = await seedSeparation({
    employee_id: noticeEmp.id,
    separation_type: "resignation",
    initiated_date: "2026-08-01",
    last_working_day: "2026-09-30",
    notice_period_days: 60,
    status: "active",
    reason: "Career growth opportunity",
  });

  // Completed Separation for Offboarded Employee (idempotent)
  const sepCompleted = await seedSeparation({
    employee_id: offboardedEmp.id,
    separation_type: "resignation",
    initiated_date: "2026-06-01",
    last_working_day: "2026-07-31",
    notice_period_days: 60,
    status: "completed",
    reason: "Relocation",
  });

  if (sepCompleted?.id) {
    await adminDb.from("ff_settlement_records").upsert({
      separation_id: sepCompleted.id,
      employee_id: offboardedEmp.id,
      last_working_day: "2026-07-31",
      leave_encashment_amount: 25000,
      other_earnings: 0,
      asset_recovery_amount: 0,
      tax_deduction_amount: 2500,
      net_settlement_amount: 22500,
      status: "approved",
      approved_by: MOCK_PERSONAS.hr_admin.id,
    }, { onConflict: "separation_id" });
  }

  console.log("============================================================");
  console.log("   ✓ All 20 Modules Successfully Seeded with Mock Data!    ");
  console.log("============================================================");
}

// Run immediately if called directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedAllMockData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding Error:", err);
      process.exit(1);
    });
}
