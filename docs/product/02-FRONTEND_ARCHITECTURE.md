# HRMS v2.7 — Frontend Architecture Documentation

> **Audience**: Engineering, Design, Frontend Team  
> **Framework**: Next.js 16.3 (App Router, Server Actions, React Server Components)  
> **Last Updated**: August 19, 2026

---

## 1. Architecture Overview

HRMS v2.7 follows a **server-first architecture** using Next.js App Router with React Server Components (RSC) as the default rendering strategy. Client-side interactivity is isolated to discrete "client islands" — small, focused components that require user interaction.

### Design Principles

1. **Server Components by Default**: Every page component is a Server Component unless explicitly marked with `"use client"`
2. **Client Islands Pattern**: Only genuinely interactive components (forms, drawers, modals, real-time widgets) are client components
3. **Server Actions for Mutations**: All data mutations use Next.js Server Actions with `assertPermission()` gating
4. **Permission-Gated Rendering**: Components conditionally render based on role permissions from the server context
5. **Semantic Design Tokens**: All colors, spacing, and typography use the design token system (not raw Tailwind colors)

---

## 2. Directory Structure

```
src/
├── app/                          # Next.js App Router routes
│   ├── layout.tsx                # Root layout (Server Component)
│   ├── page.tsx                  # Dashboard (Server Component)
│   ├── globals.css               # Design tokens & global styles
│   ├── loading.tsx               # Root loading skeleton
│   ├── error.tsx                 # Global error boundary
│   ├── not-found.tsx             # 404 page
│   ├── login/page.tsx            # Login page
│   ├── 403/page.tsx              # Forbidden page
│   ├── attendance/page.tsx       # Attendance module
│   ├── leave/page.tsx            # Leave module
│   ├── employees/page.tsx        # Employee directory
│   ├── payroll/page.tsx          # Payroll operations
│   ├── ... (22 route pages)
│   └── api/health/               # Health check endpoint
│
├── components/                   # UI components
│   ├── shared/                   # Reusable UI primitives
│   │   ├── DataTable.tsx         # Generic sortable/filterable table
│   │   ├── Modal.tsx             # Dialog with focus trap
│   │   ├── Drawer.tsx            # Slide-out panel
│   │   ├── Stepper.tsx           # Multi-step wizard
│   │   ├── StatusBadge.tsx       # Color-coded status indicators
│   │   ├── Toast.tsx             # Notification toasts
│   │   ├── ConfirmDialog.tsx     # Confirmation dialogs
│   │   ├── EmptyState.tsx        # Empty state placeholders
│   │   ├── ErrorBanner.tsx       # Error display
│   │   ├── PageHeader.tsx        # Page title + description
│   │   ├── PageLoading.tsx       # Loading spinner
│   │   ├── ReadOnlyBanner.tsx    # Amber read-only indicator
│   │   ├── Skeleton.tsx          # Loading skeleton
│   │   ├── GlobalSearchPalette.tsx # Ctrl+K command palette
│   │   ├── NotificationsBell.tsx # Notification bell icon
│   │   └── WebVitals.tsx         # Performance monitoring
│   │
│   ├── layout/                   # App shell components
│   │   ├── AppShell.tsx          # Root layout wrapper (client)
│   │   ├── Header.tsx            # Top navigation bar (client)
│   │   ├── Sidebar.tsx           # Side navigation (client)
│   │   └── Breadcrumbs.tsx       # Breadcrumb trail (server-compatible)
│   │
│   ├── auth/                     # Authentication components
│   │   └── ForcePasswordResetModal.tsx  # First-login password reset
│   │
│   ├── dashboard/                # Dashboard-specific widgets
│   │   ├── PunchCard.tsx         # Quick attendance punch (client)
│   │   └── RoleGreeting.tsx      # Role-aware greeting (client)
│   │
│   ├── attendance/               # Attendance module components
│   │   ├── AttendancePunchBar.tsx  # Full punch bar (client)
│   │   └── AttendanceWorkspace.tsx # Attendance workspace (client)
│   │
│   ├── leave/                    # Leave module components
│   │   └── LeaveWorkspace.tsx    # Leave workspace (client)
│   │
│   ├── employees/                # Employee module components
│   │   └── EmployeeDirectory.tsx # Employee directory (client)
│   │
│   ├── payroll/                  # Payroll module components
│   │   └── PayrollWorkspace.tsx  # Payroll workspace (client)
│   │
│   └── prototype/                # Prototype/switcher components
│       └── PrototypeSwitcher.tsx # Dev prototype switcher
│
└── lib/                          # Business logic & utilities
    ├── auth/                     # Authentication & authorization
    │   ├── assertPermission.ts   # Server Action permission gate
    │   ├── current-user.ts       # Current user resolution
    │   ├── permissions-map.ts    # Role → Permission mapping (single source)
    │   ├── rate-limit.ts         # Rate limiting
    │   ├── session.ts            # Session management
    │   └── usePermission.ts      # Client-side permission hook
    │
    ├── actions/                  # Server Actions (22 files)
    │   ├── approvals.ts          # Unified approval actions
    │   ├── attendance.ts         # Attendance punch/correct
    │   ├── auth.ts               # Login/logout/password reset
    │   ├── leave.ts              # Leave apply/cancel
    │   ├── payroll.ts            # Payroll run/finalize
    │   └── ... (17 more)
    │
    ├── services/                 # Business logic engines
    │   ├── leave-engine.ts       # Leave calculation engine
    │   ├── leave-routing.ts      # Leave approval routing
    │   ├── payroll-engine.ts     # Payroll calculation engine
    │   ├── compensation-engine.ts # Salary pro-ration engine
    │   ├── statutory-engine.ts   # Statutory deduction engine
    │   ├── offboarding-engine.ts # F&F settlement engine
    │   ├── reports-engine.ts     # Report generation engine
    │   ├── notifications.ts      # Notification service
    │   ├── mock-rbac.ts          # Mock RBAC for testing
    │   └── ... (6 more)
    │
    ├── nav/                      # Navigation configuration
    │   └── routeConfig.ts        # Route gate definitions
    │
    ├── hooks/                    # Custom React hooks
    │   ├── useFocusTrap.ts       # Modal focus trap
    │   └── useServerTable.ts     # Server-side table sorting/pagination
    │
    ├── types/                    # TypeScript type definitions
    │   └── index.ts              # Core domain types
    │
    ├── utils/                    # Utility functions
    │   └── formatters.ts         # Date/currency formatters
    │
    ├── roleContext.tsx            # Role context provider (client)
    └── security.ts               # Security & input sanitization utilities
```

