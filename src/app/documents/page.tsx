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
  version: number;
  category_name: string;
}

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
        scan_status: a.scan_status === "clean" || a.scan_status === "pending" || a.scan_status === "flagged" ? a.scan_status : "clean",
        uploaded_at: a.created_at?.replace("T", " ").substring(0, 16) || "",
        version: a.document_version || 1,
        category_name: a.category?.name || "General",
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

    let fileBase64 = "";
    try {
      const buffer = await selectedFile.arrayBuffer();
      fileBase64 = Buffer.from(buffer).toString("base64");
    } catch {
      fileBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.includes(",") ? res.split(",")[1] : res);
        };
        reader.readAsDataURL(selectedFile);
      });
    }

    const res = await uploadAttachmentAction(
      entityType,
      "",
      selectedFile.name,
      selectedFile.size,
      selectedFile.type || "application/pdf",
      "",
      fileBase64
    );

    if ("error" in res && res.error) {
      setError(`Upload Error: ${res.error}`);
      return;
    }

    const uploaded = "attachment" in res && res.attachment ? res.attachment : null;
    const newDoc: AttachmentItem = {
      id: uploaded?.id || Date.now().toString(),
      file_name: selectedFile.name,
      file_size: `${(selectedFile.size / 1024).toFixed(1)} KB`,
      mime_type: selectedFile.type || "application/octet-stream",
      entity_type: entityType,
      scan_status: uploaded?.scan_status || "pending",
      version: 1,
      category_name: "General",
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
            if (key in d) return (d[key as keyof AttachmentItem] ?? "") as string | number;
            return "";
          }}
          renderRow={(d: AttachmentItem) => (
            <tr key={d.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-ink">{d.file_name}</p>
                  <span className="px-1.5 py-0.5 rounded bg-surface-muted text-ink-secondary text-[10px] font-mono font-semibold border border-line">
                    v{d.version}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  <span className="font-medium text-ink-secondary">{d.category_name}</span> • Entity: {d.entity_type}
                </p>
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
