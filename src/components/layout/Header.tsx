"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/roleContext";
import { RoleCode } from "@/lib/types";
import { Shield, CheckCircle2, LogOut, Menu } from "lucide-react";
import { GlobalSearchPalette } from "@/components/shared/GlobalSearchPalette";
import { NotificationsBell } from "@/components/shared/NotificationsBell";
import { Breadcrumbs } from "./Breadcrumbs";
import { logoutAction } from "@/lib/actions/auth";
import { getRouteConfig } from "@/lib/nav/routeConfig";

const ROLE_LABELS: Record<RoleCode, string> = {
  employee: "Employee Focus",
  manager: "Manager Focus",
  hr: "HR Admin Focus",
  payroll_admin: "Payroll Admin Focus",
  system_admin: "System Admin Focus",
  statutory_admin: "Statutory Admin Focus",
  finance_admin: "Finance Admin Focus",
  it_admin: "IT Admin Focus",
};

interface HeaderProps {
  userName?: string;
  mustChangePassword?: boolean;
  onOpenMobileMenu?: () => void;
}

export function Header({
  userName: userNameProp,
  mustChangePassword = false,
  onOpenMobileMenu,
}: HeaderProps) {
  const pathname = usePathname();
  const routeConfig = getRouteConfig(pathname);
  const { activeRole, assignedRoles, setActiveRole, permissions, userName: contextUserName } = useRole();
  const userName = userNameProp || contextUserName || "Admin User";

  const activePageTitle = routeConfig?.name || "HRMS Operations";
  const activePageDescription = routeConfig?.description || "Enterprise Operations Shell";

  return (
    <header className="h-16 bg-surface border-b border-line px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 text-ink-secondary hover:text-ink hover:bg-surface-muted rounded-lg transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <Breadcrumbs />
          <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight flex items-center gap-2">
            {activePageTitle}
            <span className="hidden md:inline-flex text-[11px] font-semibold px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
              v2.7
            </span>
          </h1>
          <p className="text-[10px] text-ink-muted hidden sm:block">{activePageDescription}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Union Permissions Badge */}
        <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {permissions.length} Union Perms
        </span>

        {/* Global Search Palette */}
        <GlobalSearchPalette />

        {/* Multi-Role Focus Switcher */}
        {assignedRoles.length > 1 && (
          <div data-testid="role-switcher" className="relative hidden md:flex items-center bg-surface-muted border border-line rounded-lg p-0.5">
            <Shield className="w-4 h-4 text-primary-600 ml-2" aria-hidden="true" />
            <select
              data-testid="role-switcher-select"
              aria-label="Select workspace role filter"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as RoleCode)}
              className="bg-transparent text-xs font-semibold text-ink-secondary py-1 pl-2 pr-6 focus:outline-none cursor-pointer rounded"
              title="Workspace Focus Filter (Union permissions active across all assigned roles)"
            >
              {assignedRoles.map((role) => (
                <option
                  key={role}
                  value={role}
                  title={`Filter workspace view to ${ROLE_LABELS[role]} focus (Union permissions remain active)`}
                >
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notifications Bell */}
        <NotificationsBell />

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-line">
          <div
            className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-xs sm:text-sm shadow-xs"
            aria-label={`User avatar for ${userName}`}
          >
            {userName.charAt(0)}
          </div>

          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-ink leading-tight">{userName}</p>
            <p className="text-[10px] text-ink-muted capitalize leading-tight">
              {activeRole.replace("_", " ")}
            </p>
          </div>

          <button
            onClick={() => {
              if (typeof document !== "undefined") {
                document.cookie = "sb-access-token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              }
              try {
                logoutAction();
              } catch {}
              window.location.href = "/login";
            }}
            aria-label="Sign out of system"
            title="Sign Out"
            className="p-1.5 text-ink-faint hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

    </header>
  );
}
