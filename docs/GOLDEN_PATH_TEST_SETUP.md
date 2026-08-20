# Golden-Path Test Setup (CI Integration)

## Overview

The golden-path routing trace tests (`e2e/specs/cross-module/golden-path-routing-trace.spec.ts`) verify interconnections across the seeded HRMS world — that each cross-role workflow routes to the right role at the right stage with the right status. These tests require a live Supabase backend with seeded data (per ADR 0004).

## Prerequisites

1. **Supabase project** — A dedicated test project (separate from staging/production)
2. **Service role key** — `SUPABASE_SERVICE_ROLE_KEY` for direct DB assertions
3. **Seeded data** — Run `scripts/seed-mock-data.mjs` against the test database

## Environment Variables

Set these in your CI environment (e.g., GitHub Actions secrets):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_MOCK_AUTH=false
```

## Setup Steps

### 1. Create a Dedicated Test Supabase Project

```bash
# Using Supabase CLI (recommended)
supabase init
supabase link --project-ref <your-test-project-ref>

# Apply migrations
supabase db push

# Seed test data
node scripts/seed-mock-data.mjs
```

### 2. Configure CI Pipeline

#### GitHub Actions Example

```yaml
# .github/workflows/e2e-golden-path.yml
name: Golden-Path E2E Tests

on:
  push:
    branches: [main, feature/auth]
  pull_request:
    branches: [main]

jobs:
  golden-path:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_MOCK_AUTH: "false"

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run golden-path tests
        run: npx playwright test e2e/specs/cross-module/golden-path-routing-trace.spec.ts

      - name: Verify Supabase reachability
        run: node -e "
          const fetch = require('node-fetch');
          fetch('${{ env.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/', {
            signal: AbortSignal.timeout(5000)
          }).then(r => console.log('Supabase reachable:', r.status))
            .catch(e => { console.error('Supabase unreachable:', e.message); process.exit(1); });
        "
```

### 3. Run Golden-Path Tests Locally

```bash
# Ensure the test Supabase is reachable
export NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export NEXT_PUBLIC_MOCK_AUTH=false

# Run all golden-path tests
npx playwright test e2e/specs/cross-module/golden-path-routing-trace.spec.ts

# Or run via npm script
npm run test:golden-path
```

### 4. Add to package.json

Add this script to your `package.json`:

```json
{
  "scripts": {
    "test:golden-path": "playwright test e2e/specs/cross-module/golden-path-routing-trace.spec.ts"
  }
}
```

## Troubleshooting

### Tests skip with "Requires live Supabase backend"

- Ensure `NEXT_PUBLIC_MOCK_AUTH=false` is set
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check that the Supabase project is running and accessible

### Tests fail with "Persona not found"

- Re-seed the test database: `node scripts/seed-mock-data.mjs`
- Verify the seed data includes all required personas (`persona-emp-001`, `persona-mgr-001`, etc.)

### Rate limiting in CI

- The test Supabase project may have rate limits on the free tier
- Consider using a paid plan for CI or implement retry logic

## Test Coverage

The golden-path tests verify these cross-module connections:

| Test | Connection Verified |
|------|-------------------|
| TRACE-01 | Employee leave → Manager routing |
| TRACE-02 | HR leave → Alternate HR approver (no self-approval) |
| TRACE-03 | Reimbursement claims → Correct approval stage |
| TRACE-04 | Attendance anomaly → Payroll lock |
| TRACE-05 | Finalized payroll → Published payslip |
| TRACE-06 | Separation → F&F settlement interconnection |
| TRACE-07 | Payroll eligibility → Suspension exclusion |
| TRACE-08 | Org hierarchy → Manager data routing |
| TRACE-09 | HR alternate self-application → System admin fallback |
| TRACE-10 | Manual comp-off credit → 90-day expiry contract |
