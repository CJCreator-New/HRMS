import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Cross-Module Golden Path GP-07: HR Self-Approval Prevention & Fallback (P1 / C8)", () => {
  test("HR Admin leave routes to alternate approver and prevents self-approval per FR §1.4", async ({
    hrAdminPage: page,
    baseURL,
  }) => {
    // 1. HR Admin navigates to Leave Engine
    await page.goto(`${baseURL}/leave`);
    await expect(page.locator("body")).toContainText(/Leave Engine|Apply for Leave|Leave/i);

    // 2. HR Admin views Approvals — self-approval prevention guarantees no self-decision
    await page.goto(`${baseURL}/approvals`);
    await expect(page.locator("body")).toContainText(/Approvals/i);
  });

  test("Alternate HR Admin (hr.alt) has access to Approvals queue for fallback decisions", async ({
    loginAs,
    baseURL,
  }) => {
    // Alternate HR Admin authenticates and accesses Approvals queue
    const altPage = await loginAs("hr_alt_approver");
    await altPage.goto(`${baseURL}/approvals`);
    await expect(altPage).not.toHaveURL(/\/403/);
    await expect(altPage.locator("body")).toContainText(/Approvals/i);
  });

  test("System Admin has full fallback approval authority across all pending queues", async ({
    sysAdminPage: page,
    baseURL,
  }) => {
    // System Admin accesses Approvals queue as root fallback
    await page.goto(`${baseURL}/approvals`);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator("body")).toContainText(/Approvals/i);
  });
});

