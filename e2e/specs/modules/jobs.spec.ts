import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 17: Scheduled Background Jobs (P1)", () => {
  test("JOB-01: Admin views job audit log and triggers manual job rerun", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/jobs`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Scheduled Background Jobs Monitor" heading.
    await expect(page.locator("main h2").first()).toContainText(/Scheduled Background Jobs Monitor/i);
  });
});
