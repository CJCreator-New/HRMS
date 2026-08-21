"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, XCircle, Plus, Trash2, Loader2, ShieldAlert, Info } from "lucide-react";
import {
  getEligibilityDataAction,
  setEligibilityAction,
  removeEligibilityAction,
} from "@/lib/actions/eligibility";
import { usePermission } from "@/lib/auth/usePermission";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { formatDateIndian } from "@/lib/utils/formatters";

interface Emp {
  id: string;
  full_name: string;
  employee_code: string;
  status: string;
}
interface EligRow {
  id: string;
  employee_id: string;
  is_eligible: boolean;
  reason: string | null;
  source: string;
  effective_from: string;
  effective_to: string | null;
}

function currentEligibility(rows: EligRow[], employeeId: string, today: string): EligRow | null {
  const todayD = new Date(today).getTime();
  const matches = rows
    .filter((r) => r.employee_id === employeeId)
    .filter((r) => new Date(r.effective_from).getTime() <= todayD)
    .filter((r) => !r.effective_to || new Date(r.effective_to).getTime() >= todayD)
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  return matches[0] || null;
}

export default function EligibilityPage() {
  const { can } = usePermission();
  const canManage = can("payroll.run");
  const today = new Date().toISOString().split("T")[0];

  const [employees, setEmployees] = useState<Emp[]>([]);
  const [eligibility, setEligibility] = useState<EligRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [isEligible, setIsEligible] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError("");
    const res = await getEligibilityDataAction();
    if ("error" in res && res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    if ("employees" in res && res.employees) {
      setEmployees(res.employees);
    }
    if ("eligibility" in res && res.eligibility) {
      setEligibility(res.eligibility);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rowsByEmp = useMemo(() => {
    const map = new Map<string, EligRow[]>();
    for (const r of eligibility) {
      const arr = map.get(r.employee_id) || [];
      arr.push(r);
      map.set(r.employee_id, arr);
    }
    return map;
  }, [eligibility]);

  const excludedCount = employees.filter(
    (e) => currentEligibility(eligibility, e.id, today)?.is_eligible === false
  ).length;

  const handleSet = async () => {
    if (!selectedEmp) {
      toast("Select an employee first.", "error");
      return;
    }
    setSaving(true);
    const res = await setEligibilityAction(selectedEmp, isEligible, effectiveFrom, reason || undefined);
    if ("error" in res) {
      toast(`Error: ${res.error}`, "error");
      setSaving(false);
      return;
    }
    setReason("");
    setSelectedEmp("");
    setIsEligible(false);
    toast("Saved. Payroll run will now respect this effective-dated eligibility.");
    await load();
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    setConfirmRemoveId(null);
    setSaving(true);
    const res = await removeEligibilityAction(id);
    if ("error" in res) {
      toast(`Error: ${res.error}`, "error");
    } else {
      toast("Override removed.");
    }
    await load();
    setSaving(false);
  };

  if (loading) return <PageLoading message="Loading eligibility…" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<ShieldAlert className="h-6 w-6 text-indigo-600" aria-hidden="true" />}
        title="Payroll Eligibility"
        description="Effective-dated eligible / ineligible flags per employee. Ineligible employees are excluded from bulk payroll runs."
      />

      {error && <ErrorBanner message={error} />}

      <div className="mb-4 flex items-center gap-2 text-sm text-ink-secondary">
        <Info className="h-4 w-4" />
        <span>
          {excludedCount} of {employees.length} active employees currently excluded from payroll run.
        </span>
      </div>

      {canManage && (
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card" data-testid="eligibility-form">
          <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Plus className="w-4 h-4 text-primary-600" /> Set Eligibility Override
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="eligibility-employee" className="block font-semibold text-ink-secondary mb-1">Employee *</label>
              <select
                id="eligibility-employee"
                data-testid="eligibility-employee"
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface font-medium focus:ring-2 focus:ring-primary-300 focus:outline-none"
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="eligibility-effective-from" className="block font-semibold text-ink-secondary mb-1">Effective From *</label>
              <input
                id="eligibility-effective-from"
                data-testid="eligibility-effective-from"
                type="date"
                className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="eligibility-ineligible" className="flex items-center gap-2 font-semibold text-ink-secondary cursor-pointer pt-5">
                <input
                  id="eligibility-ineligible"
                  type="checkbox"
                  data-testid="eligibility-ineligible"
                  checked={!isEligible}
                  onChange={(e) => setIsEligible(!e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-line-strong"
                />
                Mark as <span className="font-medium text-red-600">ineligible</span> (else eligible)
              </label>
            </div>
            <div>
              <label htmlFor="eligibility-reason" className="block font-semibold text-ink-secondary mb-1">Reason</label>
              <input
                id="eligibility-reason"
                data-testid="eligibility-reason"
                className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
                value={reason}
                placeholder="e.g. On unpaid suspension"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="pt-4 border-t border-line mt-4">
            <button
              data-testid="eligibility-save"
              onClick={handleSet}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition shadow-xs"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save Eligibility
            </button>
          </div>
        </div>
      )}

      <DataTable
        name="eligibility"
        columns={[
          { key: "full_name", header: "Employee" },
          { key: "employee_code", header: "Code" },
          { key: "status", header: "Current status" },
          { key: "effective_from", header: "Effective from" },
          { key: "reason", header: "Reason" },
          ...(canManage ? [{ key: "actions", header: "", headerClassName: "text-right" }] : []),
        ]}
        rows={employees}
        empty={
          <EmptyState
            title="No employees found"
            description="Employee eligibility data will appear here."
          />
        }
        renderRow={(e: Emp) => {
          const cur = currentEligibility(eligibility, e.id, today);
          const ineligible = cur?.is_eligible === false;
          return (
            <tr key={e.id} className="hover:bg-surface-muted/50 transition">
              <td className="px-4 py-3 font-bold text-ink">{e.full_name}</td>
              <td className="px-4 py-3 font-mono text-ink-secondary">{e.employee_code}</td>
              <td className="px-4 py-3">
                {ineligible ? (
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    <StatusBadge status="ineligible" label="Ineligible" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <StatusBadge status="eligible" label="Eligible" />
                  </span>
                )}
                {cur?.source === "hr_override" && (                    <span className="ml-2 text-xs text-ink-faint">(override)</span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-ink-muted text-[11px]">{cur?.effective_from ? formatDateIndian(cur.effective_from) : "—"}</td>
              <td className="px-4 py-3 text-ink-secondary">{cur?.reason || "—"}</td>
              {canManage && (
                <td className="px-4 py-3 text-right">
                  {cur?.id && (
                    <button
                      data-testid={`eligibility-remove-${e.id}`}
                      onClick={() => setConfirmRemoveId(cur.id)}
                      className="text-rose-600 hover:text-rose-800"
                      title="Remove override"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          );
        }}
      />

      {/* H-12: Confirm destructive eligibility-override removal */}
      <ConfirmDialog
        isOpen={!!confirmRemoveId}
        title="Remove eligibility override?"
        description="Removing this override restores the employee to the default eligibility rule. This action is recorded in the audit log."
        confirmLabel="Remove override"
        cancelLabel="Cancel"
        danger
        onConfirm={() => confirmRemoveId && handleRemove(confirmRemoveId)}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </div>
  );
}
