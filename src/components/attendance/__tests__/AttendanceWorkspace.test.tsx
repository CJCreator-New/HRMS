import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AttendanceWorkspace } from "../AttendanceWorkspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("AttendanceWorkspace Component", () => {
  it("renders attendance logs and correction sections", () => {
    render(
      <AttendanceWorkspace
        initialRecords={[
          {
            id: "att-1",
            date: "2026-08-19",
            status: "present",
            check_in: "09:00",
            check_out: "18:00",
          },
        ]}
        initialCorrections={[]}
        employeeId="emp-1"
        canApprove={false}
      />
    );

    expect(screen.getByText("My Attendance Logs")).toBeDefined();
    expect(screen.getByText("Attendance Correction Requests Queue")).toBeDefined();
  });
});
