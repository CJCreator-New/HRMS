import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: vi.fn(async () => null),
  assertAnyPermission: vi.fn(async () => null),
  getAuthenticatedCaller: vi.fn(async () => ({
    employeeId: "emp-test",
    email: "sysadmin@company.com",
    roles: ["system_admin"],
  })),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  globalSearchAction,
  getOffboardingDataAction,
  getStatutoryDataAction,
  getCalendarDataAction,
} from "@/lib/actions/data";

describe("globalSearchAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("short-circuits queries shorter than 2 characters", async () => {
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    await expect(globalSearchAction("a")).resolves.toEqual({ results: [] });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("returns RPC results when available", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        search_global: () => ({ data: [{ id: "e1", type: "employee", label: "Alice" }], error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await globalSearchAction("ali");
    expect(res.results).toEqual([{ id: "e1", type: "employee", label: "Alice" }]);
  });

  it("falls back to a direct employee search mapping on RPC failure", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        search_global: () => ({ data: null, error: { message: "no index" } }),
      },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: [
              { id: "e1", full_name: "Alice", employee_code: "E1", department: "Eng", status: "active" },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await globalSearchAction("ali");
    expect(res.results).toEqual([
      {
        id: "e1",
        type: "employee",
        label: "Alice",
        sub: "E1 · Eng",
        href: "/employees",
        status: "active",
      },
    ]);
  });
});

describe("getOffboardingDataAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("maps raw separation rows through the view-model mapper", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "separation_records" && state.method === "select") {
          return {
            data: [{
              id: "s1",
              employees: { full_name: "Alice", employee_code: "E1" },
              separation_type: "resignation",
              status: "offboarded",
              ff_settlement_records: {
                status: "approved",
                ff_clearances: [{ department_name: "IT", is_cleared: true }],
              },
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await getOffboardingDataAction();
    expect(res.separations[0]).toMatchObject({
      id: "s1",
      employee_name: "Alice",
      status: "completed",
      ff_status: "approved",
      clearance: { it: true, finance: false, admin: false, hr: false },
    });
  });

  it("returns an empty list on error", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "separation_records" && state.method === "select") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getOffboardingDataAction()).resolves.toEqual({ separations: [] });
  });
});

describe("getStatutoryDataAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns statutory profiles", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "statutory_profiles" && state.method === "select") {
          return { data: [{ id: "sp-1", pt_state: "Karnataka" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getStatutoryDataAction()).resolves.toEqual({
      profiles: [{ id: "sp-1", pt_state: "Karnataka" }],
    });
  });
});

describe("getCalendarDataAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns holidays, templates and the default template id", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "holidays" && state.method === "select") {
          return { data: [{ id: "h1", date: "2026-08-15" }], error: null };
        }
        if (state.table === "work_calendar_templates" && state.method === "select") {
          return { data: [{ id: "tpl-1", name: "Default" }], error: null };
        }
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "employee_optional_holiday_selections" && state.method === "select") {
          return { data: [{ holiday_id: "h1" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await getCalendarDataAction();
    expect(res.holidays).toHaveLength(1);
    expect(res.templates).toHaveLength(1);
    expect(res.defaultTemplateId).toBe("tpl-1");
    expect(res.selectedOptional).toEqual(["h1"]);
  });
});
