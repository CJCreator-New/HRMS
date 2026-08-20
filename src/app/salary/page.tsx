"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Plus, Edit3, Shield, CheckCircle2, History, Calculator, Upload, User } from "lucide-react";
import { getSalaryDataAction } from "@/lib/actions/data";
import { createSalaryStructureAction, bulkAssignSalaryStructure } from "@/lib/actions/salary";
import { formatCurrencyIndian, formatDateIndian } from "@/lib/utils/formatters";
import { usePermission } from "@/lib/auth/usePermission";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import { BatchUploadDrawer } from "@/components/shared/batch-import/BatchUploadDrawer";
import { SalaryStructureBatchSchema } from "@/lib/batch-import/schemas";

interface ComponentItem {
  id: string;
  code: string;
  name: string;
  type: "earning" | "deduction" | "statutory_deduction";
  calc_type: "flat_amount" | "percentage_of_basic" | "percentage_of_ctc";
  is_taxable: boolean;
  is_pf: boolean;
  is_esi: boolean;
}

interface SalaryVersion {
  version_number: number;
  annual_ctc: number;
  monthly_gross: number;
  basic_monthly: number;
  effective_from: string;
  effective_to?: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

export default function SalaryManagementPage() {
  const { can, isManager } = usePermission();
  const { toast } = useToast();
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [salaryVersions, setSalaryVersions] = useState<SalaryVersion[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [newCtc, setNewCtc] = useState(840000);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [proRataSplit, setProRataSplit] = useState<{ oldDays: number; newDays: number; oldPay: number; newPay: number; totalGross: number } | null>(null);

  const [showBatchDrawer, setShowBatchDrawer] = useState(false);

  const loadData = async (targetEmpId?: string) => {
    setLoading(true);
    const res = await getSalaryDataAction(targetEmpId);
    if ((res as any).employeeId) {
      setEmployeeId((res as any).employeeId);
    }
    if ((res as any).employees?.length) {
      setEmployees((res as any).employees);
    }
    const rawComps: any[] = (res as any).components || [];
    setComponents(rawComps.map((c: any) => ({
      id: c.id, code: c.code, name: c.name,
      type: c.component_type || "earning",
      calc_type: c.calculation_type || "flat_amount",
      is_taxable: c.is_taxable || false,
      is_pf: c.is_pf_applicable || false,
      is_esi: c.is_esi_applicable || false,
    })));
    const rawAssign: any[] = (res as any).assignments || [];
    setSalaryVersions(rawAssign.map((a: any, idx: number) => ({
      version_number: idx + 1,
      annual_ctc: a.annual_ctc || 0,
      monthly_gross: a.monthly_gross || 0,
      basic_monthly: a.basic_monthly || 0,
      effective_from: a.effective_from || "",
      effective_to: a.effective_to || undefined,
    })));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const canViewAll = can("salary.view.all");
  const canViewSelf = can("salary.view.self");

  if (isManager && !canViewAll && !canViewSelf) {
    return (
      <div className="p-8 text-center bg-surface rounded-xl border border-line shadow-xs space-y-3">
        <Shield className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-ink">Salary Visibility Restricted</h3>
        <p className="text-xs text-ink-secondary max-w-md mx-auto">
          Per company policy, Manager roles do not have visibility into employee salary structures. Contact HR Admin or Payroll Administrator for assistance.
        </p>
      </div>
    );
  }

  const latestVersion = salaryVersions.length > 0 ? salaryVersions[salaryVersions.length - 1] : null;

  const handleCreateSalaryVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast("Error: Could not resolve current employee for salary structure.", "error");
      return;
    }
    const res = await createSalaryStructureAction(employeeId, newCtc, effectiveDate);
    if ("error" in res) {
      toast(res.error, "error");
    } else {
      const monthlyGross = Math.round(newCtc / 12);
      const basicMonthly = Math.round(monthlyGross * 0.5);
      const updatedVersions = salaryVersions.map((v, idx) =>
        idx === salaryVersions.length - 1 ? { ...v, effective_to: effectiveDate } : v
      );
      const newVersion: SalaryVersion = {
        version_number: (latestVersion?.version_number ?? 0) + 1,
        annual_ctc: newCtc,
        monthly_gross: monthlyGross,
        basic_monthly: basicMonthly,
        effective_from: effectiveDate,
      };
      setSalaryVersions([...updatedVersions, newVersion]);
      toast(
        `New Salary Structure Version v${newVersion.version_number} recorded starting ${formatDateIndian(effectiveDate)}! Annual CTC: ${formatCurrencyIndian(newCtc)}.`
      );
    }
  };

  const handleCalculateProRata = () => {
    const daysInMonth = 31;
    const splitDay = 14;
    const oldMonthly = 50000;
    const newMonthly = 60000;
    const oldPay = Math.round((oldMonthly / daysInMonth) * splitDay);
    const newPay = Math.round((newMonthly / daysInMonth) * (daysInMonth - splitDay));
    setProRataSplit({ oldDays: splitDay, newDays: daysInMonth - splitDay, oldPay, newPay, totalGross: oldPay + newPay });
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<DollarSign className="w-5 h-5 text-emerald-600" aria-hidden="true" />}
        title="Per-Employee Versioned Salary Structure"
        description="Maintain salary components and effective-dated salary structures with automated mid-month pro-ration calculations."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchDrawer(true)}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4" /> Batch Upload (.xlsx / .csv)
            </button>
            <button
              onClick={handleCalculateProRata}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition flex items-center gap-1.5"
            >
              <Calculator className="w-4 h-4 text-emerald-600" /> Preview Mid-Month Pro-Ration
            </button>
          </div>
        }
      />

      {/* Employee Selector for HR Admin / Salary View All */}
      {canViewAll && employees.length > 0 && (
        <div className="bg-surface p-4 rounded-xl border border-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <User className="w-4 h-4 text-primary-600" />
            <span>Select Employee:</span>
          </div>
          <div className="w-full sm:w-80">
            <select
              value={employeeId || ""}
              onChange={(e) => {
                const targetId = e.target.value;
                setEmployeeId(targetId);
                loadData(targetId);
              }}
              className="w-full text-xs border border-line-strong rounded-lg px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Select Employee"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Pro-Rata Preview Banner */}
      {proRataSplit && (
        <div className="bg-primary-50 border border-primary-200 text-primary-900 p-5 rounded-xl text-xs space-y-2">
          <h4 className="font-bold text-sm text-primary-950 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-primary-600" /> Mid-Month Salary Split Breakdown (August 2026)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-surface rounded-lg border border-primary-100">
              <p className="font-semibold text-ink-secondary">Days 1–14 (v1 Rate)</p>
              <p className="font-mono text-sm font-bold text-ink">{formatCurrencyIndian(proRataSplit.oldPay)}</p>
              <p className="text-[10px] text-ink-muted">14 days @ ₹50,000/mo</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-primary-100">
              <p className="font-semibold text-ink-secondary">Days 15–31 (v2 Rate)</p>
              <p className="font-mono text-sm font-bold text-ink">{formatCurrencyIndian(proRataSplit.newPay)}</p>
              <p className="text-[10px] text-ink-muted">17 days @ ₹60,000/mo</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg border border-emerald-200">
              <p className="font-bold text-emerald-900">Total Pro-Rated Gross</p>
              <p className="font-mono text-base font-bold text-emerald-950">{formatCurrencyIndian(proRataSplit.totalGross)}</p>
              <p className="text-[10px] text-emerald-800">Combined monthly gross</p>
            </div>
          </div>
        </div>
      )}

      {/* Salary Component Master & Version History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version History & Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Salary Revision Form */}
          {can("salary.edit") && (
            <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-4">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
                <Edit3 className="w-4 h-4 text-emerald-600" /> Revise Salary Structure (Creates Version v{(latestVersion?.version_number ?? 0) + 1})
              </h3>

              <form onSubmit={handleCreateSalaryVersion} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">New Annual CTC (INR) *</label>
                  <input
                    type="number"
                    step="10000"
                    required
                    value={newCtc}
                    onChange={(e) => setNewCtc(parseFloat(e.target.value) || 0)}
                    className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">Effective From Date *</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full border border-line-strong rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
                  >
                    Record Salary Revision
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Version History Log */}
          <div className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <History className="w-4 h-4 text-primary-600" /> Versioned Salary Structure Log
            </h3>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line font-bold uppercase text-ink-muted text-[11px]">
                    <th className="px-4 py-2.5">Version</th>
                    <th className="px-4 py-2.5">Annual CTC</th>
                    <th className="px-4 py-2.5">Monthly Gross</th>
                    <th className="px-4 py-2.5">Basic Monthly</th>
                    <th className="px-4 py-2.5">Effective Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {salaryVersions.map((v) => (
                    <tr key={v.version_number} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold text-primary-600">v{v.version_number}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-ink">{formatCurrencyIndian(v.annual_ctc)}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary">{formatCurrencyIndian(v.monthly_gross)}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary">{formatCurrencyIndian(v.basic_monthly)}</td>
                      <td className="px-4 py-3 font-mono text-ink-muted text-[11px]">
                        {formatDateIndian(v.effective_from)} &rarr; {v.effective_to ? formatDateIndian(v.effective_to) : "Present"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Component Master List */}
        <div className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Shield className="w-4 h-4 text-emerald-600" /> Salary Components Master
          </h3>

          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.id} className="p-3 bg-surface-muted rounded-lg border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-ink">{c.name} ({c.code})</span>
                  <StatusBadge
                    status={c.type === "earning" ? "active" : "rejected"}
                    label={c.type.replace("_", " ")}
                  />
                </div>
                <p className="text-[11px] text-ink-muted">
                  Calculation: <span className="font-medium text-ink-secondary">{c.calc_type}</span> &bull; Taxable: {c.is_taxable ? "Yes" : "No"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shared Batch Upload Drawer */}
      <BatchUploadDrawer
        isOpen={showBatchDrawer}
        onClose={() => setShowBatchDrawer(false)}
        schema={SalaryStructureBatchSchema}
        onCommit={bulkAssignSalaryStructure}
        onSuccess={async () => {
          await loadData(employeeId || undefined);
          toast("Salary structures updated successfully from batch upload.");
        }}
      />
    </div>
  );
}
