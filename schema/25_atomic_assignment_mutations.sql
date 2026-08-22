-- ============================================================================
-- HRMS v2.7 — Module 25: Atomic Effective-Dated Assignment Mutations
-- Database Target: PostgreSQL / Supabase
-- Target File: schema/25_atomic_assignment_mutations.sql
-- Strictly aligned with FR §2.1, §3.5 & ADR 0003
-- ============================================================================
--
-- DEPENDENCIES: 02_org.sql (employee_department_assignment, employee_manager_assignment, employee_designation_assignment),
--               04_work_calendar.sql (employee_work_calendar_assignment)
-- Provides: update_employee_manager_assignment(), update_employee_department_assignment(),
--           update_employee_designation_assignment(), update_employee_work_calendar_assignment()

-- 1. Manager Assignment Atomic Mutation
create or replace function update_employee_manager_assignment(
  p_employee_id uuid,
  p_manager_id uuid,
  p_effective_from date,
  p_created_by uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  if p_effective_from is null then
    raise exception 'effective_from cannot be null';
  end if;

  -- Row-level lock on existing open assignment
  select id, effective_from into v_existing
  from employee_manager_assignment
  where employee_id = p_employee_id and effective_to is null
  for update;

  if found then
    if v_existing.effective_from = p_effective_from then
      -- Same day change: update existing record directly
      update employee_manager_assignment
      set manager_id = p_manager_id
      where id = v_existing.id
      returning id into v_new_id;
      return v_new_id;
    elsif v_existing.effective_from < p_effective_from then
      -- Close previous open assignment at day before new effective_from
      update employee_manager_assignment
      set effective_to = p_effective_from - 1
      where id = v_existing.id;

      insert into employee_manager_assignment (
        employee_id, manager_id, effective_from, effective_to, created_by
      ) values (
        p_employee_id, p_manager_id, p_effective_from, null, p_created_by
      ) returning id into v_new_id;
      return v_new_id;
    else
      raise exception 'New assignment effective_from (%) cannot precede existing assignment start date (%)',
        p_effective_from, v_existing.effective_from;
    end if;
  else
    insert into employee_manager_assignment (
      employee_id, manager_id, effective_from, effective_to, created_by
    ) values (
      p_employee_id, p_manager_id, p_effective_from, null, p_created_by
    ) returning id into v_new_id;
    return v_new_id;
  end if;
end;
$$;

-- 2. Department Assignment Atomic Mutation
create or replace function update_employee_department_assignment(
  p_employee_id uuid,
  p_department_id uuid,
  p_effective_from date,
  p_created_by uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  if p_effective_from is null then
    raise exception 'effective_from cannot be null';
  end if;

  select id, effective_from into v_existing
  from employee_department_assignment
  where employee_id = p_employee_id and effective_to is null
  for update;

  if found then
    if v_existing.effective_from = p_effective_from then
      update employee_department_assignment
      set department_id = p_department_id
      where id = v_existing.id
      returning id into v_new_id;
      return v_new_id;
    elsif v_existing.effective_from < p_effective_from then
      update employee_department_assignment
      set effective_to = p_effective_from - 1
      where id = v_existing.id;

      insert into employee_department_assignment (
        employee_id, department_id, effective_from, effective_to, created_by
      ) values (
        p_employee_id, p_department_id, p_effective_from, null, p_created_by
      ) returning id into v_new_id;
      return v_new_id;
    else
      raise exception 'New assignment effective_from (%) cannot precede existing assignment start date (%)',
        p_effective_from, v_existing.effective_from;
    end if;
  else
    insert into employee_department_assignment (
      employee_id, department_id, effective_from, effective_to, created_by
    ) values (
      p_employee_id, p_department_id, p_effective_from, null, p_created_by
    ) returning id into v_new_id;
    return v_new_id;
  end if;
end;
$$;

-- 3. Designation Assignment Atomic Mutation
create or replace function update_employee_designation_assignment(
  p_employee_id uuid,
  p_title text,
  p_effective_from date,
  p_created_by uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  if p_effective_from is null then
    raise exception 'effective_from cannot be null';
  end if;

  select id, effective_from into v_existing
  from employee_designation_assignment
  where employee_id = p_employee_id and effective_to is null
  for update;

  if found then
    if v_existing.effective_from = p_effective_from then
      update employee_designation_assignment
      set title = p_title
      where id = v_existing.id
      returning id into v_new_id;
      return v_new_id;
    elsif v_existing.effective_from < p_effective_from then
      update employee_designation_assignment
      set effective_to = p_effective_from - 1
      where id = v_existing.id;

      insert into employee_designation_assignment (
        employee_id, title, effective_from, effective_to, created_by
      ) values (
        p_employee_id, p_title, p_effective_from, null, p_created_by
      ) returning id into v_new_id;
      return v_new_id;
    else
      raise exception 'New assignment effective_from (%) cannot precede existing assignment start date (%)',
        p_effective_from, v_existing.effective_from;
    end if;
  else
    insert into employee_designation_assignment (
      employee_id, title, effective_from, effective_to, created_by
    ) values (
      p_employee_id, p_title, p_effective_from, null, p_created_by
    ) returning id into v_new_id;
    return v_new_id;
  end if;
end;
$$;

-- 4. Work Calendar Assignment Atomic Mutation
create or replace function update_employee_work_calendar_assignment(
  p_employee_id uuid,
  p_calendar_template_id uuid,
  p_effective_from date,
  p_created_by uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_existing record;
  v_new_id uuid;
begin
  if p_effective_from is null then
    raise exception 'effective_from cannot be null';
  end if;

  select id, effective_from into v_existing
  from employee_work_calendar_assignment
  where employee_id = p_employee_id and effective_to is null
  for update;

  if found then
    if v_existing.effective_from = p_effective_from then
      update employee_work_calendar_assignment
      set calendar_template_id = p_calendar_template_id
      where id = v_existing.id
      returning id into v_new_id;
      return v_new_id;
    elsif v_existing.effective_from < p_effective_from then
      update employee_work_calendar_assignment
      set effective_to = p_effective_from - 1
      where id = v_existing.id;

      insert into employee_work_calendar_assignment (
        employee_id, calendar_template_id, effective_from, effective_to, created_by
      ) values (
        p_employee_id, p_calendar_template_id, p_effective_from, null, p_created_by
      ) returning id into v_new_id;
      return v_new_id;
    else
      raise exception 'New assignment effective_from (%) cannot precede existing assignment start date (%)',
        p_effective_from, v_existing.effective_from;
    end if;
  else
    insert into employee_work_calendar_assignment (
      employee_id, calendar_template_id, effective_from, effective_to, created_by
    ) values (
      p_employee_id, p_calendar_template_id, p_effective_from, null, p_created_by
    ) returning id into v_new_id;
    return v_new_id;
  end if;
end;
$$;
