import { test, expect } from "@playwright/test";

test("debug: login mount vs submit POSTs", async ({ page }) => {
  const posts: Array<{ phase: string; actionId: string; body: string }> = [];
  page.on("response", async (res) => {
    if (res.request().method() === "POST" && res.url().includes("/login")) {
      const body = await res.text().catch(() => "");
      posts.push({
        phase: "UNKNOWN",
        actionId: (res.request().headers()["next-action"] || "?"),
        body: body.replace(/\n/g, " | ").slice(0, 300),
      });
    }
  });
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/login")) {
      const last = posts[posts.length - 1];
      if (last) last.phase = "captured"; // placeholder, fixed below
    }
  });
  await page.goto("/login");
  await page.waitForTimeout(1200);
  console.log("LOGIN_DEBUG after-mount POSTs:", posts.length);
  await page.fill('input[type="email"]', "sysadmin@company.com");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  console.log("LOGIN_DEBUG after-submit POSTs:", posts.length);
  posts.forEach((p, i) => {
    console.log(`LOGIN_DEBUG POST[${i}] action=${p.actionId.slice(0, 12)} body=${p.body}`);
  });
  expect(true).toBe(true);
});
