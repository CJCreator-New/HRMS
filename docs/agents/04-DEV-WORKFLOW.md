# HRMS — Development Workflow for Agents and Developers

This is the operational companion to `AGENTS.md`. `AGENTS.md` states the rules; this document says how to follow them on a real change. If the two disagree, `AGENTS.md` wins and this file should be fixed.

---

## 1. Setup (once)

```bash
npm install
cp .env.example .env.local      # .env.local is git-ignored; never commit it
```

Pick a mode in `.env.local`:

| Mode | Setting | Use for |
|---|---|---|
| Mock auth | `NEXT_PUBLIC_MOCK_AUTH=true` | UI work, most unit/E2E runs, no database needed |
| Live | `NEXT_PUBLIC_MOCK_AUTH=false` + Supabase keys | Anything touching RLS, triggers, RPCs, payroll SQL, integration tests |

Live database: `npm run db:sync` → apply `schema/combined_init.sql` to Postgres → `npm run seed:mock`. Details: `docs/LOCAL_SETUP.md`.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or a `NEXT_PUBLIC_*` variable.

---

## 2. Definition of Done (every change)

A change is done only when all of these hold. Run them and paste the summary line in the PR.

| # | Command | Pass condition |
|---|---|---|
| 1 | `npm run verify:permissions` | exit 0 (required if permissions, roles, or SQL seeds changed) |
| 2 | `npx tsc --noEmit` | 0 errors |
| 3 | `npm run lint` | 0 errors (new warnings must be explained) |
| 4 | `npm run test:unit` | all files pass |
| 5 | `npm run db:sync` | `git diff --stat schema/combined_init.sql` is only the expected change (required if any `schema/*.sql` changed) |
| 6 | `npm run test:e2e:p0` | pass in mock mode (required if any route, page, or permission changed) |
| 7 | `npm run test:integration` and `npm run test:db` | pass against a live DB (required if SQL, triggers, RPCs or payroll logic changed) |

If a required check cannot run (for example no live DB), say so explicitly in the PR and in your final report. Do not claim it passed.

Coverage gate: `npm run test:coverage` must keep statements ≥ 70 and branches ≥ 60 (`vitest.config.mts`).

---

## 3. Non-negotiable rules (summary of AGENTS.md §2–§4)

1. **Every mutating server action** in `src/lib/actions/` calls `assertPermission` / `assertAnyPermission` (or `assertCallerIdentity` for acting on behalf of an employee) **before** any query or write.
2. **Client-side hiding is not authorization.** `usePermission` is UX only.
3. **No self-approval.** Leave, attendance corrections, claims and F&F clearances must route to the reporting manager or `System Admin` when the applicant is also an approver.
4. **Schema:** edit `schema/NN_*.sql` (or add a new numbered file and register it in `scripts/db-apply.mjs`), then `npm run db:sync`. Never edit `schema/combined_init.sql` by hand.
5. **Permissions:** a code used in `src/lib/auth/permissions-map.ts` must exist in `schema/01_rbac.sql`. Run `verify:permissions`.
6. **Business integrity rules** (overlaps, sandwich days, F&F staleness, payroll locks) live in PostgreSQL triggers or stored procedures, not only in TypeScript.
7. **Types:** no `any` in new code. Server actions return `ActionResponse<T>`.
8. **Components:** server components by default; `'use client'` only for hooks, browser APIs, or event handlers.
9. **Styling:** Tailwind with semantic tokens (`text-ink`, `bg-surface`, `border-line`, `text-primary-*`). Icons from `lucide-react`.
10. **Accessibility:** every interactive element has a label; axe runs in `e2e/specs/nfr/accessibility.spec.ts`.
11. **Dates:** IST via `getTodayDateStringIST()` (`src/lib/utils/date-utils.ts`). Never `toISOString().split("T")[0]`.
12. **Logs:** use `src/lib/utils/logger.ts`; it redacts salary, PAN, Aadhaar, bank, UAN. Never log raw payroll data.

---

## 4. Recipes

### 4.1 Add a server action (mutating)

