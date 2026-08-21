// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PunchButton } from "../PunchButton";

const mocks = vi.hoisted(() => ({
  router: { refresh: vi.fn() },
  punchCheckInAction: vi.fn(),
  punchCheckOutAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/actions/attendance", () => ({
  punchCheckInAction: mocks.punchCheckInAction,
  punchCheckOutAction: mocks.punchCheckOutAction,
}));

describe("PunchButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toggle variant with punch-in state initially", () => {
    render(
      <PunchButton
        employeeId="emp-1"
        activeRecordId={null}
        isCheckedIn={false}
        variant="toggle"
      />
    );
    expect(screen.getByRole("button", { name: /punch in to work/i })).toHaveTextContent("Punch In Now");
  });

  it("renders toggle variant with punch-out state when checked in", () => {
    render(
      <PunchButton
        employeeId="emp-1"
        activeRecordId="rec-1"
        isCheckedIn={true}
        variant="toggle"
      />
    );
    expect(screen.getByRole("button", { name: /punch out of work/i })).toHaveTextContent("Punch Out Now");
  });

  it("handles successful check-in and unmounts cleanly", async () => {
    mocks.punchCheckInAction.mockResolvedValue({
      success: true,
      record: { id: "rec-new" },
    });

    const onPunchSuccess = vi.fn();
    const { unmount } = render(
      <PunchButton
        employeeId="emp-1"
        activeRecordId={null}
        isCheckedIn={false}
        variant="toggle"
        onPunchSuccess={onPunchSuccess}
      />
    );

    const btn = screen.getByRole("button", { name: /punch in to work/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mocks.punchCheckInAction).toHaveBeenCalledWith("emp-1");
    expect(mocks.router.refresh).toHaveBeenCalled();
    expect(onPunchSuccess).toHaveBeenCalled();

    // Verify unmount does not throw
    expect(() => unmount()).not.toThrow();
  });

  it("handles successful check-out", async () => {
    mocks.punchCheckOutAction.mockResolvedValue({
      success: true,
      record: { id: "rec-1" },
    });

    const onPunchSuccess = vi.fn();
    render(
      <PunchButton
        employeeId="emp-1"
        activeRecordId="rec-1"
        isCheckedIn={true}
        variant="toggle"
        onPunchSuccess={onPunchSuccess}
      />
    );

    const btn = screen.getByRole("button", { name: /punch out of work/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mocks.punchCheckOutAction).toHaveBeenCalledWith("rec-1");
    expect(mocks.router.refresh).toHaveBeenCalled();
    expect(onPunchSuccess).toHaveBeenCalled();
  });
});
