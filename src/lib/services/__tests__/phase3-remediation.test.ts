import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  assertCallerIdentity: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
  writeAuditLogAction: vi.fn(),
  createNotificationAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  assertCallerIdentity: mocks.assertCallerIdentity,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (val: string) => (typeof val === "string" ? val.trim() : val),
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));
vi.mock("@/lib/actions/notifications", () => ({
  createNotificationAction: mocks.createNotificationAction,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { getSalaryDataAction } from "@/lib/actions/data";
import { updateCompanySettingsAction } from "@/lib/actions/settings";
import {
  finalizePayrollPeriodAction,
  reopenPayrollPeriodAction,
  publishPayrollPeriodAction,
} from "@/lib/actions/payroll";
import {
  rescindResignationAction,
  toggleClearanceAction,
  approveFfAction,
} from "@/lib/actions/offboarding";
import {
  manualCreditCompOffAction,
  revokeCompOffAction,
} from "@/lib/actions/permissions";

describe("Phase 3 Remediation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.assertCallerIdentity.mockResolvedValue(null);
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-hr",
      roles: ["hr"],
      permissions: ["salary.view.all", "salary.edit", "compoff.credit.manual", "compoff.revoke"],
    });
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
    mocks.createNotificationAction.mockResolvedValue({ success: true });
  });

  describe("Task 3.1: getSalaryDataAction targetEmployeeId filtering", () => {
    it("filters salary structures by targetEmployeeId when caller has salary.view.all", async () => {
      let queriedEmpId: string | undefined;
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "salary_components") {
            return { data: [{ id: "c1", code: "BASIC", name: "Basic" }], error: null };
          }
          if (state.table === "employee_salary_structures") {
            queriedEmpId = (state.filters.find((f: any) => (f.col || f.field) === "employee_id") as any)?.val ?? (state.filters.find((f: any) => (f.col || f.field) === "employee_id") as any)?.value;
            return {
              data: [
                { id: "ss-1", employee_id: "emp-target", annual_ctc: 1200000, effective_from: "2026-04-01" },
              ],
              error: null,
            };
          }
          if (state.table === "employees") {
            return {
              data: [
                { id: "emp-target", full_name: "Target Employee", employee_code: "EMP001" },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res = await getSalaryDataAction("emp-target");
      expect(res.employeeId).toBe("emp-target");
      expect(queriedEmpId).toBe("emp-target");
      expect(res.structures).toHaveLength(1);
      expect(res.employees).toHaveLength(1);
    });
  });

  describe("Task 3.2: Audit Logging in Settings, Payroll, and Offboarding", () => {
    it("logs audit record when updateCompanySettingsAction executes", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "company_settings" && state.method === "select") {
            return { data: { id: "cs-1", company_name: "Old Corp" }, error: null };
          }
          if (state.table === "company_settings" && state.method === "update") {
            return { data: { id: "cs-1" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const fd = new FormData();
      fd.append("companyName", "New Acme Corp");
      fd.append("timezone", "Asia/Kolkata");
      fd.append("currency", "INR");
      fd.append("currencySymbol", "₹");
      fd.append("managerSlaDays", "3");
      fd.append("noticePeriodDaysDefault", "60");

      const res = await updateCompanySettingsAction(fd);
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "settings.update",
          entityType: "company_settings",
          entityId: "cs-1",
        })
      );
    });

    it("logs audit record on finalizePayrollPeriodAction", async () => {
      const fake = createFakeSupabase({
        respond: () => ({ data: { id: "p-1" }, error: null }),
      });
      mocks.createClient.mockReturnValue(fake);

      const res: any = await finalizePayrollPeriodAction("p-1");
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payroll.finalize",
          entityType: "payroll_periods",
          entityId: "p-1",
        })
      );
    });

    it("logs audit record on publishPayrollPeriodAction", async () => {
      const fake = createFakeSupabase({
        respond: () => ({ data: { id: "p-1" }, error: null }),
      });
      mocks.createClient.mockReturnValue(fake);

      const res: any = await publishPayrollPeriodAction("p-1");
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payroll.publish",
          entityType: "payroll_periods",
          entityId: "p-1",
        })
      );
    });

    it("logs audit record on rescindResignationAction", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "separation_records") {
            return { data: { id: "sep-1", employee_id: "emp-1", status: "active" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res: any = await rescindResignationAction("sep-1");
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "separation.rescind",
          entityType: "separation_records",
          entityId: "sep-1",
        })
      );
    });

    it("logs audit record on toggleClearanceAction", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "ff_settlement_records") {
            return { data: { id: "ff-1", employee_id: "emp-1" }, error: null };
          }
          if (state.table === "ff_clearances") {
            return { data: { id: "clr-1" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res: any = await toggleClearanceAction("sep-1", "IT", true);
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ff.clearance_approved",
          entityType: "ff_clearances",
          entityId: "ff-1",
        })
      );
    });

    it("logs audit record on approveFfAction", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "ff_settlement_records") {
            return { data: { id: "ff-1", employee_id: "emp-other" }, error: null };
          }
          if (state.table === "separation_records") {
            return { data: { id: "sep-1", last_working_day: "2026-08-01" }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res: any = await approveFfAction("sep-1");
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ff.approve",
          entityType: "ff_settlement_records",
          entityId: "ff-1",
        })
      );
    });
  });

  describe("Task 3.3: Comp-Off Manual Credit & Revocation in permissions.ts", () => {
    it("successfully creates manual comp-off grant and records audit log", async () => {
      const insertedRows: any[] = [];
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "comp_off_grants" && state.method === "insert") {
            insertedRows.push(state.payload);
            return { data: { id: "cog-1", ...(state.payload as object) }, error: null };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res = await manualCreditCompOffAction("emp-101", 1.5, "Weekend production release support", 90);
      expect(res.success).toBe(true);
      expect(res.grant).toBeDefined();
      expect(insertedRows[0]).toMatchObject({
        employee_id: "emp-101",
        days_granted: 1.5,
        status: "approved",
      });
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "compoff.credit.manual",
          entityType: "comp_off_grants",
          entityId: "cog-1",
        })
      );
      expect(mocks.createNotificationAction).toHaveBeenCalledWith(
        "emp-101",
        "Comp-Off Credited",
        expect.stringContaining("Weekend production release support"),
        "/leave"
      );
    });

    it("successfully revokes unutilized comp-off grant and records audit log", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "comp_off_grants" && state.method === "select") {
            return {
              data: {
                id: "cog-1",
                employee_id: "emp-101",
                days_granted: 1.0,
                is_used: false,
                status: "approved",
              },
              error: null,
            };
          }
          if (state.table === "comp_off_grants" && state.method === "update") {
            return {
              data: {
                id: "cog-1",
                employee_id: "emp-101",
                days_granted: 1.0,
                status: "rejected",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res = await revokeCompOffAction("cog-1", "Grant issued in error");
      expect(res.success).toBe(true);
      expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "compoff.revoke",
          entityType: "comp_off_grants",
          entityId: "cog-1",
        })
      );
      expect(mocks.createNotificationAction).toHaveBeenCalledWith(
        "emp-101",
        "Comp-Off Revoked",
        expect.stringContaining("Grant issued in error"),
        "/leave"
      );
    });

    it("blocks revocation when comp-off grant is already utilized", async () => {
      const fake = createFakeSupabase({
        respond: (state) => {
          if (state.table === "comp_off_grants" && state.method === "select") {
            return {
              data: {
                id: "cog-1",
                employee_id: "emp-101",
                days_granted: 1.0,
                is_used: true,
                status: "approved",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res = await revokeCompOffAction("cog-1", "Attempt revoke");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already been utilized/i);
    });
  });

  describe("Task 3.4: Attachment Upload Security & Sanitization", () => {
    it("rejects uploads exceeding maximum 10MB limit", async () => {
      const { uploadAttachmentAction } = await import("@/lib/actions/attachments");
      const res = await uploadAttachmentAction(
        "general",
        "emp-1",
        "doc.pdf",
        11 * 1024 * 1024, // 11MB
        "application/pdf",
        "uploads/doc.pdf"
      );
      expect(res).toEqual({ error: "File size exceeds maximum allowed limit of 10MB." });
    });

    it("rejects invalid or unauthorized MIME types", async () => {
      const { uploadAttachmentAction } = await import("@/lib/actions/attachments");
      const res: any = await uploadAttachmentAction(
        "general",
        "emp-1",
        "script.sh",
        1024,
        "application/x-sh",
        "uploads/script.sh"
      );
      expect(res.error).toContain("Unsupported or invalid file MIME type");
    });

    it("rejects path traversal in filename or storage path", async () => {
      const { uploadAttachmentAction } = await import("@/lib/actions/attachments");
      const res: any = await uploadAttachmentAction(
        "general",
        "emp-1",
        "../../evil.pdf",
        1024,
        "application/pdf",
        "uploads/../evil.pdf"
      );
      expect(res.error).toContain("Invalid storage path");
    });
  });

  describe("Task 3.5: Structured Logger Redaction & PII / Financial Masking", () => {
    it("redacts sensitive compensation, token, and PII fields in metadata", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const { logger } = await import("@/lib/utils/logger");

      logger.info("payroll.calculation", {
        actorId: "emp-admin",
        metadata: {
          salary: 150000,
          annual_ctc: 1800000,
          pan: "ABCDE1234F",
          password: "secretpassword123",
          token: "eyJhbGciOi...",
          safeField: "Standard Log Metadata",
        },
      });

      expect(infoSpy).toHaveBeenCalled();
      const loggedEntry = JSON.parse(infoSpy.mock.calls[0][0]);
      expect(loggedEntry.metadata.salary).toBe("[REDACTED]");
      expect(loggedEntry.metadata.annual_ctc).toBe("[REDACTED]");
      expect(loggedEntry.metadata.pan).toBe("[REDACTED]");
      expect(loggedEntry.metadata.password).toBe("[REDACTED]");
      expect(loggedEntry.metadata.token).toBe("[REDACTED]");
      expect(loggedEntry.metadata.safeField).toBe("Standard Log Metadata");

      infoSpy.mockRestore();
    });
  });

  describe("Task 3.6: Idempotency Key Handling & Duplicate Detection", () => {
    it("detects duplicate idempotency key registration", async () => {
      const { assertIdempotencyKey } = await import("@/lib/services/idempotency");
      const fake = createFakeSupabase({
        rpcs: {
          register_idempotency_key: () => ({
            data: null,
            error: { code: "23505", message: "Duplicate request detected for idempotency key" },
          }),
        },
      });
      mocks.createClient.mockReturnValue(fake);

      const res = await assertIdempotencyKey("test-key-123", "payroll_run");
      expect(res.isDuplicate).toBe(true);
      expect(res.error).toContain("Duplicate request detected");
    });
  });
});
