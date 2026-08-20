import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · TAB-01…TAB-02 — Server-side pagination & column sort (M-09)
 * ----------------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-B DataTable) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVATED in Phase 1 — server-side pagination + sort shipped on the employees
 * directory and unified approvals inbox (M-09).
 *
 * data-testid contract (implemented by src/components/shared/DataTable.tsx):
 *  - table container: `data-testid="<name>-table"` (employees-table, approvals-table)
 *  - pagination:      `data-testid="pagination"`, `pagination-prev`, `pagination-next`,
 *                     `pagination-size` (25/50/100), `pagination-page` (e.g. "Page 1 of 3")
 *  - sortable headers: `data-testid="sort-<field>"` toggling `aria-sort="ascending|descending"`
 *
 * NOTE: assumes the seeded dataset exceeds one page (25 rows) for the next-page
 * navigation assertion in TAB-01.
 */
test.describe("Suite 20: UI Consistency — Pagination & Sort (TAB-01, TAB-02)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend + seeded rows (ADR 0004); skipped in offline mock mode."
    );
  });

  test("TAB-01: employees table paginates server-side and sorts by column", async ({ hrAdminPage: page }) => {
    await page.goto("/employees");

    await expect(page.locator('[data-testid="employees-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

    await page.selectOption('[data-testid="pagination-size"]', "25");
    await page.click('[data-testid="pagination-next"]');
    await expect(page.locator('[data-testid="pagination-page"]')).not.toHaveText("Page 1 of 1");

    await page.click('[data-testid="sort-employee_code"]');
    await expect(page.locator('[data-testid="sort-employee_code"]')).toHaveAttribute(
      "aria-sort",
      /ascending|descending/
    );
  });

  test("TAB-02: approvals inbox paginates and supports status sort", async ({ managerPage: page }) => {
    await page.goto("/approvals");

    await expect(page.locator('[data-testid="approvals-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

    await page.click('[data-testid="sort-status"]');
    await expect(page.locator('[data-testid="sort-status"]')).toHaveAttribute("aria-sort", /ascending|descending/);
  });
});
