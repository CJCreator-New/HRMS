import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (s: string) => s.trim(),
}));

import {
  getNotificationPreferencesAction,
  updateNotificationPreferencesAction,
} from "@/lib/actions/notifications";

describe("Notification Preferences Action (P2-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-pref-1",
      email: "user@company.com",
    });
  });

  it("returns default preferences when no existing records are stored", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "notification_preferences") {
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getNotificationPreferencesAction();
    expect(res.success).toBe(true);
    expect(res.preferences.length).toBe(5);
    expect(res.preferences[0]).toEqual({
      module: "leaves",
      emailEnabled: true,
      inAppEnabled: true,
    });
  });

  it("updates preferences via upsert", async () => {
    let upsertPayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "notification_preferences" && state.method === "upsert") {
          upsertPayload = state.payload;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await updateNotificationPreferencesAction([
      { module: "leaves", emailEnabled: false, inAppEnabled: true },
      { module: "payroll", emailEnabled: true, inAppEnabled: false },
    ]);

    expect(res.success).toBe(true);
    expect(upsertPayload).toHaveLength(2);
    expect(upsertPayload[0]).toMatchObject({
      employee_id: "emp-pref-1",
      module: "leaves",
      email_enabled: false,
      in_app_enabled: true,
    });
  });
});
