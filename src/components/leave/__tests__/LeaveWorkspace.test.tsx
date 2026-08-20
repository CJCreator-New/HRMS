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
});
