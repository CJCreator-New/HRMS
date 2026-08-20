"use client";

import React from "react";

/**
 * Reusable skeleton shimmer primitives (V6).
 *
 * Compose these to build loading placeholders that match the final layout
 * shape, eliminating the spinner → content layout shift.
 */

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-muted rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a page header (title + description). */
export function SkeletonHeader() {
  return (
    <div className="space-y-2 p-6 bg-surface rounded-xl border border-line shadow-card">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Skeleton for a stat card (label + big number). */
export function SkeletonStatCard() {
  return (
    <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  );
}

/** Skeleton for a DataTable — header + N rows. */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-line bg-surface-muted">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-b-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-16 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a card grid (2–3 columns). */
export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Full-page skeleton combining header + cards + table. */
export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonHeader />
      <SkeletonCardGrid />
      <SkeletonTable />
    </div>
  );
}
