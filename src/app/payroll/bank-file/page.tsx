"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Landmark,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
} from "lucide-react";
import {
  generateBankDisbursementFileAction,
  getPayrollPeriodsAction,
  type BankDisbursementFileResult,
} from "@/lib/actions/payroll";
import { useToast } from "@/components/shared/Toast";
import { formatCurrencyIndian } from "@/lib/utils/formatters";

interface PayrollPeriodOption {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function BankDisbursementPage() {
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PayrollPeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [format, setFormat] = useState<"generic_csv" | "sbi">("generic_csv");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BankDisbursementFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPeriods() {
      setLoading(true);
      try {
        const res = await getPayrollPeriodsAction();
        if (res?.periods && res.periods.length > 0) {
          setPeriods(res.periods);
          setSelectedPeriodId(res.periods[0].id);
        }
      } catch {
        setError("Failed to load payroll periods.");
      }
      setLoading(false);
    }
    loadPeriods();
  }, []);

  const handleGenerate = async () => {
    if (!selectedPeriodId) return;
    setError(null);
    setResult(null);

    startTransition(async () => {
      const res = await generateBankDisbursementFileAction(selectedPeriodId, format);
      if (res.success) {
        setResult(res);
        showToast("Bank disbursement file generated!", "success");
      } else {
        setError(res.error || "Failed to generate bank file.");
        showToast(res.error || "Generation failed", "error");
      }
    });
  };

  const handleDownload = () => {
    if (!result?.fileContent || !result.fileName) return;

    const blob = new Blob([result.fileContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", result.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Download initiated", "info");
  };

  const copyChecksum = () => {
    if (result?.checksumSha256) {
      navigator.clipboard.writeText(result.checksumSha256);
      showToast("Checksum copied to clipboard!", "success");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Bank Disbursement File Generator</h1>
        <p className="text-sm text-ink-secondary">
          Generate corporate salary payment files for automated bank disbursement (NEFT/RTGS/SBI Bulk).
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration Card */}
      <div className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-6">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2 border-b border-line pb-3">
          <Landmark className="w-5 h-5 text-primary-600" />
          Disbursement Batch Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="periodSelect" className="block text-xs font-semibold text-ink uppercase mb-1">
              Select Payroll Period
            </label>
            <select
              id="periodSelect"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_name || `${p.start_date} to ${p.end_date}`} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="formatSelect" className="block text-xs font-semibold text-ink uppercase mb-1">
              Bank File Format
            </label>
            <select
              id="formatSelect"
              value={format}
              onChange={(e) => setFormat(e.target.value as "generic_csv" | "sbi")}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              <option value="generic_csv">Generic Bank CSV (NEFT / RTGS Standard)</option>
              <option value="sbi">State Bank of India (SBI Bulk Upload)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            onClick={handleGenerate}
            disabled={isPending || !selectedPeriodId}
            className="px-6 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating File...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" /> Generate Disbursement File
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generation Result & Download Card */}
      {result && (
        <div className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="text-base font-semibold text-ink">Batch Summary Ready for Download</h2>
            </div>
            <button
              onClick={handleDownload}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" /> Download {result.fileName}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-surface-muted border border-line">
              <p className="text-xs text-ink-muted uppercase font-semibold">Total Beneficiaries</p>
              <p className="text-xl font-bold text-ink mt-1">{result.totalRecords}</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-muted border border-line">
              <p className="text-xs text-ink-muted uppercase font-semibold">Total Disbursement</p>
              <p className="text-xl font-bold text-ink mt-1">
                {formatCurrencyIndian(result.totalAmount || 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-muted border border-line">
              <p className="text-xs text-ink-muted uppercase font-semibold">Output Filename</p>
              <p className="text-xs font-mono text-ink mt-2 truncate">{result.fileName}</p>
            </div>
          </div>

          {/* Cryptographic SHA-256 Integrity Verification */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                SHA-256 Batch Verification Hash
              </div>
              <button
                onClick={copyChecksum}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
            <p className="text-[11px] font-mono text-indigo-950 break-all bg-surface/70 p-2 rounded border border-indigo-200">
              {result.checksumSha256}
            </p>
            <p className="text-[11px] text-indigo-700">
              Provide this cryptographic checksum to your corporate bank portal for upload tamper verification.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
