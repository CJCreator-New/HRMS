"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calculator,
  ShieldCheck,
  Building2,
  FileCheck2,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  submitInvestmentDeclarationAction,
  getEmployeeDeclarationsAction,
  type InvestmentDeclarationRecord,
} from "@/lib/actions/declarations";
import { useToast } from "@/components/shared/Toast";
import { formatCurrencyIndian } from "@/lib/utils/formatters";

export default function InvestmentDeclarationsPage() {
  const { showToast } = useToast();
  const [declarations, setDeclarations] = useState<InvestmentDeclarationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form fields
  const [financialYear, setFinancialYear] = useState("2025-2026");
  const [sec80C, setSec80C] = useState<number>(0);
  const [sec80D, setSec80D] = useState<number>(0);
  const [sec80G, setSec80G] = useState<number>(0);
  const [otherExempt, setOtherExempt] = useState<number>(0);
  const [hraRent, setHraRent] = useState<number>(0);

  const totalDeductions = Math.min(sec80C, 150000) + Math.min(sec80D, 100000) + sec80G + otherExempt;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getEmployeeDeclarationsAction();
      if (res.success && res.declarations) {
        setDeclarations(res.declarations);
        const current = res.declarations.find((d) => d.financial_year === "2025-2026");
        if (current) {
          setSec80C(Number(current.section_80c_amount) || 0);
          setSec80D(Number(current.section_80d_amount) || 0);
          setSec80G(Number(current.section_80g_amount) || 0);
          setOtherExempt(Number(current.other_exemptions_amount) || 0);
          setHraRent(Number(current.hra_annual_rent) || 0);
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await submitInvestmentDeclarationAction({
        financialYear,
        section80C: sec80C,
        section80D: sec80D,
        section80G: sec80G,
        otherExemptions: otherExempt,
        hraAnnualRent: hraRent,
      });

      if (res.success && res.data) {
        showToast("Investment declaration submitted successfully!", "success");
        setDeclarations((prev) => [
          res.data!,
          ...prev.filter((d) => d.id !== res.data!.id),
        ]);
      } else {
        setErrorMessage(res.error || "Failed to submit declaration.");
        showToast(res.error || "Submission failed", "error");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tax Investment Declarations</h1>
        <p className="text-sm text-ink-secondary">
          Submit income tax investment declarations under Chapter VI-A for TDS optimization.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-line p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-50 text-primary-600">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase">Total Chapter VI-A</p>
              <p className="text-xl font-bold text-ink">{formatCurrencyIndian(totalDeductions)}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-line p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase">Declared Annual Rent</p>
              <p className="text-xl font-bold text-ink">{formatCurrencyIndian(hraRent)}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-line p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase">Financial Year</p>
              <p className="text-xl font-bold text-ink">FY {financialYear}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Declaration Form */}
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            Investment Particulars (FY {financialYear})
          </h2>
          <div className="flex items-center gap-2">
            <label htmlFor="fySelect" className="text-xs font-semibold text-ink-secondary uppercase">
              Financial Year:
            </label>
            <select
              id="fySelect"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 border border-line rounded-lg bg-surface text-ink"
            >
              <option value="2025-2026">2025 - 2026</option>
              <option value="2024-2025">2024 - 2025</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          {/* Section 80C */}
          <div className="p-4 rounded-xl border border-line bg-surface-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="sec80c" className="font-semibold text-ink">
                Section 80C (PPF, ELSS, EPF, LIC, Tuition)
              </label>
              <span className="text-[11px] text-ink-muted font-mono">Max ₹1,50,000</span>
            </div>
            <input
              id="sec80c"
              type="number"
              min="0"
              value={sec80C}
              onChange={(e) => setSec80C(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
            <p className="text-[11px] text-ink-muted">
              Applicable deduction: {formatCurrencyIndian(Math.min(sec80C, 150000))}
            </p>
          </div>

          {/* Section 80D */}
          <div className="p-4 rounded-xl border border-line bg-surface-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="sec80d" className="font-semibold text-ink">
                Section 80D (Health Insurance Premium)
              </label>
              <span className="text-[11px] text-ink-muted font-mono">Max ₹1,00,000</span>
            </div>
            <input
              id="sec80d"
              type="number"
              min="0"
              value={sec80D}
              onChange={(e) => setSec80D(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
            <p className="text-[11px] text-ink-muted">
              Applicable deduction: {formatCurrencyIndian(Math.min(sec80D, 100000))}
            </p>
          </div>

          {/* Section 80G */}
          <div className="p-4 rounded-xl border border-line bg-surface-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="sec80g" className="font-semibold text-ink">
                Section 80G (Eligible Charitable Donations)
              </label>
            </div>
            <input
              id="sec80g"
              type="number"
              min="0"
              value={sec80G}
              onChange={(e) => setSec80G(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          {/* Other Exemptions */}
          <div className="p-4 rounded-xl border border-line bg-surface-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="otherExempt" className="font-semibold text-ink">
                Section 24 (Home Loan Interest) & Others
              </label>
              <span className="text-[11px] text-ink-muted font-mono">Max ₹2,00,000</span>
            </div>
            <input
              id="otherExempt"
              type="number"
              min="0"
              value={otherExempt}
              onChange={(e) => setOtherExempt(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          {/* HRA Rent */}
          <div className="p-4 rounded-xl border border-line bg-surface-muted/30 space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label htmlFor="hraRent" className="font-semibold text-ink">
                House Rent Allowance (Annual Rent Paid to Landlord)
              </label>
            </div>
            <input
              id="hraRent"
              type="number"
              min="0"
              value={hraRent}
              onChange={(e) => setHraRent(Number(e.target.value) || 0)}
              placeholder="Total annual rent (₹)"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
            <p className="text-[11px] text-ink-muted">
              Required for Section 10(13A) HRA exemption computation. Rent receipts required if annual rent exceeds ₹1,00,000.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-line">
          <p className="text-xs text-ink-muted">
            Declarations will be verified by Payroll before final TDS calculation.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Submit Declaration
              </>
            )}
          </button>
        </div>
      </form>

      {/* Historical Declarations Table */}
      <div className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-ink">Submission History</h2>
        {declarations.length === 0 ? (
          <p className="text-xs text-ink-muted text-center py-4">No past declarations found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line text-ink-muted uppercase">
                  <th className="py-2.5 px-3">FY</th>
                  <th className="py-2.5 px-3">Sec 80C</th>
                  <th className="py-2.5 px-3">Sec 80D</th>
                  <th className="py-2.5 px-3">Annual Rent</th>
                  <th className="py-2.5 px-3">Total Declared</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {declarations.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-muted/40">
                    <td className="py-2.5 px-3 font-semibold text-ink">{d.financial_year}</td>
                    <td className="py-2.5 px-3 font-mono">{formatCurrencyIndian(d.section_80c_amount)}</td>
                    <td className="py-2.5 px-3 font-mono">{formatCurrencyIndian(d.section_80d_amount)}</td>
                    <td className="py-2.5 px-3 font-mono">{formatCurrencyIndian(d.hra_annual_rent)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-ink">{formatCurrencyIndian(d.total_declared_amount)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          d.status === "verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-ink-muted">
                      {d.submitted_at ? new Date(d.submitted_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
