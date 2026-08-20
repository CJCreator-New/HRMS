import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable, adminDb } from "../../fixtures/db.fixture";

// Golden-path routing trace (ticket 05): verifies the interconnections the
// mock world seeds — that each cross-role workflow routes to the right role at
// the right stage with the right status. DB-level assertions against the
// seeded fixtures (scripts/seed-mock-data.mjs); self-skip until a live
// backend is reachable (ADR 0004). The routing verification matrix lives in
// the ticket's resolution.
test.describe("Golden-Path Routing Trace (seeded world)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded data (ADR 0004); skipped in offline mock mode."
    );
  });

  test("TRACE-01: Employee leave routes to assigned manager (employee→manager)", async () => {
    const { data } = await adminDb
      .from("leave_requests")
      .select("current_approver_id, status")
      .eq("employee_id", "persona-emp-001")
      .eq("start_date", "2026-08-21")
      .maybeSingle();
    expect(data?.status).toBe("pending");
    expect(data?.current_approver_id).toBe("persona-mgr-001"); // manager_m1 via employee_manager_assignment
  });

  test("TRACE-02: HR leave routes to alternate HR approver, never self (FR §1.4)", async () => {
    const { data: settings } = await adminDb
      .from("company_settings")
      .select("alternate_hr_approver_id")
      .maybeSingle();
    expect(settings?.alternate_hr_approver_id).toBe("persona-hralt-001");

    const { data } = await adminDb
      .from("leave_requests")
      .select("current_approver_id, status")
      .eq("employee_id", "persona-hradmin-001")
      .eq("start_date", "2026-08-25")
      .maybeSingle();
    expect(data?.status).toBe("pending");
    expect(data?.current_approver_id).toBe("persona-hralt-001"); // not the applicant
  });

  test("TRACE-03: Reimbursement claims sit in the correct stage per approval_route", async () => {
    // TRAVEL (manager_then_hr) — approved at HR stage
    const travel = await adminDb
      .from("reimbursement_claims")
      .select("status, approver_id")
      .eq("employee_id", "persona-emp-001")
      .eq("claim_date", "2026-08-05")
      .maybeSingle();
    expect(travel.data?.status).toBe("approved");
    expect(travel.data?.approver_id).toBe("persona-hradmin-001");

    // INTERNET (manager_only) — seeded in manager stage; note D11 (ticket 04):
    // new manager_only claims start at pending_hr, and no stage transition
    // exists in decideApprovalAction.
    const internet = await adminDb
      .from("reimbursement_claims")
      .select("status, reimbursement_categories!inner(approval_route)")
      .eq("employee_id", "persona-emp-001")
      .eq("claim_date", "2026-08-08")
      .maybeSingle();
    expect(internet.data?.reimbursement_categories?.approval_route).toBe("manager_only");
    expect(internet.data?.status).toBe("pending_manager");
  });

  test("TRACE-04: Attendance anomaly preconditions the August payroll draft (anomaly lock)", async () => {
    const { data: anomaly } = await adminDb
      .from("attendance_records")
      .select("status")
      .eq("employee_id", "persona-emp-001")
      .eq("attendance_date", "2026-08-10")
      .maybeSingle();
    expect(anomaly?.status).toBe("pending_review");

    const { data: aug } = await adminDb
      .from("payroll_periods")
      .select("status")
      .eq("year", 2026)
      .eq("month", 8)
      .maybeSingle();
    expect(aug?.status).toBe("draft"); // open period with a pending anomaly
  });

  test("TRACE-05: Finalized July payroll carries a published payslip for E1", async () => {
    const { data: july } = await adminDb
      .from("payroll_periods")
      .select("id, status")
      .eq("year", 2026)
      .eq("month", 7)
      .maybeSingle();
    expect(july?.status).toBe("finalized");

    const { data: slip } = await adminDb
      .from("payslips")
      .select("is_published, net_pay, payroll_revisions!inner(payroll_period_id)")
      .eq("employee_id", "persona-emp-001")
      .eq("year", 2026)
      .eq("month", 7)
      .maybeSingle();
    expect(slip?.is_published).toBe(true);
    expect(slip?.net_pay).toBe(92800);
  });

  test("TRACE-06: Separation → F&F settlement interconnection (offboarded vs notice)", async () => {
    // Offboarded: completed separation + approved F&F
    const { data: offSep } = await adminDb
      .from("separation_records")
      .select("status, ff_settlement_records!inner(status, net_settlement_amount, approved_by)")
      .eq("employee_id", "persona-offboarded-001")
      .maybeSingle();
    expect(offSep?.status).toBe("completed");
    expect(offSep?.ff_settlement_records?.status).toBe("approved");
    expect(offSep?.ff_settlement_records?.net_settlement_amount).toBe(22500);
    expect(offSep?.ff_settlement_records?.approved_by).toBe("persona-hradmin-001");

    // Notice period: active separation with LWD tracked
    const { data: noticeSep } = await adminDb
      .from("separation_records")
      .select("status, last_working_day")
      .eq("employee_id", "persona-notice-001")
      .maybeSingle();
    expect(noticeSep?.status).toBe("active");
    expect(noticeSep?.last_working_day).toBe("2026-09-30");
  });

  test("TRACE-07: Payroll eligibility interconnection — suspended excluded, active included", async () => {
    const { data: susp } = await adminDb
      .from("payroll_eligibility")
      .select("is_eligible, source")
      .eq("employee_id", "persona-suspended-001")
      .maybeSingle();
    expect(susp?.is_eligible).toBe(false);
    expect(susp?.source).toBe("hr_override");

    const { data: e1 } = await adminDb
      .from("payroll_eligibility")
      .select("is_eligible")
      .eq("employee_id", "persona-emp-001")
      .maybeSingle();
    expect(e1?.is_eligible).toBe(true);
  });

  test("TRACE-08: Org hierarchy routes team data to the right managers", async () => {
    const expectManager = async (employeeId: string, managerId: string) => {
      const { data } = await adminDb
        .from("employee_manager_assignment")
        .select("manager_id")
        .eq("employee_id", employeeId)
        .is("effective_to", null)
        .maybeSingle();
      expect(data?.manager_id).toBe(managerId);
    };
    await expectManager("persona-emp-001", "persona-mgr-001"); // E1 → M1
    await expectManager("persona-emp-002", "persona-mgr-001"); // E2 → M1
    await expectManager("persona-emp-003", "persona-mgr-002"); // E3 → M2
    await expectManager("persona-mgr-001", "persona-sysadmin-001"); // M1 → sysadmin
  });

  test("TRACE-09: HR alternate self-application falls back to system_admin (C8, FR §1.4)", async () => {
    // C8 (gap catalog ticket `20`): when the applicant IS the configured
    // alternate HR approver, resolveLeaveApprover's self-approval guard skips
    // the alternate branch and routes to a system_admin approver. The seeder
    // models that branch (hr_alt applying on 2026-09-07 → sysadmin).
    const { data } = await adminDb
      .from("leave_requests")
      .select("status, current_approver_id")
      .eq("employee_id", "persona-hralt-001")
      .eq("start_date", "2026-09-07")
      .maybeSingle();
    expect(data?.status).toBe("pending");
    expect(data?.current_approver_id).toBe("persona-sysadmin-001"); // not the applicant
  });

  test("TRACE-10: Manual comp-off credit honors the 90-day expiry contract (C15)", async () => {
    // C15 (gap catalog ticket `21`): compoff.credit.manual / compoff.revoke are
    // unimplemented actions; this probe locks the seeded manual-credit contract
    // — days granted, 90-day expiry from the worked date, un-used flag, HR
    // approver, linked extra-work event — until the action exists.
    const { data } = await adminDb
      .from("comp_off_grants")
      .select("status, worked_date, days_granted, expiry_date, is_used, approver_id, attendance_record_id")
      .eq("employee_id", "persona-emp-001")
      .eq("worked_date", "2026-08-15")
      .maybeSingle();
    expect(data?.status).toBe("approved"); // manually credited by HR
    expect(data?.worked_date).toBe("2026-08-15");
    expect(data?.days_granted).toBe(1.0);
    expect(data?.expiry_date).toBe("2026-11-13"); // worked_date + 90 days (computeCompOffExpiryDate)
    expect(data?.is_used).toBe(false);
    expect(data?.approver_id).toBe("persona-hradmin-001");
    expect(data?.attendance_record_id).not.toBeNull(); // linked to the extra-work event
  });
});
