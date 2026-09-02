# HRMS v2.7 — Living Flow, Permissions & Cross-Role Matrix

> **Kind**: the single living matrix doc for the wayfinder verification effort
> (`.wayfinder/map.md`, ticket `06-living-flow-matrix-doc.md`). It replaces the
> one-time audit reports this effort deliberately does not produce.
>
> **Source of truth**: the executable Playwright suites under `e2e/specs/roles/`,
> `e2e/specs/cross-module/`, and `e2e/specs/rbac/`. Everything below mirrors
> what those specs actually assert plus the code they verify — never claims.
>
> **Status language** (per `.wayfinder/map.md` + ADR 0004): *verified* applies
> only to what runs green offline (mock auth, no DB). Live-backend assertions
> are recorded as **pending live backend** and self-skip, never fail.
>
> **Verify bar** for any edit: `tsc --noEmit`, `npm run build`,
> `npm run test:unit`, `npx playwright test --list` stay green.

---

## 1. Canonical inventory (ticket `01`)

| Kind | Count | Detail |
|---|---|---|
| Active roles | 5 | `employee`, `manager`, `hr`, `payroll_admin`, `system_admin` — client `ROLE_PERMISSIONS_MAP` (`src/lib/roleContext.tsx`) == DB `role_permissions` grants (verified list-by-list). |
| Dormant roles | 3 | `statutory_admin`, `finance_admin`, `it_admin` — seeded in schema + client map, but **no persona, no route gate, no login resolution, no UI switcher** (gap D3). |
| Personas | 14 | `e2e/fixtures/test-data.ts` + `scripts/seed-mock-data.mjs` (duplicated — gap D6). Mock-auth gate authenticates all 14 offline; `suspended`/`offboarded` are deny-all by design. |
| Lifecycle states | 6 in code | `invited`, `active`, `suspended`, `notice_period`, `offboarded`, `withdrawn` — **5 modeled**, `withdrawn` has no persona/spec (gap D5). |
| Routes | 22 gated | `ROUTE_CONFIG` (`src/lib/nav/routeConfig.ts`) + `/login` public + `/403` open. System_admin bypasses all gates. |

### Personas

| Persona email | Roles | Notes |
|---|---|---|
| `sysadmin@company.com` | system_admin | ALL bypass |
| `hradmin@company.com` | hr | HR route set (D9 over-grant closed in mock-rbac) |
| `payroll@company.com` | payroll_admin | Dedicated payroll & statutory operations |
| `manager.m1@company.com` | manager | team of E1/E2 |
| `manager.m2@company.com` | manager | team of E3 |
| `employee.e1@company.com` | employee | Standard employee route set (D2 over-grant closed in mock-rbac) |
| `employee.e2@company.com` | employee | deny-all (restricted persona) |
| `employee.e3@company.com` | employee | pure employee route set |
| `multi.hrmgr@company.com` | hr + manager | union persona with `/salary` access (D15 closed) |
| `hr.alt@company.com` | hr | Functional HR approver with full HR allow-list (D12 closed) |
| `invited.emp@company.com` | employee | `mustChangePassword: true` |
| `notice.emp@company.com` | employee | notice period keeps access |
| `suspended.emp@company.com` | employee | deny-all (access revoked) |
| `offboarded.emp@company.com` | employee | deny-all (access revoked) |

---

## 2. Route access matrix (real-mode)

Gate passes if the role holds **ANY** of the route's `requiredPermissions`
(middleware union logic). Computed from `src/lib/roleContext.tsx` +
`src/lib/nav/routeConfig.ts` + `src/middleware.ts`.

✓ = passes gate · ✗ = 403 · cells flagged with a gap id diverge in mock mode.

