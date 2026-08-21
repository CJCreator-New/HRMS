-- ============================================================================
-- Migration: 21_rbac_scope_fallback.sql
-- Description: Adds scope hierarchy fallback (.all > .team > .self) and system_admin bypass to has_any_permission RPC
-- Security: Uses SECURITY DEFINER with fixed search_path = public to safely inspect RBAC mappings without recursive RLS checks
-- ============================================================================
--
-- DEPENDENCIES: 01_rbac.sql (has_any_permission function to replace,
--               auth_employee_id, employee_roles, roles, role_permissions, permissions tables)
-- DEPENDENTS: None (replaces existing function — no new downstream dependencies)
-- Provides: Enhanced has_any_permission() with scope hierarchy fallback and
--           system_admin bypass (replaces version from 01_rbac.sql)

CREATE OR REPLACE FUNCTION has_any_permission(perm_codes text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_id uuid := auth_employee_id();
  req_code text;
BEGIN
  IF acting_id IS NULL THEN
    RETURN false;
  END IF;

  -- System Admin bypass
  IF EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN roles r ON r.id = er.role_id
    WHERE er.employee_id = acting_id AND r.code = 'system_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Fast path: exact match in held permissions
  IF EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE er.employee_id = acting_id AND p.code = ANY(perm_codes)
  ) THEN
    RETURN true;
  END IF;

  -- Scope fallback: check if any held permission satisfies the requested codes with scope hierarchy
  FOREACH req_code IN ARRAY perm_codes LOOP
    IF EXISTS (
      SELECT 1 FROM employee_roles er
      JOIN role_permissions rp ON rp.role_id = er.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE er.employee_id = acting_id
        AND (
          p.code = req_code
          OR p.code = req_code || '.all'
          OR p.code = req_code || '.team'
          OR p.code = req_code || '.self'
          OR (req_code LIKE '%.self' AND p.code = REPLACE(req_code, '.self', '.all'))
          OR (req_code LIKE '%.self' AND p.code = REPLACE(req_code, '.self', '.team'))
          OR (req_code LIKE '%.team' AND p.code = REPLACE(req_code, '.team', '.all'))
        )
    ) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;
