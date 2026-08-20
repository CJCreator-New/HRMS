import Link from "next/link";
import {
  Clock,
  Briefcase,
  CheckCircle2,
  Users,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  DollarSign,
  Receipt,
  Settings,
  UserPlus,
  FileSpreadsheet,
} from "lucide-react";
import { RoleGreeting } from "@/components/dashboard/RoleGreeting";
import { PunchCard } from "@/components/dashboard/PunchCard";
import { getCurrentUserRoles, type CurrentUserInfo } from "@/lib/auth/current-user";
import { getDashboardData, type DashboardData } from "@/lib/services/dashboard";
import { permissionsForRoles, hasPermission } from "@/lib/auth/permissions-map";
import { formatDateIndian } from "@/lib/utils/formatters";

const FALLBACK_USER: CurrentUserInfo = {
  roles: ["employee"],
  mustChangePassword: false,
  userName: "Employee",
  employeeId: null,
};

const EMPTY_DATA: DashboardData = { headcount: null, pendingApprovals: null, punch: null };

/**
 * Dashboard — command center (Slice 1: RSC conversion + design pass).
 *
 * Server component: identity, permissions, and all widget data resolve on the
 * server in one pass. Only genuinely interactive pieces are client islands:
 *  - <RoleGreeting />  role-aware heading (client because the active *focus*
 *                      role is stored in localStorage for multi-role users)
 *  - <PunchCard />     punch in/out (client because it mutates + shows notices)
 *
 * E2E contract preserved (e2e/specs/navigation/dashboard.spec.ts):
 *  - data-testid="dashboard-greeting"  role-aware h2 heading
 *  - data-testid="next-actions"        role-aware contextual action links
 */
