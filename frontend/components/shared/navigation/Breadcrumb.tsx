"use client";

/**
 * Breadcrumb — WACC-P0-015
 *
 * Derives the trail from navigation.config.ts + the current pathname.
 * Accepts a `segments` override for dynamic segments (e.g. target revision pages).
 *
 * Rendered as <nav aria-label="เส้นทางหน้า"> with structured data.
 * On mobile: shows only the last two crumbs to fit the condensed header.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { findNavGroupByPath, findNavItemByPath } from "./navigation.config";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  /** Override segments for dynamic routes (e.g. /targets/12/revisions).
   *  When provided, these replace the auto-derived trail. */
  segments?: BreadcrumbSegment[];
}

function useBreadcrumbTrail(): BreadcrumbSegment[] {
  const pathname = usePathname();

  const group = findNavGroupByPath(pathname);
  const item = findNavItemByPath(pathname);

  const trail: BreadcrumbSegment[] = [];

  if (group && group.label !== "ภาพรวม") {
    // Group as first crumb (no href — it's a heading, not a route itself)
    trail.push({ label: group.label });
  }

  if (item) {
    trail.push({ label: item.label, href: item.href });
  }

  return trail;
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  const autoTrail = useBreadcrumbTrail();
  const trail = segments ?? autoTrail;

  if (trail.length === 0) return null;

  return (
    <nav aria-label="เส้นทางหน้า">
      <ol className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          // On mobile: hide all but the last two segments
          const hiddenOnMobile = !isLast && i < trail.length - 2;

          return (
            <li
              key={i}
              className={[
                "flex items-center gap-1",
                hiddenOnMobile ? "hidden sm:flex" : "",
              ].join(" ")}
            >
              {i > 0 && (
                <ChevronRight
                  size={14}
                  className="shrink-0 text-[var(--border-strong)]"
                  aria-hidden="true"
                />
              )}
              {isLast || !crumb.href ? (
                <span
                  className={
                    isLast
                      ? "font-medium text-[var(--text-primary)]"
                      : ""
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-[var(--text-primary)] hover:underline transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
