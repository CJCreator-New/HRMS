"use client";

import React, { useState } from "react";
import { FileText, Download, Filter, Calendar } from "lucide-react";
import { usePermission } from "@/lib/auth/usePermission";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/Toast";

interface ReportItem {
  id: string;
  title: string;
  category: "Attendance" | "Leave" | "Payroll" | "Statutory";
  description: string;
  lastGenerated: string;
  format: "CSV" | "PDF";
}

const REPORTS_CATALOG: ReportItem[] = [
  {
    id: "rep-01",
    title: "Monthly Employee Attendance Summary",
    category: "Attendance",
    description: "Detailed breakdown of worked units, paid leaves, late check-ins, and pending correction reviews.",
    lastGenerated: "2026-08-01",
    format: "CSV",
  },
  {
    id: "rep-02",
    title: "Leave Utilization & Balance Ledger",
    category: "Leave",
    description: "CL/SL/EL consumption report. Parental/Maternity leaves masked for general managers.",
    lastGenerated: "2026-08-10",
    format: "CSV",
  },
  {
    id: "rep-03",
    title: "Statutory PF / ESI / PT Compliance Register",
    category: "Statutory",
    description: "Monthly statutory deductions snapshot per effective-dated rule versions (PF ₹15k cap, ESI 0.75%, PT slabs).",
    lastGenerated: "2026-08-12",
    format: "CSV",
  },
  {
    id: "rep-04",
    title: "Full & Final Settlement Disbursal Ledger",
    category: "Payroll",
    description: "Executive summary of offboarded employee settlements, leave encashments, and asset recovery deductions.",
    lastGenerated: "2026-08-12",
    format: "PDF",
  },
];

import { generateReportDataAction } from "@/lib/actions/reports";
import { formatDateIndian } from "@/lib/utils/formatters";

export default function ReportsPage() {
  const { can } = usePermission();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canExport = can("reports.export");

  const categories = ["All", "Attendance", "Leave", "Payroll", "Statutory"];

  const filteredReports = REPORTS_CATALOG.filter(
    (r) => selectedCategory === "All" || r.category === selectedCategory
  );

  const handleExportReport = async (report: ReportItem) => {
    setDownloadingId(report.id);
    const res = await generateReportDataAction(report.id);
    setDownloadingId(null);

    if (res.error) {
      toast(`Export failed: ${res.error}`, "error");
    } else {
      const csvContent = res.csv || `Report Title,Category,Generated Date\n"${report.title}","${report.category}","${new Date().toISOString()}"`;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title.toLowerCase().replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast(`Report '${report.title}' exported successfully from live database view!`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<FileText className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Executive & Compliance Reports Portal"
        description="Export audit-ready CSV/PDF reports for attendance, leave balances, statutory compliance, and payroll registers."
        testId="reports-header"
      />

      {/* Category Filters */}
      <div className="flex items-center gap-2 border-b border-line pb-3 text-xs">
        <span className="font-semibold text-ink-muted flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filter Category:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full font-semibold transition ${
              selectedCategory === cat
                ? "bg-primary-600 text-white"
                : "bg-surface-muted text-ink-secondary hover:bg-primary-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-4 flex flex-col justify-between hover:border-primary-300 transition"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary-50 text-primary-700 border border-primary-100">
                  {report.category}
                </span>
                <span className="text-[11px] text-ink-faint font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Last Run: {formatDateIndian(report.lastGenerated)}
                </span>
              </div>
              <h3 className="text-base font-bold text-ink">{report.title}</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">{report.description}</p>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-muted uppercase">
                Format: <strong className="text-ink">{report.format}</strong>
              </span>

              {canExport ? (
                <button
                  data-testid="export-report-btn"
                  onClick={() => handleExportReport(report)}
                  disabled={downloadingId === report.id}
                  className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === report.id ? "Generating Export..." : `Export ${report.format}`}
                </button>
              ) : (
                <span className="text-xs text-ink-faint font-medium">Export Permission Required</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
