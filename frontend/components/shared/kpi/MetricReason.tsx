import { cn } from "@/lib/utils";

/**
 * MetricReason — WACC-P0-020
 *
 * Renders a metric's `computable === false` reason inline at the same level as the
 * number it explains — not hidden behind a toggle. The backend deliberately sends
 * these reasons (e.g. `CompositeScoreResult.metrics[].reason`, leaderboard
 * `criterionReason`); discarding them behind an expander loses information the
 * server chose to provide (UX principle 1).
 *
 * Extracted from ScoreCard's amber reason markup so every surface (ScoreCard,
 * territory KPI, leaderboard CriterionReason, CompositeScoreBadge) shows the same
 * reason presentation. Renders nothing when both `label` and `reason` are empty —
 * an absent reason never fabricates one.
 *
 * A reason here means "the server could not compute this criterion" — it is NOT
 * the permission marker; restricted visibility uses RestrictedValue, keyed on the
 * `"TERRITORY_RANK_ONLY"` wire value.
 */

export interface MetricReasonProps {
  /** Metric display name (Thai). Rendered bold before the reason when both exist. */
  label?: string;
  /** The server-sent reason for `computable === false`. */
  reason?: string | null;
  className?: string;
}

export function MetricReason({ label, reason, className }: MetricReasonProps) {
  if (!reason && !label) return null;

  return (
    <p className={cn("text-xs text-amber-700", className)}>
      {label && <span className="font-medium">{label}{reason ? ": " : ""}</span>}
      {reason}
    </p>
  );
}

export default MetricReason;
