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
