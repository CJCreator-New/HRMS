/**
 * Lightweight fluent fake of the Supabase client for server-action tests.
 *
 * Supports the query chain shapes used across src/lib/actions:
 *   from(t).select().eq().single() / .maybeSingle()
 *   from(t).insert(x).select().single()
 *   from(t).update(x).eq().eq()
 *   from(t).upsert(x, { onConflict })
 *   rpc(name, args)
 *   auth.getUser()
 *
 * Every query resolves through the `respond` callback, which receives the
 * full QueryState (table, method, filters, payload, …) so a test can return
 * per-query fixtures. Insert/update/upsert payloads are recorded on
 * `capturedWrites` for assertion.
 */

import { vi } from "vitest";

export type FilterOp = "eq" | "neq" | "gte" | "lte" | "is" | "in" | "or";

export interface Filter {
  op: FilterOp;
  col: string;
  val?: unknown;
}

export interface QueryState {
  table: string;
  method: "select" | "insert" | "update" | "delete" | "upsert";
  payload?: unknown;
  selectCols?: string;
  filters: Filter[];
  orderCol?: string;
  ascending: boolean;
  limitCount?: number;
  rangeFrom?: number;
  rangeTo?: number;
  single: boolean;
  maybeSingle: boolean;
  head: boolean;
  onConflict?: string;
}

export type QueryResponder = (
  state: QueryState
) => { data?: unknown; error?: unknown; count?: number };

export interface FakeSupabaseOptions {
  user?: { id: string } | null;
  respond?: QueryResponder;
  rpcs?: Record<string, (args: unknown) => { data?: unknown; error?: unknown }>;
}

export function buildQueryState(table: string): QueryState {
  return {
    table,
    method: "select",
    filters: [],
    ascending: true,
    single: false,
    maybeSingle: false,
    head: false,
  };
}

class FakeQueryBuilder {
  constructor(
    private state: QueryState,
    private respond: QueryResponder
  ) {}

  select(cols?: string) {
    this.state.selectCols = cols;
    return this;
  }
  eq(col: string, val: unknown) {
    this.state.filters.push({ op: "eq", col, val });
    return this;
  }
  ilike(col: string, val: unknown) {
    this.state.filters.push({ op: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.state.filters.push({ op: "neq", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.state.filters.push({ op: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.state.filters.push({ op: "lte", col, val });
    return this;
  }
  is(col: string, val: unknown) {
    this.state.filters.push({ op: "is", col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.state.filters.push({ op: "in", col, val: vals });
    return this;
  }
  or(filter: string) {
    this.state.filters.push({ op: "or", col: "", val: filter });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.state.orderCol = col;
    this.state.ascending = opts?.ascending ?? true;
    return this;
  }
  range(from: number, to: number) {
    this.state.rangeFrom = from;
    this.state.rangeTo = to;
    return this;
  }
  limit(n: number) {
    this.state.limitCount = n;
    return this;
  }
  single() {
    this.state.single = true;
    return this;
  }
  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }
  head() {
    this.state.head = true;
    return this;
  }

  insert(payload: unknown) {
    this.state.method = "insert";
    this.state.payload = payload;
    return this;
  }
  update(payload: unknown) {
    this.state.method = "update";
    this.state.payload = payload;
    return this;
  }
  upsert(payload: unknown, opts?: { onConflict?: string }) {
    this.state.method = "upsert";
    this.state.payload = payload;
    this.state.onConflict = opts?.onConflict;
    return this;
  }
  delete() {
    this.state.method = "delete";
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    const result = this.respond(this.state);
    return Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? undefined,
    }).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabase {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

export function createFakeSupabase(
  opts: FakeSupabaseOptions = {}
): FakeSupabase {
  const respond: QueryResponder = opts.respond ?? (() => ({ data: null, error: null }));
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user ?? null }, error: null })),
    },
    from: vi.fn((table: string) => new FakeQueryBuilder(buildQueryState(table), respond)),
    rpc: vi.fn((fnName: string, args?: unknown) => {
      const handler = opts.rpcs?.[fnName];
      if (!handler) {
        return Promise.resolve({ data: null, error: { message: `RPC ${fnName} not stubbed` } });
      }
      return Promise.resolve(handler(args));
    }),
  };
}

/** Finds the first eq filter for a column (handy in respond callbacks). */
export function eqFilter(state: QueryState, col: string): unknown {
  const f = state.filters.find((x) => x.op === "eq" && x.col === col);
  return f?.val;
}
