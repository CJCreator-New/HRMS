"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UserCheck, AlertTriangle, CheckCircle2, RefreshCw, FileText, ShieldAlert, CheckSquare, XCircle, LogOut, Loader2 } from "lucide-react";
import { getOffboardingDataAction } from "@/lib/actions/data";
import { submitResignationAction, rescindResignationAction, toggleClearanceAction, approveFfAction, triggerStaleFfAction } from "@/lib/actions/offboarding";
import { computeLastWorkingDay } from "@/lib/services/offboarding-engine";
import { OFFBOARDING_STEPS, offboardingStepIndex } from "@/lib/services/workflow-steps";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Stepper } from "@/components/shared/Stepper";
import { formatCurrencyIndian, formatDateIndian } from "@/lib/utils/formatters";

import { usePermission } from "@/lib/auth/usePermission";
import { getEmployeesAction } from "@/lib/actions/employees";

interface SeparationRecord {
  id: string;
  employee_code: string;
  employee_name: string;
  type: "resignation" | "termination";
  resignation_date: string;
  notice_days: number;
  last_working_day: string;
  status: "pending" | "active" | "rescinded" | "completed";
  ff_status: "draft" | "pending_approval" | "approved" | "paid";
  is_stale: boolean;
  encashment_amount: number;
  asset_recovery_amount: number;
  net_settlement: number;
  clearance: {
    it: boolean;
    finance: boolean;
    admin: boolean;
    hr: boolean;
  };
}

