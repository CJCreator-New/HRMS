# HRMS v2.7 — Phase-by-Phase Remediation Plan

> **Source**: HRMS v2.7 Codebase Audit (August 22, 2026)  
> **Methodology**: Each phase groups related fixes by risk level. Every change includes exact file locations, the specific code to change, and a validation method.  
> **Principle**: Fix the smallest, safest thing first. Verify it works before moving on.

---

## Phase 1 — Critical SQL & Permission Bugs (1–2 hours)

> **Goal**: Fix bugs that cause runtime failures or break authorization.  
> **Risk**: LOW — These are isolated, surgical fixes.  
> **Blocks**: Everything below depends on these working correctly.

### 1.1 Fix `calculate_leave_days` undeclared variable

**File**: `schema/06_leave.sql`  
**Lines**: ~95–110 (the `calculate_leave_days` function)  
**Problem**: Variable `v_is_single_day` is referenced but never declared. PostgreSQL will raise `ERROR: column "v_is_single_day" does not exist` at runtime.

**Change**:
```sql
-- BEFORE (broken):
declare
  v_sandwich boolean;
  v_curr date := p_start_date;
  v_days numeric := 0;
  -- Guard against invalid or excessively large date ranges (> 365 days)
  if p_end_date < p_start_date then
    raise exception 'End date cannot precede start date in calculate_leave_days';
  end if;
  if p_end_date - p_start_date > 365 then
    raise exception 'Leave duration cannot exceed 365 days in calculate_leave_days';
  end if;

  select is_sandwich_enabled into v_sandwich from leave_types where id = p_leave_type_id;

  -- Single-day half-day leave: return 0.5 directly
  if v_is_single_day and p_duration_type in ('first_half', 'second_half') then
    return 0.5;
  end if;

-- AFTER (fixed):
declare
  v_sandwich boolean;
  v_curr date := p_start_date;
  v_days numeric := 0;
  v_is_single_day boolean := (p_start_date = p_end_date);
begin
  -- Guard against invalid or excessively large date ranges (> 365 days)
  if p_end_date < p_start_date then
    raise exception 'End date cannot precede start date in calculate_leave_days';
  end if;
  if p_end_date - p_start_date > 365 then
    raise exception 'Leave duration cannot exceed 365 days in calculate_leave_days';
  end if;

  select is_sandwich_enabled into v_sandwich from leave_types where id = p_leave_type_id;

  -- Single-day half-day leave: return 0.5 directly
  if v_is_single_day and p_duration_type in ('first_half', 'second_half') then
    return 0.5;
  end if;
```

**Also fix**: The function body has `if/end if` blocks outside the `begin` block. The entire function body must be wrapped in `begin ... end;`.

**Validation**:
```bash
npm run db:sync
# Then run unit test that calls calculate_leave_days with a half-day request
npm run test:unit -- --grep "leave"
```
Test case: Apply half-day leave for a single date — should return 0.5 without error.

---

### 1.2 Fix payroll permission codes

**File**: `src/lib/actions/payroll.ts`  
**Problem**: `finalizePayrollPeriodAction` and `reopenPayrollPeriodAction` both use `payroll.run` instead of their documented permissions.

**Change 1** — `finalizePayrollPeriodAction` (line ~76):
```typescript
// BEFORE:
const permError = await assertPermission("payroll.run");

// AFTER:
const permError = await assertPermission("payroll.finalize");
```

**Change 2** — `reopenPayrollPeriodAction` (line ~35):
```typescript
// BEFORE:
const permError = await assertPermission("payroll.run");

// AFTER:
const permError = await assertPermission("payroll.reopen");
```

**Validation**:
```bash
npm run test:unit -- --grep "payroll"
npm run verify:permissions
```
Test case: User with only `payroll.run` (no `payroll.finalize`) should be rejected from finalizing. User with `payroll.finalize` but not `payroll.run` should be able to finalize but not run payroll.

---

### 1.3 Add `offboarded → completed` to employee transition matrix

**File**: `schema/02_org.sql`  
**Lines**: ~28–35 (the `is_valid_employee_transition` function)  
**Problem**: Documentation describes `offboarded → completed` as valid, but the function doesn't include it.

