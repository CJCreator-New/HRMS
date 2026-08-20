import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { WebVitals } from "@/components/shared/WebVitals";
import { RoleCode } from "@/lib/types";

import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "HRMS v2.7 — Enterprise Human Resource Management System",
  description: "Internal Enterprise HRMS for employee lifecycle, attendance, leave, payroll, and settlements.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userInfo = await safeGetCurrentUserRoles();
  const initialRoles = (userInfo.roles || ["employee"]) as RoleCode[];

  return (
    <html lang="en">
      <body>
        <WebVitals />
        <AppShell
          initialRoles={initialRoles}
          initialUserName={userInfo.userName}
          initialMustChangePassword={userInfo.mustChangePassword}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

