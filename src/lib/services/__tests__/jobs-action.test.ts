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
  getScheduledJobLogsAction,
  runScheduledJobAction,
} from "@/lib/actions/jobs";

describe("getScheduledJobLogsAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns recent job logs", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "scheduled_job_logs" && state.method === "select") {
          return { data: [{ id: "j1", job_name: "accrue" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getScheduledJobLogsAction()).resolves.toEqual({
      logs: [{ id: "j1", job_name: "accrue" }],
    });
  });

  it("returns an empty list on error", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "scheduled_job_logs" && state.method === "select") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getScheduledJobLogsAction()).resolves.toEqual({
      logs: [],
      error: "boom",
    });
  });
});

describe("runScheduledJobAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("runs the earned-leave accrual RPC for matching job names", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        job_accrue_monthly_earned_leave: () => ({ data: null, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await runScheduledJobAction("accrue_monthly_earned_leave");
    expect(res.success).toBe(true);
    expect(fake.rpc).toHaveBeenCalledWith("job_accrue_monthly_earned_leave");
  });

  it("runs the comp-off expiry RPC for matching job names", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        job_expire_comp_off_grants: () => ({ data: null, error: null }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await runScheduledJobAction("expire_comp_off_grants");
    expect(res.success).toBe(true);
    expect(fake.rpc).toHaveBeenCalledWith("job_expire_comp_off_grants");
  });

  it("logs manual jobs that have no RPC", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "scheduled_job_logs" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await runScheduledJobAction("manual_review");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      job_name: "manual_review",
      status: "success",
      records_processed_count: 1,
    });
  });

  it("surfaces RPC errors", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        job_accrue_monthly_earned_leave: () => ({ data: null, error: { message: "locked" } }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await runScheduledJobAction("accrue_monthly_earned_leave");
    expect(res).toEqual({ success: false, error: "locked" });
  });
});
