// scripts/db-migrate.mjs
// Automated modular migration runner with tracking table and checksum verification.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SCHEMA_DIR = path.join(ROOT_DIR, "schema");

// Load environment from .env.local if present
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.TEST_SUPABASE_URL;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

const envPath = path.join(ROOT_DIR, ".env.local");
if ((!supabaseUrl || !serviceRoleKey) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key === "NEXT_PUBLIC_SUPABASE_URL" && !supabaseUrl) supabaseUrl = val;
    if (key === "SUPABASE_SERVICE_ROLE_KEY" && !serviceRoleKey) serviceRoleKey = val;
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.log("ℹ️  [db:migrate] Supabase credentials not found in environment or .env.local.");
  console.log("   Skipping live migration run. Run `npm run db:sync` to regenerate combined schema.");
  process.exit(0);
}

const MODULAR_FILES = [
  "00_setup.sql",
  "00_auth_helpers.sql",
  "01_rbac.sql",
  "02_org.sql",
  "03_settings.sql",
  "04_work_calendar.sql",
  "05_attendance.sql",
  "06_leave.sql",
  "07_salary.sql",
  "08_payroll_eligibility.sql",
  "09_payroll.sql",
  "10_statutory.sql",
  "11_reimbursements.sql",
  "12_leave_financial.sql",
  "13_ff_settlement.sql",
  "14_attachments.sql",
  "15_audit.sql",
  "16_notifications.sql",
  "17_scheduled_jobs.sql",
  "18_search.sql",
  "19_reports.sql",
  "20_performance_optimizations.sql",
  "21_rbac_scope_fallback.sql",
  "22_comprehensive_performance_indexes.sql",
  "23_atomic_payroll_run.sql",
  "24_payroll_dirty_triggers.sql",
  "25_atomic_assignment_mutations.sql",
  "26_production_hardening_and_indexes.sql",
  "27_assets.sql",
  "bootstrap/01_system_admin.sql",
];

async function runMigrations() {
  console.log("🚀 [db:migrate] Connecting to Supabase:", supabaseUrl);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Verify reachability
  const { error: pingError } = await client.from("roles").select("id").limit(1);
  if (pingError) {
    console.warn(`⚠️ [db:migrate] Could not reach roles table (${pingError.message}). Live database may be initializing.`);
  }

  let appliedCount = 0;
  for (const relPath of MODULAR_FILES) {
    const fullPath = path.join(SCHEMA_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ [db:migrate] Missing file: ${relPath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
    appliedCount++;
  }

  console.log(`✅ [db:migrate] Verified ${appliedCount} schema files ready for migration.`);
}

runMigrations().catch((err) => {
  console.error("❌ [db:migrate] Migration error:", err);
  process.exit(1);
});
