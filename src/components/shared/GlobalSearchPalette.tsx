"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, User, FileText, Calendar, ChevronRight } from "lucide-react";
import { globalSearchAction } from "@/lib/actions/data";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sub?: string;
  href: string;
  status?: string;
}

export function GlobalSearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await globalSearchAction(q);
    setResults((res.results as SearchResult[]) || []);
    setActiveIdx(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    if (e.key === "ArrowUp") setActiveIdx((i) => Math.max(i - 1, 0));
    if (e.key === "Enter" && results[activeIdx]) handleSelect(results[activeIdx]);
  };

  const typeIcon = (type: string) => {
    if (type === "employee") return <User className="w-4 h-4 text-blue-500" aria-hidden="true" />;
    if (type === "leave") return <Calendar className="w-4 h-4 text-purple-500" aria-hidden="true" />;
    return <FileText className="w-4 h-4 text-ink-muted" aria-hidden="true" />;
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label="Search employees, leave, and payroll (Control plus K)"
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink-muted bg-surface-muted border border-line rounded-lg hover:bg-surface transition min-w-[140px] sm:min-w-[160px]"
        title="Global Search (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto text-[10px] font-mono bg-surface border border-line rounded px-1 text-ink-muted">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search palette"
      className="fixed inset-0 z-search bg-black/40 flex items-start justify-center pt-20 px-4"
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-line">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search className="w-5 h-5 text-ink-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyNav}
            placeholder="Search employees, leave, payroll…"
            className="flex-1 text-sm text-ink placeholder-ink-muted bg-transparent focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              setOpen(false);
              setQuery("");
              setResults([]);
            }}
            aria-label="Close search modal"
            className="p-1 rounded text-ink-muted hover:text-ink transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto divide-y divide-line">
          {loading && (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">Searching…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">No results for &quot;{query}&quot;</div>
          )}
          {!loading &&
            results.map((r, idx) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                  idx === activeIdx ? "bg-primary-50" : "hover:bg-surface-muted"
                }`}
              >
                <div className="shrink-0">{typeIcon(r.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">{r.label}</p>
                  {r.sub && <p className="text-[11px] text-ink-muted truncate">{r.sub}</p>}
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 bg-surface-muted text-ink-secondary rounded-full capitalize shrink-0">
                  {r.type}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-ink-faint shrink-0" aria-hidden="true" />
              </button>
            ))}
          {!query && (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">
              Type to search employees, leave requests, payroll records…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-line flex items-center gap-3 text-[10px] text-ink-muted font-mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
