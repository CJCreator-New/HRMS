"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { RoleCode } from "@/lib/types";
import {
  ROLE_PERMISSIONS_MAP,
  permissionsForRoles,
  hasPermission as hasScopePermission,
} from "@/lib/auth/permissions-map";

import { getCurrentUserRolesAction } from "@/lib/actions/auth";
import { getPendingApprovalsCountAction } from "@/lib/actions/approvals";

interface RoleContextType {
  activeRole: RoleCode;
  assignedRoles: RoleCode[];
  permissions: string[];
  activeRolePermissions: string[];
  isManager: boolean;
  isHrAdmin: boolean;
  isPayrollAdmin: boolean;
  mustChangePassword: boolean;
  userName: string;
  /** Pending-approvals badge count — loaded once with the shell (WS-A A6 de-dup). */
  pendingApprovalsCount: number;
  setActiveRole: (role: RoleCode) => void;
  hasPermission: (permissionCode: string) => boolean;
  hasActiveRolePermission: (permissionCode: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({
  children,
  initialRoles = ["employee"],
}: {
  children: React.ReactNode;
  initialRoles?: RoleCode[];
}) {
  const [assignedRoles, setAssignedRoles] = useState<RoleCode[]>(initialRoles);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [userName, setUserName] = useState("Admin User");
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [activeRole, setActiveRoleState] = useState<RoleCode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hrms_last_active_role") as RoleCode;
      if (saved && initialRoles.includes(saved)) return saved;
    }
    return initialRoles[0] || "employee";
  });

  useEffect(() => {
    getCurrentUserRolesAction().then((res) => {
      if (res?.roles && res.roles.length > 0) {
        setAssignedRoles(res.roles as RoleCode[]);
        setActiveRoleState((prev) => {
          if (typeof window !== "undefined") {
            const saved = localStorage.getItem("hrms_last_active_role") as RoleCode;
            if (saved && res.roles.includes(saved)) return saved;
          }
          if (res.roles.includes(prev)) return prev;
          return (res.roles[0] as RoleCode) || "employee";
        });
      }
      if (res?.mustChangePassword !== undefined) {
        setMustChangePassword(res.mustChangePassword);
      }
      if (res?.userName) {
        setUserName(res.userName);
      }
    });

    // WS-A A6: the shell loads the approvals badge in the same mount as the role
    // fetch (instead of the sidebar firing its own request). A badge failure must
    // never break the shell, so failures are swallowed and the badge stays 0.
    getPendingApprovalsCountAction()
      .then((res) => {
        if (typeof res?.count === "number") setPendingApprovalsCount(res.count);
      })
      .catch(() => {});
  }, []);

  // Calculate cumulative UNION of permissions across ALL assigned roles (Q2).
  // system_admin bypasses every middleware route gate, so its client-side union
  // must also be unrestricted — otherwise UI actions (report export, approvals,
  // payroll run, …) stay hidden for the platform administrator even though the
  // routes are reachable. Shared helper keeps server (RSC) and client in sync.
  const permissions = useMemo(() => permissionsForRoles(assignedRoles), [assignedRoles]);

  // Focus-filtered permissions for the currently active role
  const activeRolePermissions = useMemo(() => {
    return ROLE_PERMISSIONS_MAP[activeRole] || [];
  }, [activeRole]);

  const setActiveRole = useCallback((role: RoleCode) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms_last_active_role", role);
    }
  }, []);

  const hasPermission = useCallback(
    (permissionCode: string): boolean => hasScopePermission(permissions, permissionCode),
    [permissions]
  );

  const hasActiveRolePermission = useCallback(
    (permissionCode: string): boolean => hasScopePermission(activeRolePermissions, permissionCode),
    [activeRolePermissions]
  );

  const contextValue = useMemo(() => ({
    activeRole,
    assignedRoles,
    permissions,
    activeRolePermissions,
    isManager: activeRole === "manager",
    isHrAdmin: activeRole === "hr",
    isPayrollAdmin: activeRole === "payroll_admin",
    mustChangePassword,
    userName,
    pendingApprovalsCount,
    setActiveRole,
    hasPermission,
    hasActiveRolePermission,
  }), [
    activeRole,
    assignedRoles,
    permissions,
    activeRolePermissions,
    mustChangePassword,
    userName,
    pendingApprovalsCount,
    setActiveRole,
    hasPermission,
    hasActiveRolePermission,
  ]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
