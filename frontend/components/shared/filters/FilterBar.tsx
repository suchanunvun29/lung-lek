"use client";

/**
 * FilterBar — WACC-P0-018
 *
 * One filter surface with a visible active-filter summary and a reset:
 * a row of filter controls plus a chip summary of what is applied, replacing the
 * hand-built filter layouts each screen used to invent.
 *
 * Filter STATE stays owned by each screen — FilterBar is presentational plus an
 * `onReset` callback. Screens that filter server-side (e.g. /sales-lines) keep
 * passing their values into their own query exactly as before; adopting this bar
 * changes no query parameter.
 *
 * Desktop (≥1024px): one horizontal bar — primary filters always visible,
 * additional filters behind a "ตัวกรองเพิ่มเติม" disclosure.
 * Tablet (768–1023px): the same bar, wrapping to two rows.
 * Mobile (<768px): collapses to a single "ตัวกรอง (N)" button opening
 * FilterDrawer with the same controls at 44px targets, an Apply and a Reset.
 *
 * `onReset` must return the screen to its documented default state — if a default
 * period or scope is part of that state, reset restores it, not "everything cleared".
 */

import * as React from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterDrawer } from "./FilterDrawer";

export interface FilterChip {
  key: string;
  label: React.ReactNode;
  /** When provided the chip renders its own remove button; informational otherwise. */
  onRemove?: () => void;
}

export interface FilterBarProps {
  /** Primary filter controls — always visible on the bar, inside the drawer on mobile. */
  children?: React.ReactNode;
  /** Additional filters behind the "ตัวกรองเพิ่มเติม" disclosure; inside the drawer on mobile. */
  secondaryFilters?: React.ReactNode;
  /** Summary of what is currently applied — also drives the "ตัวกรอง (N)" count. */
  chips?: FilterChip[];
  /** Restores the screen's documented default filter state. */
  onReset?: () => void;
  /** Called when the drawer's Apply button is pressed (the drawer closes itself). */
  onApply?: () => void;
  className?: string;
}

export function FilterBar({
  children,
  secondaryFilters,
  chips = [],
  onReset,
  onApply,
  className,
}: FilterBarProps) {
  const [showSecondary, setShowSecondary] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const activeCount = chips.length;

  return (
    <div className={className}>
      {/* Desktop / tablet: the bar itself */}
      <div className="hidden md:block">
        <div className="flex flex-wrap items-end gap-3">
          {children}
          {secondaryFilters && (
            <div>
              <button
                type="button"
                aria-expanded={showSecondary}
                onClick={() => setShowSecondary((v) => !v)}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              >
                ตัวกรองเพิ่มเติม
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showSecondary && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              {showSecondary && (
                <div className="mt-3 flex flex-wrap items-end gap-3">{secondaryFilters}</div>
              )}
            </div>
          )}
        </div>

        {(activeCount > 0 || onReset) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeCount > 0 && (
              <span className="text-xs font-medium text-text-muted">
                กรองอยู่ {activeCount} รายการ:
              </span>
            )}
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-subtle py-1 pl-2.5 pr-1 text-xs font-medium text-text-secondary"
              >
                <span className="min-w-0 truncate">{chip.label}</span>
                {chip.onRemove && (
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`ล้างตัวกรอง ${typeof chip.label === "string" ? chip.label : ""}`.trim()}
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-border hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
            {onReset && activeCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile: single button opening the drawer */}
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full justify-between"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}
          </span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={onApply}
        onReset={onReset}
      >
        {children}
        {secondaryFilters && (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              ตัวกรองเพิ่มเติม
            </p>
            <div className="space-y-4">{secondaryFilters}</div>
          </div>
        )}
      </FilterDrawer>
    </div>
  );
}

export default FilterBar;
