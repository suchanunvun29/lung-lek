/**
 * PageHeader — WACC-P0-016
 *
 * Renders exactly one visually primary action.
 * Extra actions go to secondaryActions; anything beyond two moves into an overflow menu
 * (kept simple for now — secondary actions render as-is at this primitive level).
 *
 * Desktop: title left, primary action right, on one row.
 * Tablet: same, wrapping to two rows when the title is long.
 * Mobile: title on its own row; primary action full-width 44px beneath it;
 *         secondary actions collapse into an overflow menu.
 *
 * All existing Thai wording is preserved — PageHeader receives it as a prop.
 */

import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** The page title — <h1> at --type-page-title (1.5rem / 600). */
  title: string;
  /** Optional subtitle / description shown beneath the title. */
  description?: string;
  /** The one visually-primary action (a Button, Link, etc.). */
  primaryAction?: ReactNode;
  /** Up to two secondary actions. On mobile they wrap; beyond two they should be
   *  placed in a DropdownMenu by the caller. */
  secondaryActions?: ReactNode[];
  /** Optional metadata line (e.g. "แสดง 50 จาก 200 รายการ"). */
  meta?: ReactNode;
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  meta,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1
            className="text-[var(--type-page-title)] font-semibold text-[var(--text-primary)] leading-tight"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
          )}
          {meta && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{meta}</p>
          )}
        </div>

        {/* Actions — desktop: row; hidden on mobile */}
        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="hidden sm:flex shrink-0 items-center gap-2">
            {secondaryActions?.map((action, i) => (
              <span key={i}>{action}</span>
            ))}
            {primaryAction && <span>{primaryAction}</span>}
          </div>
        )}
      </div>

      {/* Mobile: primary action full-width 44px */}
      {primaryAction && (
        <div className="mt-3 sm:hidden">
          <div className="[&>*]:w-full [&>*]:min-h-[44px]">{primaryAction}</div>
        </div>
      )}
    </div>
  );
}

export default PageHeader;
