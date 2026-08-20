# HRMS v2.7 — Design System & UI Guidelines

> **Audience**: Design, Engineering, Frontend  
> **Stack**: Tailwind CSS 3.4, Lucide React Icons  
> **Last Updated**: August 19, 2026

---

## 1. Design Philosophy

HRMS v2.7 follows a **semantic design token** system where all visual properties reference named tokens rather than raw color values. This ensures consistency across the application and makes theme changes systematic.

### Core Principles

1. **Token-First**: All colors, spacing, and typography use semantic tokens
2. **Accessibility**: WCAG AA compliance (axe-core automated testing)
3. **Responsive**: Mobile-first design with sidebar drawer
4. **Consistency**: Shared component library for repeated patterns
5. **Role-Aware**: UI adapts based on user role and permissions

---

## 2. Design Tokens

### 2.1 Color System

#### Semantic Tokens (from `globals.css`)

```css
/* Surface Colors */
--color-surface: white;           /* Card backgrounds */
--color-surface-muted: #f9fafb;   /* Muted backgrounds */

/* Text Colors */
--color-ink: #111827;             /* Primary text */
--color-ink-secondary: #6b7280;   /* Secondary text */
--color-ink-muted: #9ca3af;       /* Muted text */

/* Border Colors */
--color-line: #e5e7eb;            /* Standard borders */
--color-line-strong: #d1d5db;     /* Emphasis borders */

/* Primary (Blue) */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-300: #93c5fd;
--color-primary-500: #3b82f6;
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;

/* Success (Emerald) */
--color-success-50: #ecfdf5;
--color-success-500: #10b981;
--color-success-600: #059669;
--color-success-700: #047857;

/* Warning (Amber) */
--color-warning-50: #fffbeb;
--color-warning-500: #f59e0b;
--color-warning-600: #d97706;
--color-warning-700: #b45309;

/* Danger (Red) */
--color-danger-50: #fef2f2;
--color-danger-500: #ef4444;
--color-danger-600: #dc2626;
--color-danger-700: #b91c1c;

/* Info (Blue) */
--color-info-50: #eff6ff;
--color-info-500: #3b82f6;
--color-info-600: #2563eb;
```

#### Usage Examples

```tsx
// ✅ Correct — semantic tokens
<div className="bg-surface text-ink border border-line">
<div className="bg-primary-600 text-white hover:bg-primary-700">
<div className="text-ink-secondary text-xs">

// ❌ Incorrect — raw Tailwind colors
<div className="bg-white text-gray-900 border-gray-200">
<div className="bg-blue-600 hover:bg-blue-700">
```

### 2.2 Typography

```css
/* Font Sizes */
text-xs    → 0.75rem (12px) — Labels, captions
text-sm    → 0.875rem (14px) — Body text, descriptions
text-base  → 1rem (16px) — Default body
text-lg    → 1.125rem (18px) — Section headings
text-xl    → 1.25rem (20px) — Page titles
text-2xl   → 1.5rem (24px) — Dashboard metrics
text-3xl   → 1.875rem (30px) — Hero metrics

/* Font Weights */
font-normal    → 400
font-medium    → 500
font-semibold  → 600
font-bold      → 700
font-extrabold → 800 — Dashboard metrics
```

### 2.3 Spacing

```css
/* Standard Spacing Scale */
p-1  → 0.25rem (4px)
p-2  → 0.5rem (8px)
p-3  → 0.75rem (12px)
p-4  → 1rem (16px)
p-5  → 1.25rem (20px)
p-6  → 1.5rem (24px)
p-8  → 2rem (32px)
```

### 2.4 Border Radius

```css
rounded-sm   → 0.125rem (2px)
rounded      → 0.25rem (4px)
rounded-lg   → 0.5rem (8px)
rounded-xl   → 0.75rem (12px) — Cards
rounded-2xl  → 1rem (16px)
rounded-full → 9999px — Badges, avatars
```

### 2.5 Shadows

```css
shadow-card  → Card elevation
shadow-sm    → Subtle elevation
shadow-md    → Medium elevation
shadow-lg    → High elevation
```

### 2.6 Z-Index Scale (Planned)

```
z-base:     0     — Default content
z-dropdown: 10    — Dropdowns, tooltips
z-sticky:   20    — Sticky headers
z-modal:    50    — Modals, drawers
z-overlay:  55    — Modal backdrops
z-toast:    60    — Toast notifications
z-search:   70    — Global search palette
```

---

## 3. Component Library

### 3.1 Shared Components (17)

#### DataTable
- **Type**: Client component
- **Purpose**: Generic sortable, filterable, paginated table
- **Features**:
  - Column sorting (asc/desc)
  - Search/filter
  - Pagination with page size selector
  - Row click handlers
  - Empty state display
- **Props**: `data`, `columns`, `onRowClick`, `emptyMessage`

#### Modal
- **Type**: Client component
- **Purpose**: Dialog with focus trap and backdrop
- **Features**:
  - Focus trap (keyboard navigation)
  - Backdrop click to close
  - ESC key to close
  - Size variants (sm, md, lg)
