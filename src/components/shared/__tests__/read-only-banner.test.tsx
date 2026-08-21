// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleProvider } from "@/lib/roleContext";
import { ReadOnlyBanner } from "../ReadOnlyBanner";

const mocks = vi.hoisted(() => ({
  getCurrentUserRolesAction: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUserRolesAction: mocks.getCurrentUserRolesAction,
}));

function renderWithRoles(roles: string[]) {
  return render(
    <RoleProvider initialRoles={roles as any}>
      <ReadOnlyBanner moduleName="Leave" />
    </RoleProvider>
  );
}

describe("ReadOnlyBanner", () => {
  beforeEach(() => {
    mocks.getCurrentUserRolesAction.mockReset();
  });

  it("shows the banner to a payroll admin with no other admin role", async () => {
    mocks.getCurrentUserRolesAction.mockResolvedValue({
      roles: ["payroll_admin"],
      mustChangePassword: false,
    });
    renderWithRoles(["payroll_admin"]);

    expect(
      await screen.findByText(/Payroll Admin View \(Leave\)/)
    ).toBeInTheDocument();
  });

  it("hides the banner for an employee", async () => {
    mocks.getCurrentUserRolesAction.mockResolvedValue({
      roles: ["employee"],
      mustChangePassword: false,
    });
    renderWithRoles(["employee"]);

    await screen.findByText(/no/i).catch(() => undefined); // allow effect to settle
    expect(screen.queryByText(/Payroll Admin View/)).not.toBeInTheDocument();
  });

  it("hides the banner when active role is HR admin even if payroll admin is also assigned", async () => {
    mocks.getCurrentUserRolesAction.mockResolvedValue({
      roles: ["hr", "payroll_admin"],
      mustChangePassword: false,
    });
    renderWithRoles(["hr", "payroll_admin"]);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Payroll Admin View/)).not.toBeInTheDocument();
  });

  it("hides the banner for a system admin", async () => {
    mocks.getCurrentUserRolesAction.mockResolvedValue({
      roles: ["system_admin"],
      mustChangePassword: false,
    });
    renderWithRoles(["system_admin"]);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Payroll Admin View/)).not.toBeInTheDocument();
  });
});
