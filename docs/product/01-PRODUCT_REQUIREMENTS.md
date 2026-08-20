# HRMS v2.7 — Product Requirements & Scope Definitions

> **Audience**: Product, Business, Engineering, Design  
> **Authority**: FR v2.7, ADR 0001–0003  
> **Version**: 2.7 Release Candidate  
> **Last Updated**: August 19, 2026

---

## 1. Business Vision

### Problem Statement

Organizations managing 50–5,000+ employees lack a **unified, compliant, and role-aware** HRMS that handles:

- Employee lifecycle from onboarding to separation
- Multi-template work calendars with configurable holidays
- Attendance tracking with anomaly detection and correction workflows
- Leave management with configurable sandwich rules and comp-off policies
- Indian statutory payroll (PF, ESI, PT, TDS) with versioned rule management
- Expense reimbursements with receipt management and approval routing
- Full & Final offboarding settlements with audit trails

Existing solutions either:
- Hardcode statutory rules without versioning
- Lack Row-Level Security (RLS) and granular RBAC
- Fail to enforce payroll locking when anomalies exist
- Fragment employee data across disconnected systems

### Value Proposition

HRMS v2.7 delivers a **single source of truth** for all HR operations with:

1. **Granular RBAC** — 8 roles (5 active, 3 dormant), multi-role union permissions, and self-grant prevention
2. **Database-Enforced Compliance** — RLS policies, stored procedures, and triggers ensure data integrity at every layer
3. **Indian Statutory Payroll** — Versioned statutory rules with effective dates, covering FY 2025-26
4. **Automated Workflow Engines** — Leave calculation, payroll processing, F&F settlement, and anomaly detection
5. **Full Audit Trail** — Immutable logs capturing every administrative change with actor, timestamp, and before/after values

### Business Objectives

| Objective | Measure | Target |
|---|---|---|
| Reduce manual payroll processing time | Hours per payroll cycle | < 2 hours for 500 employees |
| Eliminate payroll errors from anomalies | Unapproved payroll count | Zero |
| Achieve full Indian statutory compliance | Regulatory audit pass | 100% |
| Reduce onboarding time | Days from offer to active | < 1 day (admin-initiated) |
| Maintain complete audit coverage | Mutations without audit log | 0 |

---

## 2. Scope Definition

### In-Scope (Phase 1 MVP — Current)

| Category | Features |
|---|---|
| **Authentication** | Email/password login, Supabase Auth, forced password reset, session management |
| **RBAC** | 5 active roles, multi-role union, permission gating, self-grant prevention, role view switcher |
| **Employee Lifecycle** | Onboarding (direct admin), CSV bulk import, department/designation assignments, deactivation |
| **Attendance** | Punch check-in/out, work duration calculation, anomaly flagging, correction workflow, manager/HR approval |
| **Work Calendar** | Calendar templates (5/6-day week), compulsory/optional holidays, employee assignment |
| **Leave Management** | CL/SL/EL/Comp-off types, sandwich rule, overlap prevention, HR alternate routing, year-end carry-forward |
| **Salary & Compensation** | Salary components, per-employee versioned structures, mid-month pro-ration |
| **Payroll** | Period initiation, lock verification, bulk run, recalculation, revision tracking, payslip publishing |
| **Statutory Compliance** | PF/ESI/PT/TDS calculation, versioned statutory rules, statutory profiles, calculation snapshots |
| **Expense Reimbursements** | Category-based claims, receipt upload, policy modes, duplicate detection, approval routing |
| **Leave Encashment** | Encashment requests, 26-day divisor, carry-forward logs |
| **Offboarding & F&F** | Resignation, notice period, LWD calculation, rescission, clearance checklists, F&F settlement, stale detection |
| **Documents** | File attachments (PDF/JPEG/PNG ≤10MB), malware scan status |
| **Audit** | Immutable audit logs with entity changes, correlation IDs |
| **Notifications** | In-app inbox for approvals, corrections, payroll releases |
| **Reports** | Attendance summary, leave utilization, statutory compliance register, payroll register (CSV export) |
| **Search** | Global command palette (Ctrl+K) for employees, departments, payroll periods |

### Out-of-Scope (Phase 1 MVP — Explicitly Excluded)

