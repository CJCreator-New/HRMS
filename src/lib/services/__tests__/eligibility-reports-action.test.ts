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
  getEligibilityDataAction,
  setEligibilityAction,
  removeEligibilityAction,
} from "@/lib/actions/eligibility";
import { generateReportDataAction } from "@/lib/actions/reports";

describe("eligibility", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("loads active employees and eligibility overrides", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: [{ id: "e1", status: "active" }], error: null };
        }
        if (state.table === "payroll_eligibility" && state.method === "select") {
          return { data: [{ id: "pe-1", is_eligible: false }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getEligibilityDataAction()).resolves.toEqual({
      success: true,
      employees: [{ id: "e1", status: "active" }],
      eligibility: [{ id: "pe-1", is_eligible: false }],
    });
  });

  it("sets an eligibility override with the acting employee as creator", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "payroll_eligibility" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await setEligibilityAction("e2", false, "2026-08-01", "moved", "2026-12-31");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      employee_id: "e2",
      is_eligible: false,
      reason: "moved",
      source: "hr_override",
      effective_from: "2026-08-01",
      effective_to: "2026-12-31",
      created_by: "emp-9",
    });
  });

  it("removes an eligibility override", async () => {
    const deletes: Array<{ table: string }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "payroll_eligibility" && state.method === "delete") {
          deletes.push({ table: state.table });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await removeEligibilityAction("pe-1");
    expect(res.success).toBe(true);
    expect(deletes).toHaveLength(1);
  });
});

describe("generateReportDataAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("exports the rep-01 attendance CSV", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "v_monthly_attendance_summary" && state.method === "select") {
          return {
            data: [{
              employee_id: "e1", full_name: "Alice", employee_code: "E1", month_year: "2026-07",
              present_count: 20, half_day_count: 1, absent_count: 0, extra_work_count: 0,
              pending_review_count: 0, total_work_hours: 180,
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await generateReportDataAction("rep-01");
    expect(res.success).toBe(true);
    expect(res.csv).toContain("Employee ID,Full Name,Employee Code,Month Year");
    expect(res.csv).toContain('"e1","Alice","E1","2026-07"');
  });

  it("exports the rep-04 payroll register CSV", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "v_payroll_register_summary" && state.method === "select") {
          return {
            data: [{
              revision_number: 1, employee_code: "E1", full_name: "Alice", payable_units: 28,
              lop_units: 3, gross_earnings: 67742, total_deductions: 2020, net_pay: 65722, is_published: false,
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await generateReportDataAction("rep-04");
    expect(res.success).toBe(true);
    expect(res.csv).toContain('1,"E1","Alice",28,3,67742,2020,65722,false');
  });

  it("rejects unknown report ids", async () => {
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    await expect(generateReportDataAction("rep-99")).resolves.toEqual({
      success: false,
      error: "Unknown report ID",
    });
  });
});