**Change**:
```sql
-- BEFORE:
create or replace function is_valid_employee_transition(p_from employee_status, p_to employee_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('invited','active'), ('invited','withdrawn'),
    ('active','suspended'), ('suspended','active'),
    ('suspended','offboarded'),
    ('active','notice_period'), ('notice_period','active'), ('notice_period','offboarded'),
    ('active','offboarded')
  )
$$;

-- AFTER:
create or replace function is_valid_employee_transition(p_from employee_status, p_to employee_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('invited','active'), ('invited','withdrawn'),
    ('active','suspended'), ('suspended','active'),
    ('suspended','offboarded'),
    ('active','notice_period'), ('notice_period','active'), ('notice_period','offboarded'),
    ('active','offboarded'),
    ('offboarded','completed')
  )
$$;
```

**Validation**:
```bash
npm run db:sync
# Test: Update an offboarded employee's status to completed — should succeed
# Test: Update an active employee's status to completed — should fail with trigger exception
```

---

### 1.4 Fix `withdrawLeaveRequestAction` permission scope

**File**: `src/lib/actions/leave.ts`  
**Lines**: ~135 (the `withdrawLeaveRequestAction` function)  
**Problem**: Uses `leave.cancel.self OR leave.apply.self` — the `leave.apply.self` permission should not allow withdrawal of pending requests. Only `leave.cancel.self` should apply.

**Change**:
```typescript
// BEFORE:
const permError = await assertAnyPermission(["leave.cancel.self", "leave.apply.self"]);

// AFTER:
const permError = await assertPermission("leave.cancel.self");
```

**Validation**:
```bash
npm run test:unit -- --grep "leave"
```
Test case: Employee with `leave.apply.self` but not `leave.cancel.self` should NOT be able to withdraw.

---

## Phase 2 — Transaction Safety & Atomicity (4–8 hours)

> **Goal**: Prevent partial state from multi-step operations.  
> **Risk**: MEDIUM — Changes affect core business flows.  
> **Depends on**: Phase 1 complete.

### 2.1 Create a leave approval stored procedure

**File**: `schema/06_leave.sql` (add new function)  
**Problem**: `approveLeaveAction` does 4 sequential Supabase calls (update request → update approvals → insert ledger → send notification) without a transaction. If step 3 fails, the leave is marked approved but the ledger is inconsistent.

**New function to add**:
```sql
-- Add after the existing process_leave_request_state_change trigger
create or replace function approve_leave_atomically(
  p_request_id uuid,
  p_approver_id uuid,
  p_remarks text default null
) returns jsonb language plpgsql as $$
declare
  v_request record;
  v_alloc_id uuid;
  v_year integer;
begin
  -- 1. Lock and fetch the request
  select * into v_request from leave_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_request is null then
    return jsonb_build_object('error', 'Leave request not found or already processed');
  end if;

  -- 2. Self-approval check
  if v_request.employee_id = p_approver_id then
    return jsonb_build_object('error', 'Self-approval of leave requests is not permitted');
  end if;

  -- 3. Update status (triggers handle ledger)
  update leave_requests
  set status = 'approved', updated_at = now()
  where id = p_request_id;

  -- 4. Update approval record
  update leave_request_approvals
  set status = 'approved', remarks = p_remarks, decided_at = now()
  where leave_request_id = p_request_id and approver_id = p_approver_id;

  -- 5. Notification (non-blocking)
  perform create_notification(
    v_request.employee_id,
    'Leave Approved',
    'Your leave request has been approved.',
    '/leave'
  );

  return jsonb_build_object('success', true, 'request_id', p_request_id);
end;
$$;
```

**Update Server Action** (`src/lib/actions/leave.ts`):
```typescript
export async function approveLeaveAction(requestId: string, approverId: string, remarks?: string) {
  // ... permission checks remain the same ...
  
  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();
  const effectiveApproverId = caller?.employeeId || approverId;

  const { data, error } = await supabase.rpc('approve_leave_atomically', {
    p_request_id: requestId,
    p_approver_id: effectiveApproverId,
    p_remarks: remarks || null,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true };
}
```

**Validation**:
```bash
npm run db:sync
npm run test:unit -- --grep "leave"
```
Test cases:
1. Normal approval succeeds → ledger updated, notification sent
2. Self-approval attempt → rejected
3. Concurrent approval of same request → only one succeeds (FOR UPDATE prevents race)

---

### 2.2 Wrap payroll bulk run in a database procedure

**File**: `schema/09_payroll.sql` (add new function)  
**Problem**: `executeBulkPayrollRunAction` uses `Promise.all` on individual upserts — no atomicity guarantee.

