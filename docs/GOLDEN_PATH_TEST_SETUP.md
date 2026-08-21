# Golden-Path Test Setup (Live-Backend CI Integration)

## Overview

The golden-path routing trace tests (`e2e/specs/cross-module/golden-path-routing-trace.spec.ts`) verify interconnections across the seeded HRMS world — that each cross-role workflow routes to the right role at the right stage with the right status. These tests require a live Supabase backend with seeded data (per ADR 0004).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI Pipeline                   │
├─────────────────────────────────────────────────────────────────┤
│  1. Health Check ──→ Verify Supabase test project reachable    │
│  2. Seed Database ──→ Apply schema + seed mock data            │
│  3. Golden-Path Traces ──→ Run 10 DB-level routing assertions  │
│  4. Cross-Module Smoke ──→ Run all cross-module specs          │
│  5. Summary ──→ Report results to GitHub Step Summary           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Test Project (Dedicated)                 │
│  • Separate from staging/production                            │
│  • Schema: 24 modular SQL files                                │
│  • Seed: 14 personas + full mock data                          │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Supabase project** — A dedicated test project (separate from staging/production)
2. **GitHub Actions secrets** — Configure these in your repository settings

## Environment Variables (GitHub Actions Secrets)

Set these in your repository's Settings → Secrets and variables → Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `TEST_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `TEST_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGciOiJIUzI1NiIs...` |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIs...` |

## Quick Start

### 1. Create a Dedicated Test Supabase Project

```bash
# Option A: Using Supabase CLI (recommended)
supabase init
supabase link --project-ref <your-test-project-ref>
supabase db push

# Option B: Using the setup script (recommended)
export NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'

npm run setup:test-db
```

### 2. Configure GitHub Actions Secrets

```bash
# Using GitHub CLI
gh secret set TEST_SUPABASE_URL --body 'https://your-project.supabase.co'
gh secret set TEST_SUPABASE_ANON_KEY --body 'your-anon-key'
gh secret set TEST_SUPABASE_SERVICE_ROLE_KEY --body 'your-service-role-key'
```

### 3. Run Tests

```bash
# Local: Run golden-path tests against live backend
npm run test:golden-path:live

# Local: Run all cross-module tests against live backend
npm run test:cross-module:live

# CI: Trigger the workflow manually
gh workflow run e2e-live-backend.yml
```

## CI Pipeline Jobs

### `health-check`
Verifies the Supabase test project is reachable before running any tests. Skips all downstream jobs if the project is not configured.

### `seed-database`
Applies the database schema and seeds mock data. Can be skipped via `workflow_dispatch` input if data is already seeded.

### `golden-path-traces`
Runs the 10 golden-path routing trace tests that verify cross-module interconnections:
- TRACE-01: Employee leave → Manager routing
- TRACE-02: HR leave → Alternate HR approver (no self-approval)
- TRACE-03: Reimbursement claims → Correct approval stage
- TRACE-04: Attendance anomaly → Payroll lock
- TRACE-05: Finalized payroll → Published payslip
- TRACE-06: Separation → F&F settlement interconnection
- TRACE-07: Payroll eligibility → Suspension exclusion
- TRACE-08: Org hierarchy → Manager data routing
- TRACE-09: HR alternate self-application → System admin fallback
- TRACE-10: Manual comp-off credit → 90-day expiry contract

### `cross-module-smoke`
Runs all cross-module specs (golden-path traces + cross-role routing + GP01-GP10 smoke tests).

### `summary`
Reports the results of all jobs to the GitHub Step Summary.

## Local Development

### Setup

```bash
# 1. Set environment variables
export NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
export NEXT_PUBLIC_MOCK_AUTH=false

# 2. Run the setup script
npm run setup:test-db

# 3. Start the dev server
npm run dev

# 4. Run tests in another terminal
npm run test:golden-path:live
```

### Running Specific Tests

