"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeEmployeePayrollRun,
  filterPayrollEligibleEmployees,
  resolveMonthlyCtc,
} from "@/lib/services/payroll-engine";
import { assertPermission } from "@/lib/auth/assertPermission";
import { checkActionRateLimit } from "@/lib/auth/rate-limit";
import { validateRequestOrigin } from "@/lib/security";

export async function validatePayrollLockAction(periodId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_payroll_lock", {
    p_period_id: periodId,
  });

  if (error) return { error: `Payroll Lock Blocked: ${error.message}` };
  return { success: true };
}

export async function reopenPayrollPeriodAction(periodId: string, actorId?: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  let actId = actorId;
  if (!actId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (emp) actId = emp.id;
    }
  }

  const { data, error } = await supabase.rpc("reopen_payroll_period", {
    p_period_id: periodId,
    p_actor_id: actId || null,
  });

  if (error) return { error: error.message };
  return { success: true, newRevisionId: data };
}

export async function finalizePayrollPeriodAction(periodId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "finalized" })
    .eq("id", periodId);

  if (error) return { error: error.message };

  await supabase
    .from("payroll_revisions")
    .update({ status: "finalized" })
    .eq("payroll_period_id", periodId)
    .eq("status", "draft");

  return { success: true };
}

export async function createPayrollPeriodAction(year: number, month: number) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  const cutoffDate = endDate;

  const { data: period, error: pErr } = await supabase
    .from("payroll_periods")
    .insert({
      year,
      month,
      start_date: startDate,
      end_date: endDate,
      cutoff_date: cutoffDate,
      status: "draft",
    })
    .select()
    .single();

  if (pErr) return { error: pErr.message };

  // Create initial revision v1
  const { data: rev, error: rErr } = await supabase
    .from("payroll_revisions")
    .insert({
      payroll_period_id: period.id,
      revision_number: 1,
      status: "draft",
    })
    .select()
    .single();

  if (rErr) return { error: rErr.message };

  return { success: true, period, revision: rev };
}