**New function** (simplified — full implementation should match existing action logic):
```sql
create or replace function execute_payroll_run(p_period_id uuid)
returns jsonb language plpgsql as $$
declare
  v_period record;
  v_revision_id uuid;
  v_emp_count integer := 0;
  v_total_gross numeric := 0;
  v_total_deductions numeric := 0;
  v_total_net numeric := 0;
begin
  -- 1. Lock and validate
  perform validate_payroll_lock(p_period_id);

  select * into v_period from payroll_periods where id = p_period_id for update;

  if v_period is null then
    raise exception 'Payroll period not found';
  end if;

  -- 2. Ensure draft revision
  select id into v_revision_id from payroll_revisions
  where payroll_period_id = p_period_id and status = 'draft'
  order by revision_number desc limit 1;

  if v_revision_id is null then
    insert into payroll_revisions (payroll_period_id, revision_number, status)
    values (p_period_id, 1, 'draft')
    returning id into v_revision_id;
  end if;

  -- 3. Process employees (batch insert payslips)
  -- Full implementation would mirror the TypeScript logic but within the transaction
  -- This is a placeholder for the structural pattern

  -- 4. Update revision totals
  update payroll_revisions
  set total_employees = v_emp_count,
      total_gross = v_total_gross,
      total_deductions = v_total_deductions,
      total_net = v_total_net
  where id = v_revision_id;

  -- 5. Update period status
  update payroll_periods set status = 'validated' where id = p_period_id;

  return jsonb_build_object('success', true, 'count', v_emp_count);
end;
$$;
```

**Note**: The full implementation requires porting the TypeScript payroll logic into PL/pgSQL or using a hybrid approach (TypeScript for calculation, wrapped in a Supabase RPC transaction). The key principle is that all payslip inserts + revision update + period status update happen atomically.

**Validation**:
```bash
npm run db:sync
# Test: Run payroll, fail employee #427 mid-batch → entire run should roll back
# Test: Run payroll successfully → all payslips created atomically
```

---

### 2.3 Add balance sufficiency check at leave submission

**File**: `schema/06_leave.sql` (modify `process_leave_request_state_change` trigger)  
**Problem**: The INSERT path reserves `pending_days` without checking if balance is sufficient. Two concurrent submissions can both succeed and exceed the balance.

**Change** — Add balance check in the INSERT path:
```sql
-- In process_leave_request_state_change(), after getting v_alloc_id:

if (tg_op = 'INSERT' and new.status = 'pending') then
  -- NEW: Check balance sufficiency before reserving
  declare
    v_available numeric;
  begin
    select (allocated_days + carry_forward_days - used_days - pending_days)
    into v_available
    from leave_allocations where id = v_alloc_id;

    if v_available < new.total_days then
      -- Check if leave type allows negative balance
      if not exists (
        select 1 from leave_types lt
        join leave_allocations la on la.leave_type_id = lt.id
        where la.id = v_alloc_id and lt.allow_negative_balance = true
      ) then
        raise exception 'Insufficient leave balance: requested % days but only % available (§4.2)', new.total_days, v_available;
      end if;
    end if;
  end;

  -- Reserve pending days (existing logic)
  update leave_allocations
  set pending_days = pending_days + new.total_days, updated_at = now()
  where id = v_alloc_id;

  insert into leave_ledger (...)
  ...;
end if;
```

**Validation**:
```bash
npm run db:sync
# Test: Employee with 2 CL days remaining applies for 3 CL days → should fail
# Test: Employee with 2 CL days remaining applies for 1 CL day → should succeed
# Test: Employee with COMP_OFF (allow_negative_balance=true) applies for 5 days → should succeed
# Test: Two concurrent 2-day requests against 3-day balance → second should fail
```

---

## Phase 3 — Authorization & FSM Fixes (3–5 hours)

> **Goal**: Fix role-based access gaps in approval workflows.  
> **Risk**: MEDIUM — Changes affect who can approve what.  
> **Depends on**: Phase 1 complete.

### 3.1 Add role-based stage gate to reimbursement FSM

**File**: `src/lib/actions/reimbursements.ts`  
**Function**: `approveReimbursementClaimAction`  
**Problem**: Any user with `reimbursement.approve` can advance either stage of the two-stage FSM. Stage 1 should require manager permission; stage 2 should require HR permission.