- **Props**: `isOpen`, `onClose`, `title`, `children`, `size`

#### Drawer
- **Type**: Client component
- **Purpose**: Slide-out panel for detail views
- **Features**:
  - Right-side slide animation
  - Backdrop overlay
  - Close on ESC or backdrop click
  - Scroll lock on body
- **Props**: `isOpen`, `onClose`, `title`, `children`

#### Stepper
- **Type**: Client component
- **Purpose**: Multi-step wizard
- **Features**:
  - Step indicators (completed, active, upcoming)
  - Back/Next navigation
  - Step validation
  - Progress tracking
- **Props**: `steps`, `currentStep`, `onStepChange`

#### StatusBadge
- **Type**: Server-compatible
- **Purpose**: Color-coded status indicators
- **Variants**:
  - `active` → Green
  - `pending` → Amber
  - `rejected` → Red
  - `approved` → Emerald
  - `draft` → Gray
  - `invited` → Blue
  - `suspended` → Red
  - `notice_period` → Amber
  - `offboarded` → Gray
  - `completed` → Green
- **Props**: `status`, `label`

#### Toast
- **Type**: Client component
- **Purpose**: Non-blocking notification messages
- **Variants**: `success`, `error`, `warning`, `info`
- **Features**:
  - Auto-dismiss (configurable duration)
  - Manual dismiss
  - Action buttons
- **Props**: `message`, `type`, `duration`, `action`

#### ConfirmDialog
- **Type**: Client component
- **Purpose**: Destructive action confirmation
- **Features**:
  - Title + description
  - Confirm/Cancel buttons
  - Keyboard navigation
- **Props**: `isOpen`, `onConfirm`, `onCancel`, `title`, `message`

#### EmptyState
- **Type**: Server-compatible
- **Purpose**: Placeholder when no data exists
- **Props**: `icon`, `title`, `description`, `action`

#### ErrorBanner
- **Type**: Server-compatible
- **Purpose**: Error display with retry action
- **Props**: `message`, `onRetry`

#### PageHeader
- **Type**: Server-compatible
- **Purpose**: Page title, description, and action buttons
- **Props**: `title`, `description`, `actions`

#### PageLoading
- **Type**: Server-compatible
- **Purpose**: Centered loading spinner
- **Props**: `message`

#### ReadOnlyBanner
- **Type**: Server-compatible
- **Purpose**: Amber banner for read-only views (Payroll Admin)
- **Props**: `message`

#### Skeleton
- **Type**: Server-compatible
- **Purpose**: Loading skeleton placeholders
- **Variants**: `text`, `circle`, `rect`, `card`
- **Props**: `variant`, `width`, `height`, `lines`

#### GlobalSearchPalette
- **Type**: Client component
- **Purpose**: Ctrl+K command palette
- **Features**:
  - Keyboard shortcut (Ctrl+K / Cmd+K)
  - Search across employees, departments, payroll
  - Result categories
  - Keyboard navigation
- **Props**: `isOpen`, `onClose`, `onSelect`

#### NotificationsBell
- **Type**: Client component
- **Purpose**: Notification bell with unread count
- **Features**:
  - Unread count badge
  - Dropdown notification list
  - Mark as read
  - Link to relevant module
- **Props**: `notifications`, `onMarkRead`

#### WebVitals
- **Type**: Client component
- **Purpose**: Performance monitoring (LCP, FID, CLS)
- **Props**: None (automatic)

---

## 4. Layout Components

### AppShell
- **Type**: Client component
- **Purpose**: Root layout wrapper
- **Structure**:
  ```
  AppShell
  ├── Header (top bar)
  │   ├── Logo
  │   ├── GlobalSearchPalette
  │   ├── NotificationsBell
  │   ├── RoleViewSwitcher
  │   └── UserAvatar
  ├── Sidebar (left navigation)
  │   ├── NavigationItems (filtered by role)
  │   └── CollapseToggle
  └── MainContent (children)
  ```

### Header
- **Type**: Client component
- **Features**:
  - Sticky positioning
  - Role View Switcher (multi-role users)
  - Global search trigger
  - Notification bell
  - User avatar dropdown
  - Mobile hamburger menu

### Sidebar
- **Type**: Client component
- **Features**:
  - Collapsible (desktop)
  - Drawer (mobile)
  - Permission-filtered navigation
  - Active route highlighting
  - Category grouping (MY WORK, PEOPLE, PAY, ADMIN)

### Breadcrumbs
- **Type**: Server-compatible
- **Features**:
  - Auto-generated from route config
  - Parent chain navigation
  - Current page indicator

---

## 5. Domain Components

### PunchCard (Dashboard)
- **Type**: Client component
- **Purpose**: Quick attendance punch from dashboard
- **Features**:
  - Check In / Check Out buttons
  - Work duration timer
  - Current status display
  - Today's date

### AttendancePunchBar
- **Type**: Client component
- **Purpose**: Full attendance punch interface
- **Features**:
  - Check In / Check Out buttons
  - Work duration timer
  - Refresh button
  - Current status display

