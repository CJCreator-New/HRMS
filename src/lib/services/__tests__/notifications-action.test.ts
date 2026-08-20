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
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  createNotificationAction,
} from "@/lib/actions/notifications";

describe("getNotificationsAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns empty when unauthenticated", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getNotificationsAction()).resolves.toEqual({ notifications: [], unread: 0 });
  });

  it("counts unread notifications for the current employee", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "inbox_notifications" && state.method === "select") {
          return {
            data: [
              { id: "n1", is_read: false },
              { id: "n2", is_read: true },
              { id: "n3", is_read: false },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getNotificationsAction();
    expect(res.notifications).toHaveLength(3);
    expect(res.unread).toBe(2);
  });
});

describe("markNotificationReadAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("marks a single notification read", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "inbox_notifications" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await markNotificationReadAction("n1");
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({ is_read: true });
  });

  it("blocks users without the permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: employee.view.self required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await markNotificationReadAction("n1");
    expect(res).toEqual({ error: "Insufficient permissions: employee.view.self required" });
  });
});

describe("markAllNotificationsReadAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("marks all of the employee's notifications read", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "inbox_notifications" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await markAllNotificationsReadAction();
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({ is_read: true });
  });

  it("returns Unauthenticated without a session", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await markAllNotificationsReadAction();
    expect(res).toEqual({ error: "Unauthenticated" });
  });
});

describe("createNotificationAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("inserts a notification with the given fields", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "inbox_notifications" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await createNotificationAction("emp-2", "Approved", "Your leave is approved", "/leave");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toEqual({
      recipient_id: "emp-2",
      title: "Approved",
      message: "Your leave is approved",
      action_url: "/leave",
    });
  });

  it("returns the insert error", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "inbox_notifications" && state.method === "insert") {
          return { data: null, error: { message: "row too big" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await createNotificationAction("emp-2", "T", "M");
    expect(res).toEqual({ error: "row too big" });
  });

  it("swallows thrown client errors", async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error("boom");
    });

    const res = await createNotificationAction("emp-2", "T", "M");
    expect(res).toEqual({ error: "boom" });
  });
});