export async function executeBulkPayrollRunAction(periodId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const rateCheck = await checkActionRateLimit(periodId, "bulk_payroll_run", 5, 3600000);
  if (!rateCheck.allowed) {
    const mins = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { error: `Rate limit exceeded: Too many bulk payroll runs. Please try again in ${mins} minute(s).` };
  }

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  // 1. Strict Payroll Lock Verification (FR §5.7)
  const { error: lockErr } = await supabase.rpc("validate_payroll_lock", {
    p_period_id: periodId,
  });

  if (lockErr) {
    return { error: `Lock Check Failed: ${lockErr.message}` };
  }

  // 2. Fetch period details
  const { data: period, error: periodErr } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("id", periodId)
    .single();

  if (periodErr || !period) return { error: periodErr?.message || "Payroll period not found" };

  // 3. Ensure revision row exists
  let { data: revision } = await supabase
    .from("payroll_revisions")
    .select("*")
    .eq("payroll_period_id", periodId)
    .eq("status", "draft")
    .order("revision_number", { ascending: false })
    .limit(1)
    .single();

  if (!revision) {
    const { data: newRev, error: revErr } = await supabase
      .from("payroll_revisions")
      .insert({
        payroll_period_id: periodId,
        revision_number: 1,
        status: "draft",
      })
      .select()
      .single();

    if (revErr) return { error: revErr.message };
    revision = newRev;
  }

  // 4. Fetch active employees
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, status")
    .eq("status", "active");

  if (empErr) return { error: empErr.message };
  const empList = employees || [];

  // 4b. Determine payroll eligibility for the period window (FR §2.1, §5.3)
  const periodStart = period.start_date;
  const periodEnd = period.end_date;
  const { data: eligibilityRows } = await supabase
    .from("payroll_eligibility")
    .select("employee_id, is_eligible, effective_from, effective_to")
    .lte("effective_from", periodEnd)
    .or(`effective_to.is.null,effective_to.gte.${periodStart}`);

  const { eligible: eligibleList, excludedCount } = filterPayrollEligibleEmployees(
    empList,
    eligibilityRows,
    periodStart,
    periodEnd
  );

  const daysInMonth = new Date(period.year, period.month, 0).getDate();
  let totalGrossRun = 0;
  let totalDeductionsRun = 0;
  let totalNetRun = 0;

  const eligibleEmpIds = eligibleList.map((e) => e.id);
  const excludedEmployees: Array<{ id: string; name: string; reason: string }> = [];

  // Track employees excluded by eligibility rules
  const eligibleIdSet = new Set(eligibleEmpIds);
  for (const emp of empList) {
    if (!eligibleIdSet.has(emp.id)) {
      excludedEmployees.push({
        id: emp.id,
        name: emp.full_name,
        reason: "Ineligible per payroll eligibility configuration or override",
      });
    }
  }

  if (eligibleEmpIds.length > 0) {
    // 5. Batch-fetch attendance, leaves, salary structures, and statutory profiles (NFR-06)
    const [
      { data: allAttRecords },
      { data: allLeaveReqs },
      { data: allSalStructs },
      { data: allStatProfiles },
    ] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id, employee_id, status")
        .in("employee_id", eligibleEmpIds)
        .gte("attendance_date", period.start_date)
        .lte("attendance_date", period.end_date),
      supabase
        .from("leave_requests")
        .select("employee_id, total_days, status")
        .in("employee_id", eligibleEmpIds)
        .eq("status", "approved")
        .gte("start_date", period.start_date)
        .lte("end_date", period.end_date),
      supabase
        .from("employee_salary_structures")
        .select("id, employee_id, monthly_ctc, annual_ctc, employee_salary_structure_items(*)")
        .in("employee_id", eligibleEmpIds),
      supabase
        .from("statutory_profiles")
        .select("*")
        .in("employee_id", eligibleEmpIds),
    ]);

    // Group batch results by employee_id for O(1) lookup
    const attMap = new Map<string, any[]>();
    const safeAtts = Array.isArray(allAttRecords) ? allAttRecords : (allAttRecords ? [allAttRecords] : []);
    for (const att of safeAtts) {
      if (!attMap.has(att.employee_id)) attMap.set(att.employee_id, []);
      attMap.get(att.employee_id)!.push(att);
    }

    const leaveMap = new Map<string, any[]>();
    const safeLeaves = Array.isArray(allLeaveReqs) ? allLeaveReqs : (allLeaveReqs ? [allLeaveReqs] : []);
    for (const req of safeLeaves) {
      if (!leaveMap.has(req.employee_id)) leaveMap.set(req.employee_id, []);
      leaveMap.get(req.employee_id)!.push(req);
    }

    const salaryMap = new Map<string, any>();
    const safeSals = Array.isArray(allSalStructs) ? allSalStructs : (allSalStructs ? [allSalStructs] : []);
    for (const sal of safeSals) {
      salaryMap.set(sal.employee_id || (sal as any).id, sal);
    }

    const statMap = new Map<string, any>();
    const safeStats = Array.isArray(allStatProfiles) ? allStatProfiles : (allStatProfiles ? [allStatProfiles] : []);
    for (const stat of safeStats) {
      statMap.set(stat.employee_id || (stat as any).id, stat);
    }

    const payslipPayloads: any[] = [];

    for (const emp of eligibleList) {
      const attRecords = attMap.get(emp.id) || [];
      const workedCount = attRecords.filter((r: any) => r.status === "present" || r.status === "extra_work").length;
      const halfDayCount = attRecords.filter((r: any) => r.status === "half_day").length;

      const leaveReqs = leaveMap.get(emp.id) || [];
      const paidLeaveDays = leaveReqs.reduce((acc: number, l: any) => acc + Number(l.total_days || 0), 0);

      const salStruct = salaryMap.get(emp.id) || (safeSals.length === 1 ? safeSals[0] : undefined);
      const statProfile = statMap.get(emp.id) || (safeStats.length === 1 ? safeStats[0] : undefined);

      const monthlyCtc = resolveMonthlyCtc(salStruct);
      if (monthlyCtc === null) {
        excludedEmployees.push({
          id: emp.id,
          name: emp.full_name || emp.employee_code || emp.id,
          reason: "Missing or invalid salary structure",
        });
        continue;
      }

      const run = computeEmployeePayrollRun({
        daysInMonth,
        workedCount,
        halfDayCount,
        paidLeaveDays,
        monthlyCtc,
        ptState: statProfile?.pt_state || "Karnataka",
        taxRegime: statProfile?.tax_regime || "new_regime",
        pfApplicable: statProfile?.pf_applicable ?? statProfile?.is_pf_eligible ?? true,
        esiApplicable: statProfile?.esi_applicable ?? statProfile?.is_esi_eligible ?? false,
      });

      totalGrossRun += run.grossMonthly;
      totalDeductionsRun += run.totalDeduction;
      totalNetRun += run.netPay;

      await supabase.from("payslips").upsert(
        {
          payroll_revision_id: revision.id,
          employee_id: emp.id,
          year: period.year,
          month: period.month,
          payable_units: run.payableUnits,
          lop_units: run.lopUnits,
          gross_earnings: run.grossMonthly,
          total_deductions: run.totalDeduction,
          net_pay: run.netPay,
          is_published: false,
        },
        { onConflict: "payroll_revision_id,employee_id" }
      );
    }
  }

  // 6. Update revision totals
  await supabase
    .from("payroll_revisions")
    .update({
      total_employees: eligibleList.length,
      total_gross: totalGrossRun,
      total_deductions: totalDeductionsRun,
      total_net: totalNetRun,
    })
    .eq("id", revision.id);

  // 7. Update period status to validated
  const { error: updateErr } = await supabase
    .from("payroll_periods")
    .update({ status: "validated" })
    .eq("id", periodId);

  if (updateErr) return { error: updateErr.message };

  return {
    success: true,
    count: eligibleList.length,
    excludedCount,
    excludedEmployees,
  };
}

