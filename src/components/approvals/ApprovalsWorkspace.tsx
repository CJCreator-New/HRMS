"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Eye,
  Loader2,
} from "lucide-react";
import {
  getUnifiedApprovalsAction,
  decideApprovalAction,
  getApprovalDetailAction,
  type ApprovalDetailField,
} from "@/lib/actions/approvals";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { Drawer } from "@/components/shared/Drawer";
import { useServerTable } from "@/lib/hooks/useServerTable";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useToast } from "@/components/shared/Toast";
import { useRole } from "@/lib/roleContext";
import { usePermission } from "@/lib/auth/usePermission";
import { formatDateIndian } from "@/lib/utils/formatters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApprovalItem {
  id: string;
  module: "leave" | "attendance" | "reimbursement" | "encashment" | "offboarding" | "permissions" | "compoff";
  employee_name: string;
  employee_code: string;
  title: string;
  sub_details: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ApprovalsWorkspaceProps {
  /** Pre-fetched on the server so the first paint already has data. */
  initialItems: ApprovalItem[];
  initialTotal: number;
  initialPendingCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODULE_PERM_MAP: Record<string, string[]> = {
  leave: ["leave.approve.manager", "leave.approve.hr"],
  attendance: ["attendance.correct.approve", "attendance.correct.override"],
  reimbursement: ["reimbursement.approve"],
  encashment: ["leave.encash.approve"],
  offboarding: ["ff.approve"],
  permissions: ["permission.approve", "leave.approve.manager", "leave.approve.hr"],
  compoff: ["compoff.approve", "leave.approve.manager", "leave.approve.hr"],
};

const MODULE_BADGE_CLASSES: Record<string, string> = {
  leave: "bg-primary-50 text-primary-700 border-primary-200",
  attendance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reimbursement: "bg-amber-50 text-amber-700 border-amber-200",
  encashment: "bg-violet-50 text-violet-700 border-violet-200",
  offboarding: "bg-red-50 text-red-700 border-red-200",
  permissions: "bg-cyan-50 text-cyan-700 border-cyan-200",
  compoff: "bg-orange-50 text-orange-700 border-orange-200",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ApprovalsWorkspace({
  initialItems,
  initialTotal,
  initialPendingCount,
}: ApprovalsWorkspaceProps) {
  const { canAny } = usePermission();
  const { activeRole } = useRole();
  const isHrFocus = activeRole === "hr" || activeRole === "system_admin";
  const { toast } = useToast();

  /* ----- State ----- */
  const [items, setItems] = useState<ApprovalItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);

  /* Batch selection */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  /* Detail drawer */
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null);
  const [detailFields, setDetailFields] = useState<ApprovalDetailField[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const { page, pageSize, sortColumn, sortDir, total, setPage, setPageSize, setSort, setTotal } =
    useServerTable();

  const canApproveAny = canAny([
    "leave.approve.manager",
    "leave.approve.hr",
    "attendance.correct.approve",
    "reimbursement.approve",
    "leave.encash.approve",
    "ff.approve",
    "permission.approve",
    "compoff.approve",
  ]);

  const canApproveItem = (item: ApprovalItem) => {
    const requiredPerms = MODULE_PERM_MAP[item.module] || [];
    return canAny(requiredPerms);
  };

  /* ----- Server-side data fetch ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const res = await getUnifiedApprovalsAction({
        page,
        pageSize,
        module: filterModule,
        sort: sortColumn && sortDir ? { column: sortColumn, dir: sortDir } : undefined,
      });
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else {
        const mapped: ApprovalItem[] = (res.items || []).map((i) => ({
          id: i.id,
          module: i.module as ApprovalItem["module"],
          employee_name: i.employee_name || "Employee",
          employee_code: "EMP",
          title: i.summary || "Request",
          sub_details: i.amount_or_duration || "-",
          status: (i.status as ApprovalItem["status"]) || "pending",
          created_at: i.submitted_date || "",
        }));
        setItems(mapped);
        setTotal(res.total ?? 0);
        // F10: derive pending count from the unified response (no separate fetch)
        if (typeof res.pendingCount === "number") {
          setPendingCount(res.pendingCount);
        } else {
          setPendingCount(mapped.filter((m) => m.status === "pending").length);
        }
        // Drop selections for rows no longer on this page / pending.
        setSelectedIds((prev) => {
          const valid = new Set(mapped.filter((m) => m.status === "pending").map((m) => m.id));
          return new Set([...prev].filter((id) => valid.has(id)));
        });
        if (res.total) {
          const maxPage = Math.max(1, Math.ceil(res.total / pageSize));
          if (page > maxPage) setPage(maxPage);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page, pageSize, sortColumn, sortDir, filterModule, reloadKey, setPage, setTotal]);

  /* F10: Header badge — derive from data refetch instead of separate count call */
  // pendingCount is now updated inside the main data fetch useEffect above.

  /* ----- Single-item approve / reject ----- */
  const handleDecision = async (item: ApprovalItem, decision: "approved" | "rejected") => {
    if (!canApproveItem(item)) {
      toast(`You do not have permission to ${decision} ${item.module} items.`, "error");
      return;
    }
    // Optimistic update
    setItems(items.map((i) => (i.id === item.id ? { ...i, status: decision } : i)));

    const res = await decideApprovalAction(item.module, item.id, decision);
    if ("error" in res) {
      // Rollback on error
      setItems(items.map((i) => (i.id === item.id ? { ...i, status: "pending" } : i)));
      toast(`Error: ${res.error}`, "error");
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setPendingCount((c) => Math.max(0, c - 1));
      const remaining = pendingCount - 1;
      toast(
        <span>
          Item #<span className="font-mono">{item.id.slice(0, 8)}</span> {decision}!{" "}
          <Link href="/approvals" className="underline font-bold">
            Review remaining {Math.max(0, remaining)} approval(s) →
          </Link>
        </span>
      );
      if (detailItem?.id === item.id) setDetailItem(null);
    }
  };

  /* ----- Batch approve ----- */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPageSelected =
    items.filter((i) => i.status === "pending").length > 0 &&
    items.filter((i) => i.status === "pending").every((i) => selectedIds.has(i.id));

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const pagePending = items.filter((i) => i.status === "pending").map((i) => i.id);
      if (pagePending.every((id) => next.has(id))) {
        pagePending.forEach((id) => next.delete(id));
      } else {
        pagePending.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBatchApprove = async () => {
    const targets = items.filter((i) => selectedIds.has(i.id) && i.status === "pending");
    if (targets.length === 0) return;

    setBatchLoading(true);
    let approved = 0;
    let failed = 0;

    for (const item of targets) {
      if (!canApproveItem(item)) { failed += 1; continue; }
      const res = await decideApprovalAction(item.module, item.id, "approved");
      if ("error" in res) {
        failed += 1;
      } else {
        approved += 1;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "approved" } : i)));
      }
    }

    setSelectedIds(new Set());
    setPendingCount((c) => Math.max(0, c - approved));
    setBatchLoading(false);

    if (approved > 0 && failed === 0) {
      toast(
        <span>
          {approved} approval(s) approved!{" "}
          <Link href="/approvals" className="underline font-bold">
            Review remaining approval(s) →
          </Link>
        </span>
      );
    } else if (approved > 0) {
      toast(
        <span>
          {approved} approved, {failed} failed.{" "}
          <Link href="/approvals" className="underline font-bold">
            Review remaining approval(s) →
          </Link>
        </span>,
        "error"
      );
    } else {
      toast(`Batch approve failed for ${failed} item(s).`, "error");
    }
    setReloadKey((k) => k + 1);
  };

  /* ----- Detail drawer ----- */
  const openDetail = async (item: ApprovalItem) => {
    setDetailItem(item);
    setDetailFields([]);
    setDetailLoading(true);
    const res = await getApprovalDetailAction(item.module, item.id);
    setDetailLoading(false);
    if ("error" in res) {
      toast(`Error loading details: ${res.error}`, "error");
    } else {
      setDetailFields(res.detail || []);
    }
  };

  /* ----- Filter chips ----- */
  const FILTER_MODULES = [
    { id: "all", label: "All Items" },
    { id: "leave", label: "Leave Requests" },
    { id: "attendance", label: "Attendance Corrections" },
    { id: "reimbursement", label: "Reimbursements" },
    { id: "permissions", label: "Short Permissions" },
    { id: "compoff", label: "Comp-Off Grants" },
    { id: "encashment", label: "Encashment" },
    { id: "offboarding", label: "Offboarding F&F" },
  ];

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <PageHeader
        icon={<CheckSquare className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Unified My Approvals Dashboard"
        description="Aggregated approval inbox consolidating leave requests, attendance corrections, expense claims, leave encashments, and offboarding settlements into one view."
        actions={
          <span className="px-3 py-1 bg-amber-50 text-amber-800 font-bold text-xs rounded-full flex items-center gap-1.5 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> {pendingCount} Pending Action(s)
          </span>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface p-3 rounded-xl border border-line shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-muted mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" /> Filter by Module:
          </span>
          {FILTER_MODULES.map((m) => (
            <button
              key={m.id}
              aria-pressed={filterModule === m.id}
              onClick={() => { setFilterModule(m.id); setPage(1); }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                filterModule === m.id
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-surface-muted hover:bg-primary-50 text-ink-secondary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {filterModule !== "all" && (
          <button
            onClick={() => { setFilterModule("all"); setPage(1); }}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline px-2 py-1 transition cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Batch Approve Toolbar */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-xs">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              data-testid="select-all-approvals"
              checked={allPageSelected}
              onChange={toggleSelectAllPage}
              className="w-4 h-4 rounded border-line-strong text-primary-600 focus:ring-primary-500"
            />
            Select all pending on this page ({items.filter((i) => i.status === "pending").length})
          </label>
          <button
            data-testid="approve-selected-btn"
            onClick={handleBatchApprove}
            disabled={selectedIds.size === 0 || batchLoading}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 min-h-[40px]"
          >
            {batchLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {batchLoading ? "Approving..." : `Approve Selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      {/* Inbox Items Table */}
      {loading && items.length === 0 ? (
        <PageLoading message="Loading pending approval items..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-8 h-8 text-ink-faint" />}
          title="No pending approvals found"
          description={
            filterModule === "all"
              ? "Your approval inbox is clear! Check back later when new requests are submitted."
              : `No approval items found for module filter '${filterModule}'.`
          }
        />
      ) : (
        <DataTable
          name="approvals"
          columns={[
            { key: "select", header: "Select" },
            { key: "module", header: "Module" },
            { key: "employee_name", header: "Employee", sortable: true },
            { key: "details", header: "Request Details" },
            { key: "created_at", header: "Submitted", sortable: true },
            { key: "status", header: "Status", sortable: true },
            { key: "actions", header: "Actions", headerClassName: "text-right" },
          ]}
          rows={items}
          total={total}
          page={page}
          pageSize={pageSize}
          sortColumn={sortColumn}
          sortDir={sortDir}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortChange={setSort}
          minWidth="min-w-[820px]"
          renderRow={(item: ApprovalItem) => {
            const canApproveThisItem = canApproveItem(item);

            // FR §4.7 Parental Medical Privacy Masking
            const isParental =
              item.module === "leave" &&
              (item.title.toLowerCase().includes("maternity") ||
                item.title.toLowerCase().includes("paternity"));
            const displayTitle = isParental && !isHrFocus ? "Parental Leave Request" : item.title;
            const displaySub = isParental && !isHrFocus ? "[Confidential Medical Reason Redacted]" : item.sub_details;

            const badgeClass = MODULE_BADGE_CLASSES[item.module] || "bg-surface-muted text-ink-secondary border-line";

            return (
              <tr key={item.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  {item.status === "pending" ? (
                    <input
                      type="checkbox"
                      data-testid={`select-approval-${item.id}`}
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.employee_name}'s ${item.module} request`}
                      className="w-4 h-4 rounded border-line-strong text-primary-600 focus:ring-primary-500"
                    />
                  ) : (
                    <span aria-hidden="true" className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${badgeClass}`}>
                    {item.module}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-ink">{item.employee_name}</p>
                  <p className="text-[10px] font-mono text-ink-muted">{item.employee_code}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{displayTitle}</p>
                  <p className="text-[11px] text-ink-muted">{displaySub}</p>
                </td>
                <td className="px-4 py-3 font-mono text-ink-muted">
                  {formatDateIndian(item.created_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {item.status === "pending" ? (
                    <>
                      <button
                        data-testid="view-approval-btn"
                        onClick={() => openDetail(item)}
                        className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 min-h-[34px]"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" /> View
                      </button>
                      {canApproveThisItem && (
                        <>
                          <button
                            onClick={() => handleDecision(item, "approved")}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition min-h-[34px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(item, "rejected")}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition min-h-[34px]"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {!canApproveThisItem && (
                        <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded">
                          Read-Only
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-faint font-medium capitalize">{item.status}</span>
                  )}
                </td>
              </tr>
            );
          }}
        />
      )}

      {/* Detail Drawer */}
      <Drawer
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="Approval Request Details"
        ariaLabel="Approval request details"
        footer={
          detailItem &&
          detailItem.status === "pending" &&
          canApproveItem(detailItem) ? (
            <>
              <button
                data-testid="reject-in-drawer-btn"
                onClick={() => handleDecision(detailItem, "rejected")}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Reject
              </button>
              <button
                data-testid="approve-in-drawer-btn"
                onClick={() => handleDecision(detailItem, "approved")}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Approve
              </button>
            </>
          ) : undefined
        }
      >
        {detailItem && (() => {
          const isDrawerParental =
            detailItem.module === "leave" &&
            (detailItem.title.toLowerCase().includes("maternity") ||
              detailItem.title.toLowerCase().includes("paternity"));
          const drawerDisplayTitle = isDrawerParental && !isHrFocus ? "Parental Leave Request" : detailItem.title;

          return (
            <>
              <div className="bg-surface-muted p-4 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{detailItem.employee_name}</p>
                    <p className="text-[10px] font-mono text-ink-muted">{detailItem.employee_code}</p>
                  </div>
                  <StatusBadge status={detailItem.status} />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-line">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${MODULE_BADGE_CLASSES[detailItem.module] || "bg-surface-muted text-ink-secondary border-line"}`}>
                    {detailItem.module}
                  </span>
                  <span className="font-semibold text-ink">{drawerDisplayTitle}</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Submitted: {formatDateIndian(detailItem.created_at)}
                </p>
              </div>

              {detailLoading ? (
                <PageLoading message="Loading request details..." />
              ) : detailFields.length > 0 ? (
                <dl data-testid="approval-detail-fields" className="space-y-2 text-xs">
                  {detailFields.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-start justify-between gap-4 border-b border-line pb-2"
                    >
                      <dt className="font-semibold text-ink-muted shrink-0">{f.label}</dt>
                      <dd className="text-right font-medium text-ink break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-ink-muted">
                  No additional detail is available for this request type.
                </p>
              )}
            </>
          );
        })()}
      </Drawer>
    </div>
  );
}