**Change** — Add role verification after the route check:
```typescript
// After line: const route = category?.approval_route || "manager_only";

if (route === "manager_then_hr") {
  if (claim.status === "pending_manager" || claim.status === "submitted") {
    // Stage 1: Verify decider has MANAGER permission (not HR-only)
    const isManager = await assertPermission("attendance.correct.approve"); // manager-level permission
    const isHr = await assertPermission("leave.approve.hr");
    
    // Allow managers OR HR (HR can act as manager for stage 1)
    // But if decider is HR-only, they should not approve stage 1
    if (isHr === null && isManager !== null) {
      return { success: false, error: "Stage 1 requires manager approval. HR admins should wait for manager review." };
    }
    
    nextStatus = "pending_hr";
  } else if (claim.status === "pending_hr") {
    // Stage 2: Verify decider has HR permission
    const isHr = await assertPermission("leave.approve.hr");
    if (isHr !== null) {
      return { success: false, error: "Stage 2 requires HR admin approval." };
    }
    nextStatus = "approved";
  }
}
```

**Better approach** — Use the existing permission codes more precisely:
```typescript
if (route === "manager_then_hr") {
  if (claim.status === "pending_manager" || claim.status === "submitted") {
    // Stage 1: Manager must approve first
    // Check decider is NOT HR-only (HR cannot skip manager review)
    const hasHrPerm = await assertPermission("leave.approve.hr");
    const hasManagerPerm = await assertPermission("attendance.correct.approve");
    
    if (hasHrPerm === null && hasManagerPerm !== null) {
      return { success: false, error: "This claim requires manager review first. HR approval is not permitted at this stage." };
    }
    nextStatus = "pending_hr";
  } else if (claim.status === "pending_hr") {
    // Stage 2: HR must approve
    const hasHrPerm = await assertPermission("leave.approve.hr");
    if (hasHrPerm !== null) {
      return { success: false, error: "Stage 2 requires HR admin approval." };
    }
    nextStatus = "approved";
  }
}
```

**Validation**:
```bash
npm run test:unit -- --grep "reimbursement"
```
Test cases:
1. Manager approves stage 1 → advances to `pending_hr` ✓
2. HR attempts stage 1 directly → rejected ✓
3. HR approves stage 2 → advances to `approved` ✓
4. Manager attempts stage 2 → rejected ✓

---

### 3.2 Fix payroll finalize to re-verify lock

**File**: `src/lib/actions/payroll.ts`  
**Function**: `finalizePayrollPeriodAction`  
**Problem**: Finalization doesn't re-verify payroll lock before finalizing. Changes could have occurred since the last run.

**Change**:
```typescript
export async function finalizePayrollPeriodAction(periodId: string) {
  // ... permission checks ...

  const supabase = await createClient();

  // NEW: Re-verify payroll lock before finalizing
  const { error: lockErr } = await supabase.rpc("validate_payroll_lock", {
    p_period_id: periodId,
  });
  if (lockErr) {
    return { error: `Cannot finalize: ${lockErr.message}` };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "finalized" })
    .eq("id", periodId);
  // ... rest unchanged ...
}
```

**Validation**:
```bash
npm run test:unit -- --grep "payroll"
```
Test case: Create pending attendance anomaly after payroll run but before finalize → finalize should be blocked.

---

### 3.3 Add `is_deactivated` enforcement in middleware

**File**: `src/middleware.ts`  
**Problem**: The `is_deactivated` flag on employees is not checked — deactivated employees can still authenticate and access the system.

**Change** — After employee resolution in the real Supabase RBAC path:
```typescript
// After line: if (userRoles.length === 0) { userRoles = ["employee"]; }

// NEW: Check if employee is deactivated
const { data: empStatus } = await supabase
  .from("employees")
  .select("is_deactivated")
  .eq("auth_user_id", user.id)
  .single();

if (empStatus?.is_deactivated) {
  const forbiddenUrl = new URL("/403?code=account_deactivated", request.url);
  return NextResponse.redirect(forbiddenUrl);
}
```

**Also add** to `assertPermission` in `src/lib/auth/assertPermission.ts` — check `is_deactivated` before returning caller:
```typescript
// In getAuthenticatedCaller(), after fetching employee:
if (emp?.is_deactivated) {
  return { employeeId: null, email: emp?.email || null, roles: [], error: "Account deactivated" };
}
```

**Validation**:
```bash
# Set employee.is_deactivated = true
# Attempt login → should be redirected to /403 with code=account_deactivated
```

---

