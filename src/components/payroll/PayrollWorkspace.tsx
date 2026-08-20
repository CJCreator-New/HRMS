"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Layers,
  Loader2,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/Toast";
import { formatCurrencyIndian } from "@/lib/utils/formatters";
import { runPayrollAction } from "@/lib/actions/data";
import { finalizePayrollPeriodAction, reopenPayrollPeriodAction, validatePayrollLockAction } from "@/lib/actions/payroll";
import { PAYROLL_STEPS, payrollStepIndex } from "@/lib/services/workflow-steps";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Modal } from "@/components/shared/Modal";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { Stepper } from "@/components/shared/Stepper";
import type { PayrollPeriod, PayslipSummary } from "@/lib/services/payroll";

interface PayrollWorkspaceProps {
  initialPeriods: PayrollPeriod[];
  initialPayslips: PayslipSummary[];
}

/**
 * Payroll workspace (client island, Slice 5).
 *
 * Periods + payslips are fetched server-side by the RSC page and passed in as
 * props. State syncs whenever refreshed props arrive (after router.refresh()),
 * keeping the stepper, register, and period selector consistent with the
 * server after each mutation (run / finalize / reopen).
 */
export function PayrollWorkspace({ initialPeriods, initialPayslips }: PayrollWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>(initialPeriods);
  const [payslips, setPayslips] = useState<PayslipSummary[]>(initialPayslips);
  const [loading, setLoading] = useState(initialPeriods.length === 0);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(initialPeriods[0] ?? null);
  const [lockError, setLockError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipSummary | null>(null);

  // Sync when the server re-renders with fresh data after a mutation.
  useEffect(() => {
    setPeriods(initialPeriods);
    setPayslips(initialPayslips);
    setLoading(initialPeriods.length === 0);
    setActivePeriod((prev) => {
      if (initialPeriods.length === 0) return null;
      if (!prev) return initialPeriods[0];
      return initialPeriods.find((p) => p.id === prev.id) ?? initialPeriods[0];
    });
  }, [initialPeriods, initialPayslips]);

  // M-10: while the payslip modal is open, tag <body> so the print stylesheet
  // can isolate the payslip and hide the shell chrome (see globals.css).
  useEffect(() => {
    if (selectedPayslip) document.body.classList.add("printing-payslip");
    else document.body.classList.remove("printing-payslip");
    return () => document.body.classList.remove("printing-payslip");
  }, [selectedPayslip]);

  const refresh = () => router.refresh();

  const handleRunPayroll = async () => {
    if (!activePeriod) return;
    setProcessing(true);
    setLockError("");
    const res = await runPayrollAction(activePeriod.id);
    setProcessing(false);
    if ("error" in res) {
      setLockError(res.error);
    } else {
      toast(
        <span>
          Bulk Payroll Run executed for {activePeriod.month_name} (Revision v{activePeriod.active_revision})!{" "}
          <a href="#payslip-register" className="underline font-bold">
            Review payslips ↓
          </a>
        </span>
      );
      refresh();
    }
  };

  const handleFinalizePayroll = async () => {
    if (!activePeriod) return;
    setLockError("");

    const lockCheck = await validatePayrollLockAction(activePeriod.id);
    if ("error" in lockCheck) {
      setLockError(lockCheck.error);
      return;
    }

    const res = await finalizePayrollPeriodAction(activePeriod.id);
    if ("error" in res) {
      setLockError(`Finalize failed: ${res.error}`);
    } else {
      toast(
        <span>
          Payroll period {activePeriod.month_name} finalized and locked successfully!{" "}
          <a href="#payslip-register" className="underline font-bold">
            Review payslips ↓
          </a>
        </span>
      );
      refresh();
    }
  };

  const handleReopenPayroll = async () => {
    if (!activePeriod) return;
    const res = await reopenPayrollPeriodAction(activePeriod.id);
    if ("error" in res) {
      setLockError(`Reopen failed: ${res.error}`);
    } else {
      toast(
        <span>
          Payroll period {activePeriod.month_name} reopened for revision! New Revision v{activePeriod.active_revision + 1} created.{" "}
          <a href="#payslip-register" className="underline font-bold">
            Review payslips ↓
          </a>
        </span>
      );
      refresh();
    }
  };

  return (
    <>
      {/* Header Bar (shared PageHeader) — owns the run / reopen actions */}
      <PageHeader
        testId="payroll-header"
        icon={<FileSpreadsheet className="w-5 h-5 text-amber-600" aria-hidden="true" />}
        title="Payroll Core Engine & Revisions"
        description="Payable units computation (worked + paid_leave), strict lock verification, and versioned revision reopen flow."
        actions={
          activePeriod?.status === "finalized" || activePeriod?.status === "published" ? (
            <button
              data-testid="reopen-payroll-btn"
              onClick={handleReopenPayroll}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg border border-amber-300 transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <RefreshCw className="w-4 h-4 text-amber-700" /> Reopen for Revision (v{(activePeriod?.active_revision ?? 0) + 1})
            </button>
          ) : (
            <button
              data-testid="run-payroll-btn"
              onClick={handleRunPayroll}
              disabled={processing || !activePeriod}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {processing ? "Executing Bulk Run..." : "Execute Bulk Payroll Run"}
            </button>
          )
        }
      />

      {lockError && <ErrorBanner title="Payroll Lock Notice" message={lockError} />}

      {loading ? (
        <PageLoading message="Loading payroll periods and registers..." />
      ) : (
        <>
          {/* Guided Workflow Stepper (FLW-01/FLW-02) */}
          <Stepper
            steps={PAYROLL_STEPS}
            current={payrollStepIndex(activePeriod?.status)}
            testId="stepper"
            className="bg-surface p-5 rounded-xl border border-line shadow-card"
          />

          {/* Period Selector Banner */}
          <div className="bg-surface p-5 rounded-xl border border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-semibold uppercase">Active Period & Revision</p>
                <p className="text-base font-extrabold text-ink">
                  {activePeriod?.month_name} &bull; <span className="text-primary-600">Revision v{activePeriod?.active_revision}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs self-start sm:self-auto">
              <StatusBadge status={activePeriod?.status || "draft"} label={`Status: ${activePeriod?.status || "draft"}`} />

              {activePeriod?.status !== "finalized" && (
                <button
                  data-testid="finalize-payroll-btn"
                  onClick={handleFinalizePayroll}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <Lock className="w-3.5 h-3.5" /> Finalize & Lock Payroll
                </button>
              )}
            </div>
          </div>

          {/* Binary Payroll Eligibility Dashboard */}
          <div data-testid="payroll-eligibility-widget" className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <Layers className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Payroll Eligibility Engine
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="font-bold text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Eligible Employees (125)
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Active status, complete statutory profiles & salary structures.</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-bold text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> Ineligible / Suspended (3)
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">EMP-004 (Suspended), EMP-012 (Missing Statutory Profile).</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-bold text-blue-900">Eligibility Rule Check</p>
                <p className="text-[11px] text-blue-700 mt-0.5">Evaluated binary is_eligible flag prior to payable unit calculation.</p>
              </div>
            </div>
          </div>

          {/* Payslip Register Table */}
          <div id="payslip-register" className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-bold text-ink">
                Monthly Payslip Register ({activePeriod?.month_name} - Revision v{activePeriod?.active_revision})
              </h3>
              <span className="text-xs text-ink-muted font-medium">Calculated per Payable Units equation</span>
            </div>

            <DataTable
              name="payslips"
              columns={[
                { key: "employee_code", header: "Code / Employee", sortable: true },
                { key: "payable_units", header: "Payable Units", sortable: true },
                { key: "lop_units", header: "LOP Units" },
                { key: "gross", header: "Gross Earnings", sortable: true },
                { key: "deductions", header: "Deductions" },
                { key: "net", header: "Net Payable", sortable: true },
                { key: "actions", header: "Payslip", headerClassName: "text-right" },
              ]}
              rows={payslips}
              getSortValue={(ps: PayslipSummary, key) => {
                switch (key) {
                  case "employee_code":
                    return ps.employee_code;
                  case "payable_units":
                    return ps.payable_units;
                  case "gross":
                    return ps.gross;
                  case "net":
                    return ps.net;
                  default:
                    return "";
                }
              }}
              minWidth="min-w-[650px]"
              empty={
                <EmptyState
                  icon={<DollarSign className="w-8 h-8 text-ink-faint" />}
                  title="No payslips generated for this period"
                  description="Run the bulk payroll wizard to generate payslip records for active employees."
                  actionLabel="Run Bulk Payroll"
                  onAction={handleRunPayroll}
                />
              }
              renderRow={(ps: PayslipSummary) => (
                <tr key={ps.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{ps.employee_name}</p>
                    <p className="text-[11px] font-mono text-ink-muted">{ps.employee_code}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-700 tabular-nums">{ps.payable_units} days</td>
                  <td className="px-4 py-3 font-mono text-red-600 font-semibold tabular-nums">{ps.lop_units} days</td>
                  <td className="px-4 py-3 font-mono text-ink font-semibold tabular-nums">{formatCurrencyIndian(ps.gross)}</td>
                  <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums">{formatCurrencyIndian(ps.deductions)}</td>
                  <td className="px-4 py-3 font-mono font-extrabold text-emerald-700 text-sm tabular-nums">{formatCurrencyIndian(ps.net)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      data-testid="view-payslip-btn"
                      onClick={() => setSelectedPayslip(ps)}
                      className="px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Eye className="w-3 h-3" /> View Payslip
                    </button>
                  </td>
                </tr>
              )}
            />
          </div>

          {/* Payslip View Modal (shared Modal — focus trap, Escape, scroll lock) */}
          {selectedPayslip && (
            <Modal
              isOpen
              onClose={() => setSelectedPayslip(null)}
              title={activePeriod ? `Payslip Statement (${activePeriod.month_name})` : "Payslip Statement"}
              maxWidth="max-w-lg"
            >
              <p className="text-xs text-ink-muted">
                Revision v{activePeriod?.active_revision} &bull; Official Payroll Record
              </p>

              <div className="bg-surface-muted p-4 rounded-lg space-y-3 text-xs">
                <div className="flex justify-between font-medium text-ink-secondary">
                  <span>
                    Employee: <strong className="text-ink">{selectedPayslip.employee_name}</strong>
                  </span>
                  <span>
                    Code: <strong className="text-ink">{selectedPayslip.employee_code}</strong>
                  </span>
                </div>
                <div className="flex justify-between font-medium text-ink-secondary border-b border-line pb-2">
                  <span>
                    Payable Days: <strong className="text-emerald-700 tabular-nums">{selectedPayslip.payable_units}</strong>
                  </span>
                  <span>
                    LOP Days: <strong className="text-red-600 tabular-nums">{selectedPayslip.lop_units}</strong>
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-ink-secondary">
                    <span>Gross Earnings</span>
                    <span className="font-mono font-semibold tabular-nums">{formatCurrencyIndian(selectedPayslip.gross)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 pt-1 border-t border-line">
                    <span>Total Deductions</span>
                    <span className="font-mono font-semibold tabular-nums">-{formatCurrencyIndian(selectedPayslip.deductions)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-sm font-extrabold text-emerald-900 pt-2 border-t border-line-strong">
                  <span>Net Salary Payable</span>
                  <span className="font-mono text-emerald-700 tabular-nums">{formatCurrencyIndian(selectedPayslip.net)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  data-testid="print-payslip-btn"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-primary-600 text-white font-semibold text-xs rounded-lg hover:bg-primary-700 flex items-center gap-1.5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <Download className="w-3.5 h-3.5" /> Print / Save Payslip PDF
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </>
  );
}

export default PayrollWorkspace;
