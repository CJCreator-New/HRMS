"use client";

import { useRole } from "@/lib/roleContext";

export function usePermission() {
  const { permissions, hasPermission } = useRole();

  const can = (permissionCode: string): boolean => {
    return hasPermission(permissionCode);
  };

  const canAny = (permissionCodes: string[]): boolean => {
    return permissionCodes.some((code) => hasPermission(code));
  };

  const canAll = (permissionCodes: string[]): boolean => {
    return permissionCodes.every((code) => hasPermission(code));
  };

  return {
    can,
    canAny,
    canAll,
    permissions,
  };
}
