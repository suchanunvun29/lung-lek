/**
 * useContextStore — WACC-P0-013
 *
 * Holds one period and one subject (salesperson / territory) for the entire app,
 * persisted in localStorage across page navigations and full reloads.
 *
 * Automation rules (safe, user-overridable):
 *  - Default period is the current month, matching today's defaultPeriod() in dashboard/kpi.
 *  - On first hydration, salespersonId defaults to the salesperson whose user.id equals
 *    the signed-in user's id.  If there is no match, stays null — never "first in list".
 *  - Cleared on logout alongside useAuthStore.logout().
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PeriodKey } from "@/lib/types";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return {
    periodType: "MONTH",
    year: now.getFullYear(),
    periodNumber: now.getMonth() + 1,
  };
}

interface ContextState {
  period: PeriodKey;
  salespersonId: number | null;
  territoryId: number | null;
  hasHydrated: boolean;

  setPeriod: (period: PeriodKey) => void;
  setSalespersonId: (id: number | null) => void;
  setTerritoryId: (id: number | null) => void;
  setHasHydrated: (value: boolean) => void;
  /** Called on logout — clears all context so the next user starts fresh. */
  reset: () => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      period: defaultPeriod(),
      salespersonId: null,
      territoryId: null,
      hasHydrated: false,

      setPeriod: (period) => set({ period }),
      setSalespersonId: (salespersonId) => set({ salespersonId }),
      setTerritoryId: (territoryId) => set({ territoryId }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      reset: () =>
        set({
          period: defaultPeriod(),
          salespersonId: null,
          territoryId: null,
        }),
    }),
    {
      name: "context-storage",
      // Only persist the user-visible context values — not the hasHydrated flag.
      partialize: (state) => ({
        period: state.period,
        salespersonId: state.salespersonId,
        territoryId: state.territoryId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useContextStore;