---

## 3. Rendering Strategy

### Server Component Pattern (Default)

Most pages follow this pattern:

```tsx
// src/app/employees/page.tsx — Server Component
export default async function EmployeesPage() {
  // Server-side data fetch
  const userInfo = await getCurrentUserRoles();
  const employees = await getEmployees(userInfo);
  
  // Permission check
  const canCreate = hasPermission(userInfo.permissions, 'employee.create');
  
  return (
    <div>
      <PageHeader title="Employee Directory" />
      {canCreate && <Link href="/onboarding">+ Onboard</Link>}
      <EmployeeDirectory employees={employees} />  {/* Client island */}
    </div>
  );
}
```

### Client Island Pattern

Client components are marked with `"use client"` and receive server-resolved data as props:

```tsx
// src/components/employees/EmployeeDirectory.tsx — Client Component
"use client";

export function EmployeeDirectory({ employees }: { employees: Employee[] }) {
  // Client-side interactivity: sorting, filtering, drawers
  return <DataTable data={employees} columns={...} />;
}
```

### Loading States

- Root: `src/app/loading.tsx` (global loading indicator)
- Per-module: Individual `loading.tsx` files (planned, not yet implemented)

### Error Boundaries

- Global: `src/app/error.tsx` (catches all unhandled errors)
- Module-level: Not yet implemented (planned per FULL_APP_REVIEW.md J5)

