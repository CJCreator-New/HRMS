import { test, expect } from "../../fixtures/auth.fixture";
import { OffboardingPage } from "../../pages/OffboardingPage";
import { ApprovalsPage } from "../../pages/ApprovalsPage";

test.describe("Cross-Module Golden Path GP-06: Resignation-to-F&F (P1)", () => {
  test("Resignation workflow: Submission → Clearance tracking → Approvals queue", async ({
    hrAdminPage,
    managerPage,
    baseURL,
  }) => {
    // 1. HR Admin views offboarding workspace and submits resignation
    const offboarding = new OffboardingPage(hrAdminPage, baseURL);
    await offboarding.goto();
    await offboarding.assertLoaded();
    await offboarding.submitResignation(60);

    // 2. Manager reviews offboarding approvals
    const approvals = new ApprovalsPage(managerPage, baseURL);
    await approvals.goto();
    await approvals.assertLoaded();
    await approvals.filterByModule("Offboarding F&F");
  });
});
