import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { getSessionUser, getCurrentEmployee } from "@/lib/auth/session";

describe("getSessionUser", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns the authenticated user", async () => {
    const fake = createFakeSupabase({ user: { id: "auth-1" } });
    mocks.createClient.mockReturnValue(fake);

    await expect(getSessionUser()).resolves.toEqual({ id: "auth-1" });
  });

  it("returns null when unauthenticated", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("getCurrentEmployee", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns null without a session", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getCurrentEmployee()).resolves.toBeNull();
  });

  it("returns the employee profile with roles", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: {
              id: "emp-1",
              full_name: "Alice",
              employee_roles: [{ roles: { code: "employee", name: "Employee" } }],
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const emp = await getCurrentEmployee();
    expect(emp?.id).toBe("emp-1");
    expect(emp?.employee_roles).toHaveLength(1);
  });
});