---

## 4. Client-Side Architecture

### Role Context Provider

The `RoleProvider` wraps the entire application and provides:

```tsx
interface RoleContextType {
  activeRole: RoleCode;          // Current focus role
  assignedRoles: RoleCode[];     // All assigned roles
  permissions: string[];         // Cumulative union of all permissions
  activeRolePermissions: string[]; // Permissions for active role only
  mustChangePassword: boolean;   // Force password reset flag
  userName: string;              // Display name
  pendingApprovalsCount: number; // Badge count for approval inbox
  setActiveRole: (role: RoleCode) => void;
  hasPermission: (code: string) => boolean;
  hasActiveRolePermission: (code: string) => boolean;
}
```

**Key behaviors**:
- Active role persisted in `localStorage` (`hrms_last_active_role`)
- Cumulative union computed via `permissionsForRoles()` from shared `permissions-map.ts`
- Pending approvals count loaded once in shell mount (WS-A A6 de-dup)
- Role switcher filters sidebar navigation without restricting backend permissions

### Permission Checking

```tsx
// Server-side (RSC)
const permissions = permissionsForRoles(userInfo.roles);
const can = (code: string) => hasPermission(permissions, code);

// Client-side
const { hasPermission } = useRole();
if (hasPermission('employee.create')) { /* ... */ }
```

**Scope fallback logic**:
- Exact code match → grant
- `.all` scope match → grant
- `.team` scope match → grant
- `.self` scope match → grant
- Otherwise → deny

---

## 5. Data Flow

### Server Actions (Mutations)

All data mutations go through Server Actions gated by `assertPermission()`:

```tsx
// src/lib/actions/leave.ts
"use server";

export async function applyLeave(data: LeaveApplicationInput) {
  // 1. Permission gate
  await assertPermission('leave.apply.self');
  
  // 2. Business logic
  const result = await leaveEngine.processApplication(data);
  
  // 3. Notification
  await notifyManager(result);
  
  return result;
}
```

### Server-Side Data Fetching

Pages fetch data directly in the Server Component:

```tsx
export default async function PayrollPage() {
  const userInfo = await getCurrentUserRoles();
  const periods = await getPayrollPeriods(userInfo);
  return <PayrollWorkspace periods={periods} />;
}
```

### Client-Side State

Client components use:
- `useState` for local UI state (modals, drawers, filters)
- `useCallback` for event handlers
- `useMemo` for derived computations
- `localStorage` for role persistence
- No global client state library (no Redux, Zustand, etc.)

---

## 6. Navigation & Routing

### Route Configuration

All routes are defined in `src/lib/nav/routeConfig.ts`:

```typescript
interface RouteGate {
  path: string;
  name: string;
  category: "MY WORK" | "PEOPLE" | "PAY" | "ADMIN";
  parent?: string;  // For breadcrumb hierarchy
  requiredPermissions: string[];  // ANY of these grants access
  public?: boolean;
}
```

