# HRMS Comprehensive End-to-End Review — Gap Analysis & Resolution Plan

**Date**: 2026-09-01  
**Scope**: Full-stack Next.js 16.3 App Router + PostgreSQL/Supabase HRMS v2.7  
**Reviewer**: Kilo (Planning Mode)  
**Status**: Implementation-Ready Plan  
**Plan File**: `.kilo/plans/1788259522931-comprehensive-e2e-gap-analysis.md`

---

## Executive Summary

The HRMS is a well-architected enterprise system with strong RBAC, modular 24-file schema, comprehensive unit/integration tests, and multi-phase CI/CD. Validation findings corrected several initial assessments: the health endpoint (`src/app/api/health/route.ts`) already checks Supabase reachability + DB latency, and the mock cookie (`src/lib/auth/mock-cookie.ts`) already uses HMAC-SHA256 signing. **Backend context: Supabase** — prefer Supabase-native capabilities (Auth email, Realtime, Edge Functions, built-in backups, full-text search extensions) over external services where viable. This plan identifies **48 actionable gaps** organized into 4 implementation phases with resolved design decisions and dependency ordering.

---

## Phase 0: Critical Security & Architecture Fixes (Week 1)

These must ship before any other work because they are production blockers or create cascading debt.

### P0-1: Enforce Redis Rate Limiting in Production
**GAP**: `src/lib/auth/rate-limit.ts` falls back to in-memory `Map` when `UPSTASH_REDIS_REST_URL` is empty. In multi-instance deployments, rate limits are per-instance.  
**Fix**:
1. In `src/lib/auth/rate-limit.ts`, throw if `UPSTASH_REDIS_REST_URL` is unset in production
2. Add startup health check for Redis connectivity
3. Update `docker-compose.yml` to require Redis or document the requirement
4. Update `.env.example` with Redis as required production dependency

### P0-2: Break Circular Schema Dependency (RBAC ↔ Org)
**GAP**: `schema/01_rbac.sql` references `employees` (from `02_org.sql`) in `auth_employee_id()`. `02_org.sql` references `has_permission` (from `01_rbac.sql`) for RLS. PostgreSQL defers body validation but this is fragile.  
**Fix**:
1. Create `schema/00_auth_helpers.sql` with only `auth_employee_id()` using `auth.uid()` (no `employees` table dependency)
2. Update `01_rbac.sql` to import from `00_auth_helpers.sql` or inline the minimal helper
3. Update `scripts/db-apply.mjs` to apply `00_auth_helpers.sql` first
4. Update `schema/02_org.sql` to reference `has_permission` after `01_rbac.sql` creates it
5. Add dependency graph comment block to each schema file header

### P0-3: Eliminate Implicit Mock Auth Fallback
**GAP**: `loginAction` (`src/lib/actions/auth.ts:131-141`) falls back to mock auth when Supabase is unreachable. In development, a broken Supabase config silently works via mock, masking real auth failures.  
**Fix**:
1. Remove the implicit fallback in `loginAction` — only allow mock when `NEXT_PUBLIC_MOCK_AUTH=true` is explicitly set
2. Add a visible dev-only banner when mock mode is active (e.g., "MOCK AUTH MODE — Set NEXT_PUBLIC_MOCK_AUTH=false for real auth")
3. In CI, assert that `NEXT_PUBLIC_MOCK_AUTH=false` for integration tests
4. Log mock mode activation to console with prominent warning

### P0-4: Add Container Security Scanning
**GAP**: `npm audit` runs in CI but the Docker image is not scanned.  
**Fix**:
1. Add Trivy scan step to `.github/workflows/ci.yml`
2. Fail build on CRITICAL vulnerabilities
3. Add SBOM generation step
4. Document image rebuild cadence

### P0-5: Add Secret Scanning
**GAP**: No detection of accidentally committed secrets.  
**Fix**:
1. Add `gitleaks` or `trufflehog` to CI
2. Add pre-commit hook via `lefthook` or `husky`
3. Add `.gitignore` enforcement for `.env.local`
4. Document secret rotation runbook

