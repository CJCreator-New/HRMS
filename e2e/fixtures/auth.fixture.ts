import { test as baseTest, Page, BrowserContext } from "@playwright/test";
import { TEST_PERSONAS, DEFAULT_PASSWORD, TestPersona } from "./test-data";
import { signMockCookieValue } from "../../src/lib/auth/mock-cookie";

export type AuthFixtures = {
  loginAs: (personaKey: keyof typeof TEST_PERSONAS) => Promise<Page>;
  sysAdminPage: Page;
  hrAdminPage: Page;
  payrollAdminPage: Page;
  managerPage: Page;
  employeePage: Page;
  multiRolePage: Page;
  statutoryAdminPage: Page;
  financeAdminPage: Page;
  itAdminPage: Page;
};

/**
 * Injects a cryptographically signed HMAC mock authentication cookie into a BrowserContext.
 * Bypasses UI form interaction, completing authentication in 0ms.
 */
export async function injectAuthCookie(
  context: BrowserContext,
  email: string,
  baseURL: string = "http://localhost:3000"
) {
  const token = await signMockCookieValue(email);
  let domain = "localhost";
  try {
    const urlObj = new URL(baseURL || "http://localhost:3000");
    domain = urlObj.hostname || "localhost";
  } catch {
    domain = "localhost";
  }

  await context.addCookies([
    {
      name: "sb-access-token",
      value: token,
      domain,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Helper to perform full browser-based login via the /login form.
 * Used primarily in Smoke and Auth suite tests to validate form inputs and UI redirection.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD
): Promise<Page> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
  });
  return page;
}

export const test = baseTest.extend<AuthFixtures>({
  loginAs: async ({ context, page, baseURL }, use) => {
    const loginFn = async (personaKey: keyof typeof TEST_PERSONAS) => {
      const persona = TEST_PERSONAS[personaKey];
      if (!persona) throw new Error(`Unknown persona: ${personaKey}`);
      await injectAuthCookie(context, persona.email, baseURL || "http://localhost:3000");
      return page;
    };
    await use(loginFn);
  },

  sysAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.sys_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  hrAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.hr_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  payrollAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.payroll_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  managerPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.manager_m1.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  employeePage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.employee_e1.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  multiRolePage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.multi_hr_mgr.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  statutoryAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.statutory_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  financeAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.finance_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  itAdminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL: baseURL || "http://localhost:3000" });
    await injectAuthCookie(context, TEST_PERSONAS.it_admin.email, baseURL || "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
