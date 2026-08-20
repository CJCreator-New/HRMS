import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  createDepartmentAction,
  toggleDepartmentActiveAction,
  updateDepartmentAction,
  getDepartmentsAction,
  bulkAssignDepartments,
} from "@/lib/actions/departments";
import {
  getCompanySettingsAction,
  updateCompanySettingsAction,
} from "@/lib/actions/settings";

describe("departments", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("creates a department with the form name", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "departments" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: { id: "d1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("name", "Engineering");
    const res: any = await createDepartmentAction(fd);
    expect(res.success).toBe(true);
    expect(writes[0].payload).toEqual({ name: "Engineering", active: true });
  });

  it("rejects a missing department name", async () => {
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);
    const res = await createDepartmentAction(new FormData());
    expect(res).toEqual({ success: false, error: "Department Name is required." });
  });

  it("toggles a department active state", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "departments" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: { id: "d1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await toggleDepartmentActiveAction("d1", false);
    expect(res.success).toBe(true);
    expect(updates[0].payload).toEqual({ active: false });
  });

  it("updates a department name", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "departments" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: { id: "d1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await updateDepartmentAction("d1", "Sales");
    expect(res.success).toBe(true);
    expect(updates[0].payload).toEqual({ name: "Sales" });
  });

  it("lists departments ordered by name", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "departments" && state.method === "select") {
          return { data: [{ id: "d1", name: "Eng" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getDepartmentsAction()).resolves.toEqual({
      departments: [{ id: "d1", name: "Eng" }],
    });
  });

  describe("bulkAssignDepartments", () => {
    it("successfully creates assignments and closes prior open versions", async () => {
      const inserts: Array<{ table: string; payload: any }> = [];
      const updates: Array<{ table: string; payload: any }> = [];

      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "employees" && state.method === "select") {
            const empCodeFilter = state.filters.find((f) => f.col === "employee_code")?.val;
            if (empCodeFilter === "EMP-101") {
              return { data: { id: "emp-101", employee_code: "EMP-101", full_name: "Emp One" }, error: null };
            }
            if (empCodeFilter === "EMP-MGR") {
              return { data: { id: "emp-mgr", employee_code: "EMP-MGR", full_name: "Manager One" }, error: null };
            }
            return { data: null, error: null };
          }
          if (state.table === "departments" && state.method === "select") {
            return { data: { id: "dept-eng", name: "Engineering" }, error: null };
          }
          if (state.table === "employee_department_assignment" && state.method === "select") {
            return { data: { id: "prev-dept", effective_from: "2026-01-01" }, error: null };
          }
          if (state.table === "employee_designation_assignment" && state.method === "select") {
            return { data: { id: "prev-desig", effective_from: "2026-01-01" }, error: null };
          }
          if (state.table === "employee_manager_assignment" && state.method === "select") {
            return { data: { id: "prev-mgr", effective_from: "2026-01-01" }, error: null };
          }
          if (state.method === "update") {
            updates.push({ table: state.table, payload: state.payload });
            return { data: { id: "upd-id" }, error: null };
          }
          if (state.method === "insert") {
            inserts.push({ table: state.table, payload: state.payload });
            return { data: { id: "ins-id", ...(state.payload as object) }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const result = await bulkAssignDepartments([
        {
          employee_code: "EMP-101",
          department: "Engineering",
          designation: "Senior Engineer",
          manager_employee_code: "EMP-MGR",
          effective_date: "2026-09-01",
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.successCount).toBe(1);

      // Verify previous versions closed
      expect(updates.some((u) => u.table === "employee_department_assignment" && u.payload.effective_to === "2026-08-31")).toBe(true);
      expect(updates.some((u) => u.table === "employee_designation_assignment" && u.payload.effective_to === "2026-08-31")).toBe(true);
      expect(updates.some((u) => u.table === "employee_manager_assignment" && u.payload.effective_to === "2026-08-31")).toBe(true);

      // Verify inserts
      expect(inserts.some((i) => i.table === "employee_department_assignment" && i.payload.department_id === "dept-eng")).toBe(true);
      expect(inserts.some((i) => i.table === "employee_designation_assignment" && i.payload.title === "Senior Engineer")).toBe(true);
      expect(inserts.some((i) => i.table === "employee_manager_assignment" && i.payload.manager_id === "emp-mgr")).toBe(true);
    });

    it("rejects self-reporting manager assignment", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "employees" && state.method === "select") {
            return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const result = await bulkAssignDepartments([
        {
          employee_code: "EMP-101",
          department: "Engineering",
          manager_employee_code: "EMP-101", // self
          effective_date: "2026-09-01",
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]).toContain("Self-reporting error");
    });

    it("rejects unknown manager employee code", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "employees" && state.method === "select") {
            const code = state.filters.find((f) => f.col === "employee_code")?.val;
            if (code === "EMP-101") return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
            return { data: null, error: null }; // manager not found
          }
          if (state.table === "departments" && state.method === "select") {
            return { data: { id: "dept-eng", name: "Engineering" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const result = await bulkAssignDepartments([
        {
          employee_code: "EMP-101",
          department: "Engineering",
          manager_employee_code: "UNKNOWN-MGR",
          effective_date: "2026-09-01",
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]).toContain("Reporting manager code 'UNKNOWN-MGR' not found");
    });

    it("blocks unauthorized callers without department.bulk_assign", async () => {
      mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: department.bulk_assign required" });
      const fake = createFakeSupabase();
      mocks.createClient.mockReturnValue(fake);

      const result = await bulkAssignDepartments([
        {
          employee_code: "EMP-101",
          department: "Engineering",
          effective_date: "2026-09-01",
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Insufficient permissions");
    });
  });
});

describe("settings", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("loads company settings", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_settings" && state.method === "select") {
          return { data: { id: "cs-1", company_name: "Acme" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getCompanySettingsAction()).resolves.toEqual({
      settings: { id: "cs-1", company_name: "Acme" },
    });
  });

  it("updates existing settings and unlocks the engine", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_settings" && state.method === "select") {
          return { data: { id: "cs-1" }, error: null };
        }
        if (state.table === "company_settings" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("companyName", "Acme Corp");
    fd.set("timezone", "Asia/Kolkata");
    fd.set("currency", "INR");
    fd.set("currencySymbol", "₹");
    fd.set("managerSlaDays", "5");
    fd.set("noticePeriodDaysDefault", "45");
    const res: any = await updateCompanySettingsAction(fd);
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({
      company_name: "Acme Corp",
      manager_sla_days: 5,
      notice_period_days_default: 45,
      is_configured: true,
      alternate_hr_approver_id: null,
    });
  });
});