---

## Phase 1: Observability, Testing & CI Hardening (Week 2-3)

### P1-1: Integrate Sentry Error Tracking
**GAP-14**: No centralized error tracking.  
**Fix**:
1. Add `@sentry/nextjs` SDK
2. Configure in `sentry.client.config.ts` and `sentry.server.config.ts`
3. Tag errors with `userRole`, `employeeId`, `module`
4. Set up Slack alerts for P0/P1 in Sentry dashboard
5. Add source map upload to CI (`sentry-cli`)

### P1-2: Raise Test Coverage Thresholds
**GAP-16**: Current thresholds (57% stmts, 48% branches) allow regressions.  
**Fix**:
1. Raise `vitest.config.ts` thresholds to: statements 70%, branches 60%, functions 65%, lines 70%
2. Add `test:coverage` to CI with fail-on-regression
3. Priority test additions: `src/lib/services/dashboard.ts`, `src/lib/services/reports-engine.ts`, `src/components/shared/PunchButton.tsx`, `src/components/shared/DataTable.tsx`

### P1-3: Add Integration Tests to Main CI
**GAP-45**: `test:integration` exists but isn't in `ci.yml`.  
**Fix**:
1. Add `npm run test:integration` to `ci.yml` as a separate job
2. Split integration tests: fast (auth, RBAC, leave) in PR CI; slow (payroll, offboarding) in staging
3. Tag slow tests with `@slow` and skip in PR CI

### P1-4: Add Production Deployment Workflow
**GAP-40**: No production deploy pipeline.  
**Fix**:
1. Create `.github/workflows/deploy-production.yml`
2. Add manual `workflow_dispatch` with approval comment
3. Add `npm run db:sync` before deploy
4. Add post-deploy smoke test (`/api/health` check)
5. Add automatic rollback on health check failure

### P1-5: Add HSTS Header
**GAP-48**: No `Strict-Transport-Security`.  
**Fix**:
1. Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to `next.config.mjs` headers
2. Add `max-age=0` for non-production to allow local HTTP

### P1-6: Add Account Lockout After Failed Logins
**GAP-50**: No brute-force protection beyond rate limiting.  
**Fix**:
1. Add `failed_login_attempts` and `locked_until` columns to `employees`
2. Update `loginAction` to increment counter and lock after 5 failures
3. Add lockout notification email action
4. Add admin unlock action in `/settings` or employee detail view

### P1-7: Add Structured Logging
**GAP-55**: `console.info/error` everywhere.  
**Fix**:
1. Add `pino` with `pino-pretty` for dev
2. Create `src/lib/logger.ts` with request ID correlation
3. Replace `console.*` in server actions with `logger.*`
4. Add log levels configurable via `LOG_LEVEL` env var

---

## Phase 2: Feature Completeness (Week 4-6)

### P2-1: Employee Self-Service Profile Page
**GAP-01**: No self-service profile editing.  
**Fix**:
1. Add `personal_address`, `phone`, `emergency_contact_name`, `emergency_contact_phone` to `employees` table
2. Create `src/app/profile/page.tsx` with editable fields
3. Add `updateProfileAction` with `assertCallerIdentity` + audit log
4. Add RLS policy: employees can update their own non-sensitive fields
5. Add E2E test

### P2-2: Password Reset Token Handler Page
**GAP-31**: Forgot-password UI exists inline in login page, but no standalone page to handle Supabase email redirect with reset token.  
**Fix**:
1. Create `src/app/auth/reset-password/page.tsx`
2. Parse `?token=...&type=recovery` from Supabase redirect
3. Show new-password form with confirmation
4. Call `supabase.auth.updateUser({ password })`
5. Redirect to `/login?reset=success`

### P2-3: Email Confirmation Callback
**GAP-32**: `email_confirm: true` in `createEmployeeAction` but no confirmation handler.  
**Fix**:
1. Create `src/app/auth/confirm/page.tsx`
2. Handle Supabase email confirmation redirect (`?token=...&type=signup`)
3. Show success state and redirect to `/login?confirmed=true`
4. Add unconfirmed email reminder banner on login page

