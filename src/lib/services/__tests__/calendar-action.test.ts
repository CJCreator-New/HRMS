import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  createHolidayAction,
  selectOptionalHolidayAction,
  assignCalendarAction,
} from "@/lib/actions/calendar";

describe("createHolidayAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("inserts the holiday", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "holidays" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: { id: "h1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await createHolidayAction("tpl-1", "Diwali", "2026-11-08", true);
    expect(res.success).toBe(true);
    expect(writes[0].payload).toEqual({
      calendar_template_id: "tpl-1",
      name: "Diwali",
      holiday_date: "2026-11-08",
      is_optional: true,
    });
  });

  it("blocks users without settings.manage", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: settings.manage required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await createHolidayAction("tpl-1", "Diwali", "2026-11-08", true);
    expect(res).toEqual({ error: "Insufficient permissions: settings.manage required" });
  });
});

describe("selectOptionalHolidayAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("selects an optional holiday below the cap", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "holidays" && state.method === "select") {
          return { data: { calendar_template_id: "tpl-1" }, error: null };
        }
        if (state.table === "employee_optional_holiday_selections" && state.method === "select") {
          return { data: [{ holiday_id: "h1" }], error: null };
        }
        if (state.table === "employee_optional_holiday_selections" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await selectOptionalHolidayAction("emp-1", "h2", true);
    expect(res.success).toBe(true);
    expect(writes[0].payload).toEqual({
      employee_id: "emp-1",
      holiday_id: "h2",
      calendar_template_id: "tpl-1",
    });
  });

  it("enforces the 2-holiday selection cap", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "holidays" && state.method === "select") {
          return { data: { calendar_template_id: "tpl-1" }, error: null };
        }
        if (state.table === "employee_optional_holiday_selections" && state.method === "select") {
          return { data: [{ holiday_id: "h1" }, { holiday_id: "h2" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await selectOptionalHolidayAction("emp-1", "h3", true);
    expect(res).toEqual({ error: "Maximum limit reached: you can select up to 2 optional holidays." });
  });

  it("deselects by deleting the selection", async () => {
    const deletes: Array<{ table: string; filters: any[] }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_optional_holiday_selections" && state.method === "delete") {
          deletes.push({ table: state.table, filters: state.filters });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await selectOptionalHolidayAction("emp-1", "h1", false);
    expect(res.success).toBe(true);
    expect(deletes[0].filters.map((f) => [f.col, f.val])).toEqual([
      ["employee_id", "emp-1"],
      ["holiday_id", "h1"],
    ]);
  });
});

describe("assignCalendarAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("inserts the work-calendar assignment", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_work_calendar_assignment" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await assignCalendarAction("emp-1", "tpl-1", "2026-08-01");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toEqual({
      employee_id: "emp-1",
      calendar_template_id: "tpl-1",
      effective_from: "2026-08-01",
    });
  });
});