export default function OffboardingPage() {
  const { can, isHrAdmin } = usePermission();
  const [separations, setSeparations] = useState<SeparationRecord[]>([]);
  const [employeesList, setEmployeesList] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedSep, setSelectedSep] = useState<SeparationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [nextStep, setNextStep] = useState<{ label: string; href: string } | null>(null);

  // Resignation Form state
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [resigDate, setResigDate] = useState(new Date().toISOString().split("T")[0]);
  const [noticeDays, setNoticeDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const [offboardRes, empRes] = await Promise.all([
        getOffboardingDataAction(),
        getEmployeesAction(),
      ]);

      const rawSeps: any[] = (offboardRes as any).separations || [];
      if (rawSeps.length > 0) {
        setSeparations(rawSeps);
        setSelectedSep(rawSeps[0] || null);
      } else {
        setSeparations([]);
        setSelectedSep(null);
      }

      if (empRes?.employees) {
        const mappedEmps = (empRes.employees || []).map((e: any) => ({
          id: e.id,
          name: e.full_name,
          code: e.employee_code,
        }));
        setEmployeesList(mappedEmps);
        if (mappedEmps.length > 0) {
          setSelectedEmpId(mappedEmps[0].id);
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleResign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;

    const lwd = computeLastWorkingDay(resigDate, noticeDays);

    const res = await submitResignationAction(selectedEmpId, resigDate, noticeDays);
    if ("error" in res) {
      setNotice(`Error: ${res.error}`);
    } else {
      setNotice(`Resignation submitted! Calculated Last Working Day (LWD): ${formatDateIndian(lwd)}. Separation status: Active.`);
      await loadData();
    }
    setTimeout(() => setNotice(""), 4500);
  };

  const handleRescind = async (id: string) => {
    const res = await rescindResignationAction(id);
    if ("error" in res) {
      setNotice(`Error: ${res.error}`);
    } else {
      setSeparations(separations.map((s) => (s.id === id ? { ...s, status: "rescinded" } : s)));
      if (selectedSep?.id === id) {
        setSelectedSep({ ...selectedSep, status: "rescinded" });
      }
      setNotice(`Resignation rescinded before LWD! Employee status restored to Active and audit event logged.`);
    }
    setTimeout(() => setNotice(""), 4500);
  };

  const loadData = async () => {
    const res = await getOffboardingDataAction();
    const rawSeps: any[] = (res as any).separations || [];
    setSeparations(rawSeps);
    setSelectedSep(rawSeps.find((s) => s.id === selectedSep?.id) || rawSeps[0] || null);
  };

  const handleToggleClearance = async (id: string, dept: keyof SeparationRecord["clearance"]) => {
    if (!selectedSep) return;
    const deptName = dept.charAt(0).toUpperCase() + dept.slice(1) as "IT" | "Finance" | "Admin" | "HR";
    const next = !selectedSep.clearance[dept];

    const updated = { ...selectedSep, clearance: { ...selectedSep.clearance, [dept]: next } };
    setSelectedSep(updated);
    setSeparations(separations.map((s) => (s.id === id ? updated : s)));

    const res = await toggleClearanceAction(id, deptName, next);
    if ("error" in res) {
      setNotice(`Error: ${res.error}`);
      await loadData();
    }
  };

  const handleApproveFF = async (id: string) => {
    if (!selectedSep) return;
    const allCleared = Object.values(selectedSep.clearance).every(Boolean);

    if (!allCleared) {
      setNotice("Error: All department clearances (IT, Finance, Admin, HR) must be completed before approving F&F Settlement!");
      setTimeout(() => setNotice(""), 4500);
      return;
    }

    const res = await approveFfAction(id);
    if ("error" in res) {
      setNotice(`Error: ${res.error}`);
    } else {
      setNotice(
        "Full & Final (F&F) Settlement Approved! Employee status transitioned to Completed Separation."
      );
      setNextStep({ label: "View settlement report", href: "/reports" });
      await loadData();
    }
    setTimeout(() => setNotice(""), 4500);
  };

  const handleSimulateStaleInvalidation = async (id: string) => {
    const res = await triggerStaleFfAction(id);
    if ("error" in res) {
      setNotice(`Error: ${res.error}`);
    } else {
      setNotice(`Leave ledger modification detected! Draft F&F Settlement auto-marked as stale for re-calculation.`);
      await loadData();
    }
    setTimeout(() => setNotice(""), 4500);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        testId="offboarding-header"
        icon={<UserCheck className="w-5 h-5 text-red-600" aria-hidden="true" />}
        title="Separation & Offboarding Lifecycle"
        description="Resignation rescission, notice period recalculation, offboarding clearance board, asset recovery deductions, and settlement workflows."
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
          {nextStep && !notice.startsWith("Error") && (
            <Link
              href={nextStep.href}
              className="ml-2 underline font-bold text-emerald-700 hover:text-emerald-900"
            >
              Next: {nextStep.label} →
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <PageLoading message="Loading offboarding records and clearance boards..." />
      ) : (
        <div className="space-y-6">
          {/* Guided Workflow Stepper (FLW-03) */}
          <Stepper
            steps={OFFBOARDING_STEPS}
            current={offboardingStepIndex(selectedSep)}
            testId="stepper"
            className="bg-surface p-5 rounded-xl border border-line shadow-card"
          />
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Initiate Resignation Form */}
          <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <LogOut className="w-4 h-4 text-red-600" aria-hidden="true" /> Initiate Resignation Workflow
            </h3>

            <form onSubmit={handleResign} className="space-y-3 text-xs">
              <div>
                <label htmlFor="resigEmpSelect" className="block font-semibold text-ink-secondary mb-1">
                  Employee *
                </label>
                <select
                  id="resigEmpSelect"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 bg-white font-medium"
                >
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="resigDateInput" className="block font-semibold text-ink-secondary mb-1">
                  Resignation Submission Date *
                </label>
                <input
                  id="resigDateInput"
                  type="date"
                  required
                  value={resigDate}
                  onChange={(e) => setResigDate(e.target.value)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label htmlFor="noticeDaysInput" className="block font-semibold text-ink-secondary mb-1">
                  Notice Period (Days) *
                </label>
                <input
                  id="noticeDaysInput"
                  type="number"
                  required
                  value={noticeDays}
                  onChange={(e) => setNoticeDays(Number(e.target.value))}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <button
                type="submit"
                data-testid="submit-resignation-btn"
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-xs"
              >
                Submit Resignation
              </button>
            </form>
          </div>

          {/* Separation Clearance & F&F Board */}
          <div className="lg:col-span-2 space-y-6">
            {separations.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="w-8 h-8 text-ink-faint" />}
                title="No active separations"
                description="Resignations and offboarding records will appear here for clearance processing."
              />
            ) : (
              selectedSep && (
                <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="text-base font-bold text-ink">{selectedSep.employee_name}</h3>
                      <p className="text-xs text-ink-muted font-mono">
                        {selectedSep.employee_code} &bull; LWD: {formatDateIndian(selectedSep.last_working_day)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedSep.status === "active" && (
                        <button
                          data-testid="rescind-resignation-btn"
                          onClick={() => handleRescind(selectedSep.id)}
                          className="px-3 py-1 bg-surface-muted hover:bg-primary-100 text-ink text-xs font-semibold rounded-lg transition"
                        >
                          Rescind Resignation
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedSep.is_stale && (
                    <div
                      data-testid="ff-stale-banner"
                      className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-900"
                      role="status"
                      aria-live="polite"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Settlement marked STALE — leave ledger changed after draft. Re-calculate before approving.
                    </div>
                  )}

                  {/* Department Clearance Checklist */}
                  <div data-testid="clearance-matrix" className="space-y-2">
                    <h4 className="text-xs font-bold text-ink">Department Offboarding Clearance Checklist</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["it", "finance", "admin", "hr"] as const).map((dept) => {
                        const isCleared = selectedSep.clearance[dept];
                        const canToggle = can("offboarding.manage") || isHrAdmin;
                        return (
                          <button
                            key={dept}
                            type="button"
                            data-testid={`clearance-${dept}-btn`}
                            onClick={() => canToggle && handleToggleClearance(selectedSep.id, dept)}
                            disabled={!canToggle}
                            className={`p-2.5 rounded-lg border text-left text-xs font-bold transition flex items-center justify-between ${
                              isCleared
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : "bg-surface-muted border-line text-ink-secondary"
                            } ${!canToggle ? "cursor-default opacity-80" : "hover:border-primary-300"}`}
                          >
                            <span className="uppercase">{dept}</span>
                            {isCleared ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-ink-faint" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* F&F Settlement Summary */}
                  <div className="p-4 bg-surface-muted rounded-xl border border-line space-y-2 text-xs">
                    <div className="flex justify-between font-medium text-ink-secondary">
                      <span>Leave Encashment:</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        +{formatCurrencyIndian(selectedSep.encashment_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-ink-secondary">
                      <span>Asset Recovery Deductions:</span>
                      <span className="font-mono text-red-600 font-bold">
                        -{formatCurrencyIndian(selectedSep.asset_recovery_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-ink pt-2 border-t border-line">
                      <span>Net Settlement:</span>
                      <span className="font-mono text-primary-700">
                        {formatCurrencyIndian(selectedSep.net_settlement)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {(can("offboarding.manage") || isHrAdmin) && (
                      <button
                        onClick={() => handleSimulateStaleInvalidation(selectedSep.id)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200 transition"
                      >
                        Simulate Stale Ledger Change
                      </button>
                    )}

                    {can("ff.approve") || isHrAdmin ? (
                      <button
                        data-testid="approve-ff-btn"
                        onClick={() => handleApproveFF(selectedSep.id)}
                        disabled={selectedSep.ff_status === "approved"}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50 shadow-xs"
                      >
                        {selectedSep.ff_status === "approved" ? "F&F Approved" : "Approve Full & Final Settlement"}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-muted font-medium italic flex items-center gap-1.5">
                        <StatusBadge status={selectedSep.ff_status} label={selectedSep.ff_status.toUpperCase()} />
                        (Approval requires HR Admin)
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