### Middleware Route Guarding

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // 1. Generate CSP nonce
  // 2. Resolve route gate
  // 3. Allow public routes (/login, /403)
  // 4. Mock-mode RBAC check
  // 5. Real Supabase RBAC check (batch permission RPC)
  // 6. System Admin bypass
  // 7. Redirect to /403 if unauthorized
}
```

### Sidebar Navigation

The `Sidebar` component:
- Reads `ROUTE_CONFIG` to build navigation items
- Filters by `category` (MY WORK, PEOPLE, PAY, ADMIN)
- Applies permission-based visibility using `useRole().hasPermission()`
- Respects `activeRole` for workspace focus filtering
- Mobile: drawer with slide animation (planned improvement)

### Breadcrumbs

Generated from `getBreadcrumbs(pathname)` using the `parent` chain in route config.

---

## 7. Component Library

### Shared Components (15)

| Component | Type | Purpose |
|---|---|---|
| `DataTable` | Client | Generic sortable, filterable, paginated table |
| `Modal` | Client | Dialog with focus trap and backdrop |
| `Drawer` | Client | Slide-out panel for detail views |
| `Stepper` | Client | Multi-step wizard (onboarding, offboarding, payroll) |
| `StatusBadge` | Server-compatible | Color-coded status indicators |
| `Toast` | Client | Non-blocking notification messages |
| `ConfirmDialog` | Client | Destructive action confirmation |
| `EmptyState` | Server-compatible | Placeholder when no data exists |
| `ErrorBanner` | Server-compatible | Error display with retry action |
| `PageHeader` | Server-compatible | Page title, description, and actions |
| `PageLoading` | Server-compatible | Centered loading spinner |
| `ReadOnlyBanner` | Server-compatible | Amber banner for read-only views |
| `Skeleton` | Server-compatible | Loading skeleton placeholders |
| `GlobalSearchPalette` | Client | Ctrl+K command palette |
| `NotificationsBell` | Client | Notification bell with unread count |

### Design Token Usage

All components use semantic tokens from `globals.css`:

```css
/* Design tokens defined in globals.css */
--color-surface: white;
--color-ink: #111827;
--color-line: #e5e7eb;
--color-primary-600: #2563eb;
```

```tsx
// ✅ Correct — semantic tokens
<div className="bg-surface text-ink border border-line">

// ❌ Incorrect — raw Tailwind colors
<div className="bg-white text-gray-900 border-gray-200">
```

---

## 8. State Management

### Client-Side State

| State | Location | Persistence |
|---|---|---|
| Active role | `localStorage` (`hrms_last_active_role`) | Survives page refresh |
| Assigned roles | `RoleContext` state | Loaded from server on mount |
| Permissions | `useMemo` from roles | Computed on role change |
| Pending approvals count | `RoleContext` state | Loaded once in shell |
| UI state (modals, drawers) | Component `useState` | Ephemeral |
| Form state | Component `useState` | Ephemeral |

### Server-Side State

| State | Location | Lifetime |
|---|---|---|
| Employee data | Server Components | Per-request |
| Permission checks | `assertPermission()` | Per-action |
| Route gating | Middleware | Per-request |

### No Global Client State Library

The application deliberately avoids Redux, Zustand, or similar. State is managed through:
- React Context (`RoleProvider`)
- Component-local `useState`
- Server Components for data fetching
- Server Actions for mutations

---

## 9. Build & Compilation

### TypeScript

```bash
npx tsc --noEmit  # Zero errors
```

### ESLint

```bash
npx eslint src    # Zero errors
```

### Build

```bash
npm run build     # Production build with type-checking
```

### Key Configuration

| File | Purpose |
|---|---|
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.ts` | Tailwind CSS with custom design tokens |
| `postcss.config.js` | PostCSS with Tailwind and Autoprefixer |
| `eslint.config.mjs` | ESLint with Next.js config |
| `next.config.mjs` | Next.js configuration (headers, CSP) |
| `vitest.config.ts` | Vitest test configuration |
| `playwright.config.ts` | Playwright E2E configuration |

---

## 10. Performance Considerations

### Server-Side Rendering Benefits

- **Reduced client JS**: Server Components send zero JS to the client
- **Faster initial load**: Data resolved on the server before HTML sent
- **SEO-friendly**: Full HTML rendered server-side (relevant for reports)

### Client-Side Optimization

- **Code splitting**: Automatic with App Router route-based splitting
- **Lazy loading**: Dynamic imports for heavy components
- **Web Vitals**: `WebVitals.tsx` component tracks LCP, FID, CLS

### Known Performance Gaps

| Gap | Impact | Status |
|---|---|---|
| Approvals page still `"use client"` | Full client-side waterfall | Planned conversion to RSC (J1) |
| No skeleton loading states | Layout shift on page load | Planned (V6) |
| N+1 middleware queries | Per-request DB overhead | Optimized to batch RPC (F2 resolved) |

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
