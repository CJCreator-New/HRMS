import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
}));
vi.mock("@/lib/actions/notifications", () => ({
  createNotificationAction: mocks.createNotification,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { applyShortPermissionAction } from "@/lib/actions/permissions";

describe("applyShortPermissionAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.createNotification.mockReset();
    mocks.createNotification.mockResolvedValue({ success: true });
  });

  function fakeWith(overrides: { managerId?: string | null } = {}) {
    return createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: { id: "emp-1", full_name: "Alice", manager_id: overrides.managerId === undefined ? "mgr-1" : overrides.managerId },
            error: null,
          };
        }
        if (state.table === "permission_requests" && state.method === "insert") {
          return { data: { id: "p1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
  }

  it("submits a valid permission with duration and notifies the manager", async () => {
    const fake = fakeWith();
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyShortPermissionAction("2026-08-20", "10:00", "11:30", "Doctor visit");

    expect(res.success).toBe(true);
    expect(res.record).toMatchObject({
      employee_id: "emp-1",
      duration_minutes: 90,
      status: "pending",
      approver_id: "mgr-1",
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      "mgr-1",
      "New Permission Request",
      expect.stringContaining("90-minute"),
      "/approvals"
    );
  });

  it("rejects requests longer than the 2-hour cap", async () => {
    const fake = fakeWith();
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyShortPermissionAction("2026-08-20", "09:00", "12:00", "Long break");
    expect(res).toEqual({ error: "Short permission requests are limited to maximum 2 hours (120 minutes)." });
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("rejects requests where end time precedes start time", async () => {
    const fake = fakeWith();
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyShortPermissionAction("2026-08-20", "11:00", "10:00", "Oops");
    expect(res.error).toContain("2 hours");
  });

  it("proceeds without a manager notification when no manager is assigned", async () => {
    const fake = fakeWith({ managerId: null });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyShortPermissionAction("2026-08-20", "10:00", "10:30", "Errand");
    expect(res.success).toBe(true);
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("blocks unauthenticated users", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Unauthenticated" });
    const fake = fakeWith();
    mocks.createClient.mockReturnValue(fake);

    const res = await applyShortPermissionAction("2026-08-20", "10:00", "10:30", "Errand");
    expect(res).toEqual({ error: "Unauthenticated" });
  });
});
