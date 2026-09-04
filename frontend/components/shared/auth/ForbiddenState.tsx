/**
 * ForbiddenState — WACC-P0-022
 *
 * One component for "this page is for managers only", replacing four hand-written copies
 * of the amber block across the product.
 *
 * Route classification — every protected route is either:
 *  - guard     = manager-only page that renders ForbiddenState for SALESPERSON users
 *  - read-open = visible to all authenticated users; write actions gated by canEdit
 *
 * This table is derived from today's actual behaviour, cross-checked against
 * src/SalesEvaluation.Api/Endpoints/*.cs role guards.  Changing it is a product
 * decision, not a UX fix.
 *
 * ┌────────────────────────────────────────┬────────────┐
 * │ Route                                  │ Mode       │
 * ├────────────────────────────────────────┼────────────┤
 * │ /dashboard                             │ read-open  │
 * │ /kpi                                   │ read-open  │
 * │ /leaderboard                           │ read-open  │
 * │ /my-territory                          │ read-open  │
 * │ /territory-kpi                         │ read-open  │
 * │ /territory-products                    │ read-open  │
 * │ /sales-lines                           │ read-open  │
 * │ /targets                               │ read-open  │  (canEdit)
 * │ /territories                           │ read-open  │
 * │ /territories/moves                     │ read-open  │  (canEdit)
 * │ /territories/unassigned                │ read-open  │
 * │ /territories/targets                   │ read-open  │  (canEdit)
 * │ /master-data                           │ read-open  │  (canEdit)
 * │ /products                              │ read-open  │  (canEdit)
 * │ /import-batches                        │ read-open  │
 * │ /reports/individual                    │ read-open  │
 * │ /reports/team-overview                 │ read-open  │
 * │ /settings/scoring-weights              │ read-open  │
 * │ /settings/evaluation                   │ read-open  │
 * │ /account                               │ read-open  │
 * │ /hospital-registry                     │ guard      │  ← ForbiddenState
 * │ /import                                │ guard      │  ← ForbiddenState
 * │ /name-reviews                          │ guard      │  ← ForbiddenState
 * │ /users                                 │ guard      │  ← ForbiddenState
 * │ /target-assist                         │ guard      │  ← ForbiddenState
 * │ /settings/tier-weights                 │ guard      │  ← ForbiddenState
 * └────────────────────────────────────────┴────────────┘
 *
 * Adding a new manager-only screen: import ForbiddenState, render it when
 * user.role !== "MANAGER", and add a row to this table.
 */

import Link from "next/link";
import { ShieldOff } from "lucide-react";

export interface ForbiddenStateProps {
  /**
   * The reason message shown to the user.
   * Defaults to the current standard wording so migrated pages keep their exact text.
   */
  reason?: string;
}

export function ForbiddenState({
  reason = "หน้านี้สำหรับผู้จัดการเท่านั้น",
}: ForbiddenStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-subtle)] text-[var(--warning)]">
        <ShieldOff size={24} aria-hidden="true" />
      </div>

      <p
        className="max-w-sm rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        role="alert"
      >
        {reason}
      </p>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}

export default ForbiddenState;
