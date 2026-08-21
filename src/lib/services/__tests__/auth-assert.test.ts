import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  assertPermission,
  assertAnyPermission,
  assertCallerIdentity,
} from "@/lib/auth/assertPermission";

describe("assertPermission", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns null when the user holds the permission", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      rpcs: {
        has_permission: () => ({ data: true, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(assertPermission("leave.apply.self")).resolves.toBeNull();
    expect(fake.rpc).toHaveBeenCalledWith("has_permission", { perm_code: "leave.apply.self" });
  });

  it("returns an error when the user lacks the permission", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      rpcs: {
        has_permission: () => ({ data: false, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(assertPermission("payroll.run")).resolves.toEqual({
      error: "Insufficient permissions: payroll.run required",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(assertPermission("payroll.run")).resolves.toEqual({
      error: "Unauthenticated",
    });
  });
});

describe("assertAnyPermission", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("passes when any listed permission is held", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      rpcs: {
        has_permission: (args) => ({
          data: (args as { perm_code: string }).perm_code === "leave.approve.hr",
          error: null,
        }),
        has_any_permission: (args) => ({
          data: (args as { perm_codes: string[] }).perm_codes?.includes("leave.approve.hr"),
          error: null,
        }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(
      assertAnyPermission(["leave.approve.manager", "leave.approve.hr"])
    ).resolves.toBeNull();
  });

  it("fails when none of the permissions are held", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      rpcs: {
        has_permission: () => ({ data: false, error: null }),
        has_any_permission: () => ({ data: false, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(assertAnyPermission(["a.x", "b.y"])).resolves.toEqual({
      error: "Insufficient permissions: one of [a.x, b.y] required",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(assertAnyPermission(["a.x"])).resolves.toEqual({
      error: "Unauthenticated",
    });
  });
});

describe("assertCallerIdentity", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("rejects unauthenticated callers when no session exists", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await assertCallerIdentity("emp-1");
    expect(res).toEqual({
      error: "Unauthenticated: Valid session required",
    });
  });

  it("passes when caller employee ID matches target employee ID", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees") {
          return { data: { id: "emp-1", email: "user@example.com" } };
        }
        if (state.table === "employee_roles") {
          return { data: [{ roles: { code: "employee" } }] };
        }
        return { data: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await assertCallerIdentity("emp-1");
    expect(res).toBeNull();
  });

  it("rejects when caller does not match target and holds no proxy permissions", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees") {
          return { data: { id: "emp-1", email: "user@example.com" } };
        }
        if (state.table === "employee_roles") {
          return { data: [{ roles: { code: "employee" } }] };
        }
        return { data: null };
      },
      rpcs: {
        has_any_permission: () => ({ data: false, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await assertCallerIdentity("emp-2", ["employee.edit"]);
    expect(res).toEqual({
      error: "Forbidden: You cannot perform this action on behalf of another employee",
    });
  });

  it("passes when caller holds an authorized proxy permission", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees") {
          return { data: { id: "emp-admin", email: "admin@example.com" } };
        }
        if (state.table === "employee_roles") {
          return { data: [{ roles: { code: "hr" } }] };
        }
        return { data: null };
      },
      rpcs: {
        has_any_permission: (args) => ({
          data: (args as { perm_codes: string[] }).perm_codes?.includes("employee.edit"),
          error: null,
        }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await assertCallerIdentity("emp-2", ["employee.edit"]);
    expect(res).toBeNull();
  });
});
