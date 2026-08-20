import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  assertPermission,
  assertAnyPermission,
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
