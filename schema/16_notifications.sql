-- ============================================================================
-- HRMS v2.7 — Module 16: Event-Driven Notifications Engine
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/16_notifications.sql
-- Strictly aligned with FR §8.2
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (auth_employee_id for RLS),
--               02_org.sql (employees table for recipient_id FK)
-- DEPENDENTS: None (leaf module — no downstream FK dependencies)
-- Provides: inbox_notifications table, create_notification() function========

-- 1. Enums
create type notification_channel as enum ('in_app', 'email');

-- 2. Inbox Notifications Table (§8.2)
create table inbox_notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references employees(id) on delete cascade,
  title         text not null,
  message       text not null,
  action_url    text,
  channel       notification_channel not null default 'in_app',
  is_read       boolean not null default false,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_notifications_recipient on inbox_notifications(recipient_id, is_read);

-- 3. Helper Function to Emit Notifications (§8.2 Event Matrix)
create or replace function create_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_action_url text default null
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into inbox_notifications (recipient_id, title, message, action_url)
  values (p_recipient_id, p_title, p_message, p_action_url)
  returning id into v_id;
  return v_id;
end;
$$;

-- 4. Row Level Security
alter table inbox_notifications enable row level security;

create policy notifications_read on inbox_notifications for select
  using (recipient_id = auth_employee_id());
create policy notifications_insert on inbox_notifications for insert
  with check (recipient_id = auth_employee_id() or has_permission('settings.manage'));
create policy notifications_update on inbox_notifications for update
  using (recipient_id = auth_employee_id());

-- 5. Notification Preferences (§8.2, P2-7)
create table if not exists notification_preferences (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  module          text not null, -- 'leaves', 'payroll', 'attendance', 'documents', 'announcements'
  email_enabled   boolean not null default true,
  in_app_enabled  boolean not null default true,
  updated_at      timestamptz not null default now(),
  constraint uq_emp_module_pref unique (employee_id, module)
);

alter table notification_preferences enable row level security;

create policy notif_pref_read on notification_preferences for select
  using (employee_id = auth_employee_id() or has_permission('settings.manage'));

create policy notif_pref_write on notification_preferences for all
  using (employee_id = auth_employee_id() or has_permission('settings.manage'))
  with check (employee_id = auth_employee_id() or has_permission('settings.manage'));

