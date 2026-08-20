"use client";

import { useCallback, useState } from "react";

/**
 * Server-side table state (M-09): page / pageSize / sort + total.
 *
 * Pair with <DataTable total=…> and a server action that accepts
 * { page, pageSize, sort } and returns { rows, total }.
 *
 * All mutators reset to page 1, since changing page size / sort / filters
 * invalidates the current offset.
 */

export type SortDir = "asc" | "desc";

export interface ServerTableState {
  page: number;
  pageSize: number;
  sortColumn: string | null;
  sortDir: SortDir | null;
  total: number;
}

export interface UseServerTableResult extends ServerTableState {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (column: string, dir: SortDir) => void;
  clearSort: () => void;
  setTotal: (total: number) => void;
  reset: () => void;
}

export function useServerTable(
  initial: Partial<ServerTableState> = {}
): UseServerTableResult {
  const [state, setState] = useState<ServerTableState>({
    page: 1,
    pageSize: 25,
    sortColumn: null,
    sortDir: null,
    total: 0,
    ...initial,
  });

  const setPage = useCallback((page: number) => {
    setState((s) => ({ ...s, page: Math.max(1, page) }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((s) => ({ ...s, pageSize, page: 1 }));
  }, []);

  const setSort = useCallback((column: string, dir: SortDir) => {
    setState((s) => ({ ...s, sortColumn: column, sortDir: dir, page: 1 }));
  }, []);

  const clearSort = useCallback(() => {
    setState((s) => ({ ...s, sortColumn: null, sortDir: null, page: 1 }));
  }, []);

  const setTotal = useCallback((total: number) => {
    setState((s) => ({ ...s, total }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, page: 1 }));
  }, []);

  return { ...state, setPage, setPageSize, setSort, clearSort, setTotal, reset };
}

export default useServerTable;
