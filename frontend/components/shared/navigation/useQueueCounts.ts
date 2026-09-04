"use client";

/**
 * useQueueCounts — WACC-P1-015
 *
 * Sidebar queue badges for the two real, actionable backlogs:
 *  - pendingNameReviews:  hospital + salesman name-review queues (ยืนยันชื่อซ้ำ)
 *  - unassignedHospitals: hospitals with no territory (รพ. ที่ยังไม่ผูกเขต)
 *
 * Rules (§14.1 / task WACC-P1-015):
 *  • Counts come from `.length` of the existing list endpoints — no count-only
 *    endpoint is invented. Both lists are fetched in ONE shared request pair.
 *  • Fetched once per session, lazily, after first paint (deferred via
 *    setTimeout) — never per render, never blocking first paint.
 *  • Only fetched for MANAGER — both menu entries are managerOnly, so no other
 *    role can see them and no count is fetched for them.
 *  • A failed request renders NO badge (count stays undefined) — never a zero,
 *    which would falsely say "nothing to do". `loaded` stays false so the next
 *    navigation retries.
 *  • Refreshed (forced) after a decision on /name-reviews or
 *    /territories/unassigned via `refreshQueueCounts`.
 *
 * No polling — navigation-time and decision-time refresh only (§13.4).
 */

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { listHospitalNameReviews, listSalesmanNameReviews } from "@/features/name-reviews";
import { listUnassignedTerritoryHospitals } from "@/features/territories/api/territories.api";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserRole } from "@/lib/types";

export type QueueBadgeKey = "pendingNameReviews" | "unassignedHospitals";

interface QueueCountsState {
  counts: Partial<Record<QueueBadgeKey, number>>;
  loaded: boolean;
  fetching: boolean;
  refresh: (token: string, force?: boolean) => Promise<void>;
}

const useQueueCountsStore = create<QueueCountsState>((set, get) => ({
  counts: {},
  loaded: false,
  fetching: false,
  refresh: async (token, force = false) => {
    if (get().fetching) return;
    if (get().loaded && !force) return;
    set({ fetching: true });
    try {
      const [hospitalReviews, salesmanReviews, unassigned] = await Promise.all([
        listHospitalNameReviews(token),
        listSalesmanNameReviews(token),
        listUnassignedTerritoryHospitals(token),
      ]);
      set({
        counts: {
          pendingNameReviews:
            hospitalReviews.hospitalNameReviews.length + salesmanReviews.salesmanNameReviews.length,
          unassignedHospitals: unassigned.hospitalCount,
        },
        loaded: true,
      });
    } catch {
      // Leave counts untouched (undefined → no badge) and `loaded` false so a
      // later navigation retries; a failed count must never read as zero.
    } finally {
      set({ fetching: false });
    }
  },
}));

/** Force a refetch after a decision consumed queue items on either screen. */
export function refreshQueueCounts(token: string): Promise<void> {
  return useQueueCountsStore.getState().refresh(token, true);
}

/**
 * Sidebar-side hook: returns the badge counts, fetching them once lazily after
 * first paint and only for MANAGER (the only role that can see the entries).
 */
export function useQueueCounts(role: UserRole | undefined): Partial<Record<QueueBadgeKey, number>> {
  const token = useAuthStore((state) => state.token);
  const counts = useQueueCountsStore((state) => state.counts);
  const refresh = useQueueCountsStore((state) => state.refresh);
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (!token || scheduledRef.current) return;
    if (role !== "MANAGER") return;
    scheduledRef.current = true;
    // Defer past first paint — the badge must never delay the sidebar render.
    const timer = window.setTimeout(() => {
      void refresh(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token, role, refresh]);

  return counts;
}

export default useQueueCounts;
