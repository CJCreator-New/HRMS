import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,

  // Override rules
  {
    rules: {
      // All 14 instances are legitimate "fetch data on mount" patterns:
      //   useEffect(() => { loadData(); }, [])
      // where loadData is async and setState happens after await.
      // The React 19 plugin flags these but the pattern is valid.
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific ignores
    "node_modules/**",
    "coverage/**",
    "e2e/**",
    "test-results/**",
    "e2e-report/**",
    ".wayfinder/**",
  ]),
]);

export default eslintConfig;
