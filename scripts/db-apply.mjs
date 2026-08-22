import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const SCHEMA_DIR = path.join(ROOT_DIR, "schema");
const COMBINED_FILE = path.join(SCHEMA_DIR, "combined_init.sql");

const MODULAR_FILES = [
  "00_setup.sql",
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
  "bootstrap/01_system_admin.sql",
];

console.log("Synchronizing schema/combined_init.sql from 27 modular schema files...");

let combinedContent = `-- ============================================================================
-- HRMS v2.7 — Master Combined Database Initializer Script
-- Generated Automatically via scripts/db-apply.mjs
-- Source: schema/00_setup.sql through 24_payroll_dirty_triggers.sql + bootstrap
-- ============================================================================

`;

for (const fileRel of MODULAR_FILES) {
  const filePath = path.join(SCHEMA_DIR, fileRel);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    combinedContent += `-- BEGIN FILE: ${fileRel}\n` + content + `\n\n-- END FILE: ${fileRel}\n\n`;
  } else {
    console.warn(`Warning: File not found ${filePath}`);
  }
}

fs.writeFileSync(COMBINED_FILE, combinedContent, "utf-8");
console.log(`Successfully generated ${COMBINED_FILE} (${combinedContent.length} bytes)!`);
