import { test, expect } from "../../fixtures/auth.fixture";
import { HeaderComponent } from "../../components/Header";

test.describe("Cross-Module Golden Path GP-08: Multi-Role Cumulative Union (P1)", () => {
  test("User with hr + manager roles holds cumulative union of permissions and can switch focus", async ({
    multiRolePage: page,
    baseURL,
  }) => {
    // 1. Visit /onboarding (HR permission)
    await page.goto(`${baseURL}/onboarding`);
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
    await expect(page).toHaveURL(/.*\/onboarding.*/);

    // 2. Visit /approvals (Manager permission)
    await page.goto(`${baseURL}/approvals`);
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
    await expect(page).toHaveURL(/.*\/approvals.*/);

    // 3. Verify Role Focus Switcher exists in Header
    const header = new HeaderComponent(page);
    await expect(header.roleSwitcher).toBeVisible();
    await header.switchRole("manager");
    await expect(page.locator("body")).not.toContainText(/403|Access Denied/i);
  });
});
