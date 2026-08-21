import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    environment: "node",
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
      // Ratchet thresholds — raise these as coverage improves.
      // Current baseline (Aug 2026): 52.85% stmts, 43.43% branches,
      //   43.41% functions, 56.09% lines.
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 40,
        lines: 53,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
