"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/roleContext";
import { ROUTE_CONFIG } from "@/lib/nav/routeConfig";
import {
  Home,
  CheckSquare,
  Clock,
  Briefcase,
  Receipt,
  Users,
  UserPlus,
  Building2,
  LogOut,
  DollarSign,
  FileSpreadsheet,
  Scale,
  Calendar,
  Paperclip,
  Settings,
  Shield,
  Upload,
  Cpu,
  FileText,
  X,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  "/": <Home className="w-4 h-4" aria-hidden="true" />,
  "/approvals": <CheckSquare className="w-4 h-4" aria-hidden="true" />,
  "/attendance": <Clock className="w-4 h-4" aria-hidden="true" />,
  "/leave": <Briefcase className="w-4 h-4" aria-hidden="true" />,
  "/reimbursements": <Receipt className="w-4 h-4" aria-hidden="true" />,
  "/employees": <Users className="w-4 h-4" aria-hidden="true" />,
  "/onboarding": <UserPlus className="w-4 h-4" aria-hidden="true" />,
  "/employees/import": <Upload className="w-4 h-4" aria-hidden="true" />,
  "/departments": <Building2 className="w-4 h-4" aria-hidden="true" />,
  "/offboarding": <LogOut className="w-4 h-4" aria-hidden="true" />,
  "/salary": <DollarSign className="w-4 h-4" aria-hidden="true" />,
  "/payroll": <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />,
  "/statutory": <Scale className="w-4 h-4" aria-hidden="true" />,
  "/encashment": <DollarSign className="w-4 h-4" aria-hidden="true" />,
  "/calendar": <Calendar className="w-4 h-4" aria-hidden="true" />,
  "/documents": <Paperclip className="w-4 h-4" aria-hidden="true" />,
  "/settings": <Settings className="w-4 h-4" aria-hidden="true" />,
  "/audit": <Shield className="w-4 h-4" aria-hidden="true" />,
  "/jobs": <Cpu className="w-4 h-4" aria-hidden="true" />,
  "/reports": <FileText className="w-4 h-4" aria-hidden="true" />,
};

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  // WS-A A6 de-dup: the approvals badge count rides the shell's single mount
  // load via RoleContext (pendingApprovalsCount), not a sidebar-owned fetch.
  const { hasActiveRolePermission, pendingApprovalsCount: badgeCount } = useRole();

  // Handle Escape key to close mobile sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen && onMobileClose) {
        onMobileClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onMobileClose]);

  const categories: Array<"MY WORK" | "PEOPLE" | "PAY" | "ADMIN"> = [
    "MY WORK",
    "PEOPLE",
    "PAY",
    "ADMIN",
  ];

  const sidebarContent = (
    <aside
      className={`w-64 bg-sidebar-bg text-sidebar-text flex flex-col h-full border-r border-sidebar-border transition-transform duration-200 ease-in-out`}
      aria-label="Main Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center font-bold text-white shadow-xs">
            H
          </div>
          <div>
            <h1 className="font-bold text-sm text-sidebar-bright tracking-tight">Enterprise HRMS</h1>
            <p className="text-[10px] text-sidebar-muted">v2.7 Operations</p>
          </div>
        </div>

        {onMobileClose && (
          <button
            onClick={onMobileClose}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 text-sidebar-muted hover:text-sidebar-bright hover:bg-sidebar-hover rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Grouped Navigation List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {categories.map((cat) => {
          const catRoutes = ROUTE_CONFIG.filter(
            (r) => r.category === cat && !r.public
          ).filter((r) => {
            return r.requiredPermissions.length === 0 || r.requiredPermissions.some((p) => hasActiveRolePermission(p));
          });

          if (catRoutes.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              <h2 className="px-3 text-[10px] font-bold text-sidebar-muted uppercase tracking-wider">
                {cat}
              </h2>
              <div className="space-y-0.5 pt-1">
                {catRoutes
                  .filter((r) => !r.parent)
                  .map((r) => {
                    const children = catRoutes.filter((c) => c.parent === r.path);
                    const isActive = pathname === r.path || pathname.startsWith(`${r.path}/`);
                    const testId = `nav-${r.path === "/" ? "home" : r.path.replace(/^\//, "").replace(/\//g, "-")}`;
                    return (
                      <div key={r.path} className="space-y-0.5">
                        <Link
                          href={r.path}
                          onClick={() => onMobileClose?.()}
                          data-testid={testId}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                            isActive
                              ? "bg-sidebar-active text-sidebar-active-text shadow-xs"
                              : "hover:bg-sidebar-hover text-sidebar-text hover:text-sidebar-bright"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {ICON_MAP[r.path]}
                            <span>{r.name}</span>
                          </div>

                          {r.path === "/approvals" && badgeCount > 0 && (
                            <span className="px-2 py-0.5 bg-amber-500 text-sidebar-bg font-bold text-[10px] rounded-full">
                              {badgeCount}
                            </span>
                          )}
                        </Link>

                        {children.length > 0 && (
                          <div className="ml-3 pl-2.5 border-l border-sidebar-border space-y-0.5 mt-0.5">
                            {children.map((child) => {
                              const childActive = pathname === child.path;
                              const childTestId = `nav-${child.path.replace(/^\//, "").replace(/\//g, "-")}`;
                              return (
                                <Link
                                  key={child.path}
                                  href={child.path}
                                  onClick={() => onMobileClose?.()}
                                  data-testid={childTestId}
                                  aria-current={childActive ? "page" : undefined}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                                    childActive
                                      ? "bg-sidebar-active text-sidebar-active-text shadow-xs"
                                      : "hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-bright"
                                  }`}
                                >
                                  {ICON_MAP[child.path]}
                                  <span>{child.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-sidebar w-64 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Slide-out — always mounted, animated via transform */}
      <div
        className={`lg:hidden fixed inset-0 z-overlay flex transition-opacity duration-200 ease-in-out ${
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isMobileOpen}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-sidebar-backdrop backdrop-blur-xs transition-opacity duration-200"
          onClick={onMobileClose}
          aria-hidden="true"
        />
        {/* Drawer Container */}
        <div
          data-testid="mobile-drawer"
          className={`relative flex-1 max-w-xs w-full bg-sidebar-bg h-full shadow-2xl z-overlay transition-transform duration-200 ease-in-out ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