## Phase 4 — Workflow Completion & Cascades (3–5 hours)

> **Goal**: Fix broken end-to-end workflows.  
> **Risk**: MEDIUM — Changes affect multi-module interactions.  
> **Depends on**: Phases 1–3 complete.

### 4.1 Add F&F approval → employee status cascade

**File**: `src/lib/actions/offboarding.ts`  
**Function**: `approveFfAction`  
**Problem**: F&F approval doesn't transition the employee to `offboarded` or `completed`.

**Change** — After F&F approval, check if LWD is reached and update employee status:
```typescript
export async function approveFfAction(separationId: string) {
  // ... existing permission and identity checks ...

  // ... existing F&F update ...

  // NEW: Check if LWD is reached and update employee status
  const { data: separation } = await supabase
    .from("separation_records")
    .select("employee_id, last_working_day, status")
    .eq("id", separationId)
    .single();

  if (separation?.last_working_day) {
    const today = new Date().toISOString().split("T")[0];
    if (separation.last_working_day <= today) {
      // LWD reached + F&F approved → transition to offboarded
      const { error: empErr } = await supabase
        .from("employees")
        .update({ status: "offboarded" })
        .eq("id", separation.employee_id)
        .eq("status", "notice_period"); // Only transition if currently in notice_period

      if (empErr) {
        console.error("Failed to transition employee status:", empErr);
        // Non-blocking — F&F is still approved
      }

      // Update separation status
      await supabase
        .from("separation_records")
        .update({ status: "completed" })
        .eq("id", separationId);
    }
  }

  return { success: true };
}
```

**Validation**:
```bash
npm run test:unit -- --grep "offboarding"
```
Test cases:
1. F&F approved after LWD → employee status becomes `offboarded` ✓
2. F&F approved before LWD → employee stays `notice_period` ✓
3. F&F approved, employee already `active` → no status change ✓

---

### 4.2 Clean up F&F draft on rescission

**File**: `src/lib/actions/offboarding.ts`  
**Function**: `rescindResignationAction`  
**Problem**: Rescission only updates separation status but leaves orphaned F&F draft.

**Change**:
```typescript
export async function rescindResignationAction(separationId: string) {
  // ... existing checks ...

  const supabase = await createClient();

  // NEW: Delete associated F&F draft before rescinding
  await supabase
    .from("ff_settlement_records")
    .delete()
    .eq("separation_id", separationId)
    .eq("status", "draft"); // Only delete drafts, not approved settlements

  const { data, error } = await supabase
    .from("separation_records")
    .update({ status: "rescinded" })
    .eq("id", separationId)
    .select()
    .single();

  // Also restore employee status if they were in notice_period
  if (data?.employee_id) {
    await supabase
      .from("employees")
      .update({ status: "active" })
      .eq("id", data.employee_id)
      .eq("status", "notice_period");
  }

  // ... audit log ...
  return { success: true, record: data };
}
```

**Validation**:
```bash
# Test: Submit resignation → F&F draft created → Rescind → F&F draft deleted, employee status restored to active
```

---

### 4.3 Add duplicate attendance prevention

**File**: `src/lib/actions/attendance.ts`  
**Function**: `punchCheckInAction`  
**Problem**: No check for existing open attendance record on the same day — duplicate inserts possible.

**Change**:
```typescript
export async function punchCheckInAction(employeeId?: string) {
  // ... existing permission and identity checks ...

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // NEW: Check for existing attendance record today
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, status")
    .eq("employee_id", empId)
    .eq("attendance_date", today)
    .single();

  if (existing) {
    if (existing.status === "present" || existing.status === "half_day") {
      return { success: false, error: "Already checked in for today." };
    }
    if (existing.status === "pending_review") {
      return { success: false, error: "Attendance record already exists for today. Please submit a correction if needed." };
    }
  }

  // ... rest of check-in logic (use upsert instead of insert) ...
  const nowIso = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("attendance_records")
    .upsert({
      employee_id: empId,
      attendance_date: today,
      check_in_time: nowIso,
      status: "pending_review",
    }, { onConflict: "employee_id,attendance_date" })
    .select()
    .single();
  // ...
}
```

**Validation**:
```bash
npm run test:unit -- --grep "attendance"
```
Test case: Check in twice on same day → second attempt rejected.

---

## Phase 5 — Security Hardening (2–3 hours)

> **Goal**: Close security gaps in authentication and session management.  
> **Risk**: LOW-MEDIUM — Changes affect auth flow.  
> **Depends on**: Phase 1 complete.