### P2-4: Document Categories & Versioning
**GAP-02**: Attachments exist but are unstructured.  
**Fix**:
1. Add `document_categories` table (policy, contract, id_proof, certificate, etc.)
2. Add `document_version` column and `document_versions` history table
3. Add `expires_at` and `reminder_days` for compliance tracking
4. Update `attachments` table with `category_id` FK
5. Add bulk download action in `/documents`

### P2-5: Tax Investment Declaration Flow
**GAP-04**: Statutory engine supports 80C/80D but no declaration UI.  
**Fix**:
1. Create `investment_declarations` table with sections (80C, 80D, 80G, 80E, etc.)
2. Add `submitDeclarationAction` with `assertCallerIdentity`
3. Create `/statutory/declarations` page
4. Add HR approval workflow (`declaration.status`: pending → approved/rejected)
5. Link approved declarations to `statutory_snapshots` for TDS calculation

### P2-6: Bank File Generation for Payroll
**GAP-05**: No bank disbursement file generation.  
**Fix**:
1. Add `generateBankFileAction` server action
2. Support standard formats: SBI bulk, HDFC bulk, generic CSV
3. Create `/payroll/bank-file` page with period selector and download
4. Add file format config in `company_settings`
5. Add checksum/hash for batch verification

### P2-7: Notification Preferences
**GAP-33**: No user control over notification channels.  
**Fix**:
1. Add `notification_preferences` table (user_id, channel: email|in_app|sms, module, enabled)
2. Create settings UI toggle per module
3. Update `createNotificationAction` to respect preferences
4. Add Supabase Edge Function for email dispatch when `channel=email` is enabled

### P2-8: Active Sessions Management
**GAP-34**: No session visibility or remote logout.  
**Fix**:
1. Query Supabase `auth.sessions` via admin client
2. Create `/settings/sessions` page
3. Add `remoteLogoutAction` for non-current sessions
4. Show device, IP, last active timestamp

---

## Phase 3: NFRs, UX Polish & Advanced Testing (Week 7-8)

### P3-1: Server-Side Caching with Redis
**GAP-12**: Every page hits Supabase directly.  
**Fix**:
1. Add Redis client wrapper (`src/lib/cache/redis.ts`)
2. Cache dashboard aggregates (5-min TTL, key: `dashboard:{employeeId}`)
3. Cache employee directory pages (1-min TTL, key: `employees:page:{n}:size:{s}:q:{q}`)
4. Invalidate cache on mutations in server actions
5. Add cache hit/miss metrics to `/api/health`

### P3-2: Feature Flags (Self-Hosted Unleash)
**GAP-15**: All-or-nothing deployments.  
**Fix**:
1. Deploy Unleash proxy in Docker Compose
2. Add `@unleash/server` and `@unleash/client` SDKs
3. Wrap new features in `useFlag` / `isEnabled` checks
4. Add Unleash admin UI accessible to `system_admin`
5. Document flag naming: `module.feature.state`

### P3-3: Cross-Browser & Mobile E2E in Main CI
**GAP-26, GAP-27**: Only Chromium runs on main branch.  
**Fix**:
1. Add `firefox`, `webkit`, `mobile-chrome`, `mobile-safari` to `e2e.yml` projects
2. Use matrix strategy for parallel execution
3. Add responsive-specific assertions (touch target size, drawer behavior)
4. Document browser support matrix (Chrome, Firefox, Safari, Edge latest 2 versions)

### P3-4: Visual Regression Testing (Playwright Native)
**GAP-28**: No screenshot diffing.  
**Fix**:
1. Use Playwright's built-in `expect(page).toHaveScreenshot()` with `maxDiffPixels: 100`
2. Capture baseline for all 22 routes + key states (empty table, loading, error)
3. Store baselines in `e2e/screenshots/baseline/`
4. Add `test:e2e:visual` script
5. Run in staging CI only (too flaky for PR gating)

