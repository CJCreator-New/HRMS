#!/usr/bin/env node

/**
 * Supabase Test Project Setup Script
 *
 * Sets up a dedicated Supabase test project for live-backend E2E tests.
 * This script:
 *   1. Validates environment variables
 *   2. Tests Supabase connectivity
 *   3. Applies database schema
 *   4. Seeds mock data
 *   5. Verifies the setup
 *
 * Usage:
 *   node scripts/setup-supabase-test.mjs
 *
 * Environment Variables:
 *   NEXT_PUBLIC_SUPABASE_URL       - Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  - Supabase anon key
 *   SUPABASE_SERVICE_ROLE_KEY      - Supabase service role key
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ─── Color Helpers ──────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function success(msg) {
  log(GREEN + "✅", msg + RESET);
}

function error(msg) {
  log(RED + "❌", msg + RESET);
}

function warn(msg) {
  log(YELLOW + "⚠️ ", msg + RESET);
}

function info(msg) {
  log(CYAN + "ℹ️ ", msg + RESET);
}

// ─── Step 1: Validate Environment ──────────────────────────────────────
function validateEnvironment() {
  console.log("\n" + "═".repeat(60));
  console.log("  Step 1: Validating Environment Variables");
  console.log("═".repeat(60));

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    error(`Missing required environment variables:\n  ${missing.join("\n  ")}`);
    console.log("\nTo set up:");
    console.log("  export NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'");
    console.log("  export NEXT_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'");
    console.log("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'");
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url.startsWith("http")) {
    error(`NEXT_PUBLIC_SUPABASE_URL must start with http(s): ${url}`);
    return false;
  }

  success(`Supabase URL: ${url}`);
  success("All required environment variables set");
  return true;
}

// ─── Step 2: Test Connectivity ─────────────────────────────────────────
async function testConnectivity() {
  console.log("\n" + "═".repeat(60));
  console.log("  Step 2: Testing Supabase Connectivity");
  console.log("═".repeat(60));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status >= 200 && res.status < 500) {
      success(`Supabase reachable (HTTP ${res.status})`);
      return true;
    } else {
      error(`Supabase returned unexpected status: ${res.status}`);
      return false;
    }
  } catch (err) {
    error(`Supabase unreachable: ${err.message}`);
    return false;
  }
}

// ─── Step 3: Apply Schema ──────────────────────────────────────────────
function applySchema() {
  console.log("\n" + "═".repeat(60));
  console.log("  Step 3: Applying Database Schema");
  console.log("═".repeat(60));

  try {
    // First generate the combined schema
    info("Generating combined schema from modular files...");
    execSync("node scripts/db-apply.mjs", {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });

    success("Schema generation complete");
    return true;
  } catch (err) {
    error(`Schema generation failed: ${err.message}`);
    return false;
  }
}

// ─── Step 4: Seed Mock Data ────────────────────────────────────────────
function seedMockData() {
  console.log("\n" + "═".repeat(60));
  console.log("  Step 4: Seeding Mock Data");
  console.log("═".repeat(60));

  try {
    info("Running seed script...");
    execSync("node scripts/seed-mock-data.mjs", {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    success("Mock data seeded successfully");
    return true;
  } catch (err) {
    error(`Seeding failed: ${err.message}`);
    return false;
  }
}

// ─── Step 5: Verify Setup ──────────────────────────────────────────────
async function verifySetup() {
  console.log("\n" + "═".repeat(60));
  console.log("  Step 5: Verifying Setup");
  console.log("═".repeat(60));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const checks = [
    {
      name: "Roles table",
      query: () => supabase.from("roles").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Permissions table",
      query: () => supabase.from("permissions").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Employees table",
      query: () => supabase.from("employees").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Leave types table",
      query: () => supabase.from("leave_types").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Attendance records",
      query: () => supabase.from("attendance_records").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Salary structures",
      query: () => supabase.from("employee_salary_structures").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Statutory profiles",
      query: () => supabase.from("statutory_profiles").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
    {
      name: "Company settings",
      query: () => supabase.from("company_settings").select("id").limit(1),
      expected: (data) => data && data.length > 0,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      const { data, error } = await check.query();
      if (check.expected(data) && !error) {
        success(check.name);
        passed++;
      } else {
        error(`${check.name} — ${error?.message || "no data"}`);
        failed++;
      }
    } catch (err) {
      error(`${check.name} — ${err.message}`);
      failed++;
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log(`  Verification: ${passed} passed, ${failed} failed`);
  console.log("─".repeat(60));

  return failed === 0;
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  HRMS v2.7 — Supabase Test Project Setup");
  console.log("═".repeat(60));

  // Step 1: Validate environment
  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Step 2: Test connectivity
  const reachable = await testConnectivity();
  if (!reachable) {
    error("Cannot proceed without Supabase connectivity");
    process.exit(1);
  }

  // Step 3: Apply schema
  if (!applySchema()) {
    warn("Schema generation failed — tables may already exist");
  }

  // Step 4: Seed mock data
  if (!seedMockData()) {
    warn("Seeding failed — data may already exist");
  }

  // Step 5: Verify setup
  const verified = await verifySetup();

  console.log("\n" + "═".repeat(60));
  if (verified) {
    success("Supabase test project setup complete!");
    console.log("\n  You can now run live-backend E2E tests:");
    console.log("    npm run test:golden-path");
    console.log("    npm run test:audit");
    console.log("\n  Or trigger the CI workflow:");
    console.log("    gh workflow run e2e-live-backend.yml");
  } else {
    warn("Setup completed with some verification failures");
    console.log("\n  Check the Supabase dashboard for table status:");
    console.log(`    ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});
