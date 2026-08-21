"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import type { BatchSchemaDefinition } from "@/lib/batch-import/types";
import { downloadTemplateFile } from "@/lib/batch-import/template";

interface TemplateDownloadProps {
  schema: BatchSchemaDefinition<any>;
  variant?: "button" | "dropdown" | "compact";
  className?: string;
}

export function TemplateDownload({
  schema,
  variant = "dropdown",
  className = "",
}: TemplateDownloadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = (format: "csv" | "xlsx") => {
    downloadTemplateFile(schema, format);
    setIsOpen(false);
  };

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 text-xs ${className}`}>
        <span className="text-ink-secondary">Template:</span>
        <button
          type="button"
          onClick={() => handleDownload("xlsx")}
          className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700 hover:underline"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> .xlsx
        </button>
        <span className="text-ink-faint">|</span>
        <button
          type="button"
          onClick={() => handleDownload("csv")}
          className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700 hover:underline"
        >
          <FileText className="w-3.5 h-3.5" /> .csv
        </button>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-surface hover:bg-surface-muted border border-line text-ink text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Download className="w-3.5 h-3.5 text-primary-600" />
        <span>Download Template</span>
        <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-surface rounded-lg border border-line shadow-card z-50 py-1 text-xs">
          <button
            type="button"
            onClick={() => handleDownload("xlsx")}
            className="w-full px-3 py-2 text-left hover:bg-surface-muted flex items-center gap-2 text-ink"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="font-semibold">Excel Template (.xlsx)</p>
              <p className="text-[10px] text-ink-muted">With instructions sheet</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleDownload("csv")}
            className="w-full px-3 py-2 text-left hover:bg-surface-muted flex items-center gap-2 text-ink border-t border-line"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <div>
              <p className="font-semibold">CSV Template (.csv)</p>
              <p className="text-[10px] text-ink-muted">Plain comma-delimited</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
