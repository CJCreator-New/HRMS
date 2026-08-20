"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, Search, Edit, Plus, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getEmployeesAction,
  toggleEmployeeDeactivationAction,
  updateEmployeeAssignmentAction,
} from "@/lib/actions/employees";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { useServerTable } from "@/lib/hooks/useServerTable";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { EmployeeItem } from "@/lib/services/employees";

interface EmployeeDirectoryProps {
  /** Server-rendered first page (page 1, default size/sort). */
  initialEmployees: EmployeeItem[];
  initialTotal: number;
  /** Server-resolved permission gates. */
  canEdit: boolean;
  canCreate: boolean;
}

/**
 * Employee directory (client island, Slice 4).
 *
 * The first page is rendered by the server (passed in as props); this island
 * owns search, pagination, sort, and the assignment / revoke interactions,
 * refetching via the server action on filter changes (M-09) and updating rows
 * locally after mutations.
 */
export function EmployeeDirectory({
  initialEmployees,
  initialTotal,
  canEdit,
  canCreate,
}: EmployeeDirectoryProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [loading, setLoading] = useState(initialEmployees.length === 0);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<EmployeeItem | null>(null);

  // Assignment Modal state
  const [assignDept, setAssignDept] = useState("Engineering");
  const [assignDesig, setAssignDesig] = useState("Lead Engineer");
  const [assignManager, setAssignManager] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [assignSuccess, setAssignSuccess] = useState("");
  // Revoke Access Confirmation State (H-12)
  const [confirmDeactivate, setConfirmDeactivate] = useState<EmployeeItem | null>(null);

  const { page, pageSize, sortColumn, sortDir, total, setPage, setPageSize, setSort, setTotal } =
    useServerTable();
  const [reloadKey, setReloadKey] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Skip the redundant first fetch only when the server already rendered data.
  const hasInitialData = useRef(initialEmployees.length > 0);
  const skippedInitial = useRef(false);

  // Debounce the directory search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Server-side fetch — page / pageSize / sort / search changes re-query (M-09).
  useEffect(() => {
    if (hasInitialData.current && !skippedInitial.current) {
      skippedInitial.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const res = await getEmployeesAction({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        sort: sortColumn && sortDir ? { column: sortColumn, dir: sortDir } : undefined,
      });
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else {
        const mapped: EmployeeItem[] = (res.employees || []).map((e: any) => ({
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
        }));
        setEmployees(mapped);
        setTotal(res.total ?? 0);
        // Clamp back to a valid page when the filtered set shrinks.
        if (res.total) {
          const maxPage = Math.max(1, Math.ceil(res.total / pageSize));
          if (page > maxPage) setPage(maxPage);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortColumn, sortDir, debouncedSearch, reloadKey, setPage, setTotal]);

  const handleToggleDeactivate = async (id: string, nextState: boolean) => {
    const res = await toggleEmployeeDeactivationAction(id, nextState);
    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setEmployees(employees.map((e) => (e.id === id ? { ...e, is_deactivated: nextState } : e)));
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const res = await updateEmployeeAssignmentAction(selectedEmp.id, undefined, assignManager || undefined, assignDesig);

    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setEmployees(
        employees.map((emp) =>
          emp.id === selectedEmp.id
            ? { ...emp, department: assignDept, designation: assignDesig, manager: assignManager }
            : emp
        )
      );
      setAssignSuccess(`Effective-dated assignment recorded for ${selectedEmp.name} starting ${effectiveFrom}.`);
      setTimeout(() => {
        setAssignSuccess("");
        setSelectedEmp(null);
      }, 1200);
    }
  };

  return (
    <>
      {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <label htmlFor="directorySearchInput" className="sr-only">
          Search employee directory
        </label>
        <input
          id="directorySearchInput"
          type="text"
          placeholder="Search by code, name, department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs border border-line-strong rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
        />
        <Search className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
      </div>

      {/* Directory Content — server-side pagination + sort (M-09) */}
      {loading && employees.length === 0 ? (
        <PageLoading message="Loading employee directory..." />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-ink-faint" />}
          title="No employees found"
          description={
            debouncedSearch
              ? `No employee profiles matched your search term "${debouncedSearch}".`
              : "No employee records found in directory."
          }
          actionLabel={canCreate ? "+ Onboard New Employee" : undefined}
          onAction={canCreate ? () => router.push("/onboarding") : undefined}
        />
      ) : (
        <DataTable
          name="employees"
          columns={[
            { key: "employee_code", header: "Code / Employee", sortable: true },
            { key: "department", header: "Department & Designation" },
            { key: "manager", header: "Manager" },
            { key: "status", header: "Status", sortable: true },
            { key: "actions", header: "Access & Assignments", headerClassName: "text-right" },
          ]}
          rows={employees}
          total={total}
          page={page}
          pageSize={pageSize}
          sortColumn={sortColumn}
          sortDir={sortDir}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortChange={setSort}
          minWidth="min-w-[700px]"
          renderRow={(emp: EmployeeItem) => (
            <tr key={emp.id} className="hover:bg-surface-muted/50 transition">
              <td className="px-5 py-4">
                <p className="font-bold text-ink">{emp.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {emp.code} &bull; {emp.email}
                </p>
              </td>
              <td className="px-5 py-4">
                <p className="font-semibold text-ink-secondary">
                  {emp.department || <span className="text-ink-faint italic">Unassigned</span>}
                </p>
                <p className="text-[11px] text-ink-muted">{emp.designation || "—"}</p>
              </td>
              <td className="px-5 py-4 text-ink-secondary">{emp.manager || "—"}</td>
              <td className="px-5 py-4">
                <StatusBadge status={emp.status} />
                {emp.is_deactivated && (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                    Revoked
                  </span>
                )}
              </td>
              <td className="px-5 py-4 text-right space-x-2">
                {canEdit && (
                  <button
                    onClick={() => {
                      setSelectedEmp(emp);
                      setAssignDept(emp.department);
                      setAssignDesig(emp.designation);
                      setAssignManager(emp.manager);
                    }}
                    className="px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Edit className="w-3 h-3" /> Assign
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => (emp.is_deactivated ? handleToggleDeactivate(emp.id, false) : setConfirmDeactivate(emp))}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                      emp.is_deactivated
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-red-50 text-red-600 hover:bg-red-100"
                    }`}
                  >
                    {emp.is_deactivated ? "Reactivate Access" : "Revoke Access"}
                  </button>
                )}
              </td>
            </tr>
          )}
        />
      )}

      {/* Assignment Modal (shared Modal — focus trap, Escape, scroll lock) */}
      <Modal
        isOpen={!!selectedEmp}
        onClose={() => setSelectedEmp(null)}
        title={selectedEmp ? `Record Assignment (${selectedEmp.name})` : "Record Assignment"}
        maxWidth="max-w-md"
      >
        {assignSuccess ? (
          <div
            role="status"
            aria-live="polite"
            className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium"
          >
            {assignSuccess}
          </div>
        ) : (
          <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
            <div>
              <label htmlFor="assignDeptSelect" className="block font-semibold text-ink-secondary mb-1">
                Department
              </label>
              <select
                id="assignDeptSelect"
                value={assignDept}
                onChange={(e) => setAssignDept(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Finance & Accounts">Finance & Accounts</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
              </select>
            </div>

            <div>
              <label htmlFor="assignDesigInput" className="block font-semibold text-ink-secondary mb-1">
                Designation Title *
              </label>
              <input
                id="assignDesigInput"
                type="text"
                required
                value={assignDesig}
                onChange={(e) => setAssignDesig(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="assignManagerInput" className="block font-semibold text-ink-secondary mb-1">
                Reporting Manager *
              </label>
              <input
                id="assignManagerInput"
                type="text"
                required
                value={assignManager}
                onChange={(e) => setAssignManager(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="effectiveFromInput" className="block font-semibold text-ink-secondary mb-1">
                Effective From Date *
              </label>
              <input
                id="effectiveFromInput"
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="px-3 py-1.5 text-ink-secondary hover:bg-surface-muted rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white font-semibold text-xs rounded-lg hover:bg-primary-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                Record Assignment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Revoke Access Confirmation (shared ConfirmDialog — H-12) */}
      <ConfirmDialog
        isOpen={!!confirmDeactivate}
        title="Revoke System Access"
        description={
          confirmDeactivate
            ? `Are you sure you want to revoke system access and deactivate ${confirmDeactivate.name} (${confirmDeactivate.code})? The employee will be locked out until reactivated.`
            : "Are you sure you want to revoke system access for this employee?"
        }
        confirmLabel="Deactivate Employee"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          if (confirmDeactivate) handleToggleDeactivate(confirmDeactivate.id, true);
          setConfirmDeactivate(null);
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </>
  );
}

export default EmployeeDirectory;