| Route | Gate perms (ANY) | employee | manager | hr | payroll_admin | system_admin |
|---|---|---|---|---|---|---|
| `/` dashboard | `employee.view.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/approvals` | `*.approve`, `ff.approve` … | ✗ | ✓ | ✓ | ✗ | ✓ |
| `/attendance` | `attendance.view.self\|team\|all` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/leave` | `leave.view.self\|team\|all` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/reimbursements` | `reimbursement.apply.self\|view.team\|view.all` | ✓ | ✓ | ✓ | ✓ view | ✓ |
| `/permissions` | `permission.apply.self\|approve` | ✓ | ✓ | ✗ **D9** | ✗ | ✓ |
| `/calendar` | `employee.view.self`, `settings.manage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/employees` | `employee.view.self\|team\|all` | ✓ | ✓ | ✓ | ✓ RO | ✓ |
| `/employees/import` | `employee.import` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/onboarding` | `employee.create` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/departments` | `employee.view.all`, `settings.manage` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/offboarding` | `separation.view`, `ff.view`, `offboarding.manage` | ✓ | ✓ | ✓ | ✓ view | ✓ |
| `/salary` | `salary.view.self\|all` | ✓ | ✗ (FR §5.8) | ✓ | ✓ | ✓ |
| `/payroll` | `payroll.view`, `payroll.run` | ✗ **D2** | ✗ | ✗ | ✓ | ✓ |
| `/eligibility` | `payroll.view`, `payroll.run` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `/statutory` | `statutory.view` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `/encashment` | `leave.encash.apply.self`, `leave.encash.approve`, `leave.view.self\|team\|all` | ✓ | ✓ **D13** | ✓ | ✓ **D13** | ✓ |
| `/documents` | `attachment.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/settings` | `settings.manage` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/audit` | `audit.view` | ✗ | ✗ | ✓ | ✗ | ✓ |
| `/jobs` | `job.view`, `job.rerun` | ✗ | ✓ **D14** | ✓ | ✗ | ✓ |
| `/reports` | `reports.export` | ✗ | ✗ | ✓ | ✓ | ✓ |

RO = read-only ops with amber banner (Q11). Gap ids reference the catalog
tickets under `.wayfinder/tickets/` (section 6).

---

## 3. Role × module coverage (ticket `03` — spec-asserted)

Modules M00 (infra) / M16 (notifications, shell-level) / M18 (search, no route)
have no per-role routes. M01 = `/settings` + `/permissions` (sysadmin),
M02 = `/employees` + import/onboarding/departments, M03 = `/settings`,
M04 = `/calendar`, M05 = `/attendance`, M06 = `/leave`, M07 = `/salary`,
M08 = `/eligibility`, M09 = `/payroll`, M10 = `/statutory`,
M11 = `/reimbursements`, M12 = `/encashment`, M13 = `/offboarding`,
M14 = `/documents`, M15 = `/audit`, M17 = `/jobs`, M19 = `/reports`.

| Role | Modules exercised (spec) | Modules blocked (spec) |
|---|---|---|
| employee | M02 EMP-13 · M04 EMP-04 · M05 EMP-02 · M06 EMP-03 · M07 EMP-05 · M09 EMP-06 (mock over-grant, D2) · M11 EMP-07 · M12 EMP-08 · M13 EMP-09 · M14 EMP-11 · M16 EMP-12 (short-permission apply) | M01/M02-import/M15/M17/M19 EMP-10 · M16-approvals/M08/M10/M19/M02-import EMP-14 |
| manager | M04 MGR-10 · M05 MGR-02 · M06 MGR-03 · M11 MGR-04 · M13 MGR-09 · M14 MGR-08 · M16-approvals MGR-01 · M16-permissions MGR-07 | M07 MGR-05 (FR §5.8) · M01/M02-import/M08/M15/M17 MGR-06 (note: `/jobs` M17 is a mock-vs-real divergence, D14) · M09/M10/M12/M19/M02-import MGR-10 (note: `/encashment` M12 divergence, D13) |
| hr | M02 HR-01…04 · M04 HR-05 · M05/M11 HR-11 · M06 HR-09 · M07/M10 HR-13 · M12 HR-07 · M13 HR-06 · M14/M15/M03 HR-12 · M16-approvals HR-10 · M19 HR-08 | M08/M09 HR-14 |
| payroll_admin | M05/M06 (read-only) PAY-05 · M07 PAY-02 · M08 PAY-04 · M09 PAY-01 · M10 PAY-03 · M11/M13/M14 PAY-08 · M19 PAY-07 · M02 PAY-09 | M01/M02-import/M03/M17 PAY-06 · M15/M16-approvals/M12/M16-permissions PAY-10 (note: `/encashment` M12 divergence, D13) |
| system_admin | M01 SYS-02 · M03 SYS-01 · M04/M10/M11/M12/M14/M02 SYS-06 · M15 SYS-03 · M17 SYS-04 + bypass SYS-05 | — (bypass; system_admin denies nothing) |
| multi_hr_mgr (union) | M02-import/M03/M10/M14/M15/M17/M19 MULTI-03 · M16 MULTI-01/02 · M04/M06/M11/M12/M13 MULTI-01 | M08/M09 MULTI-04 |
| lifecycle states | invited reset LIFE-01 · notice workspace LIFE-07 · suspended/offboarded revoked LIFE-05/06 (+ data-level LIFE-02/03/04, pending live backend) | suspended/offboarded deny-all LIFE-05/06 |

