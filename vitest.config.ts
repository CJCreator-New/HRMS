import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    // jsdom required for React component tests (.tsx); pure-logic tests
    // also execute correctly under jsdom, so a single environment covers all.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Increase timeout for component tests that need jsdom hydration
    testTimeout: 15_000,
    coverage: {
      // v8 coverage via @vitest/coverage-v8 (npm run test:coverage)
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Unit-testable layers: server actions, engines, auth helpers, RBAC
      // middleware and shared components. Full pages under src/app are
      // exercised by Playwright E2E instead.
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "src/middleware.ts",
      ],
      exclude: [
        "src/lib/types/**",
        "**/*.{test,spec}.{js,ts,jsx,tsx}",
        "**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
