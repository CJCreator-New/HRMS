// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { LeaveWorkspace } from "../LeaveWorkspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/shared/Toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("LeaveWorkspace Component", () => {
  it("renders leave allocations and apply form", () => {
    render(
      <LeaveWorkspace
        initialAllocations={[
          {
            type_code: "CL",
            type_name: "Casual Leave",
            allocated: 12,
            used: 1,
            pending: 0,
            balance: 11,
            is_sandwich_enabled: false,
          },
        ]}
        initialRequests={[]}
        employeeId="emp-1"
        canApprove={false}
        isHrAdmin={false}
      />
    );
    expect(screen.getByText("Casual Leave")).toBeDefined();
    expect(screen.getByText("CL")).toBeDefined();
    expect(screen.getByText("Apply for Leave")).toBeDefined();
  });

  it("masks maternity and paternity leave types and reasons in manager view", () => {
    render(
      <LeaveWorkspace
        initialAllocations={[]}
        initialRequests={[
          {
            id: "lr-1",
            employee_id: "emp-2",
            employee_name: "Jane Doe",
            leave_type_code: "MATERNITY",
            leave_type_name: "Maternity Leave",
            start_date: "2026-09-01",
            end_date: "2026-11-30",
            total_days: 90,
            reason: "Childbirth delivery",
            status: "pending",
            duration_type: "full_day",
            approver_name: "Manager",
          },
          {
            id: "lr-2",
            employee_id: "emp-3",
            employee_name: "John Smith",
            leave_type_code: "PATERNITY",
            leave_type_name: "Paternity Leave",
            start_date: "2026-09-05",
            end_date: "2026-09-15",
            total_days: 10,
            reason: "Newborn child care",
            status: "pending",
            duration_type: "full_day",
            approver_name: "Manager",
          },
        ]}
        employeeId="emp-1"
        canApprove={true}
        isHrAdmin={false}
      />
    );

    // Manager default view: masked to "Parental Leave" and "Medical Leave (Confidential Reason Masked)"
    expect(screen.getAllByText("Parental Leave")).toHaveLength(2);
    expect(screen.getAllByText("Medical Leave (Confidential Reason Masked)")).toHaveLength(2);
    expect(screen.queryByText("Maternity Leave")).toBeNull();
    expect(screen.queryByText("Paternity Leave")).toBeNull();
    expect(screen.queryByText("Childbirth delivery")).toBeNull();
    expect(screen.queryByText("Newborn child care")).toBeNull();
  });

  it("renders Withdraw button on pending leave requests", () => {
    render(
      <LeaveWorkspace
        initialAllocations={[]}
        initialRequests={[
          {
            id: "lr-1",
            employee_id: "emp-1",
            employee_name: "Jane Doe",
            leave_type_code: "CL",
            leave_type_name: "Casual Leave",
            start_date: "2026-09-01",
            end_date: "2026-09-02",
            total_days: 2,
            reason: "Personal work",
            status: "pending",
            duration_type: "full_day",
            approver_name: "Manager",
          },
        ]}
        employeeId="emp-1"
        canApprove={false}
        isHrAdmin={false}
      />
    );

    expect(screen.getByRole("button", { name: /withdraw/i })).toBeDefined();
  });
});