### RoleGreeting
- **Type**: Client component
- **Purpose**: Role-aware greeting heading
- **Features**:
  - Dynamic greeting based on active role
  - User name display
  - Role-specific message

### ForcePasswordResetModal
- **Type**: Client component
- **Purpose**: First-login password reset (blocking)
- **Features**:
  - Cannot be dismissed
  - Password validation
  - Confirmation required

### ApprovalsWorkspace
- **Type**: Client component
- **Purpose**: Unified approval inbox
- **Features**:
  - Module filter tabs
  - Row-level action buttons
  - Permission-gated approve/reject
  - Drawer for detail view

---

## 6. UI Patterns

### Card Pattern

```tsx
<div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
  <div className="flex justify-between items-center text-ink-secondary">
    <span className="text-xs font-bold uppercase tracking-wider">Title</span>
    <Icon className="w-4 h-4 text-primary-600" />
  </div>
  <div>
    <p className="text-2xl font-extrabold text-ink tabular-nums">Value</p>
    <p className="text-[11px] text-ink-secondary font-medium">Description</p>
  </div>
  <Link href="..." className="block text-center py-1.5 px-3 bg-primary-50 hover:bg-primary-100 text-primary-900 text-xs font-bold rounded-lg border border-primary-200 transition">
    Action →
  </Link>
</div>
```

### Button Patterns

```tsx
// Primary action
<button className="px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition shadow-card">

// Secondary action
<button className="px-3.5 py-2 bg-surface-muted hover:bg-primary-50 border border-line rounded-lg font-semibold text-ink-secondary transition">

// Danger action
<button className="px-4 py-2 bg-danger-600 text-white text-xs font-semibold rounded-lg hover:bg-danger-700 transition">

// Ghost action
<button className="px-3 py-1.5 text-ink-secondary hover:text-ink text-xs font-medium transition">
```

### Form Patterns

```tsx
// Input
<input className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />

// Select
<select className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-300">

// Label
<label className="block text-xs font-semibold text-ink-secondary mb-1">Label</label>

// Error
<p className="text-xs text-danger-600 mt-1">Error message</p>
```

---

## 7. Accessibility Guidelines

### WCAG AA Compliance

| Criterion | Implementation |
|---|---|
| **Color Contrast** | 4.5:1 minimum for text, 3:1 for large text |
| **Focus Indicators** | `focus-visible:ring-2 focus-visible:ring-primary-300` |
| **Keyboard Navigation** | All interactive elements keyboard-accessible |
| **Screen Readers** | `aria-label`, `aria-hidden`, `aria-pressed` attributes |
| **Semantic HTML** | Proper heading hierarchy, landmark regions |

### axe-core Integration

```bash
# Automated accessibility testing
npm run test:e2e:nfr
```

Tests run on every E2E spec, checking:
- Color contrast ratios
- Form label associations
- Image alt text
- ARIA attribute correctness
- Keyboard navigation patterns

---

## 8. Responsive Design

### Breakpoints

```css
sm  → 640px   /* Mobile landscape */
md  → 768px   /* Tablet */
lg  → 1024px  /* Desktop */
xl  → 1280px  /* Large desktop */
2xl → 1536px  /* Extra large */
```

### Layout Behavior

| Breakpoint | Sidebar | Header | Content |
|---|---|---|---|
| < 768px | Drawer (hamburger) | Compact | Full width |
| ≥ 768px | Collapsible | Full | With sidebar |
| ≥ 1024px | Expanded | Full | With sidebar |

### Mobile Sidebar

- Triggered by hamburger icon in header
- Slides in from left
- Overlay backdrop
- Close on backdrop click or ESC
- **Known Gap (V9)**: No slide animation (conditional render instead of CSS transform)

---

## 9. Icon System

### Library: Lucide React

```tsx
import { Clock, Users, CheckCircle2, AlertTriangle } from "lucide-react";

// Usage
<Clock className="w-4 h-4 text-ink-secondary" />
<Users className="w-5 h-5 text-primary-600" />
<CheckCircle2 className="w-4 h-4 text-amber-600" />
```

### Icon Sizes

```
w-3 h-3   → 12px — Inline badges
w-4 h-4   → 16px — Standard icons
w-5 h-5   → 20px — Emphasis icons
w-6 h-6   → 24px — Large icons
```

---

## 10. Known Design Gaps

| Gap ID | Description | Priority | Status |
|---|---|---|---|
| V1 | AppShell/Header uses raw gray colors | P0 | Planned |
| V2 | Login page uses hardcoded blue | P1 | Planned |
| V3 | Duplicate PunchCard implementations | P0 | Planned |
| V4 | Error/403 pages use legacy colors | P1 | Planned |
| V5 | Global search z-index mismatch | P1 | Planned |
| V6 | No skeleton loading states | P1 | Planned |
| V7 | Approvals page uses raw colors | P1 | Planned |
| V8 | Missing favicon/app icons | P2 | Planned |
| V9 | Mobile sidebar has no slide animation | P2 | Planned |

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
