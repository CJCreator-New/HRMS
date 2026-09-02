// scripts/test-db-triggers.mjs
// Automated live PostgreSQL database trigger, constraint, and RPC validation suite.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.TEST_SUPABASE_URL;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_ANON_KEY;

if ((!supabaseUrl || !serviceRoleKey) && existsSync(".env.local")) {
  const envContent = readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key === "NEXT_PUBLIC_SUPABASE_URL" && !supabaseUrl) supabaseUrl = val;
    if (key === "SUPABASE_SERVICE_ROLE_KEY" && !serviceRoleKey) serviceRoleKey = val;
    if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY" && !anonKey) anonKey = val;
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Skipping test:db — Supabase credentials not found in environment or .env.local");
  process.exit(0);
}

const admin = createClient(supabaseUrl, serviceRoleKey);
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
    throw new Error(message);
  }
  console.log(`  ✅ PASSED: ${message}`);
  passed++;
}

async function runTests() {
  console.log("===============================================================================");
  console.log("  POSTGRESQL TRIGGER & RPC LIVE VALIDATION SUITE");
  console.log("===============================================================================");

  // Fetch test employee & leave type
  const { data: emp, error: empErr } = await admin.from("employees").select("id, status").eq("status", "active").limit(1).single();
  assert(!empErr && emp, `Active employee found for testing (${emp?.id})`);

  const { data: lt, error: ltErr } = await admin.from("leave_types").select("id, code, is_sandwich_enabled").limit(1).single();
  assert(!ltErr && lt, `Leave type found for testing (${lt?.code})`);

  // --- 1. Leave Overlap Prevention Trigger (§4.2) ---
  console.log("\n[TEST 1] Leave Overlap Prevention Trigger (prevent_overlapping_leave_requests)");
  const testStart = "2029-07-10";
  const testEnd = "2029-07-12";

  // Clean up any stale test leaves
  await admin.from("leave_requests").delete().eq("employee_id", emp.id).eq("start_date", testStart);

  const { data: initialLeave, error: insErr } = await admin.from("leave_requests").insert({
    employee_id: emp.id,
    leave_type_id: lt.id,
    start_date: testStart,
    end_date: testEnd,
    total_days: 3,
    reason: "Automated trigger verification test",
    status: "pending",
  }).select().single();

  assert(!insErr && initialLeave, "Inserted baseline pending leave request for date range");

  // Attempt overlapping insertion for overlapping dates
  const { error: overlapErr } = await admin.from("leave_requests").insert({
    employee_id: emp.id,
    leave_type_id: lt.id,
    start_date: "2029-07-11",
    end_date: "2029-07-13",
    total_days: 3,
    reason: "Overlapping request test",
    status: "pending",
  });

  assert(overlapErr && overlapErr.message.includes("Overlapping leave request detected"), 
    `Database rejected overlapping leave request: "${overlapErr?.message}"`);

  // Clean up baseline leave
  await admin.from("leave_requests").delete().eq("id", initialLeave.id);
  console.log("  🧹 Cleaned up baseline leave record");

  // --- 2. Leave Sandwich Calculation RPC (§4.2 / §4.6) ---
  console.log("\n[TEST 2] Leave Sandwich Calculation Function (calculate_leave_days)");
  const { data: calcDays, error: calcErr } = await admin.rpc("calculate_leave_days", {
    p_employee_id: emp.id,
    p_leave_type_id: lt.id,
    p_start_date: "2029-08-01",
    p_end_date: "2029-08-03",
    p_duration_type: "full_day",
  });

  assert(!calcErr && calcDays !== null, `calculate_leave_days executed successfully, returned: ${calcDays} days`);

  // --- 3. Strict Payroll Lock Verification RPC (§5.7) ---
  console.log("\n[TEST 3] Strict Payroll Lock Verification (validate_payroll_lock)");
  const { data: period } = await admin.from("payroll_periods").select("id, start_date, end_date").limit(1).single();

  if (period) {
    try {
      const { data: lockValid, error: lockErr } = await admin.rpc("validate_payroll_lock", {
        p_period_id: period.id,
      });

      if (lockErr) {
        assert(lockErr.message.includes("Payroll finalization blocked"), 
          `validate_payroll_lock properly blocked unfinalizable period: "${lockErr.message}"`);
      } else {
        assert(lockValid === true, `validate_payroll_lock verified period finalization lock: ${lockValid}`);
      }
    } catch (e) {
      assert(e.message.includes("Payroll finalization blocked"), `Exception caught on lock check: ${e.message}`);
    }
  } else {
    console.log("  ⚠️ No payroll period present; skipping validate_payroll_lock assertion");
  }

  // --- 4. Anonymous / RLS Deny Enforcement ---
  console.log("\n[TEST 4] Row Level Security (RLS) Deny Enforcement on Sensitive Tables");
  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: auditData, error: anonErr } = await anonClient.from("scheduled_job_logs").select("*");
    assert(!auditData || auditData.length === 0 || !!anonErr, "Anonymous unauthenticated access to scheduled_job_logs blocked by RLS");
  } else {
    console.log("  ⚠️ No anon key available; skipping anon RLS check");
  }

  console.log("\n===============================================================================");
  console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
