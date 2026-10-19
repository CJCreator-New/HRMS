# HRMS — Prioritized Backlog (agent-ready tickets)

Derived from [01-E2E-PRODUCT-REVIEW.md](./01-E2E-PRODUCT-REVIEW.md). Each ticket is written so one agent can take it alone: scope, evidence, definition of done, and the agent to use. IDs are stable; cite them in commits and PRs (`fix(audit): … (B-02)`).

Priority: **P0** = verify or fix before the next release · **P1** = next sprint · **P2** = planned · **P3** = when touched.

Agents are defined in `.claude/agents/` (see [05-AGENT-ROSTER.md](./05-AGENT-ROSTER.md)).

---

## P0

### B-01 — Confirm and fix audit-trigger inserts blocked by RLS (F-01)
- **Scope:** `log_entity_audit()` in `schema/15_audit.sql`; triggers on `employees`, salary structures, `payroll_revisions`.
- **Evidence:** function is not `security definer`; `audit_logs` has RLS with only a `SELECT` policy (`audit_logs_read`). Writes through user-scoped clients may fail.
- **Steps:**
  1. Reproduce against a live database: as an authenticated HR user, `update employees set … where id = …` through the user-scoped client. Record the result. (Use `scripts/test-db-triggers.mjs` as the harness.)
  2. Fix in SQL: make `log_entity_audit()` `security definer set search_path = public`, or add a narrowly scoped INSERT policy. Prefer `security definer` so users cannot write arbitrary audit rows directly.
  3. Add a regression check to `scripts/test-db-triggers.mjs`.
  4. Run `npm run db:sync` and `git diff` the combined file. Never hand-edit `combined_init.sql`.
- **Definition of done:** user-scoped update of `employees` succeeds **and** writes exactly one `audit_logs` row; `npm run test:db` green; `npm run db:sync` clean.
- **Agent:** `hrms-db-schema` (then `hrms-test-engineer` for the regression test).
- **Blocker:** needs a live Supabase/Postgres instance. If none is available, stop after step 1 and report.

---

## P1

### B-02 — Redesign `writeAuditLogAction` (F-02)
- **Scope:** `src/lib/actions/audit.ts:80–124`; 85 call sites.
- **Problems:** no permission gate; client controls `action` and `metadata`; falls back to actor "System" when unauthenticated; callers ignore the returned error.
- **Steps:**
  1. Keep one internal helper (`recordAuditEvent`) that is **not** a client-callable server action. Derive the actor from the server session.
  2. Write through a `security definer` RPC with an allow-list of action codes (add the codes to a constant, verified by a unit test).
  3. Update the 85 call sites to `await` and check the result; a failed audit write for a sensitive action must fail the business action (or be explicitly documented as best-effort).
  4. Keep `writeAuditLogAction` exported only if a client caller is genuinely required; if so, restrict it to read-only-metadata events.
- **Definition of done:** no unauthenticated write path; all callers handle the result; new unit tests cover allow-list rejection; `verify:permissions` and `test:unit` green.
- **Agent:** `hrms-rbac-auditor` designs the allow-list and reviews; `hrms-server-action-dev` implements.
- **Depends on:** B-01.

### B-03 — Remove the nine `as any` casts (F-03)
- **Scope:** `src/app/documents/page.tsx:37`, `src/lib/actions/notifications.ts:162`, `src/lib/actions/payroll.ts:578, 579, 597, 598`, `src/lib/actions/sessions.ts:44`, `src/lib/observability/sentry.ts:31`.
- **Steps:** define the Supabase join row types (`EmployeeJoin | EmployeeJoin[] | null`, `StatutoryProfileJoin`, etc.) next to each action; keep behaviour identical.
- **Definition of done:** `grep -rn "as any\|: any" src` (excluding tests) returns no production hits; `npx tsc --noEmit` and `test:unit` pass; payroll export output unchanged (add or run a snapshot test).
- **Agent:** `hrms-server-action-dev`.

