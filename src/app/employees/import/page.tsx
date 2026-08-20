"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Upload, ArrowLeft, Users, ShieldCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { importEmployeesAction } from "@/lib/actions/employees";
import { PageHeader } from "@/components/shared/PageHeader";
import { TemplateDownload } from "@/components/shared/batch-import/TemplateDownload";
import { BatchUploadDrawer } from "@/components/shared/batch-import/BatchUploadDrawer";
import { EmployeeImportBatchSchema } from "@/lib/batch-import/schemas";
import { useToast } from "@/components/shared/Toast";

export default function BulkEmployeeImportPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastBatchSummary, setLastBatchSummary] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const { toast } = useToast();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Directory
        </Link>
      </div>

      <PageHeader
        icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" aria-hidden="true" />}
        title="Bulk Employee Import (.xlsx / .csv)"
        description="Provision new employee accounts and profiles in batch with automatic temporary credentials, invited status, and validation error reporting."
        actions={
          <div className="flex items-center gap-2">
            <TemplateDownload schema={EmployeeImportBatchSchema} />
            <button
              onClick={() => setDrawerOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4" /> Upload Employee Batch
            </button>
          </div>
        }
      />

      {/* Overview & Guidelines Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-line shadow-card space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs">
            <Users className="w-4 h-4" /> Account Provisioning
          </div>
          <p className="text-xs text-ink-secondary">
            Creates auth credentials and sets status to <span className="font-semibold text-ink">invited</span> with mandatory first-time password reset.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line shadow-card space-y-2">
          <div className="flex items-center gap-2 text-primary-600 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4" /> Two-Step Verification
          </div>
          <p className="text-xs text-ink-secondary">
            Pre-flight parser checks required fields, email syntax, unique codes, and date formats before any data is committed.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line shadow-card space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs">
            <FileSpreadsheet className="w-4 h-4" /> Dual File Format
          </div>
          <p className="text-xs text-ink-secondary">
            Supports both modern <span className="font-mono font-bold text-ink">.xlsx</span> (with embedded instruction guides) and raw <span className="font-mono font-bold text-ink">.csv</span> files.
          </p>
        </div>
      </div>

      {/* Main Upload Trigger Card */}
      <div className="bg-surface p-8 rounded-xl border border-line shadow-card text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
          <Upload className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-bold text-ink">Ready to import employee data?</h3>
          <p className="text-xs text-ink-secondary">
            Download the official template, fill in your employee records, and open the batch upload drawer to preview and validate your rows.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <TemplateDownload schema={EmployeeImportBatchSchema} />
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-xs"
          >
            <Upload className="w-4 h-4" /> Open Batch Upload Drawer
          </button>
        </div>
      </div>

      {/* Batch Result Summary if available */}
      {lastBatchSummary && (
        <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-2">
          <h4 className="text-xs font-bold uppercase text-ink-secondary tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Recent Batch Import Summary
          </h4>
          <div className="flex items-center gap-3 text-xs font-semibold pt-1">
            <span className="px-2.5 py-1 bg-surface-muted text-ink-secondary rounded border border-line">
              Total Processed: {lastBatchSummary.total}
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
              Successfully Imported: {lastBatchSummary.success}
            </span>
            {lastBatchSummary.failed > 0 && (
              <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded border border-red-200">
                Failed / Skipped: {lastBatchSummary.failed}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Shared Batch Upload Drawer */}
      <BatchUploadDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        schema={EmployeeImportBatchSchema}
        onCommit={importEmployeesAction}
        onSuccess={async (res) => {
          setLastBatchSummary({
            total: res.total,
            success: res.successCount,
            failed: res.errorCount,
          });
          toast(`Successfully imported ${res.successCount} employee record(s).`);
        }}
      />
    </div>
  );
}
