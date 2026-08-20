import { test, expect } from "../../fixtures/auth.fixture";
import { isSupabaseReachable } from "../../fixtures/db.fixture";

/**
 * Suite 20 · NAV-01…NAV-04 — Breadcrumbs, nested active state, 404, aria-current
 * ----------------------------------------------------------------------------
 * Source: docs/DESIGN_FLOW_ENHANCEMENT_PLAN.md (WS-A §A1/A2/A4) ·
 *         docs/E2E_TEST_PLAN.md Suite 20
 *
 * ACTIVE since Phase 0. Relies on this data-testid contract:
 *      - `data-testid="breadcrumbs"`  breadcrumb trail container (Home › … )
 *      - `data-testid="breadcrumb-link"` on each crumb; final crumb has `aria-current="page"`
 *      - sidebar links `data-testid="nav-<route>"` with `aria-current="page"` when active
 *      - custom 404 page with `data-testid="not-found"`
 */
test.describe("Suite 20: Navigation — Breadcrumbs, Active State & 404 (NAV-01…04)", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isSupabaseReachable()),
      "Requires live Supabase backend (ADR 0004); skipped in offline mock mode."
    );
  });

  test("NAV-01: breadcrumbs render on an authenticated route with a Home trail", async ({ employeePage: page }) => {
    await page.goto("/leave");

    const crumbs = page.locator('[data-testid="breadcrumbs"]');
    await expect(crumbs).toBeVisible();
    await expect(crumbs.locator('[data-testid="breadcrumb-link"]').first()).toContainText(/Home/i);
    await expect(crumbs.locator('[data-testid="breadcrumb-link"]').last()).toContainText(/Leave/i);
  });

  test("NAV-02: nested route /employees/import resolves breadcrumbs and highlights its parent", async ({ hrAdminPage: page }) => {
    await page.goto("/employees/import");

    await expect(page.locator('[data-testid="breadcrumbs"]')).toContainText(/Employee Directory/i);
    await expect(page.locator('[data-testid="breadcrumbs"]')).toContainText(/Bulk Employee Import/i);
    await expect(page.locator('[data-testid="nav-employees"]')).toHaveAttribute("aria-current", "page");
  });

  test("NAV-03: unknown route renders the custom not-found page (no white screen)", async ({ employeePage: page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator('[data-testid="not-found"]')).toBeVisible();
  });

  test("NAV-04: active sidebar link and final breadcrumb carry aria-current=page", async ({ employeePage: page }) => {
    await page.goto("/attendance");

    await expect(page.locator('[data-testid="nav-attendance"]')).toHaveAttribute("aria-current", "page");
    await expect(
      page.locator('[data-testid="breadcrumbs"] [data-testid="breadcrumb-link"]').last()
    ).toHaveAttribute("aria-current", "page");
  });
});
