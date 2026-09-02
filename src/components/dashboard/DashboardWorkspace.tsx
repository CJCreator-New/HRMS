"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileSpreadsheet,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { RoleGreeting } from "@/components/dashboard/RoleGreeting";
import { PunchCard } from "@/components/dashboard/PunchCard";
import { useRole } from "@/lib/roleContext";
import type { DashboardData } from "@/lib/services/dashboard";

interface DashboardWorkspaceProps {
  initialData: DashboardData;
  todayStr: string;
  payrollPeriodLabel: string;
}

interface ActionLinkProps {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  tone?: "primary" | "neutral" | "warning";
}

function ActionLink({ label, description, href, icon, tone = "neutral" }: ActionLinkProps) {
  const toneClass = tone === "primary"
    ? "border-primary-200 bg-primary-50 hover:bg-primary-100"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
      : "border-line bg-surface-muted hover:bg-primary-50";

  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-xl border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${toneClass}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary-600 shadow-card">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function StatusCard({ title, value, detail, href, icon, tone = "primary" }: { title: string; value: string; detail: string; href: string; icon: React.ReactNode; tone?: "primary" | "success" | "warning" }) {
  const iconClass = tone === "success" ? "text-emerald-600 bg-emerald-50" : tone === "warning" ? "text-amber-600 bg-amber-50" : "text-primary-600 bg-primary-50";
  return (
    <div className="flex min-h-36 flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
      </div>
      <div>
        <p className="mt-3 text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-ink-secondary">{detail}</p>
      </div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
        Open workspace <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function DashboardWorkspace({ initialData, todayStr, payrollPeriodLabel }: DashboardWorkspaceProps) {
  const { hasActiveRolePermission } = useRole();
  const can = (code: string) => hasActiveRolePermission(code);
  const canAny = (codes: string[]) => codes.some(can);
  const canApprove = canAny(["leave.approve.manager", "leave.approve.hr", "attendance.correct.approve", "reimbursement.approve", "ff.approve"]);

  const actions: ActionLinkProps[] = [];
  if (can("attendance.mark.self")) actions.push({ label: "Punch attendance", description: "Record today’s working hours", href: "/attendance", icon: <Clock3 className="size-4" />, tone: "primary" });
  if (can("leave.apply.self")) actions.push({ label: "Request leave", description: "Check balance and submit a request", href: "/leave", icon: <Briefcase className="size-4" /> });
  if (canApprove) actions.push({ label: "Review approvals", description: "Clear items waiting in your queue", href: "/approvals", icon: <CheckCircle2 className="size-4" />, tone: "warning" });
  if (can("employee.create")) actions.push({ label: "Onboard employee", description: "Start a new employee record", href: "/onboarding", icon: <UserPlus className="size-4" /> });
  if (canAny(["payroll.run", "payroll.view"])) actions.push({ label: "Run payroll", description: "Review the active pay cycle", href: "/payroll", icon: <FileSpreadsheet className="size-4" /> });

  const hasAdminAccess = can("settings.manage");
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Today at a glance</p>
          <RoleGreeting />
          <p className="mt-2 text-sm leading-6 text-ink-secondary">Your workspace brings the next decision, task, or exception into focus.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-secondary">
          <p className="text-xs font-semibold text-ink-muted">Workspace date</p>
          <p className="mt-1 font-bold text-ink">{todayStr}</p>
        </div>
      </section>

      {actions.length > 0 && (
        <section aria-labelledby="next-actions-heading" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div><h2 id="next-actions-heading" className="text-lg font-bold tracking-tight text-ink">Your next actions</h2><p className="mt-1 text-sm text-ink-secondary">Start with the work that needs your attention.</p></div>
            {canApprove && <Link href="/approvals" className="hidden text-xs font-bold text-primary-700 sm:inline-flex sm:items-center sm:gap-1">View inbox <ArrowRight className="size-3.5" /></Link>}
          </div>
          <div data-testid="next-actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actions.slice(0, 6).map((action) => <ActionLink key={action.href} {...action} />)}</div>
        </section>
      )}

      <section aria-labelledby="status-heading" className="flex flex-col gap-4">
        <div><h2 id="status-heading" className="text-lg font-bold tracking-tight text-ink">Workspace status</h2><p className="mt-1 text-sm text-ink-secondary">A live summary of the areas available to your active role.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {can("attendance.mark.self") && initialData.punch && <PunchCard initialEmployeeId={initialData.punch.employeeId} initialIsCheckedIn={initialData.punch.isCheckedIn} initialCheckInTime={initialData.punch.checkInTime} initialActiveRecordId={initialData.punch.activeRecordId} todayLabel={todayStr} />}
          {canApprove && <StatusCard title="Pending approvals" value={initialData.pendingApprovals !== null ? String(initialData.pendingApprovals) : "Unavailable"} detail="Leave, attendance, claims, and settlements" href="/approvals" icon={<CheckCircle2 className="size-4" />} tone="warning" />}
          {can("employee.view.all") && <StatusCard title="Active headcount" value={initialData.headcount !== null ? String(initialData.headcount.active) : "Unavailable"} detail={initialData.headcount ? `+${initialData.headcount.newThisMonth} new this month` : "Data could not be loaded"} href="/employees" icon={<Users className="size-4" />} />}
          {canAny(["payroll.run", "payroll.view"]) && <StatusCard title="Payroll cycle" value="Active period" detail={`${payrollPeriodLabel} cycle`} href="/payroll" icon={<ShieldCheck className="size-4" />} tone="success" />}
        </div>
      </section>

      {hasAdminAccess && <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" /><div><p className="text-sm font-bold text-amber-950">Configuration needs attention</p><p className="mt-1 text-xs leading-5 text-amber-900">Complete organization policies before locking dependent HR and payroll engines.</p></div></div><Link href="/settings" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">Review settings</Link></section>}

      <section aria-labelledby="modules-heading" className="rounded-xl border border-line bg-surface p-5 shadow-card"><div className="flex items-center justify-between gap-3"><div><h2 id="modules-heading" className="text-lg font-bold tracking-tight text-ink">All workspaces</h2><p className="mt-1 text-sm text-ink-secondary">Jump to a module without leaving your current focus.</p></div><Settings className="size-5 text-ink-faint" aria-hidden="true" /></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[
        ["attendance.view.self", "/attendance", "Attendance", <Clock3 key="attendance" className="size-5" />], ["leave.view.self", "/leave", "Leave", <Briefcase key="leave" className="size-5" />], ["reimbursement.apply.self", "/reimbursements", "Claims", <Receipt key="claims" className="size-5" />], ["salary.view.self", "/salary", "Salary", <DollarSign key="salary" className="size-5" />], ["employee.view.all", "/employees", "People", <Users key="people" className="size-5" />], ["audit.view", "/audit", "Audit trail", <Shield key="audit" className="size-5" />],
      ].filter(([permission]) => can(permission as string)).map(([, href, label, icon]) => <Link key={href as string} href={href as string} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-muted p-3 text-center text-xs font-bold text-ink-secondary transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">{icon}<span>{label}</span></Link>)}</div></section>
    </div>
  );
}

export default DashboardWorkspace;
