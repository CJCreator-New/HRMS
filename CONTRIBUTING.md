# Contributing to Enterprise HRMS

Thank you for contributing to the Enterprise Human Resource Management System (HRMS). This document outlines our development process, coding standards, Git workflow, and quality expectations.

---

## 🧭 1. Core Engineering Principles

1. **Security by Default**:
   - Every mutating backend operation must enforce authorization via `assertPermission(user, 'permission.code')`.
   - Never trust client-provided role claims. Always validate server-side.
   - Enforce anti-self-approval guardrails for all workflow approvals.

2. **Full-Stack Type Safety**:
   - Write strict, fully-typed TypeScript code. Avoid `any` or loose casting.
   - Use discriminated unions for action responses (`ActionResponse<T>`).

3. **High Test Coverage**:
   - Write Vitest unit tests for business logic engines and components.
   - Verify critical user flows and RBAC permissions with Playwright E2E tests.

4. **Preserve Master Schema Hygiene**:
   - Never edit `schema/combined_init.sql` directly. Always modify modular SQL files in `schema/` and run `npm run db:sync`.

---

## 🌿 2. Git & Branching Strategy

We follow standard trunk-based branching with short-lived feature branches:

### Branch Naming Convention
- `feat/<module>-<short-description>` — New feature or capability
- `fix/<module>-<short-description>` — Bug fix or error resolution
- `docs/<short-description>` — Documentation improvements
- `refactor/<module>-<short-description>` — Code refactoring without behavior change
- `test/<module>-<short-description>` — Adding or updating test suites

*Examples*:
- `feat/leave-sandwich-policy-v2`
- `fix/payroll-lop-calculation`
- `docs/setup-guide-update`

---

## 💬 3. Commit Message Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short imperative description>

[optional body describing why the change was made]

[optional footer with issue reference, e.g. Fixes #123]
```

### Supported Types:
- `feat`: A new feature or capability
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (formatting, white-space)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

*Examples*:
```
feat(leave): add comp-off 90-day expiry enforcement
fix(attendance): handle clock-out crossing midnight boundary
test(rbac): add golden path routing trace for HR alternate approver
```

---

## 💻 4. Development & Coding Standards

### Server Actions Pattern
All server actions in `src/lib/actions/` must follow this structure:
```typescript
"use server";

import { assertPermission } from "@/lib/auth/assertPermission";
import { getCurrentUser } from "@/lib/actions/auth";

export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function submitExampleAction(input: InputType): Promise<ActionResponse<OutputType>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Mandatory RBAC check
    assertPermission(user, "example.permission_code");

    // Perform database operations...
    return { success: true, data: result };
  } catch (err: any) {
    console.error("Action error:", err);
    return { success: false, error: err.message || "Failed to execute action" };
  }
}
```

### Modifying Roles or Permissions
If you add or alter a permission code:
1. Add permission INSERT to `schema/01_rbac.sql`.
2. Add permission code to `ROLE_PERMISSIONS_MAP` in `src/lib/auth/permissions-map.ts`.
3. Verify synchronization:
   ```bash
   npm run verify:permissions
   ```

### UI & Styling Standards
- Use Tailwind CSS utility classes adhering to the project palette.
- Default to React Server Components (RSC); use `'use client'` only when client-side state/interactivity is required.
- Ensure all interactive elements include accessible labels (`aria-label`, `<label htmlFor="...">`).

---

## ✅ 5. Pre-PR Quality Checklist

Before submitting a Pull Request, verify that all quality checks pass locally:

```bash
# 1. Verify TypeScript & SQL permission synchronization
npm run verify:permissions

# 2. Run unit tests
npm run test:unit

# 3. Run ESLint code quality checks
npm run lint

# 4. Check schema compilation (if SQL files modified)
npm run db:sync

# 5. Run smoke & RBAC E2E tests
npm run test:e2e:p0
```

---

## 📬 6. Pull Request Submission

1. Push your branch to the remote repository.
2. Open a Pull Request targeting `main`.
3. Fill out the Pull Request template completely, including:
   - Summary of changes
   - Impacted modules
   - RBAC/Schema changes
   - Test verification results
