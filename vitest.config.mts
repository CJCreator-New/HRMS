import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    environment: "jsdom",
    fileParallelism: false,
    pool: "threads",
    setupFiles: ["./vitest.setup.ts"],
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
      // Coverage thresholds raised per P1-2 quality gate
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 65,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