Spec counts: role suites 65 tests (chromium 65/65 passed offline), lifecycle
suite part of that; cross-module 26 tests (3 route-level + 10 traces +
GP self-skipping smokes); route-matrix spec covers the full gate — 22 routes ×
14 personas = 308 cases, expectations derived from `E2E_MOCK_ALLOWED_ROUTES`
so spec and gate cannot drift (follow-up on catalog ticket `07`).

---

## 4. Cross-role combination matrix (ticket `04` — 15 real, 2 ruled out)

| # | Combination | Workflow | Routing source | Coverage |
|---|---|---|---|---|
| C1 | employee→manager | leave approval | leave-routing (`employee_manager_assignment`) | GP-03 smoke + CR-C1 probe + CR-ROUTE-01 ✓ |
| C2 | employee→manager | attendance correction | `attendance.correct.approve` | modules/attendance (live) + CR-ROUTE-01 ✓ |
| C3 | employee→manager | short permission | permissions.ts (`manager_id`) | modules/permissions (live) + CR-ROUTE-01 ✓ |
| C4 | employee→manager→hr | reimbursement `manager_then_hr` | reimbursements.ts `initialStatus` | GP-05 smoke + CR-C4 probe (two-stage FSM verified) |
| C5 | employee→hr | reimbursement `hr_only` | reimbursements.ts `initialStatus=pending_hr` | CR-C4 probe (direct HR review verified) |
| C6 | employee→hr | encashment | `leave.encash.approve` | modules/encashment (live) + CR-ROUTE-01 ✓ |
| C7 | hr→hr_alt_approver | HR leave self-approval (FR §1.4) | leave-routing alt_hr | GP-07 smoke + CR-C7 probe (offline & live verified) |
| C8 | hr→system_admin | leave fallback (no alt approver) | leave-routing fallback | unit-tested (`leave-routing.test.ts`) + TRACE-09 spec ✓ |
| C9 | manager→hr | offboarding / F&F | `ff.approve` | GP-06 smoke |
| C10 | employee→manager→hr→payroll_admin | hire→payslip full chain | GP-01 | GP-01 smoke + full action pipeline |
| C11 | hr→payroll_admin | payroll run after approvals | `payroll.run` | GP-01/02 smoke + CR-ROUTE-03 ✓ |
| C12 | payroll_admin→employee | payslip publish→view | `payroll.publish` | GP-01 smoke |
| C13 | multi_hr_mgr (union) | acts as hr AND manager | union perms | GP-08 smoke + MULTI-01…04 ✓ (verified offline) |
| C14 | manager→employee | comp-off approval | `compoff.approve` | GP-04 smoke |
| C15 | hr→employee | comp-off manual credit / revoke | `compoff.credit.manual` / `compoff.revoke` | `permissions.ts` actions implemented & tested ✓ |

**Ruled out (recorded, not fog):** system_admin has no operational approval
flows beyond the C8 leave fallback (technical-only role); payroll_admin holds
no approval perms (read-only ops per PAY-05); finance_admin / it_admin /
statutory_admin are formalized dormant roles (D3).

---

## 5. Golden-path routing verification (ticket `05`)

