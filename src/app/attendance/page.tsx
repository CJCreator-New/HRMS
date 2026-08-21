import { Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";
import { permissionsForRoles, hasPermission } from "@/lib/auth/permissions-map";
import { getAttendanceDashboard, type AttendanceDashboardData } from "@/lib/services/attendance";
import { ReadOnlyBanner } from "@/components/shared/ReadOnlyBanner";
import { AttendancePunchBar } from "@/components/attendance/AttendancePunchBar";
import { AttendanceWorkspace } from "@/components/attendance/AttendanceWorkspace";
import { formatDateIndian } from "@/lib/utils/formatters";

const EMPTY_DATA: AttendanceDashboardData = {
  employeeId: null,
  records: [],
  corrections: [],
  today: { isCheckedIn: false, checkInTime: null, activeRecordId: null },
};

/**
 * Attendance & Time Tracking (Slice 2: RSC conversion + unified punch flow).
 *
 * Server component: records, corrections, and today's punch state resolve on
 * the server and are passed to client islands as props. The Today strip makes
 * the punch flow coherent — punch state, date, and the punch controls live in
 * one place at the top of the page.
 *
 * E2E contract preserved (e2e/specs/modules/attendance.spec.ts):
 *  - `main h1` contains "Attendance & Time Tracking"
 *  - data-testid="punch-in-btn" / "punch-out-btn"
 *  - data-testid="open-correction-modal-btn", "correction-*-input",
 *    "correction-submit-btn", "approve-correction-btn", "reject-correction-btn"
 */
export default async function AttendancePage() {
  const userInfo = await safeGetCurrentUserRoles();
  const permissions = permissionsForRoles(userInfo.roles);

  let data: AttendanceDashboardData = EMPTY_DATA;
  try {
    data = await getAttendanceDashboard(userInfo);
  } catch {
    data = EMPTY_DATA;
  }

  const canApprove =
    hasPermission(permissions, "attendance.correct.approve") ||
    hasPermission(permissions, "attendance.correction.approve");

  const todayLabel = formatDateIndian(new Date());
  const { today } = data;

  return (
    <div className="space-y-6">
      <ReadOnlyBanner moduleName="Attendance & Anomaly Records" />

      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Clock className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Attendance & Time Tracking"
        description="Punch check-in/out, view daily logs, and submit correction requests for manager review."
        actions={
          <AttendancePunchBar
            employeeId={data.employeeId}
            activeRecordId={today.activeRecordId}
            isCheckedIn={today.isCheckedIn}
          />
        }
      />

      {/* Today strip + punch flow — current punch state at a glance */}
      <div className="bg-surface rounded-xl border border-line shadow-card space-y-4">
        {/* Today strip */}
        <div
          data-testid="today-strip"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            today.isCheckedIn
              ? "bg-emerald-50 border-emerald-200"
              : "bg-surface-muted border-line"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${today.isCheckedIn ? "bg-emerald-500" : "bg-slate-400"}`}
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary">Today</p>
              <p className="text-sm font-bold text-ink">
                {today.isCheckedIn ? `Checked in @ ${today.checkInTime}` : "Not checked in yet"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-ink-secondary">{todayLabel}</p>
            <p className="text-[11px] font-medium text-ink-muted">
              {today.isCheckedIn ? "Open shift — remember to punch out" : "Use Punch Check-In to start your shift"}
            </p>
          </div>
        </div>
      </div>

      <AttendanceWorkspace
        initialRecords={data.records}
        initialCorrections={data.corrections}
        employeeId={data.employeeId}
        canApprove={canApprove}
      />
    </div>
  );
}
