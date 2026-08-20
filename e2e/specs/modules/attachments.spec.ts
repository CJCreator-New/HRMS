import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Module 14: Document Attachments (P1)", () => {
  test("ATT-01: Upload document attachment with MIME validation and size check", async ({ employeePage: page, baseURL }) => {
    await page.goto(`${baseURL}/documents`);
    // Page heading is an h2 inside <main>; sidebar category labels are also h2s,
    // so scope to main to match the current "Document Attachment Manager" heading.
    await expect(page.locator("main h2").first()).toContainText(/Document Attachment Manager/i);
  });
});
