import { describe, it, expect } from "vitest";
import {
  mapSeparationToViewModel,
  mapEmployeeToSearchResult,
  mapApprovalRowToItem,
  resolveApprovalModule,
  APPROVAL_TABLE_MAP,
  MODULE_APPROVE_PERMS,
} from "../mappers";

describe("mapSeparationToViewModel", () => {
  it("maps a fully populated separation row", () => {
    const vm = mapSeparationToViewModel({
      id: "s1",
      employees: { employee_code: "E1001", full_name: "Alice Doe" },
      separation_type: "resignation",
      resignation_date: "2026-08-01",
      notice_period_days: 30,
      last_working_day: "2026-08-31",
      status: "offboarded",
      ff_settlement_records: {
        status: "approved",
        is_stale: false,
        leave_encashment_amount: 5000,
        asset_recovery_amount: 1000,
        net_settlement_amount: 40000,
        ff_clearances: [
          { department_name: "IT", is_cleared: true },
          { department_name: "Finance", is_cleared: false },
        ],
      },
    });

    expect(vm.id).toBe("s1");
    expect(vm.employee_code).toBe("E1001");
    expect(vm.employee_name).toBe("Alice Doe");
    expect(vm.type).toBe("resignation");
    expect(vm.resignation_date).toBe("2026-08-01");
    expect(vm.notice_days).toBe(30);
    expect(vm.last_working_day).toBe("2026-08-31");
    expect(vm.status).toBe("completed"); // offboarded → completed
    expect(vm.ff_status).toBe("approved");
    expect(vm.encashment_amount).toBe(5000);
    expect(vm.asset_recovery_amount).toBe(1000);
    expect(vm.net_settlement).toBe(40000);
    expect(vm.clearance).toEqual({
      it: true,
      finance: false,
      admin: false,
      hr: false,
    });
  });

  it("applies defaults for a sparse row", () => {
    const vm = mapSeparationToViewModel({ id: "s2" });
    expect(vm.employee_code).toBe("");
    expect(vm.employee_name).toBe("");
    expect(vm.type).toBe("resignation");
    expect(vm.notice_days).toBe(30);
    expect(vm.status).toBe("active");
    expect(vm.ff_status).toBe("draft");
    expect(vm.clearance).toEqual({ it: false, finance: false, admin: false, hr: false });
  });

  it("falls back to created_at for resignation date", () => {
    const vm = mapSeparationToViewModel({
      id: "s3",
      created_at: "2026-07-15T10:30:00.000Z",
    });
    expect(vm.resignation_date).toBe("2026-07-15");
  });
});

describe("mapEmployeeToSearchResult", () => {
  it("builds the search result shape", () => {
    const result = mapEmployeeToSearchResult({
      id: "e1",
      full_name: "Bob Smith",
      employee_code: "E2001",
      department: "Engineering",
      status: "active",
    });
    expect(result).toEqual({
      id: "e1",
      type: "employee",
      label: "Bob Smith",
      sub: "E2001 · Engineering",
      href: "/employees",
      status: "active",
    });
  });

  it("handles missing department", () => {
    const result = mapEmployeeToSearchResult({
      id: "e2",
      full_name: "Cara",
      employee_code: "E2002",
    });
    expect(result.sub).toBe("E2002 · ");
  });
});

describe("approvals mapping", () => {
  it("maps approval rows to the unified view model", () => {
    const item = mapApprovalRowToItem({
      request_id: "r1",
      request_type: "leave_request",
      employee_name: "Dana",
      item_name: "CL 2 days",
      created_at: "2026-08-01T09:00:00.000Z",
      status: "pending",
    });
    expect(item).toEqual({
      id: "r1",
      module: "leave",
      employee_name: "Dana",
      summary: "CL 2 days",
      submitted_date: "2026-08-01",
      amount_or_duration: "CL 2 days",
      status: "pending",
    });
  });

  it("falls back to a default module", () => {
    expect(resolveApprovalModule("unknown_type")).toBe("leave");
    expect(resolveApprovalModule("", "reimbursement")).toBe("reimbursement");
  });

  it("maps every module to a target table and permission set", () => {
    for (const mod of [
      "leave",
      "attendance",
      "reimbursement",
      "encashment",
      "offboarding",
      "permissions",
      "compoff",
    ]) {
      expect(APPROVAL_TABLE_MAP[mod], mod).toBeTruthy();
      expect(MODULE_APPROVE_PERMS[mod], mod).toBeTruthy();
    }
  });
});
