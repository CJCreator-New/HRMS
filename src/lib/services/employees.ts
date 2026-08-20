import { createClient } from "@/lib/supabase/server";

/**
 * Server-side employee directory queries (Slice 4 — RSC conversion).
 *
 * Shared by the `getEmployeesAction` server action (unchanged consumers:
 * offboarding dropdown, etc.) and the server-rendered directory page so the
 * page's initial paint is server-rendered instead of a client fetch.
 */

export interface EmployeeQueryOptions {
  /** 1-based page number — when omitted, returns the full unpaginated set. */
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { column: string; dir: "asc" | "desc" };
}

const EMPLOYEE_SORT_COLUMNS: Record<string, string> = {
  employee_code: "employee_code",
  full_name: "full_name",
  email: "email",
  status: "status",
  created_at: "created_at",
};

export interface EmployeeItem {
  id: string;
  code: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  manager: string;
  status: "invited" | "active" | "suspended" | "notice_period" | "offboarded";
  is_deactivated: boolean;
  doj: string;
}

export function toEmployeeItem(e: any): EmployeeItem {
  return {
    id: e.id,
    code: e.employee_code || "",
    name: e.full_name || "",
    email: e.email || "",
    department: e.department || "",
    designation: e.designation || "",
    manager: e.manager_name || "",
    status: e.status || "active",
    is_deactivated: e.is_deactivated ?? false,
    doj: e.date_of_joining || "",
  };
}

/**
 * Employee directory query (M-09). When `page` is provided, performs a
 * server-side count + ranged fetch with deterministic ordering; otherwise
 * returns the full set. Returns raw rows (RLS-scoped) — map with
 * `toEmployeeItem` for display.
 */
export async function queryEmployees(
  opts: EmployeeQueryOptions = {}
): Promise<{ employees: any[]; total: number | null }> {
  const { page, pageSize = 25, search, sort } = opts;
  const paginated = typeof page === "number" && page > 0;
  const supabase = await createClient();

  let query = supabase
    .from("employees")
    .select("*, employee_roles(roles(code, name))", paginated ? { count: "exact" } : undefined);

  if (search && search.trim()) {
    const q = search.trim().replace(/[%]/g, "");
    query = query.or(`full_name.ilike.%${q}%,employee_code.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const sortCol =
    sort && EMPLOYEE_SORT_COLUMNS[sort.column] ? EMPLOYEE_SORT_COLUMNS[sort.column] : "created_at";
  query = query.order(sortCol, {
    ascending: sort?.dir ? sort.dir !== "desc" : true,
  });

  if (paginated) {
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { employees: data || [], total: paginated ? count ?? 0 : null };
}
