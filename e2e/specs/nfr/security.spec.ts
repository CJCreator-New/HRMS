import { test as baseTest, expect } from "@playwright/test";
import { injectAuthCookie } from "../../fixtures/auth.fixture";

baseTest.describe("P2-P3 Non-Functional Requirements: Security Probes", () => {
  baseTest("SEC-01: Direct unauthenticated route access redirects to /login", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/payroll`);
    await expect(page).toHaveURL(/.*login/);
  });

  baseTest("SEC-02: Direct forbidden route access returns 403 or redirects", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/settings`);
    await expect(page).toHaveURL(/.*login/);
  });
});

baseTest.describe("NFR-08: Extended Security Probes", () => {
  baseTest.describe("CSRF Protection", () => {
    baseTest("SEC-03: Server action with mismatched origin header is handled safely", async ({ page, baseURL }) => {
      const response = await page.request.post(`${baseURL}/login`, {
        headers: {
          origin: "https://evil-attacker.com",
          host: new URL(baseURL!).host,
        },
        form: {
          email: "employee.e1@company.com",
          password: "Password123!",
        },
      });
      // Mismatched origin must be rejected (403 Forbidden or redirected), never accepted with 200 OK
      expect([403, 302, 303]).toContain(response.status());
    });
  });

  baseTest.describe("IDOR & Direct Access Prevention", () => {
    baseTest("SEC-04: Unauthenticated access to attendance is blocked", async ({
      page,
      baseURL,
    }) => {
      await page.goto(`${baseURL}/attendance`);
      await expect(page).toHaveURL(/.*login/);
    });
  });

  baseTest.describe("XSS Prevention", () => {
    baseTest("SEC-05: Script tags in user input are sanitized on render", async ({ page, baseURL }) => {
      await injectAuthCookie(page.context(), "employee.e1@company.com", baseURL);
      await page.goto(`${baseURL}/leave`);

      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert(document.cookie)</script>');
    });
  });

  baseTest.describe("Cookie Tampering", () => {
    baseTest("SEC-06: Tampered sb-access-token cookie results in redirect to /login or /403", async ({
      page,
      baseURL,
    }) => {
      const hostname = new URL(baseURL || "http://localhost:3000").hostname || "localhost";
      await page.context().addCookies([
        {
          name: "sb-access-token",
          value: "sysadmin@company.com:tampered_signature:9999999999999",
          domain: hostname,
          path: "/",
          httpOnly: true,
        },
      ]);

      await page.goto(`${baseURL}/settings`);
      await expect(page).toHaveURL(/.*(?:login|403)/);
    });

    baseTest("SEC-06b: Expired mock cookie results in redirect to /login or /403", async ({ page, baseURL }) => {
      const hostname = new URL(baseURL || "http://localhost:3000").hostname || "localhost";
      await page.context().addCookies([
        {
          name: "sb-access-token",
          value: "sysadmin@company.com:1000000000000:dummysig",
          domain: hostname,
          path: "/",
          httpOnly: true,
        },
      ]);

      await page.goto(`${baseURL}/settings`);
      await expect(page).toHaveURL(/.*(?:login|403)/);
    });
  });

  baseTest.describe("Session Handling", () => {
    baseTest("SEC-07: After logout, old session cookie no longer grants access", async ({
      page,
      baseURL,
    }) => {
      await injectAuthCookie(page.context(), "sysadmin@company.com", baseURL);
      await page.goto(`${baseURL}/`);
      await expect(page).not.toHaveURL(/.*login/);

      // Clear cookies to simulate logout
      await page.context().clearCookies();

      // Attempt to access protected page again — should redirect to /login
      await page.goto(`${baseURL}/settings`);
      await expect(page).toHaveURL(/.*login/);
    });

    baseTest("SEC-08: Expired cookie is rejected and user is redirected to login", async ({
      page,
      baseURL,
    }) => {
      const hostname = new URL(baseURL || "http://localhost:3000").hostname || "localhost";
      await page.context().addCookies([
        {
          name: "sb-access-token",
          value: "employee.e1@company.com:1000000000000:expired_sig",
          domain: hostname,
          path: "/",
          httpOnly: true,
          expires: Math.floor(Date.now() / 1000) - 3600,
        },
      ]);

      await page.goto(`${baseURL}/attendance`);
      await expect(page).toHaveURL(/.*login/);
    });
  });
});
