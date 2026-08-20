import { FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

async function globalSetup(config: FullConfig) {
  console.log("[Playwright globalSetup] Initializing E2E Test Suite Environment with Comprehensive Mock Data...");
  try {
    const seederScript = path.resolve(__dirname, "../scripts/seed-mock-data.mjs");
    execSync(`node "${seederScript}"`, { stdio: "inherit" });
    console.log("[Playwright globalSetup] E2E Environment Seeding Complete.");
  } catch (err: any) {
    console.warn(`[Playwright globalSetup] Seeding Note: ${err.message}`);
  }
}

export default globalSetup;