### B-04 — Enforce "every mutating action is guarded" with a test (F-04)
- **Scope:** all exported functions in `src/lib/actions/*.ts`.
- **Steps:** write a Vitest test that parses action modules (or uses a registry) and fails if an exported function that calls `.insert/.update/.upsert/.delete/.rpc` does not reference `assertPermission`, `assertAnyPermission`, `assertCallerIdentity`, or `validateRequestOrigin`. Allow-list only the documented auth endpoints (`loginAction`, `logoutAction`, `changePasswordAction`, `requestPasswordResetAction`) with a reason comment.
- **Definition of done:** test passes on the current tree (after B-02 is merged, `writeAuditLogAction` no longer appears unguarded); `test:unit` green.
- **Agent:** `hrms-test-engineer` with `hrms-rbac-auditor` review.

### B-05 — Harden the mock-auth cookie (F-05)
- **Scope:** `src/lib/auth/mock-cookie.ts`.
- **Steps:**
  1. When `NEXT_PUBLIC_MOCK_AUTH=true` and `MOCK_COOKIE_SECRET` is unset, throw at startup in development with a clear message. Remove the literal fallback secret.
  2. Fix the header comment (HMAC is present).
  3. Limit the unsigned `NODE_ENV === "test"` path (line 69) to an explicit `MOCK_COOKIE_ALLOW_UNSIGNED=true` flag used only by tests.
- **Definition of done:** unit tests cover signed-valid, tampered, expired, and missing-secret cases; production still returns `null` for mock sessions.
- **Agent:** `hrms-rbac-auditor`.

### B-06 — Triage the dirty working tree (F-07) — partly decided
- **Decided by the owner (2026-10-19):** the `.wayfinder/` deletions are intended. Do not restore them.
- **Still open:** approve committing the assets module (`schema/27_assets.sql`, `src/app/assets/`, `src/lib/actions/assets.ts`, its test) and tooling (`scripts/build-prod.mjs`, `scripts/db-migrate.mjs`, `ThemeToggle.tsx`) as reviewed change sets.
- **Agent prep:** `hrms-docs` can produce a commit plan grouped by concern (schema, actions, UI, tooling, docs), with each group's verification commands. It must not commit without an explicit instruction.
- **Definition of done:** working tree clean or each remaining change has an owning ticket; `schema/combined_init.sql` regenerated from the committed sources.

### B-12 — Documentation drift cleanup (F-06, register D-1…D-13)
- **Scope:** `README.md` (counts, missing `docs/DATABASE_MIGRATIONS.md` link, test totals), `AGENTS.md` §3.1 (24 → 29 numbered schema files, plus the three other SQL files), `CONTEXT.md`, `CHANGELOG.md` (post-2.7 entries and the v2.8 asset module), `vitest.config.ts` → `.mts` references in `docs/` (ENHANCEMENT_PLAN, product 00/02/09, REMEDIATION, PRODUCTION-CERTIFICATION), and a `Superseded by` banner on the Kilo plan and remediation certification.
- **Definition of done:** every number in README/AGENTS matches a command output (counts reproduced by the command in the doc); no link to a missing file.
- **Agent:** `hrms-docs`.

### B-13 — Run the checks this review could not run
- **Scope:** `npm run build`; `npm run test:integration` (needs DB); `npm run test:e2e:p0` (needs Playwright browsers and app in mock mode); `npm run test:db` (needs DB); `npm audit --audit-level=high`.
- **Definition of done:** each command's exit code and summary recorded in a dated section of `01-E2E-PRODUCT-REVIEW.md` (append, do not rewrite earlier results).
- **Agent:** `hrms-test-engineer`.

### B-14 — E2E coverage for assets and notifications
- **Scope:** no Playwright spec for `/assets` or the notifications bell.
- **Definition of done:** `e2e/specs/modules/assets.spec.ts` covers allocate → clearance verify; `e2e/specs/modules/notifications.spec.ts` covers bell count and mark-read; both pass in mock mode and run under `test:e2e:p0` or the module suite.
- **Agent:** `hrms-test-engineer`.

---

## P2

### B-07 — Verify (or build) payslip distribution (F-08)
- **Question:** README promises "automated payslip generation and distribution". No outbound mail transport was found in `src/**/*.ts`.
- **Steps:** trace from payroll publish to what the employee receives. If in-app only, correct the README. If email is required, propose a transport (Supabase-native first, per the plan), behind a feature flag, with an ADR.
- **Agent:** `hrms-domain-reviewer` (scope) → `hrms-server-action-dev` (if building).

