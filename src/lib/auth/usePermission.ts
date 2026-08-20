"use client";

import { useRole } from "@/lib/roleContext";

export function usePermission() {
  const { assignedRoles, activeRole, hasPermission } = useRole();

  const can = (permissionCode: string): boolean => {
    return hasPermission(permissionCode);
  };

  const canAny = (permissionCodes: string[]): boolean => {
    return permissionCodes.some((code) => hasPermission(code));
  };

  const canAll = (permissionCodes: string[]): boolean => {
    return permissionCodes.every((code) => hasPermission(code));
  };

  const isPayrollAdmin = assignedRoles.includes("payroll_admin");
  const isManager = assignedRoles.includes("manager");
  const isHrAdmin = assignedRoles.includes("hr");
  const isSystemAdmin = assignedRoles.includes("system_admin");

  return {
    can,
    canAny,
    canAll,
    assignedRoles,
    activeRole,
    isPayrollAdmin,
    isManager,
    isHrAdmin,
    isSystemAdmin,
  };
}