### 5.1 Remove mock cookie backward compatibility

**File**: `src/lib/auth/mock-cookie.ts`  
**Function**: `validateMockCookieValue`  
**Lines**: ~68–77 (the 2-part cookie acceptance block)  
**Problem**: Non-production environments accept unsigned 2-part cookies, enabling impersonation.

**Change** — Delete the backward-compat block:
```typescript
// DELETE this entire block (lines 68-77):
    // Backward compatibility for existing 2-part format during development / non-production
    if (process.env.NODE_ENV !== "production" && parts.length === 2) {
      const [encoded, expiryStr] = parts;
      const expiry = parseInt(expiryStr, 10);
      if (!isNaN(expiry) && Date.now() > expiry) return null;
      try {
        const email = decodeURIComponent(atob(encoded));
        if (email && email.includes("@")) return email;
      } catch {
        return null;
      }
    }
```

**Validation**:
```bash
# Create a 2-part mock cookie manually
# Attempt to use it → should be rejected
# Create a 3-part HMAC-signed cookie → should be accepted
```

---

### 5.2 Guard auth logging in production

**File**: `src/lib/actions/auth.ts`  
**Function**: `loginAction`  
**Lines**: ~65–80 (the `console.info` block)  
**Problem**: Detailed Supabase error objects including stack traces are logged in production.

**Change**:
```typescript
// BEFORE:
    console.info("[Auth Server Action: Handshake Response]", {
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET",
      email,
      hasSession: Boolean(data?.session),
      user: data?.user ? { id: data.user.id, email: data.user.email, app_metadata: data.user.app_metadata } : null,
      error: authErr ? { ... } : null,
      rawErrorObject: error,
    });

// AFTER:
    if (process.env.NODE_ENV !== "production") {
      console.info("[Auth Server Action: Handshake Response]", {
        timestamp: new Date().toISOString(),
        email,
        hasSession: Boolean(data?.session),
        error: authErr ? { name: authErr.name, message: authErr.message, code: authErr.code } : null,
      });
    }
```

**Also** remove `rawErrorObject: error` and `app_metadata` from the log to avoid leaking sensitive data.

**Validation**:
```bash
# Run login in production mode → no detailed auth logs should appear
# Run login in development mode → logs should appear
```

---

### 5.3 Remove service role key as HMAC fallback

**File**: `src/lib/auth/mock-cookie.ts`  
**Lines**: ~8  
**Problem**: `MOCK_COOKIE_SECRET` falls back to `SUPABASE_SERVICE_ROLE_KEY` — the service role key should never be used for cookie signing.

**Change**:
```typescript
// BEFORE:
const MOCK_COOKIE_SECRET = process.env.MOCK_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "hrms-mock-dev-secret-key-2026";

// AFTER:
const MOCK_COOKIE_SECRET = process.env.MOCK_COOKIE_SECRET || "hrms-mock-dev-secret-key-2026";
```

**Add validation**:
```typescript
if (process.env.NODE_ENV === "production" && !process.env.MOCK_COOKIE_SECRET) {
  console.warn("[Security] MOCK_COOKIE_SECRET not set in production — using default dev key. This is insecure.");
}
```

**Validation**:
```bash
# Verify that SUPABASE_SERVICE_ROLE_KEY is no longer used for cookie signing
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/lib/auth/
```

---

## Phase 6 — Testing & Reliability (5–8 hours)

> **Goal**: Add tests for every P0/P1 fix to prevent regressions.  
> **Risk**: LOW — Tests don't affect production code.  
> **Depends on**: Phases 1–5 complete.

### 6.1 Leave balance over-commitment test

**File**: `src/lib/services/__tests__/leave-action.test.ts` (add new test)

```typescript
describe("Leave Balance Concurrency", () => {
  it("should reject leave when balance is insufficient even with pending reservations", async () => {
    // Setup: Employee has 2 CL days allocated, 0 used, 0 pending
    // Action 1: Apply for 2 CL days (succeeds, reserves 2 pending)
    // Action 2: Apply for 1 more CL day (should fail — only 0 available)
    // Assert: Second application returns error about insufficient balance
  });

  it("should allow negative balance when leave type has allow_negative_balance", async () => {
    // Setup: Employee has COMP_OFF type (allow_negative_balance=true), 0 balance
    // Action: Apply for 1 COMP_OFF day
    // Assert: Application succeeds despite negative resulting balance
  });
});
```

