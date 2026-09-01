import { defineConfig, devices } from "@playwright/test";

const isLiveBackend = process.env.NEXT_PUBLIC_MOCK_AUTH === "false";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 45 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "e2e-report", open: "never" }],
    ["list"],
  ],
  globalSetup: require.resolve("./e2e/global-setup"),
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // ─── Offline Mock-Auth Projects (Default) ─────────────────────────
    ...(isLiveBackend
      ? []
      : [
          {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
          {
            name: "edge",
            use: { ...devices["Desktop Edge"] },
          },
          {
            name: "mobile-chrome",
            use: { ...devices["Pixel 5"] },
          },
          {
            name: "mobile-safari",
            use: { ...devices["iPhone 12"] },
          },
          {
            name: "tablet",
            use: { ...devices["iPad Mini"] },
          },
        ]),

    // ─── Live-Backend Projects ────────────────────────────────────────
    ...(isLiveBackend
      ? [
          {
            name: "live-chromium",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
  webServer: isLiveBackend
    ? undefined // No web server when running against a live backend
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
