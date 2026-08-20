-- ============================================================================
-- HRMS v2.7 — Module 14: Document Attachments & Malware Scanning
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/14_attachments.sql
-- Strictly aligned with FR §6 & ADR 0003
-- ============================================================================

-- 1. Scan Status Enum
create type scan_status_enum as enum ('pending', 'clean', 'flagged');

-- 2. Polymorphic Document Attachments Master Table (§6)
create table document_attachments (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null, -- 'employee_profile', 'leave_attachment', 'reimbursement_receipt', 'separation_doc'
  entity_id       uuid not null,
  file_name       text not null,
  file_size_bytes bigint not null,
  mime_type       text not null,
  storage_path    text not null,
  scan_status     scan_status_enum not null default 'pending',
  uploaded_by     uuid not null references employees(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. File Security & MIME Whitelist Validation Trigger (§6)
create or replace function validate_attachment_security() returns trigger
language plpgsql as $$
begin
  if new.file_size_bytes > 10485760 then
    raise exception 'File size exceeds maximum allowed limit of 10MB (§6)';
  end if;

  if new.mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'Unsupported or invalid file MIME type: % (§6)', new.mime_type;
  end if;

  return new;
end;
$$;

create trigger trg_validate_attachment
  before insert on document_attachments
  for each row execute function validate_attachment_security();

-- 4. Row Level Security
alter table document_attachments enable row level security;

create policy attachments_read on document_attachments for select
  using (uploaded_by = auth_employee_id() or has_permission('employee.view', uploaded_by) or has_permission('leave.view.team') or has_permission('leave.view.all'));
create policy attachments_insert on document_attachments for insert
  with check (uploaded_by = auth_employee_id());
create policy attachments_delete on document_attachments for delete
  using (uploaded_by = auth_employee_id() or has_permission('settings.manage'));
