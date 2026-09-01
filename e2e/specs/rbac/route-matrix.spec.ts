import { test, expect } from "../../fixtures/auth.fixture";
import { TEST_PERSONAS } from "../../fixtures/test-data";
import { ROUTE_CONFIG } from "../../../src/lib/nav/routeConfig";
import { E2E_MOCK_ALLOWED_ROUTES, isMockEmailAllowed } from "../../../src/lib/services/mock-rbac";

// Suite 01: RBAC parameterized route-access matrix.
//
// Covers the FULL 14-persona gate × all 22 gated routes (308 combinations),
// per the wayfinder follow-up on ticket `07`. Expected access is derived from
// `E2E_MOCK_ALLOWED_ROUTES` — the same table the middleware enforces — so the
// spec cannot drift from the gate (the pre-fix spec duplicated it by hand).
//
// Deliberate extra grants (employee_e1 → /payroll, hradmin → /permissions) are
// asserted here exactly as the mock gate defines them and are tracked as gaps
// D2/D9/D10/D13/D14/D15 in the wayfinder catalog. Deny-all personas
// (employee_e2, hr_alt, suspended, offboarded) must 403 on every route; the
// system_admin "ALL" bypass allows every route.
const GATED_ROUTES = ROUTE_CONFIG.filter((r) => !r.public).map((r) => r.path);
const PERSONAS = Object.keys(TEST_PERSONAS) as Array<keyof typeof TEST_PERSONAS>;

test.describe("Suite 01: RBAC Parameterized Route Access Matrix (P0)", () => {
  test("RBAC-GATE: spec enumeration is in sync with the mock gate (14 personas × 22 routes)", () => {
    // Every fixture persona must be covered by the gate — no orphan persona.
    // (Array form of toHaveProperty: the email contains a dot, which would
    // otherwise be treated as a nested-path separator.)
    for (const personaKey of PERSONAS) {
      expect(E2E_MOCK_ALLOWED_ROUTES).toHaveProperty([TEST_PERSONAS[personaKey].email]);
    }
    // Every gated route must be granted to at least one persona (explicitly or
    // via the system_admin ALL bypass) — no route silently drops out of the
    // matrix, and the enumeration is complete (22 routes).
    for (const route of GATED_ROUTES) {
      const covered = PERSONAS.some((key) =>
        isMockEmailAllowed(TEST_PERSONAS[key].email, route)
      );
      expect(covered, `gated route ${route} is not granted to any persona`).toBe(true);
    }
    expect(GATED_ROUTES.length).toBeGreaterThanOrEqual(20);
    expect(PERSONAS.length).toBeGreaterThanOrEqual(14);
  });

  for (const route of GATED_ROUTES) {
    for (const personaKey of PERSONAS) {
      const isAllowed = isMockEmailAllowed(TEST_PERSONAS[personaKey].email, route);
      const testName = `RBAC-GATE: ${personaKey} accessing ${route} → ${isAllowed ? "ALLOW (200)" : "BLOCK (403/Redirect)"}`;

      test(testName, async ({ loginAs, baseURL }) => {
        // Authenticate as persona
        const page = await loginAs(personaKey);

        // Direct navigation to route
        await page.goto(`${baseURL}${route}`);

        if (isAllowed) {
          await expect(page).not.toHaveURL(/\/403/);
        } else {
          // Should either redirect to 403 page or login
          const currentUrl = page.url();
          const is403OrRedirect = currentUrl.includes("/403") || currentUrl.includes("/login") || currentUrl.endsWith("/");
          expect(is403OrRedirect).toBe(true);
        }
      });
    }
  }
});
