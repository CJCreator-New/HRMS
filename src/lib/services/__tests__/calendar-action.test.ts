import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  createHolidayAction,
  selectOptionalHolidayAction,
  assignCalendarAction,
  bulkAssignCalendarTemplate,
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
    mocks.getAuthenticatedCaller.mockReset();
    mocks.getAuthenticatedCaller.mockResolvedValue({ employeeId: "emp-1" });
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

describe("bulkAssignCalendarTemplate", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("assigns calendar template to employee and closes prior open version", async () => {
    const inserts: Array<{ table: string; payload: any }> = [];
    const updates: Array<{ table: string; payload: any }> = [];

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "work_calendar_templates" && state.method === "select") {
          return { data: [{ id: "tpl-5day", code: "DEFAULT_5DAY", name: "Standard 5-Day" }], error: null };
        }
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
        }
        if (state.table === "employee_work_calendar_assignment" && state.method === "select") {
          return { data: { id: "open-cal", effective_from: "2026-01-01" }, error: null };
        }
        if (state.table === "employee_work_calendar_assignment" && state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: { id: "open-cal" }, error: null };
        }
        if (state.table === "employee_work_calendar_assignment" && state.method === "insert") {
          inserts.push({ table: state.table, payload: state.payload });
          return { data: { id: "new-cal", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignCalendarTemplate([
      {
        scope: "employee",
        target_code: "EMP-101",
        template_name: "DEFAULT_5DAY",
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(result.successCount).toBe(1);

    // Verify closing update
    expect(updates[0].payload).toEqual({ effective_to: "2026-08-31" });

    // Verify insert
    expect(inserts[0].payload).toMatchObject({
      employee_id: "emp-101",
      calendar_template_id: "tpl-5day",
      effective_from: "2026-09-01",
    });
  });

  it("assigns calendar template by department scope to all active department members", async () => {
    const inserts: Array<{ table: string; payload: any }> = [];

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "work_calendar_templates" && state.method === "select") {
          return { data: [{ id: "tpl-5day", code: "DEFAULT_5DAY", name: "Standard 5-Day" }], error: null };
        }
        if (state.table === "departments" && state.method === "select") {
          return { data: { id: "dept-eng", name: "Engineering" }, error: null };
        }
        if (state.table === "employee_department_assignment" && state.method === "select") {
          return {
            data: [{ employee_id: "emp-1" }, { employee_id: "emp-2" }],
            error: null,
          };
        }
        if (state.table === "employee_work_calendar_assignment" && state.method === "select") {
          return { data: null, error: null };
        }
        if (state.table === "employee_work_calendar_assignment" && state.method === "insert") {
          inserts.push({ table: state.table, payload: state.payload });
          return { data: { id: "cal-ins" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignCalendarTemplate([
      {
        scope: "department",
        target_code: "Engineering",
        template_name: "DEFAULT_5DAY",
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(inserts.length).toBe(2);
    expect(inserts.map((i) => i.payload.employee_id)).toEqual(["emp-1", "emp-2"]);
  });

  it("rejects unknown calendar template", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "work_calendar_templates" && state.method === "select") {
          return { data: [{ id: "tpl-1", code: "T1", name: "Template 1" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignCalendarTemplate([
      {
        scope: "employee",
        target_code: "EMP-101",
        template_name: "NONEXISTENT_TEMPLATE",
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Calendar template 'NONEXISTENT_TEMPLATE' not found");
  });

  it("blocks unauthorized callers without calendar.bulk_assign", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: calendar.bulk_assign required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignCalendarTemplate([
      {
        scope: "employee",
        target_code: "EMP-101",
        template_name: "DEFAULT_5DAY",
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Insufficient permissions");
  });
});