| # | Exclusion | Rationale |
|---|---|---|
| 1 | SSO / SAML / OAuth / MFA | Authentication simplified for internal deployment |
| 2 | Biometric hardware / GPS geofencing | Web-based punch only |
| 3 | Multi-location / multi-tenant | Single-organization deployment |
| 4 | Bank payment gateway API | Manual payment processing |
| 5 | ERP / Accounting integration (SAP, Oracle, Tally) | Standalone HRMS |
| 6 | Tax filing portal APIs (EPFO / ESIC) | Manual compliance filing |
| 7 | Manager salary visibility | Explicitly blocked per FR §5.8 |
| 8 | Employee advances / loans | Not in current scope |
| 9 | Discretionary bonus workflows | Beyond standard payroll adjustments |

### Future Scope (Phase 2+)

- SSO/MFA integration
- Mobile application (React Native)
- Advanced analytics dashboards
- AI-powered attendance anomaly detection
- Bank API integration for salary disbursement
- Multi-language support

---

## 3. Stakeholders

| Stakeholder | Role | Interest | Influence |
|---|---|---|---|
| **HR Administrator** | Primary operator | Employee lifecycle, policy management, compliance reporting | High |
| **Payroll Administrator** | Primary operator | Payroll execution, statutory compliance, salary structures | High |
| **Manager** | Team operator | Team approvals, attendance monitoring, leave review | Medium |
| **Employee** | End user | Self-service attendance, leave, claims, payslip access | Medium |
| **System Administrator** | Technical operator | System configuration, RBAC governance, audit, scheduled jobs | High |
| **Finance Team** | Consumer | Payroll reports, compliance registers, F&F settlements | Medium |
| **External Auditor** | Consumer | Audit trail, statutory compliance verification, payroll records | Medium |
| **Engineering Team** | Builder | System design, code quality, testing, deployment | High |
| **Product Team** | Owner | Feature prioritization, user experience, business alignment | High |

---

## 4. User Personas

### 4.1 Employee (`employee`)

**Role**: Individual contributor within the organization

**Needs**:
- Punch attendance daily (check-in/check-out)
- Apply for leave and view balances
- Submit expense claims with receipts
- View and download monthly payslips
- Submit resignation when applicable

**Pain Points**:
- Missing check-outs requiring manual correction
- Unclear leave balance visibility
- Delayed payslip access

**Expectations**:
- One-click attendance punch
- Real-time leave balance visibility
- Instant payslip download after payroll publish

**Routes**: `/`, `/attendance`, `/leave`, `/reimbursements`, `/permissions`, `/calendar`, `/employees` (self only), `/documents`, `/encashment`

---

### 4.2 Manager (`manager`)

**Role**: Line manager / team lead overseeing direct reports

**Needs**:
- Monitor team attendance and approve corrections
- Review and approve team leave requests
- Conduct stage-1 expense reimbursement review
- Approve comp-off and short permission requests

**Pain Points**:
- Approvals scattered across different modules
- Missing context when reviewing requests
- No visibility into team payroll (by design per FR §5.8)

**Expectations**:
- Unified approval inbox with module filtering
- Context-rich request details (dates, reasons, history)
- Quick approve/reject with comments

**Routes**: All Employee routes + `/approvals`, `/offboarding` (team view)

**Constraints**: **Strictly no salary visibility** — `/salary` hidden and returns 403

---

### 4.3 HR Admin (`hr`)

**Role**: Organization & people operations manager

**Needs**:
- Onboard new employees with temporary credentials
- Configure departments, managers, designations
- Manage leave policies and sandwich rules
- Handle HR-stage approvals (leave, reimbursement, encashment)
- Manage offboarding and F&F settlements
- Export compliance and attendance reports

**Pain Points**:
- Self-approval prevention for own leave requests
- Complex F&F settlement calculations
- Stale F&F detection when records change

**Expectations**:
- Direct onboarding without employee self-registration
- Alternate HR approver routing (FR §1.4)
- Automated F&F stale detection

**Routes**: All Employee routes + `/onboarding`, `/employees/import`, `/departments`, `/offboarding`, `/salary`, `/statutory`, `/settings`, `/audit`, `/reports`

---

### 4.4 Payroll Admin (`payroll_admin`)

