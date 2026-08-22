import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
  createNotificationAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (val: string) => (typeof val === "string" ? val.trim() : val),
}));
vi.mock("@/lib/actions/notifications", () => ({
  createNotificationAction: mocks.createNotificationAction,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { getPendingApprovalsCountAction } from "@/lib/actions/approvals";
import { applyShortPermissionAction } from "@/lib/actions/permissions";
import { globalSearchAction } from "@/lib/actions/data";
import { updateEmployeeAssignmentAction } from "@/lib/actions/employees";
import { assignCalendarAction } from "@/lib/actions/calendar";
import { writeAuditLogAction, getAuditLogsAction } from "@/lib/actions/audit";
import { uploadAttachmentAction, MAX_FILE_SIZE_BYTES } from "@/lib/actions/attachments";
import { approveLeaveAction } from "@/lib/actions/leave";
import { approveReimbursementClaimAction } from "@/lib/actions/reimbursements";

describe("Remediation Regression Suite: Schema Mismatches (TEST-SCHEMA-001 to 005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.assertPermission.mockResolvedValue(null);
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.createNotificationAction.mockResolvedValue({ success: true });
  });

  it("TEST-SCHEMA-001: getPendingApprovalsCountAction queries employee_current_manager/employee_manager_assignment, never employees.manager_id", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      userId: "u-mgr",
      employeeId: "emp-mgr-1",
      roles: ["manager"],
    });

    const queries: Array<{ table: string; method: string }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        queries.push({ table: state.table, method: state.method });
        if (state.table === "employee_current_manager") {
          return { data: [{ employee_id: "report-1" }, { employee_id: "report-2" }], error: null };
        }
        if (state.table === "v_pending_approvals_dashboard") {
          return { count: 3, data: null, error: null };
        }
        return { data: [], error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getPendingApprovalsCountAction("manager");
    expect(res).toEqual({ count: 3 });

    // Assert that 'employees' table was NOT queried for manager_id
    const queriedEmployeesForManager = queries.some((q) => q.table === "employees");
    expect(queriedEmployeesForManager).toBe(false);

    // Assert employee_current_manager or employee_manager_assignment was used
    const queriedAssignment = queries.some((q) => q.table === "employee_current_manager" || q.table === "employee_manager_assignment");
    expect(queriedAssignment).toBe(true);
  });

  it("TEST-SCHEMA-002: applyShortPermissionAction resolves manager from employee_manager_assignment", async () => {
    let insertedApproverId: string | null = null;
    const fake = createFakeSupabase({
      user: { id: "auth-emp-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1", full_name: "Test Employee" }, error: null };
        }
        if (state.table === "employee_manager_assignment" && state.method === "select") {
          return { data: { manager_id: "mgr-456" }, error: null };
        }
        if (state.table === "permission_requests" && state.method === "select") {
          return { data: [], error: null };
        }
        if (state.table === "permission_requests" && state.method === "insert") {
          insertedApproverId = (state.payload as any)?.approver_id;
          return { data: { id: "perm-1", ...(state.payload as any) }, error: null };
        }
        if (state.table === "notifications") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyShortPermissionAction(
      "2026-08-25",
      "10:00",
      "11:30",
      "Doctor appointment"
    );

    expect(res.success).toBe(true);
    expect(insertedApproverId).toBe("mgr-456");
  });

  it("TEST-SCHEMA-003: globalSearchAction does not query non-existent department/designation on employees table", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      userId: "u-mgr",
      employeeId: "emp-mgr-1",
      roles: ["manager"],
    });

    let selectedCols: string = "";
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_manager_assignment") {
          return { data: [{ employee_id: "emp-report-1" }], error: null };
        }
        if (state.table === "employees" && state.method === "select") {
          selectedCols = state.selectCols || "";
          return {
            data: [
              { id: "emp-report-1", full_name: "Report One", employee_code: "EMP-001", email: "r1@co.com", status: "active" },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await globalSearchAction("Report");
    expect(res.results).toBeDefined();
    expect(res.results.length).toBe(1);
    expect(res.results[0].label).toBe("Report One");

    // Must NOT select non-existent department or designation directly from employees table
    expect(selectedCols).not.toContain("department,");
    expect(selectedCols).not.toContain("designation,");
  });
});

describe("Remediation Regression Suite: Effective-Dated Mutations (TEST-ASSIGN-001 to 006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("TEST-ASSIGN-001: updateEmployeeAssignmentAction calls atomic RPC update_employee_department_assignment", async () => {
    let rpcArgs: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        update_employee_department_assignment: (args) => {
          rpcArgs = args;
          return { data: "dept-assign-new-id", error: null };
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await updateEmployeeAssignmentAction("emp-1", "dept-new", undefined, undefined);
    expect(res).toEqual({ success: true });
    expect(rpcArgs).toEqual({
      p_employee_id: "emp-1",
      p_department_id: "dept-new",
      p_effective_from: expect.any(String),
    });
  });

  it("TEST-ASSIGN-002: assignCalendarAction calls atomic RPC update_employee_work_calendar_assignment", async () => {
    let rpcArgs: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        update_employee_work_calendar_assignment: (args) => {
          rpcArgs = args;
          return { data: "cal-assign-new-id", error: null };
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await assignCalendarAction("emp-1", "cal-tmpl-2", "2026-09-01");
    expect(res).toEqual({ success: true });
    expect(rpcArgs).toEqual({
      p_employee_id: "emp-1",
      p_calendar_template_id: "cal-tmpl-2",
      p_effective_from: "2026-09-01",
    });
  });
});