export default async function DashboardPage() {
  // Graceful degradation: if the DB/session layer is unavailable, render the
  // default employee view with placeholder data instead of 500-ing the page.
  let userInfo: CurrentUserInfo = FALLBACK_USER;
  let data: DashboardData = EMPTY_DATA;
  try {
    userInfo = await getCurrentUserRoles();
  } catch {
    userInfo = FALLBACK_USER;
  }
  try {
    data = await getDashboardData(userInfo);
  } catch {
    data = EMPTY_DATA;
  }

  const permissions = permissionsForRoles(userInfo.roles);
  const can = (code: string) => hasPermission(permissions, code);
  const canAny = (codes: string[]) => codes.some(can);

  // Role-aware suggested next actions (WS-A A5 / NAV-05) — order is significant
  const nextActions: Array<{ label: string; href: string }> = [];
  if (can("attendance.mark.self")) nextActions.push({ label: "Punch Attendance", href: "/attendance" });
  if (can("leave.apply.self")) nextActions.push({ label: "Apply for Leave", href: "/leave" });
  if (
    canAny([
      "leave.approve.manager",
      "leave.approve.hr",
      "attendance.correct.approve",
      "reimbursement.approve",
      "ff.approve",
    ])
  )
    nextActions.push({ label: "Review Approvals", href: "/approvals" });
  if (can("employee.create")) nextActions.push({ label: "Direct Onboard", href: "/onboarding" });
  if (canAny(["payroll.run", "payroll.view"])) nextActions.push({ label: "Open Payroll", href: "/payroll" });
  if (can("settings.manage")) nextActions.push({ label: "Company Settings", href: "/settings" });

  const todayStr = formatDateIndian(new Date());
  const payrollPeriodLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="bg-surface p-6 rounded-xl border border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <RoleGreeting />
          <p className="text-xs text-ink-secondary mt-1">
            Welcome to your HR portal dashboard. Modules and actions are configured based on your role permissions.
          </p>
        </div>

        {can("employee.create") && (
          <Link
            href="/onboarding"
            className="px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition self-start sm:self-auto shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            + Direct Onboard
          </Link>
        )}
      </div>

      {/* Role-Aware Suggested Next Actions (NAV-05) */}
      {nextActions.length > 0 && (
        <div className="bg-surface p-5 rounded-xl border border-line shadow-card">
          <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
            Get Started — Suggested Next Actions
          </h3>
          <div data-testid="next-actions" className="mt-3 flex flex-wrap gap-3 text-xs">
            {nextActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="px-3.5 py-2 bg-surface-muted hover:bg-primary-50 border border-line rounded-lg font-semibold text-ink-secondary transition inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Permission-Filtered Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: Punch Quick Action (client island) */}
        {can("attendance.mark.self") && data.punch && (
          <PunchCard
            initialEmployeeId={data.punch.employeeId}
            initialIsCheckedIn={data.punch.isCheckedIn}
            initialCheckInTime={data.punch.checkInTime}
            initialActiveRecordId={data.punch.activeRecordId}
            todayLabel={todayStr}
          />
        )}

        {/* Widget 2: Pending Approvals Queue */}
        {canAny([
          "leave.approve.manager",
          "leave.approve.hr",
          "attendance.correct.approve",
          "reimbursement.approve",
          "ff.approve",
        ]) && (
          <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
            <div className="flex justify-between items-center text-ink-secondary">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Approvals</span>
              <CheckCircle2 className="w-4 h-4 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-ink tabular-nums">
                {data.pendingApprovals !== null ? data.pendingApprovals : "Inbox"}
              </p>
              <p className="text-[11px] text-amber-700 font-medium">Leave, Attendance & Reimbursements</p>
            </div>
            <Link
              href="/approvals"
              className="block text-center py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              Review My Queue &rarr;
            </Link>
          </div>
        )}

        {/* Widget 3: Headcount Summary (server-side counts) */}
        {can("employee.view.all") && (
          <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
            <div className="flex justify-between items-center text-ink-secondary">
              <span className="text-xs font-bold uppercase tracking-wider">Total Headcount</span>
              <Users className="w-4 h-4 text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-ink tabular-nums">
                {data.headcount !== null ? data.headcount.active : "—"}
              </p>
              {data.headcount !== null && data.headcount.newThisMonth > 0 && (
                <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> +{data.headcount.newThisMonth} active this month
                </p>
              )}
            </div>
            <Link
              href="/employees"
              className="block text-center py-1.5 px-3 bg-surface-muted hover:bg-primary-50 text-ink-secondary text-xs font-bold rounded-lg border border-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              View Directory
            </Link>
          </div>
        )}

        {/* Widget 4: Payroll Lock Status */}
        {canAny(["payroll.run", "payroll.view"]) && (
          <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
            <div className="flex justify-between items-center text-ink-secondary">
              <span className="text-xs font-bold uppercase tracking-wider">Payroll Status</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-ink">Active Period</p>
              <p className="text-[11px] text-emerald-700 font-medium">{payrollPeriodLabel} Cycle</p>
            </div>
            <Link
              href="/payroll"
              className="block text-center py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg border border-emerald-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              Open Payroll Wizard
            </Link>
          </div>
        )}
      </div>

      {/* Policy Warning Banner */}
      {can("settings.manage") && (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              <strong>Initial Configuration Gate:</strong> Organization settings and policy quotas need to be finalized to lock system engine.
            </span>
          </div>
          <Link
            href="/settings"
            className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Configure Settings
          </Link>
        </div>
      )}

      {/* Restricted Access Notice — for personas with no module access */}
      {nextActions.length === 0 && !can("employee.create") && !canAny(["payroll.run", "payroll.view"]) && !can("settings.manage") && (
        <div className="p-4 bg-primary-50 rounded-xl border border-primary-200 text-xs text-primary-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
            <span>
              <strong>Limited Access:</strong> Your account currently has restricted module access. Contact your HR administrator to request additional permissions.
            </span>
          </div>
        </div>
      )}

      {/* Operational Links Grid */}
      <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3">Available Operations Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          {can("attendance.view.self") && (
            <Link href="/attendance" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" aria-hidden="true" /> Attendance
            </Link>
          )}

          {can("leave.view.self") && (
            <Link href="/leave" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <Briefcase className="w-5 h-5 text-purple-600 mx-auto mb-1" aria-hidden="true" /> Leave Engine
            </Link>
          )}

          {can("reimbursement.apply.self") && (
            <Link href="/reimbursements" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <Receipt className="w-5 h-5 text-indigo-600 mx-auto mb-1" aria-hidden="true" /> Reimbursements
            </Link>
          )}

          {can("salary.view.self") && (
            <Link href="/salary" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <DollarSign className="w-5 h-5 text-emerald-600 mx-auto mb-1" aria-hidden="true" /> Salary
            </Link>
          )}

          {canAny(["payroll.run", "payroll.view"]) && (
            <Link href="/payroll" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <FileSpreadsheet className="w-5 h-5 text-primary-600 mx-auto mb-1" aria-hidden="true" /> Payroll
            </Link>
          )}

          {can("employee.view.all") && (
            <Link href="/employees" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <UserPlus className="w-5 h-5 text-ink-secondary mx-auto mb-1" aria-hidden="true" /> Employees
            </Link>
          )}

          {can("audit.view") && (
            <Link href="/audit" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <Shield className="w-5 h-5 text-ink-secondary mx-auto mb-1" aria-hidden="true" /> Audit Trail
            </Link>
          )}

          {can("settings.manage") && (
            <Link href="/settings" className="p-3 bg-surface-muted hover:bg-primary-50 rounded-xl border border-line text-center font-bold text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
              <Settings className="w-5 h-5 text-primary-600 mx-auto mb-1" aria-hidden="true" /> Settings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