### P3-5: Enhanced Health Check
**GAP-54**: `/api/health` already checks Supabase reachability + DB latency, but missing Redis and process metrics.  
**Fix**:
1. Add Redis ping check when `UPSTASH_REDIS_REST_URL` is configured
2. Add memory usage check (`process.memoryUsage()`)
3. Add uptime check (`process.uptime()`)
4. Return `components.supabase`, `components.redis`, `components.memory` in JSON

### P3-6: Audit Log Partitioning
**GAP-18**: Audit logs grow indefinitely.  
**Fix**:
1. Add `created_at`-based partitioning to `audit_logs` (monthly partitions)
2. Add `audit_log_archive` table for records > 90 days
3. Add `archive_old_audit_logs()` scheduled job
4. Add compliance report: `audit_logs_retention_report`

### P3-7: Leave Sandwich Edge Case Tests
**GAP-37**: Undocumented edge cases in `calculate_leave_days()`.  
**Fix**:
1. Add tests for: consecutive holidays, month-boundary sandwiches, half-day sandwiches
2. Document sandwich rules in `schema/06_leave.sql` comments
3. Add integration test verifying sandwich against seeded calendar data

### P3-8: F&F Stale Trigger Refactor
**GAP-38**: `triggerStaleFfAction` inserts dummy `leave_ledger` record to fire trigger.  
**Fix**:
1. Add `ff_settlement_id` nullable FK to `leave_ledger`
2. Refactor `invalidate_stale_ff_settlement()` trigger to fire on `leave_ledger` insert/update where `ff_settlement_id IS NOT NULL`
3. Update `triggerStaleFfAction` to insert with `ff_settlement_id` directly
4. Remove dummy record pattern

---

## Out of Scope (Future Phases)

These are valid gaps but too large for immediate execution. Mark for Q4 2026 or 2027 roadmap:

| Gap | Reason Out of Scope |
|-----|---------------------|
| GAP-10: Asset Tracking | Requires asset lifecycle, depreciation, QR/barcode integration |
| GAP-07: Real-Time WebSocket Updates | Supabase Realtime is viable and preferred over custom WebSocket infra — revisit in Phase 3 if needed |
| GAP-20: Multi-Time Zone Support | Requires company timezone setting, user timezone profiles, DST handling — strategic decision needed |
| GAP-23: Dark Mode / Theme Switching | Low business value; can be addressed when design system matures |
| GAP-25: In-App Help Tour | Nice-to-have; can use external docs |
| GAP-28 (alternative): Percy Cloud Visual Testing | Self-hosted Playwright screenshots chosen instead |
| GAP-53: Full-Text Search Indexing | Supabase supports `pg_trgm` + `tsvector` extensions — revisit in Phase 3; `schema/18_search.sql` exists as foundation |

---

## Dependency Map

```
P0-1 (Redis Rate Limit) ──────────────────────────────────────────┐
P0-2 (Schema Split) ───────────────────────────────────────────┐   │
P0-3 (Mock Auth Fix) ───────────────────────────┐              │   │
P0-4 (Container Scan) ──────────────┐           │              │   │
P0-5 (Secret Scan) ────────┐        │           │              │   │
                            │        │           │              │   │
P1-1 (Sentry) ◄────────────┘        │           │              │   │
P1-2 (Coverage) ◄───────────────────┘           │              │   │
P1-3 (Integration CI) ◄────────────────────────┘              │   │
P1-4 (Deploy Workflow) ◄───────────────────────────────────────┘   │
P1-5 (HSTS) ◄─────────────────────────────────────────────────────┘
P1-6 (Account Lockout) ───────┐
P1-7 (Structured Logging) ────┤
                              │
P2-1 (Profile Page) ◄─────────┤
P2-2 (Reset Password) ◄───────┤
P2-3 (Email Confirm) ◄────────┤
P2-4 (Doc Categories) ◄───────┤
P2-5 (Tax Declarations) ◄─────┤
P2-6 (Bank Files) ◄───────────┤
P2-7 (Notification Prefs) ◄───┤
P2-8 (Sessions) ◄─────────────┘
                              │
P3-1 (Redis Cache) ◄──────────┘
P3-2 (Feature Flags) ◄─────────────────┐
P3-3 (Cross-Browser CI) ◄──────────────┤
P3-4 (Visual Regression) ◄─────────────┤
P3-5 (Health Check) ◄──────────────────┤
P3-6 (Audit Partitioning) ◄────────────┤
P3-7 (Sandwich Tests) ◄────────────────┤
P3-8 (F&F Refactor) ◄──────────────────┘
```

