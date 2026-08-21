"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildAttendanceCsv,
  buildLeaveCsv,
  buildPayrollCsv,
  buildStatutoryCsv,
} from "@/lib/services/reports-engine";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";

export async function generateReportDataAction(reportId: string): Promise<{ success: boolean; csv?: string; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("reports.export");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  const MAX_REPORT_ROWS = 5000;

  if (reportId === "rep-01") {
    // Attendance Summary View
    const { data } = await supabase
      .from("v_monthly_attendance_summary")
      .select("*")
      .order("month_year", { ascending: false })
      .limit(MAX_REPORT_ROWS);
    return { success: true, csv: buildAttendanceCsv(data || []) };
  }

  if (reportId === "rep-02") {
    // Leave Utilization Summary View
    const { data } = await supabase
      .from("v_leave_utilization_summary")
      .select("*")
      .order("year", { ascending: false })
      .limit(MAX_REPORT_ROWS);
    return { success: true, csv: buildLeaveCsv(data || []) };
  }

  if (reportId === "rep-03") {
    // Statutory Compliance Register
    const { data } = await supabase
      .from("statutory_profiles")
      .select("*, employees(full_name, employee_code)")
      .order("created_at", { ascending: false })
      .limit(MAX_REPORT_ROWS);
    return { success: true, csv: buildStatutoryCsv(data || []) };
  }

  if (reportId === "rep-04") {
    // Payroll Register Summary View
    const { data } = await supabase
      .from("v_payroll_register_summary")
      .select("*")
      .order("revision_number", { ascending: false })
      .limit(MAX_REPORT_ROWS);
    return { success: true, csv: buildPayrollCsv(data || []) };
  }

  return { success: false, error: "Unknown report ID" };
}
