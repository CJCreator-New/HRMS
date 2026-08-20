"use client";

import React, { useState, useEffect } from "react";
import { Paperclip, Upload, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { getAttachmentsAction, uploadAttachmentAction } from "@/lib/actions/attachments";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { useToast } from "@/components/shared/Toast";
import { formatDateIndian } from "@/lib/utils/formatters";

interface AttachmentItem {
  id: string;
  file_name: string;
  file_size: string;
  mime_type: string;
  entity_type: string;
  scan_status: "pending" | "clean" | "flagged";
  uploaded_at: string;
}

const INITIAL_DOCS: AttachmentItem[] = [
  { id: "doc-1", file_name: "uber_receipt_1450.pdf", file_size: "245 KB", mime_type: "application/pdf", entity_type: "reimbursements", scan_status: "clean", uploaded_at: "2026-08-10 14:20" },
  { id: "doc-2", file_name: "medical_certificate.jpg", file_size: "1.2 MB", mime_type: "image/jpeg", entity_type: "leave_requests", scan_status: "clean", uploaded_at: "2026-08-05 09:15" },
  { id: "doc-3", file_name: "suspicious_exec.exe", file_size: "4.5 MB", mime_type: "application/octet-stream", entity_type: "employees", scan_status: "flagged", uploaded_at: "2026-08-01 11:30" },
];

export default function DocumentsPage() {
  const [docs, setDocs] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState("employees");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const loadDocs = async () => {
    setLoading(true);
    const res = await getAttachmentsAction();
    if (res.attachments) {
      const mapped: AttachmentItem[] = res.attachments.map((a: any) => ({
        id: a.id,
        file_name: a.file_name,
        file_size: `${((a.file_size_bytes || 0) / 1024).toFixed(1)} KB`,
        mime_type: a.mime_type || "application/pdf",
        entity_type: a.entity_type,
        scan_status: a.scan_status || "clean",
        uploaded_at: a.created_at?.replace("T", " ").substring(0, 16) || "",
      }));
      setDocs(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File Size Exceeded: Maximum attachment limit is 10MB.");
      return;
    }

    const res = await uploadAttachmentAction(
      entityType,
      "dummy-entity-id",
      selectedFile.name,
      selectedFile.size,
      selectedFile.type || "application/pdf",
      `/attachments/${selectedFile.name}`
    );

    if ("error" in res && res.error) {
      setError(`Upload Error: ${res.error}`);
      return;
    }

    const newDoc: AttachmentItem = {
      id: Date.now().toString(),
      file_name: selectedFile.name,
      file_size: `${(selectedFile.size / 1024).toFixed(1)} KB`,
      mime_type: selectedFile.type || "application/octet-stream",
      entity_type: entityType,
      scan_status: "clean",
      uploaded_at: new Date().toISOString().replace("T", " ").substring(0, 16),
    };

    setDocs([newDoc, ...docs]);
    setSelectedFile(null);
    toast(`Document '${newDoc.file_name}' uploaded successfully!`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<Paperclip className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Document Attachment Manager"
        description="Centralized file attachment pipeline with 10MB limit and automated security verification."
      />

      {error && <ErrorBanner message={error} />}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-2">Attach Document to Entity</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="entityTypeSelect" className="block font-semibold text-ink-secondary mb-1">
              Target Entity *
            </label>
            <select
              id="entityTypeSelect"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface font-medium"
            >
              <option value="employees">Employees</option>
              <option value="leave_requests">Leave Requests</option>
              <option value="reimbursements">Reimbursements</option>
              <option value="offboarding">Offboarding</option>
            </select>
          </div>

          <div>
            <label htmlFor="fileInput" className="block font-semibold text-ink-secondary mb-1">
              Select File (Max 10MB) *
            </label>
            <input
              id="fileInput"
              type="file"
              required
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-xs text-ink-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 font-semibold"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-primary-600 text-white font-semibold text-xs rounded-lg hover:bg-primary-700 transition flex items-center gap-2 shadow-xs"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </form>

      {/* Attachments Register — shared DataTable (client-mode pagination/sort) */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
          Document Attachments Register & Verification Status
        </h3>

        <DataTable
          name="documents"
          columns={[
            { key: "file_name", header: "File Name & Entity" },
            { key: "file_size", header: "Size & MIME" },
            { key: "scan_status", header: "Scan Status" },
            { key: "uploaded_at", header: "Uploaded At", headerClassName: "text-right" },
          ]}
          rows={docs}
          getSortValue={(d: AttachmentItem, key) => {
            if (key === "uploaded_at") return d.uploaded_at;
            if (key === "scan_status") return d.scan_status;
            if (key === "file_size") return d.file_size;
            return (d as any)[key];
          }}
          renderRow={(d: AttachmentItem) => (
            <tr key={d.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{d.file_name}</p>
                <p className="text-[11px] text-ink-muted">Entity: {d.entity_type}</p>
              </td>
              <td className="px-4 py-3 font-mono text-ink-secondary">
                {d.file_size}
                <p className="text-[10px] text-ink-muted">{d.mime_type}</p>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  {d.scan_status === "clean" ? (
                    <ShieldCheck className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  ) : d.scan_status === "flagged" ? (
                    <ShieldAlert className="w-3 h-3 text-red-600" aria-hidden="true" />
                  ) : (
                    <Clock className="w-3 h-3 text-amber-600 animate-spin" aria-hidden="true" />
                  )}
                  <StatusBadge
                    status={d.scan_status}
                    label={
                      d.scan_status === "clean"
                        ? "Verified Clean"
                        : d.scan_status === "flagged"
                        ? "Flagged Security Concern"
                        : "Pending Scan"
                    }
                  />
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-ink-muted text-right">
                {formatDateIndian(d.uploaded_at, true)}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
