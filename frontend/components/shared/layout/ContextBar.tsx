"use client";

/**
 * ContextBar — WACC-P0-015
 *
 * Renders PeriodSelector and/or a salesperson switcher bound to useContextStore,
 * depending on the flags declared in navigation.config.ts for the current route.
 *
 * Which controls appear is determined entirely by the config — not hardcoded here.
 * Pages that are month-only (DerivedTargetCard etc.) still pass a global period;
 * they handle the month-only guard themselves (unchanged behaviour).
 *
 * The salesperson list is loaded here once and cached in local state. When there
 * is exactly one valid salesperson, the switcher renders as static text (auto-select rule).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PeriodSelector } from "@/features/kpi/components/PeriodSelector";
import { listSalespeople } from "@/features/master-data";
import { listTerritories } from "@/features/territories/api/territories.api";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { findNavItemByPath } from "../navigation/navigation.config";
import type { Salesperson, Territory } from "@/lib/types";

export function ContextBar() {
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);

  const period = useContextStore((state) => state.period);
  const setPeriod = useContextStore((state) => state.setPeriod);
  const salespersonId = useContextStore((state) => state.salespersonId);
  const setSalespersonId = useContextStore((state) => state.setSalespersonId);
  const territoryId = useContextStore((state) => state.territoryId);
  const setTerritoryId = useContextStore((state) => state.setTerritoryId);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);

  // Determine what to show based on the config for the current route.
  const navItem = findNavItemByPath(pathname);
  const showPeriod = navItem?.showPeriodSelector ?? false;
  const showSalesperson = navItem?.showSalespersonSelector ?? false;
  const showTerritory = navItem?.showTerritorySelector ?? false;

  // Load salesperson list when the switcher is needed.
  useEffect(() => {
    if (!showSalesperson || !token) return;
    listSalespeople(token)
      .then((data) => {
        setSalespeople(data.salespeople);
        // Safe automation: on first load, default to own salesperson if not yet set.
        if (salespersonId === null && authUser?.id != null) {
          const own = data.salespeople.find((sp) => sp.userId === authUser.id);
          if (own) setSalespersonId(own.id);
        }
      })
      .catch(() => {
        // Silently ignore — the contextbar is non-critical; pages have their own error handling.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSalesperson, token]);

  // Load territory list when the territory switcher is needed.
  useEffect(() => {
    if (!showTerritory || !token) return;
    listTerritories(token)
      .then((data) => {
        const active = data.territories.filter((t) => t.isActive);
        setTerritories(active);
        // Safe automation: default to first territory if not set.
        if (territoryId === null && active.length > 0) {
          setTerritoryId(active[0].id);
        }
      })
      .catch(() => {
        // Silently ignore
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTerritory, token]);

  if (!showPeriod && !showSalesperson && !showTerritory) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {showPeriod && (
        <PeriodSelector value={period} onChange={setPeriod} />
      )}

      {showTerritory && territories.length > 0 && (
        territories.length === 1 ? (
          /* Auto-select: sole option renders as text */
          <span className="font-medium text-[var(--text-secondary)]">
            {territories[0].name}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <label className="font-medium text-[var(--text-muted)]">เขต</label>
            <select
              value={territoryId ?? ""}
              onChange={(e) => setTerritoryId(Number(e.target.value) || null)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      {showSalesperson && salespeople.length > 0 && (
        salespeople.length === 1 ? (
          /* Auto-select: sole option renders as text */
          <span className="font-medium text-[var(--text-secondary)]">
            {salespeople[0].displayName}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <label className="font-medium text-[var(--text-muted)]">มุมมอง</label>
            <select
              value={salespersonId ?? ""}
              onChange={(e) => setSalespersonId(Number(e.target.value) || null)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.displayName}
                </option>
              ))}
            </select>
          </div>
        )
      )}
    </div>
  );
}

export default ContextBar;