**Role**: Compensation & compliance specialist

**Needs**:
- Configure salary components and employee structures
- Maintain statutory rule versions and employee profiles
- Execute payroll runs with lock verification
- Publish payslips for employee access
- View operational data (read-only) for payroll context

**Pain Points**:
- Unresolved anomalies blocking payroll finalization
- Missing statutory profiles for employees
- Need operational context without operational access

**Expectations**:
- Strict lock verification preventing non-compliant payroll
- Read-only operational data with clear context
- Revision tracking for payroll corrections

**Routes**: `/salary`, `/payroll`, `/eligibility`, `/statutory`, `/employees` (read-only), `/attendance` (read-only), `/leave` (read-only), `/documents`, `/reports`

---

### 4.5 System Administrator (`system_admin`)

**Role**: Technical & security governance

**Needs**:
- Bootstrap initial system configuration (zero-seed gate)
- Manage RBAC roles and permissions
- Inspect audit trails
- Execute scheduled background jobs
- Break-glass account recovery

**Pain Points**:
- Self-granting approval permissions (blocked by trigger)
- Initial system bootstrap outside RLS
- Need for break-glass access

**Expectations**:
- Service-role bootstrap script for initial setup
- Self-grant prevention at database level
- Complete system visibility

**Routes**: All routes (bypass), with primary focus on `/settings`, `/permissions`, `/audit`, `/jobs`

---

### 4.6 Multi-Role User (`multi_hr_mgr`)

**Role**: Employee holding multiple roles (e.g., HR + Manager)

**Needs**:
- Switch between Manager and HR workspaces
- Access cumulative union of permissions
- Context-appropriate navigation for active role

**Pain Points**:
- Confusion about which role's context is active
- Navigation clutter from all permissions

**Expectations**:
- Role View Switcher in header
- Sidebar filters to active role's workspace
- Backend permissions unchanged by switch

---

## 5. Functional Requirements Summary

### Module 00: Infrastructure
- **FR-00.1**: System must use PostgreSQL with Row-Level Security (RLS)
- **FR-00.2**: All mutations must be auditable via immutable `audit_logs`
- **FR-00.3**: Idempotency keys must prevent duplicate operations (FR §8.4)

### Module 01: RBAC
- **FR-01.1**: 56 granular permission codes organized by module and scope (`.self`, `.team`, `.all`)
- **FR-01.2**: Multi-role union evaluation across all assigned roles
- **FR-01.3**: Self-grant prevention trigger blocking users from granting approval permissions to themselves
- **FR-01.4**: HR Admin leave requests route to `alternate_hr_approver_id` (preventing self-approval)

### Module 02: Employee Lifecycle
- **FR-02.1**: Direct admin onboarding with temporary password (ADR 0001)
- **FR-02.2**: Mandatory password reset on first login (`invited` → `active`)
- **FR-02.3**: Effective-dated department/designation/manager assignments
- **FR-02.4**: CSV bulk import with row-level validation

### Module 04: Work Calendar
- **FR-04.1**: Multiple calendar templates (5-day, 6-day week)
- **FR-04.2**: Compulsory and optional holiday configuration
- **FR-04.3**: Optional holiday selection with deadline and auto-allocation

### Module 05: Attendance
- **FR-05.1**: Two-layer model (Base Calendar Layer + Attendance Event Layer)
- **FR-05.2**: Automatic work duration calculation from punches
- **FR-05.3**: `Pending Review` status for anomalies (missing punch-out, insufficient work)
- **FR-05.4**: `on_leave` derived from approved leave requests (not editable attendance)

### Module 06: Leave
- **FR-06.1**: CL/SL/EL/Comp-off types with configurable sandwich rules
- **FR-06.2**: Date-range overlap prevention via database trigger
- **FR-06.3**: Parental leave privacy masking (FR §4.7)
- **FR-06.4**: Comp-off grants linked to `extra_work` records with 90-day expiry
- **FR-06.5**: Short permission (2-hour monthly pass with quota tracking)

### Module 07: Salary
- **FR-07.1**: Per-employee versioned salary structures with effective dates (FR §5.1)
- **FR-07.2**: Mid-month salary pro-ration based on exact days under old/new structures
- **FR-07.3**: Manager salary visibility strictly blocked (FR §5.8)