### 6.2 Employee status transition test

**File**: `src/lib/services/__tests__/offboarding-action.test.ts` (add new test)

```typescript
describe("Employee Status Transitions", () => {
  it("should allow offboarded → completed transition", async () => {
    // Setup: Employee in 'offboarded' status
    // Action: Update status to 'completed'
    // Assert: Transition succeeds
  });

  it("should reject active → completed transition", async () => {
    // Setup: Employee in 'active' status
    // Action: Update status to 'completed'
    // Assert: Trigger raises exception
  });

  it("should reject completed → active transition", async () => {
    // Setup: Employee in 'completed' status
    // Action: Update status to 'active'
    // Assert: Trigger raises exception
  });
});
```

### 6.3 Reimbursement FSM stage gate test

**File**: `src/lib/services/__tests__/reimbursements-action.test.ts` (add new test)

```typescript
describe("Reimbursement Two-Stage FSM", () => {
  it("should advance from pending_manager to pending_hr on manager approval", async () => {
    // Setup: Claim in pending_manager status, approver has manager permission
    // Action: Approve claim
    // Assert: Status becomes pending_hr
  });

  it("should reject HR-only approver at stage 1", async () => {
    // Setup: Claim in pending_manager status, approver has only HR permission
    // Action: Attempt to approve
    // Assert: Error "Stage 1 requires manager approval"
  });

  it("should reject manager-only approver at stage 2", async () => {
    // Setup: Claim in pending_hr status, approver has only manager permission
    // Action: Attempt to approve
    // Assert: Error "Stage 2 requires HR admin approval"
  });
});
```

### 6.4 Mock cookie security test

**File**: `src/lib/services/__tests__/mock-rbac.test.ts` (add new test)

```typescript
describe("Mock Cookie Security", () => {
  it("should reject unsigned 2-part cookies", async () => {
    // Create a 2-part cookie value: base64(email):expiry
    const cookie = btoa("test@company.com") + ":" + (Date.now() + 3600000);
    const result = await validateMockCookieValue(cookie);
    expect(result).toBeNull();
  });

  it("should accept valid 3-part HMAC-signed cookies", async () => {
    const cookie = await signMockCookieValue("test@company.com");
    const result = await validateMockCookieValue(cookie);
    expect(result).toBe("test@company.com");
  });

  it("should reject expired cookies", async () => {
    // Create an expired cookie
    const cookie = await signMockCookieValue("test@company.com");
    // Manually expire it by modifying the expiry timestamp
    // Assert: validation returns null
  });
});
```

### 6.5 Payroll permission test

**File**: `src/lib/services/__tests__/payroll-action.test.ts` (add new test)

```typescript
describe("Payroll Permission Separation", () => {
  it("should allow finalize with payroll.finalize permission", async () => {
    // Setup: User has payroll.finalize but not payroll.run
    // Action: Call finalizePayrollPeriodAction
    // Assert: Action succeeds (permission check passes)
  });

  it("should reject finalize with only payroll.run permission", async () => {
    // Setup: User has payroll.run but not payroll.finalize
    // Action: Call finalizePayrollPeriodAction
    // Assert: Action returns permission error
  });
});
```

### 6.6 Run all tests

```bash
npm run test:unit
npm run verify:permissions
npm run lint
```

---

## Phase 7 — Performance & Scalability (3–5 hours)

> **Goal**: Address bottlenecks that will matter at scale.  
> **Risk**: LOW-MEDIUM — Optimizations, not behavior changes.  
> **Depends on**: Phases 1–6 complete.

### 7.1 Add payroll eligibility index

**File**: `schema/08_payroll_eligibility.sql` (or `schema/22_comprehensive_performance_indexes.sql`)

```sql
-- Index for payroll eligibility overlap queries
CREATE INDEX IF NOT EXISTS idx_payroll_eligibility_effective
  ON payroll_eligibility (employee_id, effective_from, effective_to)
  WHERE is_eligible = false;
```

**Validation**:
```bash
npm run db:sync
EXPLAIN ANALYZE SELECT * FROM payroll_eligibility
  WHERE effective_from <= '2026-08-31'
  AND (effective_to IS NULL OR effective_to >= '2026-08-01');
```

### 7.2 Add leave allocation non-negative constraints

**File**: `schema/06_leave.sql`