```ts
// src/lib/actions/<module>.ts
"use server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { createClient } from "@/lib/supabase/server";

// Target shape (AGENTS.md §4.1). Today only src/lib/actions/assets.ts defines it inline;
// see backlog B-19 for moving it to a shared module. Until then, copy the assets.ts definition.
export type ActionResponse<T = void> = { success: boolean; data?: T; error?: string };

export async function approveSomethingAction(id: string): Promise<ActionResponse> {
  const permError = await assertPermission("module.approve");   // 1. guard first
  if (permError) return { success: false, error: permError.error }; // assertPermission returns { error } | null

  const supabase = await createClient();                         // 2. user-scoped client
  const { error } = await supabase.rpc("approve_something", { p_id: id }); // 3. business rule in SQL
  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

Then:
1. Add the permission code to `permissions-map.ts` **and** `schema/01_rbac.sql`; run `npm run verify:permissions`.
2. Add a unit test in `src/lib/services/__tests__/<module>-action.test.ts` covering: unauthorized caller, self-approval attempt, happy path.
3. Add or extend the route gate in `src/lib/nav/routeConfig.ts` if a new page is involved.

### 4.2 Add a column or table

1. Edit or add `schema/NN_<module>.sql`. Use `if not exists`/`create or replace` so the file is re-runnable.
2. Enable RLS on new tables and write explicit policies. Load the `supabase-postgres-best-practices` skill for RLS and index rules.
3. Register new files in `scripts/db-apply.mjs` (the ordered list) if you added a file.
4. `npm run db:sync`; check the diff of `combined_init.sql`.
5. Update `docs/product/07-DATA_MODEL.md` if the model changed.
6. Run `npm run test:db`.

### 4.3 Add or change a business rule (payroll, leave, statutory, F&F)

1. Start from the rule's current home (see `02-MODULE-MAP.md`). Do not add a second implementation in the UI.
2. If the rule protects integrity across concurrent transactions, put it in SQL (trigger or RPC) and test with the integration suite.
3. Add table-driven unit tests for the engine (`payroll-engine.test.ts`, `statutory-engine.test.ts`, `leave-engine.test.ts` are the patterns).
4. Record a short decision in `docs/adr/` if the change alters a published rule.

### 4.4 Add a page

1. `src/app/<route>/page.tsx` (server component), with `error.tsx` in the same folder (copy `src/app/payroll/error.tsx`).
2. Register the route in `src/lib/nav/routeConfig.ts` with `requiredPermissions`.
3. Put interactive pieces in `src/components/<module>/`, marked `'use client'` only where needed.
4. Add a Playwright spec under `e2e/specs/modules/` and, if it's role-specific, a row in `e2e/specs/rbac/route-matrix.spec.ts`.

### 4.5 Fix a bug

1. Reproduce with a failing test first (unit if logic, E2E if flow). See the `tdd` and `diagnosing-bugs` skills.
2. Fix at the lowest layer that owns the rule (SQL > service > action > component).
3. Note the ticket ID (e.g., `B-03`) in the commit message.

### 4.6 Change permissions or roles

1. Edit `src/lib/auth/permissions-map.ts` and `schema/01_rbac.sql` together.
2. `npm run verify:permissions` must exit 0.
3. Review `docs/RBAC_ACCESS_MATRIX.md` and `docs/product/06-RBAC_DESIGN_GUIDE.md`; update them if the matrix changed.
4. Run `e2e/specs/rbac/` in mock mode.
5. Use `hrms-rbac-auditor` for review.

---

## 5. Git and commit conventions

- Branch from `main`. Never commit directly to `main`.
- Commit messages: `type(scope): summary (B-xx)` — e.g. `fix(audit): make audit trigger security definer (B-01)`.
- Commit `schema/combined_init.sql` in the same commit as the source change that produced it.
- Do not commit `.env.local`, `test-results/`, `e2e-report/`, `tsconfig.tsbuildinfo` churn, or secrets. Gitleaks runs in CI.
- PR body: link the backlog ticket, list the Definition-of-Done results, and call out any check that did not run.

---

## 6. Troubleshooting (Windows-specific and known)

| Symptom | Cause | Fix |
|---|---|---|
| Vitest fails with file-handle errors | parallel workers + `lucide-react` on Windows | keep `fileParallelism: false`; see B-11 |
| Login works but nothing persists | mock mode active | set `NEXT_PUBLIC_MOCK_AUTH=false` and use a live DB |
| `verify:permissions` fails after editing roles | SQL seed not updated | update `schema/01_rbac.sql` to match `permissions-map.ts` |
| CI "schema sync" fails | `combined_init.sql` not regenerated | run `npm run db:sync` and commit the result |
| Audit rows missing | see review F-01/F-02 | do not assume audit writes succeed until B-01/B-02 are closed |
| Middleware slow on gated routes | one RPC per request | see B-16 |

---

## 7. Reference documents

| Need | Read |
|---|---|
| Rules | `AGENTS.md` |
| Where things live | `docs/agents/02-MODULE-MAP.md` |
| Current state and risks | `docs/agents/01-E2E-PRODUCT-REVIEW.md` |
| What to work on | `docs/agents/03-BACKLOG.md` |
| Who to ask (which agent) | `docs/agents/05-AGENT-ROSTER.md` |
| API surface | `docs/API_DOCUMENTATION.md` |
| Testing strategy | `docs/product/09-TESTING_STRATEGY.md`, `TESTING_ARCHITECTURE.md`, `TEST_COVERAGE.md` |
| Business rules | `CONTEXT.md`, `docs/PRD.md`, `docs/SPEC.md`, `docs/SPEC-CORE-LIFECYCLE.md` |
| Decisions | `docs/adr/` |
| Operations | `docs/runbooks/` |