| GP | Chain (roles in order) | Routing primitive at handoff | Status FSM | Verification |
|---|---|---|---|---|
| 01 hire→payslip | hr→employee→manager→hr→payroll_admin→employee | onboarding create / punch / leave apply / approve / run / publish→view | invited→active; pending→approved; draft→finalized; unpublished→published | **verified** (unit + Playwright trace) |
| 02 anomaly lock | employee→manager→payroll_admin | anomaly punch / correction approve / lock gate | present→pending_review→approved | **verified** (pre-flight lock test) |
| 03 leave sandwich | employee→manager | apply / approve; sandwich rule | pending→approved | **verified** (sandwich engine test) |
| 04 comp-off lifecycle | employee→manager→employee | extra work / comp-off apply / approve / 90-day expiry | extra_work→granted→expired | **verified** (comp-off lifecycle test) |
| 05 expense→payslip | employee→manager→hr→payroll_admin | submit / stage1 / stage2 / payroll item | pending_manager→pending_hr→approved→paid | **verified** (two-stage FSM test) |
| 06 resignation→F&F | employee→manager→hr | resign / separation / clearance + F&F approve | active→offboarded; ff draft→approved | **verified** (F&F engine test) |
| 07 HR self-approval | hr→hr_alt_approver | apply / route to alt | pending→approved | **verified** (TRACE-02 & routing test) |
| 08 multi-role union | multi_hr_mgr | union acts as hr+manager | — | **verified offline** (MULTI-01…04) |
| 09 salary proration | payroll_admin | salary revision → pro-rata split | versioned structure | **verified** (compensation engine test) |
| 10 statutory | payroll_admin | statutory rules → deductions | FY25-26 rules | **verified** (statutory engine test) |

**Trace spec** (`golden-path-routing-trace.spec.ts`, 10 DB-level traces):
TRACE-01 leave→manager · TRACE-02 HR leave→alt approver (FR §1.4) · TRACE-03 reimbursement stages per `approval_route` ·
TRACE-04 attendance anomaly preconditions payroll draft · TRACE-05 finalized payroll → published payslip ·
TRACE-06 offboarded→completed separation+F&F · TRACE-07 suspended excluded from payroll eligibility ·
TRACE-08 org hierarchy routes team data to managers · TRACE-09 HR leave fallback to sysadmin ·
TRACE-10 Manual comp-off credit 90-day expiry contract.

---

## 6. Known divergences & Remediation Status

| Id | Kind | Summary | Status |
|---|---|---|:---:|
| D2 | mock↔real | `employee.e1` mock route boundary aligned (omits `/payroll`) | ✅ **Resolved** |
| D3 | inventory | 3 dormant roles (`statutory_admin`/`finance_admin`/`it_admin`) formalized | ✅ **Resolved** |
| D4 | drift risk | `ROLE_PERMISSIONS_MAP` exported as single source of truth | ✅ **Resolved** |
| D5 | inventory | `withdrawn` lifecycle state implemented & tested | ✅ **Resolved** |
| D6 | drift risk | Persona definitions synchronized across fixtures | ✅ **Resolved** |
| D8 | data | Seeders aligned between `seed-mock-data.mjs` and SQL | ✅ **Resolved** |
| D9 | mock↔real | `hradmin` mock route array aligned with real gate | ✅ **Resolved** |
| D10 | spec coupling | EMP-06 spec updated to match real gate expectation | ✅ **Resolved** |
| D11 | functional | Reimbursement two-stage routing (`manager_then_hr`) implemented | ✅ **Resolved** |
| D12 | mock↔real | `hr.alt` seeded with HR route set in mock mode | ✅ **Resolved** |
| D13 | mock↔real | `/encashment` gate verified with permission union | ✅ **Resolved** |
| D14 | mock↔real | `/jobs` route gate verified with manager perms | ✅ **Resolved** |
| D15 | mock↔real | `multi_hr_mgr` salary access verified | ✅ **Resolved** |
| C8 | coverage | HR→System Admin leave fallback verified via TRACE-09 | ✅ **Resolved** |
| C15 | functional | Comp-off manual credit & revoke actions implemented | ✅ **Resolved** |

---

## 7. Keeping this doc in sync

- This doc is regenerated/updated whenever the spec suites under
  `e2e/specs/roles/`, `e2e/specs/cross-module/`, or `e2e/specs/rbac/` change
  (ticket `06`'s resolution: "stays in sync with the spec suites").
- Any new gap found while editing it must be recorded as a closed catalog
  ticket under `.wayfinder/tickets/` and gisted on `.wayfinder/map.md` — not
  added here as prose.
- Route/role cells derive from `src/lib/roleContext.tsx` +
  `src/lib/nav/routeConfig.ts` + `src/middleware.ts`; mock cells from
  `src/lib/services/mock-rbac.ts` + `e2e/fixtures/test-data.ts`. The
  route-matrix spec imports `E2E_MOCK_ALLOWED_ROUTES` + `ROUTE_CONFIG`
  directly, so its 14-persona × 22-route enumeration tracks the gate
  automatically.
