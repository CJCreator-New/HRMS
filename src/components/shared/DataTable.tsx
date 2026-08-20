"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SortDir } from "@/lib/hooks/useServerTable";

/**
 * Generic data table with pagination + column sort (M-09, WS-B pattern library).
 *
 * Two modes:
 *  - Client mode (default): omit `total` — rows are paginated/sorted in memory
 *    using `getSortValue`. Used by attendance logs, payslip register, etc.
 *  - Server mode: pass `total` plus the controlled `page` / `pageSize` /
 *    `sortColumn` / `sortDir` props from useServerTable. The parent refetches
 *    when those change; the current page slice arrives via `rows`.
 *
 * data-testid contract (pagination.spec.ts):
 *  - table wrapper:  data-testid="{name}-table"
 *  - pagination:     data-testid="pagination", "pagination-prev", "pagination-next",
 *                    "pagination-size", "pagination-page" ("Page X of Y")
 *  - sortable th:    data-testid="sort-{columnKey}" with aria-sort="ascending|descending"
 */

export interface DataTableColumn<T = any> {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  headerClassName?: string;
}

export interface DataTableProps<T = any> {
  /** Base for the `data-testid="{name}-table"` wrapper. */
  name: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  renderRow: (row: T, index: number) => React.ReactNode;
  /** Client-mode sort accessor — returns the comparable value for a column key. */
  getSortValue?: (row: T, columnKey: string) => string | number;
  /** Server-mode: total row count across all pages. */
  total?: number;
  page?: number;
  pageSize?: number;
  sortColumn?: string | null;
  sortDir?: SortDir | null;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (column: string, dir: SortDir) => void;
  pageSizeOptions?: number[];
  empty?: React.ReactNode;
  minWidth?: string;
  className?: string;
}

export function DataTable<T = any>({
  name,
  columns,
  rows,
  renderRow,
  getSortValue,
  total,
  page: controlledPage,
  pageSize: controlledPageSize,
  sortColumn: controlledSortColumn,
  sortDir: controlledSortDir,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  pageSizeOptions = [25, 50, 100],
  empty,
  minWidth = "min-w-[650px]",
  className = "",
}: DataTableProps<T>) {
  const isServer = total !== undefined;

  // Client-mode internal state
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(pageSizeOptions[0] ?? 25);
  const [clientSortColumn, setClientSortColumn] = useState<string | null>(null);
  const [clientSortDir, setClientSortDir] = useState<SortDir | null>(null);

  const page = isServer ? controlledPage ?? 1 : clientPage;
  const pageSize = isServer ? controlledPageSize ?? pageSizeOptions[0] ?? 25 : clientPageSize;
  const sortColumn = isServer ? controlledSortColumn ?? null : clientSortColumn;
  const sortDir = isServer ? controlledSortDir ?? null : clientSortDir;

  // Sorted (client mode) row set
  const sortedRows = useMemo(() => {
    if (isServer || !sortColumn || !sortDir) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getSortValue ? getSortValue(a, sortColumn) : (a as any)[sortColumn];
      const vb = getSortValue ? getSortValue(b, sortColumn) : (b as any)[sortColumn];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, sortColumn, sortDir, isServer, getSortValue]);

  const rowCount = isServer ? total ?? 0 : sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));

  // Clamp page when the dataset shrinks (client refetch / server total change)
  useEffect(() => {
    if (page > totalPages) {
      if (isServer && onPageChange) onPageChange(totalPages);
      else setClientPage(totalPages);
    }
  }, [page, totalPages, isServer, onPageChange]);

  const start = (page - 1) * pageSize;
  const visibleRows = isServer ? sortedRows : sortedRows.slice(start, start + pageSize);

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    let nextDir: SortDir;
    if (sortColumn !== column.key || !sortDir) nextDir = "asc";
    else nextDir = sortDir === "asc" ? "desc" : "asc";
    if (isServer && onSortChange) onSortChange(column.key, nextDir);
    else {
      setClientSortColumn(column.key);
      setClientSortDir(nextDir);
      setClientPage(1);
    }
  };

  const changePage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (isServer && onPageChange) onPageChange(clamped);
    else setClientPage(clamped);
  };

  const changePageSize = (size: number) => {
    if (isServer && onPageSizeChange) onPageSizeChange(size);
    else {
      setClientPageSize(size);
      setClientPage(1);
    }
  };

  return (
    <div
      data-testid={`${name}-table`}
      className={`bg-surface rounded-xl border border-line shadow-card overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        {visibleRows.length === 0 ? (
          empty ?? (
            <div className="p-8 text-center text-sm text-ink-secondary">No records found.</div>
          )
        ) : (
          <table className={`w-full text-left text-xs border-collapse ${minWidth}`}>
            <thead>
              <tr className="bg-surface-muted/70 border-b border-line font-bold uppercase text-ink-secondary text-[11px]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      sortColumn === col.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={`px-4 py-3 ${col.headerClassName ?? ""}`}
                  >
                    {col.sortable ? (
                      <button
                        data-testid={`sort-${col.key}`}
                        aria-sort={
                          sortColumn === col.key
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded transition hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                          sortColumn === col.key ? "text-primary-700" : ""
                        }`}
                      >
                        {col.header}
                        <span aria-hidden="true" className="text-[9px]">
                          {sortColumn === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleRows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      <div
        data-testid="pagination"
        className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-line bg-surface-muted/50"
      >
        <span data-testid="pagination-page" className="text-xs font-semibold text-ink">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-ink-secondary font-medium">
            Rows per page
            <select
              data-testid="pagination-size"
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="border border-line-strong rounded-lg px-2 py-1 bg-surface text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <button
            data-testid="pagination-prev"
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-line-strong rounded-lg bg-surface text-ink-secondary font-semibold hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Prev
          </button>
          <button
            data-testid="pagination-next"
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-line-strong rounded-lg bg-surface text-ink-secondary font-semibold hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
