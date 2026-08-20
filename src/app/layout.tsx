import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { WebVitals } from "@/components/shared/WebVitals";
import { RoleCode } from "@/lib/types";

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
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  let initialRoles: RoleCode[] = ["employee"];

  if (token) {
    if (token.includes("sysadmin")) initialRoles = ["system_admin"];
    else if (token.includes("multi.hrmgr")) initialRoles = ["hr", "manager"];
    else if (token.includes("hradmin") || token.includes("hr.alt")) initialRoles = ["hr"];
    else if (token.includes("payroll")) initialRoles = ["payroll_admin"];
    else if (token.includes("manager")) initialRoles = ["manager"];
    else if (token.includes("employee")) initialRoles = ["employee"];
  }

  return (
    <html lang="en">
      <body>
        <WebVitals />
        <AppShell initialRoles={initialRoles}>{children}</AppShell>
      </body>
    </html>
  );
}
