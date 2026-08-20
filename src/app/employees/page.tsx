import { Users, Plus, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";
import { permissionsForRoles, hasPermission } from "@/lib/auth/permissions-map";
import { queryEmployees, toEmployeeItem, type EmployeeItem } from "@/lib/services/employees";
import { ReadOnlyBanner } from "@/components/shared/ReadOnlyBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmployeeDirectory } from "@/components/employees/EmployeeDirectory";

/**
 * Employee Directory & Assignments (Slice 4: RSC conversion).
 *
 * Server component: the first directory page (page 1, default sort) renders
 * server-side so the initial paint is HTML, not a client fetch + spinner. The
 * interactive island (search, pagination, sort, assignments) receives that
 * initial data and refetches via server actions on filter changes (M-09).
 *
 * E2E contract preserved (e2e/specs/ui/pagination.spec.ts):
 *  - data-testid="employees-table", "pagination*", "sort-employee_code"
 */
export default async function EmployeeDirectoryPage() {
  const userInfo = await safeGetCurrentUserRoles();
  const permissions = permissionsForRoles(userInfo.roles);
  const canEdit = hasPermission(permissions, "employee.edit");
  const canCreate = hasPermission(permissions, "employee.create");

  let initialEmployees: EmployeeItem[] = [];
  let initialTotal = 0;
  try {
    const { employees, total } = await queryEmployees({ page: 1, pageSize: 25 });
    initialEmployees = employees.map(toEmployeeItem);
    initialTotal = total ?? 0;
  } catch {
    // DB unavailable — the island will surface the fetch error on first query.
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner moduleName="Employee Profiles & Directory" />

      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<Users className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Employee Directory & Assignments"
        description="Manage employee profiles, department/manager assignments, and access revocation status."
        actions={
          <>
            <Link
              href="/employees/import"
              className="px-3.5 py-2 bg-surface-muted hover:bg-primary-50 text-ink-secondary text-xs font-semibold rounded-lg transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Bulk CSV Import
            </Link>
            {canCreate && (
              <Link
                href="/onboarding"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Direct Onboard Employee
              </Link>
            )}
          </>
        }
      />

      <EmployeeDirectory
        initialEmployees={initialEmployees}
        initialTotal={initialTotal}
        canEdit={canEdit}
        canCreate={canCreate}
      />
    </div>
  );
}
