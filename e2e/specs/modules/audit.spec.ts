import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 15: System Audit Trail (P1)", () => {
  test("AUD-01: Admin can view immutable system audit log", async ({ sysAdminPage: page, baseURL }) => {
    await page.goto(`${baseURL}/audit`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Immutable System Audit Log Viewer" heading.
    await expect(page.locator("main h2").first()).toContainText(/Immutable System Audit Log/i);
  });
});