---

## Resolved Design Decisions

| Decision | Resolution |
|----------|------------|
| Mock auth in production | **Keep mock mode for rapid prototyping** but add prominent dev-only banner; CI enforces `NEXT_PUBLIC_MOCK_AUTH=false` |
| Email provider for notifications | **Supabase Auth email / Edge Functions** — use Supabase SMTP or Edge Functions with Supabase's built-in email templates. External provider only if volume exceeds Supabase limits or custom templates are required |
| Feature flag service | **Self-hosted Unleash** — data sovereignty, no vendor lock-in, Docker-ready |
| Visual regression tool | **Playwright native screenshots** — no external service dependency, CI-friendly |
| Circular schema fix | **Create `schema/00_auth_helpers.sql`** — minimal, no table dependencies, applied first |
| Password reset flow | **Inline in login page** for request; **separate `/auth/reset-password` page** for token handling |
| Redis requirement | **Mandatory in production** — fail startup if unavailable; document in deployment guide |
| Test coverage target | **70% statements, 60% branches, 65% functions, 70% lines** — achievable without massive effort |
| Backend service selection | **Supabase-native first**: Auth emails via Supabase SMTP/Edge Functions, Realtime for push, `pg_trgm`/`tsvector` for search, Supabase PITR for backups. External services only when Supabase lacks the feature or scale demands it |

---

## Validation Checklist

After each phase, run:

```bash
# Core quality gates
npm run lint
npx tsc --noEmit
npm run verify:permissions
npm run test:unit
npm run test:integration

# E2E gates
npm run test:e2e:p0
npm run test:e2e:rbac
npm run test:e2e:workflows

# DB
npm run db:sync

# Security
npm audit --audit-level=high
```

---

## Open Questions (Resolved)

1. **Q1: Mock auth mode** → Keep for prototyping, add CI enforcement for `false`, add dev banner
2. **Q2: Email provider** → Supabase Auth email / Edge Functions (built-in SMTP). External provider only if volume exceeds Supabase limits or custom templates are required
3. **Q3: Feature flags** → Self-hosted Unleash in Docker Compose
4. **Q4: Visual regression** → Playwright native (`toHaveScreenshot`)
5. **Q5: Schema circular dependency** → `schema/00_auth_helpers.sql` approach

---

## Finalized Implementation Decisions

1. **Q1: Mock auth mode** → Keep for prototyping, add CI enforcement for `false`, add dev banner
2. **Q2: Email provider** → Supabase Auth email / Edge Functions (built-in SMTP). External provider only if volume exceeds Supabase limits or custom templates are required
3. **Q3: Feature flags** → Self-hosted Unleash in Docker Compose
4. **Q4: Visual regression** → Playwright native (`toHaveScreenshot`)
5. **Q5: Schema circular dependency** → `schema/00_auth_helpers.sql` approach
6. **Q6: Phase 0 PR structure** → Single "security hardening" PR for atomicity, but use feature flags for P0-3 to allow revert
7. **Q7: Bank file formats** → Generic CSV + SBI format first; HDFC/ICICI as follow-up
8. **Q8: Redis caching backend** → Upstash (already in deps) for managed simplicity; self-hosted Redis only if data sovereignty requires
9. **Q9: Account lockout policy** → Time-based lockout (15 minutes) with admin override
10. **Q10: Unleash infra** → Same `docker-compose.yml` for dev; separate K8s/service for production
