import { test as baseTest, Page } from "@playwright/test";
import { TEST_PERSONAS, DEFAULT_PASSWORD, TestPersona } from "./test-data";

export type AuthFixtures = {
  loginAs: (personaKey: keyof typeof TEST_PERSONAS) => Promise<Page>;
  sysAdminPage: Page;
  hrAdminPage: Page;
  payrollAdminPage: Page;
  managerPage: Page;
  employeePage: Page;
};

export const test = baseTest.extend<AuthFixtures>({
  loginAs: async ({ page, baseURL }, use) => {
    const loginFn = async (personaKey: keyof typeof TEST_PERSONAS) => {
      const persona = TEST_PERSONAS[personaKey];
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', persona.email);
      await page.fill('input[type="password"]', DEFAULT_PASSWORD);
      await page.click('button[type="submit"]');
      // Wait for the login to redirect away from /login (up to 10s).
      // If the redirect never fires, the test will fail here with a clear
      // timeout error instead of silently continuing on the login page.
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
      return page;
    };
    await use(loginFn);
  },

  sysAdminPage: async ({ loginAs }, use) => {
    const page = await loginAs("sys_admin");
    await use(page);
  },

  hrAdminPage: async ({ loginAs }, use) => {
    const page = await loginAs("hr_admin");
    await use(page);
  },

  payrollAdminPage: async ({ loginAs }, use) => {
    const page = await loginAs("payroll_admin");
    await use(page);
  },

  managerPage: async ({ loginAs }, use) => {
    const page = await loginAs("manager_m1");
    await use(page);
  },

  employeePage: async ({ loginAs }, use) => {
    const page = await loginAs("employee_e1");
    await use(page);
  },
});

export { expect } from "@playwright/test";
