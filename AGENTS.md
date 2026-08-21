<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Enterprise HRMS — Agent & AI Pair Programming Guidelines

This document provides mandatory architecture standards, security patterns, and workflow rules for AI agents and developers building and refactoring in the Enterprise HRMS codebase.

---

## 🏛️ 1. Architecture Mental Model

The repository is a full-stack Next.js App Router application backed by PostgreSQL (via Supabase):

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│  src/app/ (Pages, Layouts, React Server & Client Components) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Calls
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Server Actions Layer                       │
│  src/lib/actions/ (*.ts)                                     │
│  • Enforces assertPermission(user, 'perm.code')             │
│  • Validates inputs & self-approval guardrails              │
│  • Returns typed ActionResponse<T> = { success, data, error }│
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Database Services Layer    │ │   Supabase Client / Admin  │
│   src/lib/services/          │ │   src/lib/supabase/        │
│   • Statutory calculation    │ │   • client.ts (anon/browser│
│   • Payroll engine           │ │   • server.ts (RSC/cookies)│
│   • Leave sandwich policy    │ │   • admin.ts (service role)│
└──────────────┬───────────────┘ └────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  schema/ (24 modular SQL schema files)                      │
│  • Row-Level Security (RLS) policies                        │
│  • Database Stored Procedures & Triggers (RPCs)             │
│  • Bootstrapped roles, permissions & system admin           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 2. Non-Negotiable Security & RBAC Rules

1. **Mandatory Server-Side Permission Checks**:
   - Every mutating Server Action in `src/lib/actions/` MUST call `assertPermission(user, 'perm.code')` before performing any database query or state modification.
   - Client-side visibility controls (hiding buttons/tabs) are UX conveniences only and NEVER substitute for server-side authorization.

2. **Strict Self-Approval Guardrails**:
   - Never allow users to approve their own requests (leaves, attendance corrections, expense claims, F&F clearances).
   - If an applicant is also an approver (e.g. Manager applying for leave, HR applying for leave), the system MUST route the request to their reporting manager or fallback to `System Admin`.

3. **Supabase Service Role Key Protection**:
   - `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to browser clients or `NEXT_PUBLIC_*` environment variables.
   - Use `createClient()` from `src/lib/supabase/client.ts` or `src/lib/supabase/server.ts` for user-scoped queries. Use `createAdminClient()` in `src/lib/supabase/admin.ts` strictly for administrative background tasks and tests.

4. **Mock Auth Mode Safety**:
   - In production (`process.env.NODE_ENV === "production"`), mock authentication is strictly disabled.
   - Mock auth session cookies in development are cryptographically signed (`src/lib/auth/mock-cookie.ts`).

---

## 🗄️ 3. Database Schema & Migration Conventions

1. **Modular Schema Files**:
   - The master schema is split into 24 numbered modular files in `schema/` (`00_setup.sql` through `22_comprehensive_performance_indexes.sql` and `bootstrap/01_system_admin.sql`).
   - **NEVER edit `schema/combined_init.sql` directly**. Always edit the relevant `schema/XX_*.sql` file or add a new numbered file, then run:
     ```bash
     npm run db:sync
     ```

2. **RBAC Permission Synchronization**:
   - Every permission code used in `src/lib/auth/permissions-map.ts` MUST be defined in `schema/01_rbac.sql`.
   - After updating permissions or role mappings, always run:
     ```bash
     npm run verify:permissions
     ```
     This check must exit with code `0`.

3. **Database Stored Procedures & Triggers**:
   - Business rules that enforce data integrity across concurrent transactions (e.g., leave sandwich calculation, preventing overlapping leaves, F&F draft staleness triggers) belong in PostgreSQL triggers and stored procedures (`schema/06_leave.sql`, `schema/09_payroll.sql`, `schema/13_ff_settlement.sql`).

---

## 💻 4. Coding & Component Standards

1. **TypeScript Strictness**:
   - All new code must be fully typed. Avoid `any`. Use discriminated unions for action results and status enums.
   - Standard Server Action return type:
     ```typescript
     export type ActionResponse<T = void> = {
       success: boolean;
       data?: T;
       error?: string;
     };
     ```

2. **Server vs. Client Components**:
   - Default to React Server Components (RSC) for data fetching and layout structure.
   - Use `'use client'` only for interactive components requiring browser APIs, hooks (`useState`, `useEffect`), or toast triggers.

3. **Styling & Design System**:
   - Use Tailwind CSS utility classes adhering to the project palette (Slate/Zinc neutral slate, Blue primary, Emerald success, Rose/Red danger, Amber warning).
   - Use Lucide React icons (`lucide-react`).

4. **Accessibility (a11y)**:
   - Ensure all interactive elements have accessible labels (`aria-label`, semantic `<button>`, `<input id="..." />` with `<label htmlFor="...">`).
   - The repository runs automated WCAG AA checks via `@axe-core/playwright`.

---

## 🧪 5. Testing & Validation Workflow

Before finishing any task, run the relevant verification commands:

```bash
# 1. Verify RBAC permission code sync
npm run verify:permissions

# 2. Run unit tests
npm run test:unit

# 3. Check for linting errors
npm run lint

# 4. Regenerate master schema if SQL files changed
npm run db:sync
```

---

## 📋 6. Key File Map for Agents

| Area | Key Files |
|---|---|
| **Server Actions** | `src/lib/actions/*.ts` |
| **RBAC Authorization** | `src/lib/auth/assertPermission.ts`, `src/lib/auth/permissions-map.ts`, `src/lib/auth/roles.ts` |
| **Mock Auth & Session** | `src/lib/auth/mock-cookie.ts`, `src/lib/actions/auth.ts`, `src/middleware.ts` |
| **Database Schema** | `schema/*.sql`, `scripts/db-apply.mjs`, `scripts/seed-mock-data.mjs` |
| **Business Services** | `src/lib/services/payroll-engine.ts`, `src/lib/services/statutory-engine.ts` |
| **UI Components** | `src/components/layout/AppShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/shared/` |