### Module 09: Payroll
- **FR-09.1**: Payable units = `worked_units + paid_leave_units`
- **FR-09.2**: Strict payroll lock: no finalization with unresolved anomalies, pending leaves, or missing statutory profiles (FR §5.7)
- **FR-09.3**: Payroll revisions with historical payslip preservation (FR §5.2)
- **FR-09.4**: Recalculation after attendance/leave corrections

### Module 10: Statutory
- **FR-10.1**: Versioned statutory rules (`statutory_rule_version`) with effective dates
- **FR-10.2**: PF 12% capped at ₹15,000 wage ceiling
- **FR-10.3**: ESI 0.75% employee contribution above ₹21,000 gross threshold
- **FR-10.4**: State-specific Professional Tax slabs
- **FR-10.5**: Income Tax / TDS for Old and New Tax Regimes

### Module 11: Reimbursements
- **FR-11.1**: Category-based claims with policy modes (`block`, `warn_and_allow`, `allow_always`)
- **FR-11.2**: Duplicate claim detection trigger
- **FR-11.3**: Approval routes: `manager_then_hr` or `hr_only` (D11: two-stage unenforced)

### Module 13: Offboarding
- **FR-13.1**: Resignation → Notice period → LWD calculation
- **FR-13.2**: Rescission workflow restoring `Active` status
- **FR-13.3**: F&F settlement with EL encashment, asset recovery, tax deductions
- **FR-13.4**: Stale F&F invalidation when leave/attendance records change
- **FR-13.5**: Separation → `completed` only when LWD reached AND F&F approved

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Security** | Content Security Policy with nonce-based script allowlisting | ✅ Implemented |
| **Security** | Self-grant prevention at database level | ✅ Implemented |
| **Security** | RLS policies on all tables | ✅ Implemented |
| **Performance** | Middleware response time for route gating | < 500ms |
| **Performance** | Page load for server-rendered routes | < 2s |
| **Accessibility** | WCAG AA compliance | Automated via axe-core |
| **Auditability** | All administrative mutations logged | 100% |
| **Data Integrity** | Payroll lock prevents non-compliant finalization | Strict enforcement |
| **Availability** | Application uptime (local deployment) | N/A (dev environment) |
| **Scalability** | Concurrent users | Designed for 100+ simultaneous users |

---

## 7. Business Rules Summary

| Rule ID | Description |
|---|---|
| BR-01 | Sandwich rule: weekends/holidays inside leave period consume quota only when sandwich toggle is enabled for the leave type |
| BR-02 | Comp-off credit: 1 day granted for verified `extra_work` on weekends/holidays; expires after 90 days |
| BR-03 | HR self-approval prevention: HR Admin leave requests route to `alternate_hr_approver_id` or System Admin |
| BR-04 | Overlapping leave prevention: database trigger blocks duplicate date ranges |
| BR-05 | Payroll lock: strict validation blocks finalization when anomalies, pending leaves, or missing statutory profiles exist |
| BR-06 | F&F stale detection: draft settlements automatically invalidated when leave/attendance records change |
| BR-07 | Self-grant prevention: System Admin cannot grant approval permissions to their own account |
| BR-08 | Zero-seed gate: operational transactions blocked until company settings are provisioned (`is_configured = true`) |
| BR-09 | Manager salary isolation: `/salary` route hidden and returns 403 for Manager role |
| BR-10 | Parental leave masking: Maternity/Paternity leave types and reasons masked in manager views |

---

## 8. Key Performance Indicators (KPIs)

### Engineering Quality KPIs

| KPI | Current | Target |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Unit test pass rate | 100% (260/260) | 100% |
| E2E route-gate coverage | 308 cases (14 personas × 22 routes) | 308+ |
| ESLint errors | 0 | 0 |
| Component test coverage | 5 files failing (jsdom env) | 0 failing |

### Business Impact KPIs

| KPI | Target |
|---|---|
| Payroll processing time (500 employees) | < 2 hours |
| Onboarding time (admin-initiated) | < 1 day |
| Attendance anomaly resolution time | < 24 hours |
| F&F settlement completion time | < 5 business days |
| Audit trail coverage | 100% |

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
