"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Drawer } from "@/components/shared/Drawer";
import { TemplateDownload } from "./TemplateDownload";
import type {
  BatchSchemaDefinition,
  BatchValidationReport,
  BatchCommitResult,
  BatchRowResult,
} from "@/lib/batch-import/types";
import { parseAndValidateBatchFile } from "@/lib/batch-import/parser";

interface BatchUploadDrawerProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  schema: BatchSchemaDefinition<T>;
  onCommit: (validRows: T[]) => Promise<any>;
  onSuccess?: (result: BatchCommitResult<T>) => void | Promise<void>;
  title?: string;
  description?: string;
}

export function BatchUploadDrawer<T = any>({
  isOpen,
  onClose,
  schema,
  onCommit,
  onSuccess,
  title,
  description,
}: BatchUploadDrawerProps<T>) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<BatchValidationReport<T> | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<BatchCommitResult<T> | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setReport(null);
    setIsParsing(false);
    setIsCommitting(false);
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileProcess = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setCommitResult(null);

    try {
      let buffer: ArrayBuffer;
      if (selectedFile.name.endsWith(".csv")) {
        const text = await selectedFile.text();
        const rep = await parseAndValidateBatchFile<T>(text, schema);
        setReport(rep);
      } else {
        buffer = await selectedFile.arrayBuffer();
        const rep = await parseAndValidateBatchFile<T>(buffer, schema);
        setReport(rep);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid format";
      setReport({
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        rows: [],
        isValid: false,
        errors: [`Failed to parse file: ${message}`],
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCommit = async () => {
    if (!report || report.validCount === 0) return;
    setIsCommitting(true);

    const validRows = report.rows.filter((r) => r.status === "valid").map((r) => r.data);

    try {
      const res = await onCommit(validRows);

      // Handle both BatchCommitResult and action response shapes ({ success, imported, skipped, errors })
      const normalizedResult: BatchCommitResult<T> = {
        success: res.success !== false && !res.error,
        total: res.total ?? validRows.length,
        successCount: res.successCount ?? res.imported ?? (res.success !== false ? validRows.length : 0),
        errorCount: res.errorCount ?? res.skipped ?? (res.error ? validRows.length : 0),
        errors: res.errors ?? (res.error ? [res.error] : []),
        rowResults: res.rowResults,
      };

      setCommitResult(normalizedResult);
      if (normalizedResult.success && onSuccess) {
        onSuccess(normalizedResult);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred during commit.";
      setCommitResult({
        success: false,
        total: validRows.length,
        successCount: 0,
        errorCount: validRows.length,
        errors: [message],
      });
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={title || `Batch Upload: ${schema.displayName}`}
      width="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Description & Template Download Toolbar */}
        <div className="bg-surface-muted/60 p-4 rounded-xl border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-secondary">
              {description || schema.description || "Upload a spreadsheet or CSV to bulk import records."}
            </p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Supported formats: <span className="font-mono font-semibold text-ink">.xlsx, .xls, .csv</span> (Max {schema.maxRows || 500} rows)
            </p>
          </div>
          <TemplateDownload schema={schema} />
        </div>

        {/* Step 1: File Dropzone */}
        {!commitResult && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
              dragActive
                ? "border-primary-500 bg-primary-50/50"
                : "border-line-strong bg-surface hover:border-primary-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <p className="text-xs font-semibold text-ink">
              {file ? file.name : "Choose a file or drag and drop here"}
            </p>
            <p className="text-[11px] text-ink-muted mt-1">
              Click to browse or drop an Excel (.xlsx) or CSV file
            </p>
          </div>
        )}

        {/* Parsing Loader */}
        {isParsing && (
          <div className="p-6 text-center text-xs text-ink-secondary bg-surface rounded-xl border border-line space-y-2">
            <RefreshCw className="w-5 h-5 text-primary-600 animate-spin mx-auto" />
            <p className="font-semibold">Parsing spreadsheet and validating rows...</p>
          </div>
        )}

        {/* Step 2: Validation Report & Preview */}
        {report && !isParsing && !commitResult && (
          <div className="space-y-4">
            {/* Global Errors */}
            {report.errors && report.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Validation Issues Found:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  {report.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Summary Metrics */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                Row Validation Preview
              </h4>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-0.5 bg-surface-muted text-ink-secondary rounded border border-line">
                  Total: {report.totalRows}
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid: {report.validCount}
                </span>
                {report.invalidCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded border border-red-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Invalid: {report.invalidCount}
                  </span>
                )}
              </div>
            </div>

            {/* Row-Level Table */}
            <div className="overflow-x-auto max-h-72 rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted/70 border-b border-line font-bold uppercase text-ink-secondary text-[11px] sticky top-0">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Status</th>
                    {schema.columns.slice(0, 3).map((c) => (
                      <th key={c.key} className="px-3 py-2">{c.label}</th>
                    ))}
                    <th className="px-3 py-2">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.rows.map((r: BatchRowResult<T>) => (
                    <tr
                      key={r.rowNumber}
                      className={r.status === "invalid" ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-surface-muted/40"}
                    >
                      <td className="px-3 py-2 font-semibold text-ink-secondary font-mono">
                        #{r.rowNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === "valid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {r.status === "valid" ? (
                            <><CheckCircle2 className="w-3 h-3" /> Valid</>
                          ) : (
                            <><AlertCircle className="w-3 h-3" /> Invalid</>
                          )}
                        </span>
                      </td>
                      {schema.columns.slice(0, 3).map((c) => (
                        <td key={c.key} className="px-3 py-2 font-mono text-ink">
                          {String(r.data[c.key as keyof T] ?? r.raw[c.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {r.errors.length > 0 ? (
                          <div className="space-y-0.5">
                            {r.errors.map((err, errIdx) => (
                              <p key={errIdx} className="text-[11px] font-semibold text-red-600">
                                &bull; {err}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium">Ready to commit</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <button
                type="button"
                onClick={resetState}
                className="px-3 py-2 text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-surface-muted rounded-lg transition"
              >
                Clear & Pick Another
              </button>

              <button
                type="button"
                onClick={handleCommit}
                disabled={report.validCount === 0 || isCommitting}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50 shadow-xs"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Committing {report.validCount} Records...
                  </>
                ) : (
                  <>
                    Confirm & Commit {report.validCount} {report.validCount === 1 ? "Row" : "Rows"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Final Commit Execution Result */}
        {commitResult && (
          <div className="space-y-5 bg-surface p-5 rounded-xl border border-line shadow-card">
            <div className="flex items-center gap-3">
              {commitResult.success ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-ink">
                  {commitResult.success
                    ? "Batch Import Completed"
                    : "Batch Import Completed with Issues"}
                </h4>
                <p className="text-xs text-ink-secondary">
                  Processed {commitResult.total} records. Audit log entry recorded.
                </p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-surface-muted rounded-lg border border-line">
                <p className="text-[10px] uppercase font-bold text-ink-muted">Total</p>
                <p className="text-base font-bold text-ink font-mono mt-0.5">{commitResult.total}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-[10px] uppercase font-bold text-emerald-800">Success</p>
                <p className="text-base font-bold text-emerald-700 font-mono mt-0.5">{commitResult.successCount}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-[10px] uppercase font-bold text-red-800">Errors</p>
                <p className="text-base font-bold text-red-700 font-mono mt-0.5">{commitResult.errorCount}</p>
              </div>
            </div>

            {/* Error list if any */}
            {commitResult.errors && commitResult.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
                <p className="font-bold text-red-900">Execution Error Messages:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  {commitResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={resetState}
                className="px-4 py-2 text-xs font-semibold bg-surface-muted hover:bg-surface border border-line text-ink rounded-lg transition"
              >
                Upload Another File
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
