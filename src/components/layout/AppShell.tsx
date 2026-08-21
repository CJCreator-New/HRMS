"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { RoleProvider, useRole } from "@/lib/roleContext";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { RoleCode } from "@/lib/types";
import { ForcePasswordResetModal } from "@/components/auth/ForcePasswordResetModal";
import { ToastProvider } from "@/components/shared/Toast";
import { BackToTop } from "@/components/shared/BackToTop";

function AppShellContent({ children }: { children: React.ReactNode }) {
  const { mustChangePassword } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-subtle text-ink font-sans relative">
      {/* Skip to Main Content Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:font-bold focus:text-xs focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Navigation Sidebar (Responsive Mobile Drawer + Desktop Fixed) */}
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 ml-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main id="main-content" className="flex-1 p-4 sm:p-6 overflow-y-auto" tabIndex={-1}>
          {children}
        </main>
      </div>

      <ForcePasswordResetModal isOpen={mustChangePassword} />
      <BackToTop />
    </div>
  );
}

export function AppShell({
  children,
  initialRoles = ["employee"],
  initialUserName,
  initialMustChangePassword,
}: {
  children: React.ReactNode;
  initialRoles?: RoleCode[];
  initialUserName?: string;
  initialMustChangePassword?: boolean;
}) {
  const pathname = usePathname();

  // Route-group separation: Login & 403 pages render cleanly without RoleProvider or sidebar shell
  const isPublicRoute = pathname === "/login" || pathname === "/403";

  if (isPublicRoute) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <RoleProvider
        initialRoles={initialRoles}
        initialUserName={initialUserName}
        initialMustChangePassword={initialMustChangePassword}
      >
        <AppShellContent>{children}</AppShellContent>
      </RoleProvider>
    </ToastProvider>
  );
}
