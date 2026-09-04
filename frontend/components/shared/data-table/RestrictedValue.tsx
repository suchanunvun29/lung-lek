import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TerritoryKpiVisibility } from "@/lib/types";

/**
 * RestrictedValue — WACC-P0-020
 *
 * The distinct "you are not permitted to see this" marker, visually separate from
 * "there is no data" (EmptyState) and from a warning (InlineMessage).
 *
 * ── Hard rule ─────────────────────────────────────────────────────────────────
 * This component renders when, and only when, the server payload's `visibility`
 * field is the literal `"TERRITORY_RANK_ONLY"`. It must NEVER be derived from a
 * value being `null`, `undefined`, empty, or zero — that inference would leak the
 * existence of data the server chose to withhold, and zero is a legitimate value.
 *
 * The only accepted input is the wire `visibility` field itself (typed as
 * `TerritoryKpiVisibility`), passed straight through:
 *
 *   {row.visibility === "TERRITORY_FULL"
 *     ? <span>{row.revenue}</span>
 *     : <RestrictedValue visibility={row.visibility} />}
 *
 * A masked value never reaches this component — `FieldMasker` does not send it,
 * and the client must not infer or grey one out.
 *
 * Legible in a card row as well as a table cell; never relies on hover —
 * text (not colour alone) carries the meaning, and screen readers announce it.
 */

export const RESTRICTED_VALUE_MESSAGE = "ข้อมูลถูกจำกัดตามสิทธิ์การเข้าถึง";

export interface RestrictedValueProps {
  /** The server row's `visibility` wire value — never a value the client derived. */
  visibility: TerritoryKpiVisibility;
  /** Override the explanation text (defaults to the standard Thai wording). */
  label?: string;
  className?: string;
}

export function RestrictedValue({ visibility, label = RESTRICTED_VALUE_MESSAGE, className }: RestrictedValueProps) {
  if (visibility !== "TERRITORY_RANK_ONLY") return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-restricted-subtle px-2.5 py-1 text-xs font-medium text-restricted",
        className
      )}
      title={label}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export default RestrictedValue;