```bash
# Run only the golden-path routing traces
npx playwright test e2e/specs/cross-module/golden-path-routing-trace.spec.ts --project=live-chromium

# Run a specific trace (e.g., TRACE-01)
npx playwright test -g "TRACE-01" --project=live-chromium

# Run all cross-module tests
npx playwright test e2e/specs/cross-module --project=live-chromium
```

## Troubleshooting

### Tests skip with "Requires live Supabase backend"

- Ensure `NEXT_PUBLIC_MOCK_AUTH=false` is set
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check that the Supabase project is running and accessible

### Tests fail with "Persona not found"

- Re-seed the test database: `npm run seed:mock`
- Verify the seed data includes all required personas (`persona-emp-001`, `persona-mgr-001`, etc.)

### Rate limiting in CI

- The test Supabase project may have rate limits on the free tier
- Consider using a paid plan for CI or implement retry logic

### GitHub Actions secrets not configured

The CI pipeline will skip all tests if the secrets are not configured. Add these secrets:
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_SUPABASE_SERVICE_ROLE_KEY`

## Test Coverage

The golden-path tests verify these cross-module connections:

| Test | Connection Verified | Roles |
|------|-------------------|-------|
| TRACE-01 | Employee leave → Manager routing | employee → manager |
| TRACE-02 | HR leave → Alternate HR approver (no self-approval) | hr → hr_alt |
| TRACE-03 | Reimbursement claims → Correct approval stage | employee → manager → hr |
| TRACE-04 | Attendance anomaly → Payroll lock | employee → payroll_admin |
| TRACE-05 | Finalized payroll → Published payslip | payroll_admin → employee |
| TRACE-06 | Separation → F&F settlement interconnection | employee → hr |
| TRACE-07 | Payroll eligibility → Suspension exclusion | hr → payroll_admin |
| TRACE-08 | Org hierarchy → Manager data routing | employee → manager → sysadmin |
| TRACE-09 | HR alternate self-application → System admin fallback | hr → sysadmin |
| TRACE-10 | Manual comp-off credit → 90-day expiry contract | hr → employee |

## Notifications (Slack & Email)

Both the staging and live-backend workflows include notification jobs that alert when tests fail.

### Slack Notifications

1. Create a Slack Incoming Webhook:
   - Go to https://api.slack.com/apps
   - Create a new app or use an existing one
   - Enable "Incoming Webhooks"
   - Add a new webhook to your workspace
   - Copy the webhook URL

2. Add to GitHub Actions secrets:
   ```bash
   gh secret set SLACK_WEBHOOK_URL --body 'https://hooks.slack.com/services/T.../B.../...'
   ```

3. Configure the notification email (optional):
   ```bash
   gh secret set NOTIFY_EMAIL --body 'team@company.com'
   ```

### Email Notifications

1. Add to GitHub Actions secrets:
   ```bash
   gh secret set NOTIFY_EMAIL --body 'team@company.com'
   ```

2. Note: Email notifications use the `mail` command which may not be available in all GitHub Actions runners. If unavailable, the notification will be logged to the workflow output.

### Notification Behavior

| Trigger | Slack | Email |
|---------|-------|-------|
| Any job fails | ✅ | ✅ |
| All jobs pass | ❌ | ❌ |
| Webhook/email not configured | ⚠️ Skipped | ⚠️ Skipped |

### Sample Slack Message

```
❌ Staging Tests Failed
Repository: acme/hrms
Branch: staging
Commit: abc123
Author: developer
Failed Jobs:
  • Unit Tests: failure
  • E2E Smoke (Mock): failure
```

## Related Documentation

- [ADR 0004: E2E Hybrid Test Data](docs/adr/0004-e2e-hybrid-test-data.md)
- [FLOW_MATRIX.md](docs/FLOW_MATRIX.md)
- [E2E Test Plan](docs/product/09-TESTING_STRATEGY.md)
