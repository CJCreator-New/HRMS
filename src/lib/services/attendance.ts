import { createClient } from "@/lib/supabase/server";
import type { CurrentUserInfo } from "@/lib/auth/current-user";
import { getTodayDateStringIST } from "@/lib/utils/date-utils";

/**
 * Server-side attendance data (Slice 2 — RSC conversion).
 *
 * Mirrors the shape previously produced by `getAttendanceAction` (which is a
 * server action and cannot be called from a server component), resolved in one
 * server pass and passed to client islands as serialized props. Degrades to
 * empty data when the DB is unavailable so the page never 500s.
 */

export interface AttendanceRecordView {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

export interface CorrectionView {
  id: string;
  employee_name: string;
  date: string;
  requested_check_in: string;
  requested_check_out: string;
  reason: string;
  status: string;
}

export interface AttendanceDashboardData {
  employeeId: string | null;
  records: AttendanceRecordView[];
  corrections: CorrectionView[];
  /** Today's punch state — drives the Today strip and the punch-out target. */
  today: {
    isCheckedIn: boolean;
    checkInTime: string | null;
    activeRecordId: string | null;
  };
}

const time = (v: string | null | undefined) => (v ? v.substring(0, 5) : null);
const dateOf = (v: string | null | undefined, fallback = "") => v?.split("T")[0] ?? fallback;

export async function getAttendanceDashboard(userInfo: CurrentUserInfo): Promise<AttendanceDashboardData> {
  const empty: AttendanceDashboardData = {
    employeeId: userInfo.employeeId,
    records: [],
    corrections: [],
    today: { isCheckedIn: false, checkInTime: null, activeRecordId: null },
  };

  if (!userInfo.employeeId) return empty;

  const supabase = await createClient();
  const todayIso = getTodayDateStringIST();

  try {
    const [{ data: records }, { data: corrections }] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("*")
        .eq("employee_id", userInfo.employeeId)
        .order("attendance_date", { ascending: false })
        .limit(30),
      supabase
        .from("attendance_corrections")
        .select("*, employees!employee_id(full_name)")
        .eq("employee_id", userInfo.employeeId)
        .order("created_at", { ascending: false }),
    ]);

    const typedRecords = (records || []) as Array<{
      id: string;
      attendance_date: string;
      check_in_time?: string | null;
      check_out_time?: string | null;
      status: AttendanceRecordView["status"];
    }>;

    const typedCorrections = (corrections || []) as Array<{
      id: string;
      attendance_date?: string | null;
      created_at?: string | null;
      requested_check_in?: string | null;
      requested_check_out?: string | null;
      reason: string;
      status: CorrectionView["status"];
      employees?: { full_name?: string | null } | null;
    }>;

    const todayRec = typedRecords.find((r) => r.attendance_date === todayIso);

    return {
      employeeId: userInfo.employeeId,
      records: typedRecords.map((r) => ({
        id: r.id,
        date: r.attendance_date,
        check_in: time(r.check_in_time),
        check_out: time(r.check_out_time),
        status: r.status,
      })),
      corrections: typedCorrections.map((c) => ({
        id: c.id,
        employee_name: c.employees?.full_name || "Employee",
        date: dateOf(c.attendance_date, c.created_at?.split("T")[0]),
        requested_check_in: time(c.requested_check_in) || "09:00",
        requested_check_out: time(c.requested_check_out) || "17:30",
        reason: c.reason,
        status: c.status,
      })),
      today: {
        isCheckedIn: !!todayRec?.check_in_time && !todayRec?.check_out_time,
        checkInTime: time(todayRec?.check_in_time),
        activeRecordId: todayRec?.id ?? null,
      },
    };
  } catch {
    return empty;
  }
}
