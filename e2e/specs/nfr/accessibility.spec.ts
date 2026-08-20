import { test, expect } from "../../fixtures/auth.fixture";
import AxeBuilder from "@axe-core/playwright";

test.describe("Suite P3: Accessibility (a11y) Automated Scans", () => {
  // Full 22-route coverage (NFR-07)
  const routesToScan = [
    "/login", "/", "/approvals", "/attendance", "/leave", "/reimbursements",
    "/permissions", "/calendar", "/employees", "/employees/import", "/onboarding",
    "/departments", "/offboarding", "/salary", "/payroll", "/eligibility",
    "/statutory", "/encashment", "/documents", "/settings", "/audit",
    "/jobs", "/reports",
  ];

  for (const route of routesToScan) {
    test(`A11Y-01: Accessibility scan on ${route} has zero critical violations`, async ({ loginAs, baseURL }) => {
      const page = await loginAs("sys_admin");

      await page.goto(`${baseURL}${route}`);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      expect(criticalViolations).toEqual([]);
    });
  }

  test("A11Y-04: Accessibility scan on the approvals detail drawer has zero critical violations", async ({
    managerPage: page,
  }) => {
    await page.goto("/approvals");
    await page.locator('[data-testid="view-approval-btn"]').first().click();
    await expect(page.locator('[data-testid="drawer"]')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toEqual([]);
  });
});
