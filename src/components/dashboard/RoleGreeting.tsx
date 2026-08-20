"use client";

import React from "react";
import { useRole } from "@/lib/roleContext";
import type { RoleCode } from "@/lib/types";

const ROLE_GREETINGS: Record<string, string> = {
  employee: "Employee Workspace",
  manager: "Manager Workspace",
  hr: "HR Operations Workspace",
  payroll_admin: "Payroll Operations Workspace",
  system_admin: "System Administration Workspace",
};

/**
 * Role-aware greeting heading (NAV-05 / WS-A A5).
 *
 * Kept as a client island because the active *focus* role (multi-role users)
 * is stored client-side (localStorage) and only known after mount — the rest
 * of the dashboard is server-rendered.
 */
export function RoleGreeting() {
  const { activeRole } = useRole();
  const label = ROLE_GREETINGS[activeRole as RoleCode] || "HRMS Workspace";
  return (
    <h2 data-testid="dashboard-greeting" className="text-xl font-bold text-ink tracking-tight">
      {label}
    </h2>
  );
}

export default RoleGreeting;
