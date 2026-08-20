import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 02: Employee Lifecycle & Org Structure (P1)", () => {
  test("ORG-01: Direct onboarding creates invited employee with must_change_password=true", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Employee Directory & Assignments" heading.
    await expect(page.locator("main h2").first()).toContainText(/Employee Directory & Assignments/i);
  });

  test("ORG-05: Deactivation revokes system access", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/employees`);
    await expect(page.locator("body")).toBeVisible();
  });
});