```sql
-- Add check constraints to prevent negative values
ALTER TABLE leave_allocations
  ADD CONSTRAINT chk_leave_alloc_used_nonneg CHECK (used_days >= 0),
  ADD CONSTRAINT chk_leave_alloc_pending_nonneg CHECK (pending_days >= 0),
  ADD CONSTRAINT chk_leave_alloc_cf_nonneg CHECK (carry_forward_days >= 0);
```

### 7.3 Add payslip net_pay constraint

**File**: `schema/09_payroll.sql`

```sql
ALTER TABLE payslips
  ADD CONSTRAINT chk_payslip_net_pay_nonneg CHECK (net_pay >= 0);
```

### 7.4 Add statutory rule version overlap prevention

**File**: `schema/10_statutory.sql`

```sql
-- Prevent overlapping statutory rules of the same type
ALTER TABLE statutory_rule_versions
  ADD CONSTRAINT chk_no_overlap_statutory
  EXCLUDE USING gist (
    rule_type WITH =,
    daterange(effective_start_date, coalesce(effective_end_date, 'infinity'::date), '[)') WITH &&
  );
```

**Validation**:
```bash
npm run db:sync
# Test: Insert overlapping statutory rules → should fail with exclusion violation
```

---

## Phase 8 — Maintainability & Observability (2–3 days)

> **Goal**: Improve long-term code health and operational visibility.  
> **Risk**: LOW — Quality-of-life improvements.  
> **Depends on**: Phases 1–7 complete.

### 8.1 Replace console.* with structured logger

**File**: Create `src/lib/logger.ts`

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  if (process.env.NODE_ENV === "production" && level === "debug") return;
  
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
};
```

Then replace all `console.*` calls across server actions with `logger.*`.

### 8.2 Sync API documentation with actual exports

**File**: `docs/API_DOCUMENTATION.md`  
**Problem**: Documented function names don't match actual exports.

**Action**: Regenerate the Server Action tables from actual code:
```bash
# Grep all "use server" files for exported functions
grep -r "^export async function" src/lib/actions/ | sort
```

Update the API documentation tables to match actual function names.

### 8.3 Raise test coverage thresholds

**File**: `vitest.config.ts`

```typescript
// BEFORE:
thresholds: {
  statements: 50,
  branches: 40,
  functions: 40,
  lines: 53,
},

// AFTER (incremental — raise after each phase):
thresholds: {
  statements: 55,
  branches: 45,
  functions: 45,
  lines: 58,
},
```

### 8.4 Add correlation ID to audit logs

**File**: `src/lib/actions/audit.ts`

Ensure `writeAuditLogAction` generates and propagates a correlation ID for related operations:

```typescript
export async function writeAuditLogAction(params: {
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId?: string; // NEW: Optional correlation ID
}) {
  const correlationId = params.correlationId || crypto.randomUUID();
  // ... insert with correlation_id ...
}
```

Then pass the same `correlationId` across related operations (e.g., leave apply → approval → notification).

---

## Validation Checklist

After completing all phases, run:

```bash
# 1. Verify all RBAC permissions sync
npm run verify:permissions

# 2. Run all unit tests
npm run test:unit

# 3. Run linting
npm run lint

# 4. Regenerate combined schema
npm run db:sync

# 5. Check TypeScript compilation
npx tsc --noEmit

# 6. Run E2E smoke tests
npm run test:e2e:p0
```

---

## Summary by Phase

| Phase | Effort | Risk | Findings Resolved |
|-------|--------|------|-------------------|
| 1 — SQL & Permission Bugs | 1–2 hours | LOW | C5, C6, C7, transition matrix |
| 2 — Transaction Safety | 4–8 hours | MEDIUM | C1, C2, balance check |
| 3 — Authorization & FSM | 3–5 hours | MEDIUM | C3, C4 (mock), lock re-verify |
| 4 — Workflow Completion | 3–5 hours | MEDIUM | F&F cascade, rescission, attendance |
| 5 — Security Hardening | 2–3 hours | LOW-MEDIUM | Mock cookie, auth logging, HMAC |
| 6 — Testing & Reliability | 5–8 hours | LOW | Regression tests for all fixes |
| 7 — Performance | 3–5 hours | LOW | Indexes, constraints |
| 8 — Maintainability | 2–3 days | LOW | Logger, docs, coverage |
| **Total** | **~3–4 weeks** | | |

---

*Generated by Buffy (Codebuff Agent) — August 22, 2026*