describe("Remediation Regression Suite: Audit Logger (TEST-AUDIT-001 to 005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue(null);
  });

  it("TEST-AUDIT-001: writeAuditLogAction records audit log even when caller does NOT have audit.view permission", async () => {
    // Caller does NOT have audit.view permission
    mocks.assertPermission.mockImplementation(async (code: string) => {
      if (code === "audit.view") return { error: "Insufficient permissions: audit.view required" };
      return null;
    });

    let insertedLog: any = null;
    const fake = createFakeSupabase({
      user: { id: "auth-mgr-1" },
      respond: (state) => {
        if (state.table === "employees") {
          return { data: { id: "emp-mgr", full_name: "Manager User" }, error: null };
        }
        if (state.table === "audit_logs" && state.method === "insert") {
          insertedLog = state.payload;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await writeAuditLogAction({
      action: "payroll.execute",
      entityType: "payroll_period",
      entityId: "per-123",
      newValues: { status: "validated" },
    });

    expect(res).toEqual({ success: true });
    expect(insertedLog).toBeDefined();
    expect(insertedLog.action).toBe("payroll.execute");
    expect(insertedLog.actor_name).toBe("Manager User");
  });

  it("TEST-AUDIT-002: getAuditLogsAction strictly enforces audit.view permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: audit.view required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await getAuditLogsAction();
    expect(res.error).toBeDefined();
    expect(res.logs).toEqual([]);
  });
});

describe("Remediation Regression Suite: File Upload Security (TEST-FILE-001 to 006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("TEST-FILE-001: Rejects file exceeding 10MB limit", async () => {
    const res = await uploadAttachmentAction(
      "employee_document",
      "emp-1",
      "large_file.pdf",
      MAX_FILE_SIZE_BYTES + 1,
      "application/pdf",
      "uploads/large_file.pdf"
    );
    expect(res).toEqual({ error: "File size exceeds maximum allowed limit of 10MB." });
  });

  it("TEST-FILE-002: Rejects forbidden executable or script MIME type", async () => {
    const res: any = await uploadAttachmentAction(
      "employee_document",
      "emp-1",
      "malicious.exe",
      1024,
      "application/x-msdownload",
      "uploads/malicious.exe"
    );
    expect(res.error).toContain("Unsupported or invalid file MIME type");
  });

  it("TEST-FILE-003: Rejects disallowed file extension", async () => {
    const res: any = await uploadAttachmentAction(
      "employee_document",
      "emp-1",
      "malicious.sh",
      1024,
      "application/pdf", // spoofed MIME with dangerous extension
      "uploads/malicious.sh"
    );
    expect(res.error).toContain("Unsupported or invalid file extension");
  });

  it("TEST-FILE-004: Rejects path traversal in storage path", async () => {
    const res = await uploadAttachmentAction(
      "employee_document",
      "emp-1",
      "valid_resume.pdf",
      1024,
      "application/pdf",
      "../../etc/passwd"
    );
    expect(res).toEqual({ error: "Invalid storage path." });
  });

  it("TEST-FILE-005: Sets initial scan_status to 'pending' on valid upload", async () => {
    let insertedAttachment: any = null;
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "document_attachments" && state.method === "insert") {
          insertedAttachment = state.payload;
          return { data: { id: "att-1", ...((state.payload as any) || {}) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await uploadAttachmentAction(
      "expense_receipt",
      "rec-1",
      "receipt.pdf",
      50000,
      "application/pdf",
      "receipts/rec-1/receipt.pdf"
    );

    expect(res.success).toBe(true);
    expect(insertedAttachment).toBeDefined();
    expect(insertedAttachment.scan_status).toBe("pending");
  });
});

describe("Remediation Regression Suite: Concurrency Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.assertPermission.mockResolvedValue(null);
    mocks.createNotificationAction.mockResolvedValue({ success: true });
  });

  it("TEST-CONCURRENCY-001: Leave approval fails safely if request is already decided", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      userId: "u-mgr",
      employeeId: "mgr-1",
      roles: ["manager"],
    });

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_requests" && state.method === "select") {
          return {
            data: { id: "req-1", employee_id: "emp-applicant", current_approver_id: "mgr-1", status: "pending" },
            error: null,
          };
        }
        if (state.table === "leave_requests" && state.method === "update") {
          // Simulate race condition where update returns 0 rows (already modified by another user)
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await approveLeaveAction("req-1", "mgr-1", "Approved");
    expect(res.error).toContain("Leave request is currently being processed or has already been decided");
  });

  it("TEST-CONCURRENCY-002: Reimbursement approval fails safely if claim was already updated", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      userId: "u-mgr",
      employeeId: "mgr-1",
      roles: ["manager"],
    });

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "reimbursement_claims" && state.method === "select") {
          return {
            data: {
              id: "claim-1",
              employee_id: "emp-applicant",
              status: "submitted",
              requested_amount: 500,
              reimbursement_categories: { approval_route: "manager_only" },
            },
            error: null,
          };
        }
        if (state.table === "reimbursement_claims" && state.method === "update") {
          // Simulate race condition
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await approveReimbursementClaimAction("claim-1", "approved", 500);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Claim was already updated by another approver");
  });
});
