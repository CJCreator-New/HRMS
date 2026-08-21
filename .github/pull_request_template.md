## 📋 Pull Request Summary

<!-- Briefly describe the goal of this PR and what was changed -->

## 🔗 Related Issues / Tickets
<!-- e.g. Fixes #123, Relates to #456 -->

## 🏷️ Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📖 Documentation update
- [ ] 🔧 Refactoring / Code hygiene
- [ ] 🧪 Test suite enhancement

## 📦 Impacted Modules
- [ ] Granular RBAC & Permissions
- [ ] Employee Directory & Onboarding
- [ ] Attendance & Time Tracking
- [ ] Leave Policy & Sandwich Engine
- [ ] Payroll Engine & Indian Statutory (PF/ESI/PT/TDS)
- [ ] Separation & F&F Settlement
- [ ] Reimbursements & Expense Claims
- [ ] Notifications & Reporting
- [ ] Database Schema & Migrations

## 🔒 Security & RBAC Checklist
- [ ] All new Server Actions enforce `assertPermission(user, 'perm.code')`
- [ ] Self-approval guardrails tested (users cannot approve their own requests)
- [ ] If permissions were modified: updated `schema/01_rbac.sql` AND `src/lib/auth/permissions-map.ts`

## 🗄️ Database / Schema Verification
- [ ] If SQL schema was modified: updated modular `schema/XX_*.sql` and ran `npm run db:sync`
- [ ] Ran `npm run verify:permissions` (exited with code 0)

## 🧪 Local Testing & Verification Checklist
- [ ] `npm run verify:permissions` passes with 0 errors
- [ ] `npm run test:unit` passes (all unit & component tests green)
- [ ] `npm run lint` passes (0 ESLint errors)
- [ ] Playwright E2E smoke tests verified (`npm run test:e2e:p0`)
