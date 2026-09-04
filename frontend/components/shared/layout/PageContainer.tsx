/**
 * PageContainer — WACC-P0-016
 *
 * Two content widths, replacing seven different max-w-* values across the product.
 *
 * Route classification (documented here so screen tasks don't have to decide):
 *  - width="wide"     → data-heavy tables: /sales-lines, /territory-kpi, /targets,
 *                        /hospital-registry, /leaderboard, /my-territory, /import-batches
 *  - width="standard" → everything else: /account, /dashboard, /kpi, /import, /settings/*,
 *                        /users, /name-reviews, /reports/*, /target-assist, /territories/*,
 *                        /master-data, /products, /territory-products
 *
 * Padding: 24px desktop / 16px mobile (p-4 sm:p-6).
 * Vertical section spacing: 24px (space-y-6 on children when needed).
 */

import type { ReactNode } from "react";

export interface PageContainerProps {
  children: ReactNode;
  /**
   * "standard" → max-w-[var(--content-standard)] = 1200px
   * "wide"     → max-w-[var(--content-wide)] = 100%
   */
  width?: "standard" | "wide";
  className?: string;
}

export function PageContainer({
  children,
  width = "standard",
  className,
}: PageContainerProps) {
  const maxWidth =
    width === "wide"
      ? "var(--content-wide)"
      : "var(--content-standard)";

  return (
    <div
      className={["w-full p-4 sm:p-6 mx-auto", className].filter(Boolean).join(" ")}
      style={{ maxWidth }}
    >
      {children}
    </div>
  );
}

export default PageContainer;
