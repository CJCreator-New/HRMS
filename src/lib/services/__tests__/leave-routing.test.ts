import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { resolveLeaveApprover } from "../leave-routing";

describe("resolveLeaveApprover", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("routes HR applicants to the alternate HR approver (FR §1.4)", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_settings" && state.method === "select") {
          return { data: { alternate_hr_approver_id: "hr-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await resolveLeaveApprover("hr-1", true);
    expect(result).toEqual({ approverId: "hr-2", stage: "alternate_hr" });
  });

  it("falls back to a system admin when the alternate approver is the applicant", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_settings" && state.method === "select") {
          return { data: { alternate_hr_approver_id: "hr-1" }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "select") {
          return { data: { employee_id: "sa-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await resolveLeaveApprover("hr-1", true);
    expect(result).toEqual({ approverId: "sa-1", stage: "system_admin" });
  });

  it("falls back to system admin when no alternate approver is configured", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_settings" && state.method === "select") {
          return { data: { alternate_hr_approver_id: null }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "select") {
          return { data: { employee_id: "sa-9" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await resolveLeaveApprover("hr-1", true);
    expect(result).toEqual({ approverId: "sa-9", stage: "system_admin" });
  });

  it("routes non-HR applicants to their current manager", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_manager_assignment" && state.method === "select") {
          return { data: { manager_id: "mgr-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await resolveLeaveApprover("emp-1", false);
    expect(result).toEqual({ approverId: "mgr-1", stage: "manager" });
  });

  it("returns a null approver when the applicant has no manager", async () => {
    const fake = createFakeSupabase({
      respond: () => ({ data: null, error: null }),
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await resolveLeaveApprover("emp-1", false);
    expect(result).toEqual({ approverId: null, stage: "manager" });
  });
});
