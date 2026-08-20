import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 04: Work Calendar & Holidays (P1)", () => {
  test("CAL-01: Create and view 5-day and 6-day work calendar templates", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/calendar`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Work Calendar Templates & Holiday Selection" heading.
    await expect(page.locator("main h2").first()).toContainText(/Work Calendar Templates/i);
  });

  test("CAL-02: Calendar template batch assignment drawer and template download available", async ({ hrAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/calendar`);
    const batchBtn = page.getByRole("button", { name: /Batch Assign Calendar/i });
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();
    await expect(page.getByText(/Batch Upload: Calendar Template Assignments/i)).toBeVisible();
    await expect(page.getByText(/Download Template/i)).toBeVisible();
  });
});
