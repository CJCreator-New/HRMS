"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Search,
  RotateCcw,
  PackageCheck,
  ShieldCheck,
  UserCheck,
  Smartphone,
  Monitor,
  HardDrive,
} from "lucide-react";
import {
  listAssetsAction,
  listEmployeeAssetsAction,
  allocateAssetAction,
  returnAssetAction,
  CompanyAsset,
  EmployeeAssetAssignment,
} from "@/lib/actions/assets";
import { getEmployeesAction } from "@/lib/actions/employees";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrencyIndian } from "@/lib/utils/formatters";
import { usePermission } from "@/lib/auth/usePermission";

export default function AssetsPage() {
  const { can } = usePermission();
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [assignments, setAssignments] = useState<EmployeeAssetAssignment[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Allocation Modal State
  const [allocatingAsset, setAllocatingAsset] = useState<CompanyAsset | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [allocateNotes, setAllocateNotes] = useState("");
  const [submittingAlloc, setSubmittingAlloc] = useState(false);

  // Return Modal State
  const [returningAssignment, setReturningAssignment] = useState<{
    assignmentId: string;
    assetTag: string;
    employeeName: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [assetRes, assignRes, empRes] = await Promise.all([
      listAssetsAction(),
      listEmployeeAssetsAction(),
      getEmployeesAction(),
    ]);

    if (assetRes.success && assetRes.data) {
      setAssets(assetRes.data);
    }
    if (assignRes.success && assignRes.data) {
      setAssignments(assignRes.data);
    }
    if (empRes && "employees" in empRes && Array.isArray(empRes.employees)) {
      const mapped = (empRes.employees as Array<{ id: string; full_name?: string | null; employee_code?: string | null }>).map((e) => ({
        id: e.id,
        name: e.full_name || "Unknown",
        code: e.employee_code || "",
      }));
      setEmployees(mapped);
      if (mapped.length > 0 && !selectedEmpId) {
        setSelectedEmpId(mapped[0].id);
      }
    }
    setLoading(false);
  }, [selectedEmpId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active assignments mapping (asset_id -> active assignment)
  const activeAssignmentsMap = useMemo(() => {
    const map = new Map<string, EmployeeAssetAssignment>();
    for (const a of assignments) {
      if (!a.returned_at) {
        map.set(a.asset_id, a);
      }
    }
    return map;
  }, [assignments]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesCategory = categoryFilter === "all" || asset.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === "all" || asset.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        !search ||
        asset.name.toLowerCase().includes(search.toLowerCase()) ||
        asset.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
        (asset.serial_number && asset.serial_number.toLowerCase().includes(search.toLowerCase())) ||
        (asset.model && asset.model.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [assets, categoryFilter, statusFilter, search]);

  // Statistics
  const stats = useMemo(() => {
    const total = assets.length;
    const allocated = assets.filter((a) => a.status === "allocated").length;
    const available = assets.filter((a) => a.status === "available").length;
    const other = total - allocated - available;
    return { total, allocated, available, other };
  }, [assets]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingAsset || !selectedEmpId) return;

    setSubmittingAlloc(true);
    const res = await allocateAssetAction(selectedEmpId, allocatingAsset.id, allocateNotes);
    setSubmittingAlloc(false);

    if (res.error) {
      setNotice(`Error: ${res.error}`);
    } else {
      setNotice(`Asset ${allocatingAsset.asset_tag} successfully allocated.`);
      setAllocatingAsset(null);
      setAllocateNotes("");
      await loadData();
    }
    setTimeout(() => setNotice(""), 4500);
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningAssignment) return;

    setSubmittingReturn(true);
    const res = await returnAssetAction(returningAssignment.assignmentId, returnCondition);
    setSubmittingReturn(false);

    if (res.error) {
      setNotice(`Error: ${res.error}`);
    } else {
      setNotice(`Asset ${returningAssignment.assetTag} successfully returned to inventory.`);
      setReturningAssignment(null);
      setReturnCondition("");
      await loadData();
    }
    setTimeout(() => setNotice(""), 4500);
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "laptop":
        return <Laptop className="w-4 h-4 text-primary-600 shrink-0" />;
      case "mobile":
        return <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />;
      case "monitor":
        return <Monitor className="w-4 h-4 text-purple-600 shrink-0" />;
      default:
        return <HardDrive className="w-4 h-4 text-ink-muted shrink-0" />;
    }
  };

  const canManage = can("offboarding.manage") || can("settings.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        testId="assets-header"
        icon={<Laptop className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Hardware Asset Inventory & Offboarding Tracking"
        description="Track company hardware assets, serials, and assignment lifecycle. Required for IT offboarding clearance verification."
      />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            notice.startsWith("Error")
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          {notice.startsWith("Error") ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          )}
          <span>{notice}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-1">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold">Total Inventory</span>
            <PackageCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-ink">{stats.total}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold">Allocated Devices</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.allocated}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-1">
          <div className="flex items-center justify-between text-primary-700">
            <span className="text-xs font-semibold">In Stock (Available)</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-primary-600">{stats.available}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold">Maintenance / Other</span>
            <RotateCcw className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.other}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-xl border border-line shadow-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-faint" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by tag, name, serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-line-strong rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="catFilter" className="font-semibold text-ink-muted">
              Category:
            </label>
            <select
              id="catFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-line-strong rounded-lg px-2.5 py-1.5 bg-white text-xs font-medium"
            >
              <option value="all">All Categories</option>
              <option value="laptop">Laptops</option>
              <option value="monitor">Monitors</option>
              <option value="mobile">Mobile Devices</option>
              <option value="peripheral">Peripherals</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="statusFilter" className="font-semibold text-ink-muted">
              Status:
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-line-strong rounded-lg px-2.5 py-1.5 bg-white text-xs font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="allocated">Allocated</option>
              <option value="maintenance">Maintenance</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Asset Table */}
      {loading ? (
        <PageLoading message="Loading hardware assets and employee assignments..." />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={<Laptop className="w-8 h-8 text-ink-faint" />}
          title="No assets found"
          description="Try adjusting your filters or search terms to locate specific company equipment."
        />
      ) : (
        <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-line text-ink-muted font-bold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4">Asset Tag</th>
                  <th scope="col" className="py-3 px-4">Device & Model</th>
                  <th scope="col" className="py-3 px-4">Category</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Assigned To</th>
                  <th scope="col" className="py-3 px-4">Cost</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink">
                {filteredAssets.map((asset) => {
                  const activeAssign = activeAssignmentsMap.get(asset.id);
                  const assignedEmp = activeAssign
                    ? employees.find((e) => e.id === activeAssign.employee_id)
                    : null;

                  return (
                    <tr key={asset.id} className="hover:bg-surface-muted/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-primary-700">
                        {asset.asset_tag}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-ink">{asset.name}</p>
                          <p className="text-[11px] text-ink-muted font-mono">
                            SN: {asset.serial_number || "N/A"} &bull; {asset.model || "Standard"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 capitalize text-ink-secondary">
                          {getCategoryIcon(asset.category)}
                          <span>{asset.category}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={asset.status}
                          label={asset.status.toUpperCase()}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {assignedEmp ? (
                          <div>
                            <p className="font-semibold text-ink">{assignedEmp.name}</p>
                            <p className="text-[10px] text-ink-muted font-mono">{assignedEmp.code}</p>
                          </div>
                        ) : (
                          <span className="text-ink-faint italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-secondary">
                        {asset.cost > 0 ? formatCurrencyIndian(asset.cost) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && asset.status === "available" && (
                          <button
                            type="button"
                            data-testid={`allocate-btn-${asset.asset_tag}`}
                            onClick={() => {
                              setAllocatingAsset(asset);
                              if (employees.length > 0) setSelectedEmpId(employees[0].id);
                            }}
                            className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-xs transition shadow-xs"
                          >
                            Assign
                          </button>
                        )}

                        {canManage && asset.status === "allocated" && activeAssign && (
                          <button
                            type="button"
                            data-testid={`return-btn-${asset.asset_tag}`}
                            onClick={() => {
                              setReturningAssignment({
                                assignmentId: activeAssign.id,
                                assetTag: asset.asset_tag,
                                employeeName: assignedEmp ? assignedEmp.name : "Employee",
                              });
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition shadow-xs"
                          >
                            Record Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Allocate Asset */}
      <Modal
        isOpen={Boolean(allocatingAsset)}
        onClose={() => setAllocatingAsset(null)}
        title={`Allocate Asset: ${allocatingAsset?.asset_tag}`}
        maxWidth="max-w-md"
      >
        {allocatingAsset && (
          <form onSubmit={handleAllocate} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-muted rounded-lg border border-line space-y-1">
              <p className="font-semibold text-ink">{allocatingAsset.name}</p>
              <p className="text-ink-muted font-mono">
                Model: {allocatingAsset.model || "Standard"} &bull; SN: {allocatingAsset.serial_number || "N/A"}
              </p>
            </div>

            <div>
              <label htmlFor="assignEmployeeSelect" className="block font-semibold text-ink-secondary mb-1">
                Assign to Employee *
              </label>
              <select
                id="assignEmployeeSelect"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                required
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-white font-medium"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="assignNotes" className="block font-semibold text-ink-secondary mb-1">
                Allocation / Condition Notes (Optional)
              </label>
              <textarea
                id="assignNotes"
                rows={3}
                value={allocateNotes}
                onChange={(e) => setAllocateNotes(e.target.value)}
                placeholder="e.g. Issued with laptop bag, charger and mouse. Mint condition."
                className="w-full border border-line-strong rounded-lg p-2.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setAllocatingAsset(null)}
                className="px-4 py-2 border border-line rounded-lg text-ink font-semibold hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAlloc}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {submittingAlloc ? "Allocating..." : "Confirm Assignment"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Record Asset Return */}
      <Modal
        isOpen={Boolean(returningAssignment)}
        onClose={() => setReturningAssignment(null)}
        title={`Return Asset: ${returningAssignment?.assetTag}`}
        maxWidth="max-w-md"
      >
        {returningAssignment && (
          <form onSubmit={handleReturn} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-muted rounded-lg border border-line space-y-1">
              <p className="text-ink">
                Returning device from <span className="font-bold">{returningAssignment.employeeName}</span>.
              </p>
              <p className="text-ink-muted">
                Completing this return will mark the device as available and reduce the employee&apos;s pending offboarding clearance liabilities.
              </p>
            </div>

            <div>
              <label htmlFor="returnConditionInput" className="block font-semibold text-ink-secondary mb-1">
                Return Inspection & Condition Notes (Optional)
              </label>
              <textarea
                id="returnConditionInput"
                rows={3}
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                placeholder="e.g. Returned in good condition with charger. No screen damage."
                className="w-full border border-line-strong rounded-lg p-2.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setReturningAssignment(null)}
                className="px-4 py-2 border border-line rounded-lg text-ink font-semibold hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReturn}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {submittingReturn ? "Recording Return..." : "Confirm Return"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
