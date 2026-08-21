"use client";

import React, { useState, useEffect } from "react";
import { Shield, Search, Lock, Loader2 } from "lucide-react";
import { getAuditLogsAction } from "@/lib/actions/audit";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { DataTable } from "@/components/shared/DataTable";
import { formatDateIndian } from "@/lib/utils/formatters";

interface AuditLogEntry {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  correlation_id: string;
  ip_address: string;
  created_at: string;
}

const INITIAL_LOGS: AuditLogEntry[] = [
  { id: "log-1", actor_name: "Admin User (HR Admin)", action: "CREATE", entity_type: "employees", entity_id: "EMP-101", correlation_id: "corr_9081234", ip_address: "127.0.0.1", created_at: "2026-08-12 18:01:05" },
  { id: "log-2", actor_name: "Admin User (HR Admin)", action: "UPDATE_SALARY_VERSION", entity_type: "salary_structures", entity_id: "v2", correlation_id: "corr_9081235", ip_address: "127.0.0.1", created_at: "2026-08-12 18:05:22" },
  { id: "log-3", actor_name: "Priya Sharma", action: "PUNCH_CHECK_IN", entity_type: "attendance_records", entity_id: "att_4401", correlation_id: "corr_9081236", ip_address: "192.168.1.45", created_at: "2026-08-12 09:05:00" },
  { id: "log-4", actor_name: "System Worker", action: "AUTO_ALLOCATE_HOLIDAYS", entity_type: "optional_holidays", entity_id: "opt_set_2026", correlation_id: "corr_9081237", ip_address: "localhost", created_at: "2026-08-12 00:00:01" },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const loadLogs = async (q?: string) => {
    setLoading(true);
    const res = await getAuditLogsAction({ search: q, limit: 100 });
    const mapped: AuditLogEntry[] = (res.logs || []).map((l) => ({
      id: l.id,
      actor_name: l.actor_name || "System",
      action: l.action,
      entity_type: l.entity_type,
      entity_id: l.entity_id || "",
      correlation_id: l.correlation_id || "",
      ip_address: typeof (l.metadata as { ip?: string } | null)?.ip === "string" ? (l.metadata as { ip: string }).ip : "—",
      created_at: l.created_at || "",
    }));
    setLogs(mapped);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = logs; // Filtering is done server-side via getAuditLogsAction

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<Shield className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        title="Immutable System Audit Log Viewer (`audit_logs`)"
        description="System-wide append-only audit trail capturing actor, action, entity IDs, correlation IDs, and IP addresses."
        actions={
          <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full flex items-center gap-1">
            <Lock className="w-3 h-3 text-indigo-600" aria-hidden="true" /> Append-Only Immutable
          </span>
        }
      />

      {/* Search Toolbar */}
      <div className="bg-surface p-4 rounded-xl border border-line shadow-card flex items-center gap-3">
        <Search className="w-4 h-4 text-ink-faint" />
        <input
          type="text"
          placeholder="Filter audit logs by actor, action, entity, or correlation ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => loadLogs(e.target.value), 350);
          }}
          className="w-full text-xs border-0 focus:outline-none text-ink"
        />
        {loading && <Loader2 className="w-4 h-4 text-ink-faint animate-spin shrink-0" />}
      </div>

      {/* Audit Log Table — shared DataTable (client-mode pagination/sort) */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        {loading ? (
          <PageLoading message="Loading audit logs…" />
        ) : (
        <DataTable
          name="audit"
          columns={[
            { key: "created_at", header: "Timestamp" },
            { key: "actor_name", header: "Actor" },
            { key: "action", header: "Action" },
            { key: "entity_type", header: "Entity Target" },
            { key: "correlation_id", header: "Correlation ID" },
            { key: "ip_address", header: "IP Address", headerClassName: "text-right" },
          ]}
          rows={filteredLogs}
          getSortValue={(l: AuditLogEntry, key) => {
            if (key in l) return (l[key as keyof AuditLogEntry] ?? "") as string;
            return "";
          }}
          renderRow={(l: AuditLogEntry) => (
            <tr key={l.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3 text-ink-muted text-[11px]">{formatDateIndian(l.created_at, true)}</td>
              <td className="px-4 py-3 font-sans font-bold text-ink">{l.actor_name}</td>
              <td className="px-4 py-3 text-indigo-700 font-bold">{l.action}</td>
              <td className="px-4 py-3 text-ink-secondary">
                {l.entity_type} <span className="text-ink-faint">({l.entity_id})</span>
              </td>
              <td className="px-4 py-3 text-ink-muted text-[11px]">{l.correlation_id}</td>
              <td className="px-4 py-3 text-ink-muted text-right">{l.ip_address}</td>
            </tr>
          )}
        />
        )}
      </div>
    </div>
  );
}