### B-08 — Reconcile the "withdrawn" terminology (F-08)
- **Question:** `CONTEXT.md` says the employee `withdrawn` lifecycle state is unmodeled (D5). The remediation report marks D5 "Resolved" for leave withdrawal.
- **Steps:** decide whether an employee `withdrawn` state is in scope. Update `CONTEXT.md` glossary and the remediation table so the two concepts have separate names (for example "leave withdrawal" vs "pre-activation withdrawal").
- **Agent:** `hrms-domain-reviewer` (decision support) + `hrms-docs`.

### B-15 — Confirm the migration ordering of `00_setup` and `00_auth_helpers`
- **Question:** plan P0-2 said auth helpers first; `scripts/db-apply.mjs:13–14` applies `00_setup.sql` first.
- **Definition of done:** a note in `schema/00_auth_helpers.sql` header stating the dependency, and `db-apply` order justified or changed (with `db:sync` re-run).
- **Agent:** `hrms-db-schema`.

### B-16 — Measure middleware permission RPC cost
- **Question:** `src/middleware.ts` calls `has_any_permission` once per gated request. Measure p95 latency on a gated route against a live DB and record it.
- **Agent:** `hrms-test-engineer` (NFR spec `e2e/specs/nfr/performance.spec.ts` is the starting point).

---

## P3

### B-09 — Add an error boundary to `/permissions`
- **Scope:** `src/app/permissions/error.tsx` (copy the pattern from `src/app/payroll/error.tsx`).
- **Agent:** `hrms-ui-dev`.

### B-10 — Logging decision and two remaining `console.*` calls
- **Question:** plan P1-7 asked for `pino`. The project has `src/lib/utils/logger.ts` with redaction. Decide: adopt pino or retire the plan item and extend the existing logger.
- **Also:** replace the two `console.*` calls in `src/lib/actions/` with the logger.
- **Agent:** `hrms-server-action-dev` (after a decision recorded in an ADR under `docs/adr/`).

### B-11 — Speed up the Windows unit-test run
- **Scope:** `vitest.config.mts` sets `fileParallelism: false` to avoid file-handle exhaustion on Windows (documented in the remediation report). Investigate per-worker `lucide-react` mocking or `pool: "forks"` to recover parallelism without the handle issue.
- **Definition of done:** full run time recorded before and after; no new flakes over three consecutive runs.
- **Agent:** `hrms-test-engineer`.

### B-17 — Triage the one ESLint warning
- **Steps:** run `npx eslint src`, identify the warning, fix or document it.
- **Agent:** `hrms-ui-dev` or `hrms-server-action-dev` depending on file.

### B-19 — Adopt one `ActionResponse` type across server actions (F-10)
- **Scope:** `ActionResponse` exists only in `src/lib/actions/assets.ts:7`. Most action modules return ad hoc shapes; `assertPermission` returns `{ error } | null`.
- **Steps:** create `src/lib/types/actions.ts` exporting `ActionResponse<T>` and a `Forbidden` helper; make `assertPermission` / `assertAnyPermission` return `ActionResponse<never>` on failure; migrate action modules one file per PR, starting with the modules that have the most callers (`leave.ts`, `payroll.ts`, `approvals.ts`). Keep public return shapes backward compatible until callers are migrated.
- **Definition of done:** `grep -rL "ActionResponse" src/lib/actions` returns only files intentionally exempt (documented); `tsc` and `test:unit` pass after each PR.
- **Agent:** `hrms-server-action-dev`.

### B-18 — Tidy the `db-apply.mjs` header
- **Scope:** the header comment says "through 24_payroll_dirty_triggers.sql" and the log line says "28 modular files"; both should be derived or updated. Trivial.
- **Agent:** `hrms-db-schema`.

---

## Closed in this review (no action)

These were on the September plan and are verified done. Do not reopen without new evidence: rate limiting in production (P0-1), mock fallback removal (P0-3), Trivy and SBOM (P0-4), gitleaks (P0-5), Sentry (P1-1), coverage thresholds (P1-2), integration tests in CI (P1-3), production deploy workflow with health smoke test (P1-4), HSTS (P1-5). Account lockout (P1-6) is implemented, but its admin-unlock write goes through the user-scoped client and is subject to B-01; re-verify after B-01 is closed.
