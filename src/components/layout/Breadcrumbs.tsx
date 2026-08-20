"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbs } from "@/lib/nav/routeConfig";

export function Breadcrumbs() {
  const pathname = usePathname();

  // Shell-free routes don't render a breadcrumb trail
  if (pathname === "/login" || pathname === "/403") return null;

  const trail = getBreadcrumbs(pathname);
  // Root (Dashboard) already resolves to just "Home"
  const crumbs = trail.length === 0 || trail[0].path === "/" ? trail : [{ path: "/", name: "Home" }, ...trail];

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs" className="mb-0.5">
      <ol className="flex items-center flex-wrap gap-1 text-[10px] text-ink-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="w-3 h-3 text-line-strong" aria-hidden="true" />}
              {isLast ? (
                <span data-testid="breadcrumb-link" aria-current="page" className="font-semibold text-ink-secondary">
                  {crumb.name}
                </span>
              ) : (
                <Link data-testid="breadcrumb-link" href={crumb.path} className="hover:text-ink transition">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
