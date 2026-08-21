import { createClient } from "@/lib/supabase/server";
import type { CurrentUserInfo } from "@/lib/auth/current-user";

/**
 * Server-side payroll data (Slice 5 — RSC conversion).
 *
 * Mirrors `getPayrollDataAction` so the payroll page resolves periods +
 * payslip register in one server pass. `canViewAll` (payroll.view permission)
 * is resolved by the caller from the shared permissions map — avoiding a
 * redundant `has_permission` RPC round-trip. Degrades to empty on DB failure.
 */

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  month_name: string;
  status: "draft" | "processing" | "validated" | "finalized" | "published";
  total_employees: number;
  active_revision: number;
}

export interface PayslipSummary {
  id: string;
  employee_code: string;
  employee_name: string;
  payable_units: number;
  lop_units: number;
  gross: number;
  deductions: number;
  net: number;
}

export interface PayrollDashboardData {
  periods: PayrollPeriod[];
  payslips: PayslipSummary[];
}

const monthName = (year: number, month: number) =>
  `${new Date(year, month - 1).toLocaleString("en-IN", { month: "long" })} ${year}`;

export async function getPayrollDashboard(
  userInfo: CurrentUserInfo,
  canViewAll: boolean
): Promise<PayrollDashboardData> {
  const empty: PayrollDashboardData = { periods: [], payslips: [] };
  const supabase = await createClient();

  try {
    const [{ data: periods }, { data: payslips }] = await Promise.all([
      supabase
        .from("payroll_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(12),
      canViewAll
        ? supabase
            .from("payslips")
            .select("*, employees(full_name, employee_code)")
            .order("created_at", { ascending: false })
            .limit(50)
        : supabase
            .from("payslips")
            .select("*, employees(full_name, employee_code)")
            .eq("employee_id", userInfo.employeeId || "")
            .order("created_at", { ascending: false }),
    ]);

    const typedPeriods = (periods || []) as Array<{
      id: string;
      year: number;
      month: number;
      status: PayrollPeriod["status"];
      total_employees?: number | null;
      active_revision_number?: number | null;
    }>;

    const typedPayslips = (payslips || []) as Array<{
      id: string;
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
      payable_units?: number | null;
      payable_days?: number | null;
      lop_units?: number | null;
      lop_days?: number | null;
      gross_earnings?: number | null;
      gross_pay?: number | null;
      total_deductions?: number | null;
      net_pay?: number | null;
    }>;

    return {
      periods: typedPeriods.map((p) => ({
        id: p.id,
        year: p.year,
        month: p.month,
        month_name: monthName(p.year, p.month),
        status: p.status,
        total_employees: p.total_employees || 0,
        active_revision: p.active_revision_number || 1,
      })),
      payslips: typedPayslips.map((p) => ({
        id: p.id,
        employee_code: p.employees?.employee_code || "",
        employee_name: p.employees?.full_name || "",
        payable_units: p.payable_units ?? p.payable_days ?? 0,
        lop_units: p.lop_units ?? p.lop_days ?? 0,
        gross: p.gross_earnings ?? p.gross_pay ?? 0,
        deductions: p.total_deductions || 0,
        net: p.net_pay || 0,
      })),
    };
  } catch {
    return empty;
  }
}
