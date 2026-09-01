import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load .env.local
const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const envConfig = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    envConfig[key] = val;
  }
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runPerformanceBenchmarks() {
  console.log("=== SUPABASE CONCURRENCY & COMPLEX QUERY BENCHMARKS ===");

  // 1. Relational join query: Employees + Assignments
  const t0 = performance.now();
  const { data: empData, error: empErr } = await adminClient
    .from("employees")
    .select("id, full_name, email, status, employee_department_assignment(department_id, effective_to), employee_manager_assignment(manager_id, effective_to)")
    .limit(10);
  const t1 = performance.now();
  console.log("Query 1 (Employees + Dept/Mgr Relations):", +(t1 - t0).toFixed(2), "ms | Result rows:", empData?.length || 0, empErr ? `Error: ${empErr.message}` : "OK");

  // 2. Relational join query: Leave requests + Type + Approvals
  const t2 = performance.now();
  const { data: leaveData, error: leaveErr } = await adminClient
    .from("leave_requests")
    .select("id, employee_id, start_date, end_date, status, leave_types(name, code), leave_request_approvals(approver_id, stage, status)")
    .limit(10);
  const t3 = performance.now();
  console.log("Query 2 (Leave Requests + Approvals Relations):", +(t3 - t2).toFixed(2), "ms | Result rows:", leaveData?.length || 0, leaveErr ? `Error: ${leaveErr.message}` : "OK");

  // 3. Paginated & Sorted query on high-write table (Audit Logs)
  const t4 = performance.now();
  const { data: auditData, error: auditErr } = await adminClient
    .from("audit_logs")
    .select("id, entity_type, action, performed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  const t5 = performance.now();
  console.log("Query 3 (Audit Logs Sorted & Paginated):", +(t5 - t4).toFixed(2), "ms | Result rows:", auditData?.length || 0, auditErr ? `Error: ${auditErr.message}` : "OK");

  // 4. Attendance punches join query
  const t6 = performance.now();
  const { data: attData, error: attErr } = await adminClient
    .from("attendance_records")
    .select("id, employee_id, attendance_date, status, attendance_punches(id, punch_type, punch_time)")
    .limit(10);
  const t7 = performance.now();
  console.log("Query 4 (Attendance Records + Punches Relations):", +(t7 - t6).toFixed(2), "ms | Result rows:", attData?.length || 0, attErr ? `Error: ${attErr.message}` : "OK");

  // 5. Concurrency Burst: 20 simultaneous queries to assess pooler connection multiplexing
  console.log("\n--- Testing Concurrency Burst (20 parallel queries) ---");
  const burstStart = performance.now();
  const queries = Array.from({ length: 20 }, async (_, i) => {
    const start = performance.now();
    const { data, error } = await adminClient.from("employees").select("id, full_name, status").limit(5);
    const end = performance.now();
    return {
      queryIndex: i + 1,
      durationMs: +(end - start).toFixed(2),
      success: !error && Boolean(data),
      error: error?.message || null,
    };
  });

  const results = await Promise.all(queries);
  const burstEnd = performance.now();
  const totalBurstDuration = +(burstEnd - burstStart).toFixed(2);
  const durations = results.map(r => r.durationMs);
  const avg = +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const successCount = results.filter(r => r.success).length;

  console.log("Concurrency Burst Results:");
  console.log(`- Total Burst Duration: ${totalBurstDuration} ms for 20 requests`);
  console.log(`- Successful: ${successCount} / 20`);
  console.log(`- Min Latency: ${min} ms`);
  console.log(`- Max Latency: ${max} ms`);
  console.log(`- Average Latency: ${avg} ms`);

  // 6. Realtime Subscription Stress Check (multiple rapid broadcast pings)
  console.log("\n--- Testing Realtime Subscription Under Load ---");
  const channel = adminClient.channel("load-test-channel", {
    config: { broadcast: { self: true } }
  });

  let receivedCount = 0;
  const sendCount = 10;
  const rtStart = performance.now();

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`Realtime load test timed out. Received ${receivedCount}/${sendCount} events.`);
      adminClient.removeChannel(channel);
      resolve();
    }, 8000);

    channel.on("broadcast", { event: "stress_ping" }, (payload) => {
      receivedCount++;
      if (receivedCount === sendCount) {
        const rtEnd = performance.now();
        console.log(`Realtime burst success: 10/10 messages delivered in ${+(rtEnd - rtStart).toFixed(2)} ms!`);
        clearTimeout(timeout);
        adminClient.removeChannel(channel);
        resolve();
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log("Channel subscribed, firing 10 rapid broadcast events...");
        for (let i = 0; i < sendCount; i++) {
          await channel.send({
            type: "broadcast",
            event: "stress_ping",
            payload: { seq: i, timestamp: Date.now() }
          });
        }
      }
    });
  });
}

runPerformanceBenchmarks().catch(console.error);
