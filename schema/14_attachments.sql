-- ============================================================================
-- HRMS v2.7 — Module 14: Document Attachments & Malware Scanning
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/14_attachments.sql
-- Strictly aligned with FR §6 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_permission, auth_employee_id for RLS),
--               02_org.sql (employees table for uploaded_by FK)
-- DEPENDENTS: None (leaf module — no downstream FK dependencies)
-- Provides: document_attachments table,
--           validate_attachment_security() trigger========

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

-- 5. Document Categories (§6, P2-4)
create table if not exists document_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  code        text not null unique,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Seed standard document categories
insert into document_categories (name, code, description, is_system) values
  ('Identity Proof', 'identity_proof', 'Government-issued ID proofs (Passport, Aadhaar, PAN)', true),
  ('Educational Certificates', 'education', 'Degrees, diplomas, and academic transcripts', true),
  ('Employment Contracts', 'contracts', 'Signed offer letters, NDAs, and agreements', true),
  ('Tax Documents', 'tax_docs', 'Form 16, investment proofs, and declarations', true),
  ('Medical & Fitness', 'medical', 'Health checks and fitness certificates', true)
on conflict (code) do nothing;

-- Document categorization & lifecycle extensions on attachments
alter table document_attachments
  add column if not exists category_id uuid references document_categories(id),
  add column if not exists document_version integer not null default 1,
  add column if not exists expires_at date,
  add column if not exists reminder_days integer default 30;

-- 6. Document Version History (§6, P2-4)
create table if not exists document_versions (
  id              uuid primary key default gen_random_uuid(),
  attachment_id   uuid not null references document_attachments(id) on delete cascade,
  version_number  integer not null,
  file_name       text not null,
  file_size_bytes bigint not null,
  storage_path    text not null,
  uploaded_by     uuid not null references employees(id),
  uploaded_at     timestamptz not null default now(),
  notes           text,
  constraint uq_attachment_version unique (attachment_id, version_number)
);

alter table document_categories enable row level security;
alter table document_versions enable row level security;

create policy doc_categories_read on document_categories for select using (true);
create policy doc_categories_write on document_categories for all
  using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy doc_versions_read on document_versions for select
  using (uploaded_by = auth_employee_id() or has_permission('employee.view', uploaded_by));
create policy doc_versions_insert on document_versions for insert
  with check (uploaded_by = auth_employee_id() or has_permission('employee.edit', uploaded_by));

