"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlHistoryMode = "push" | "replace";
export type UrlStateValue = string | number | null | undefined;

/**
 * Shared writer for page-level URL state.
 * Discrete choices use push; debounced text search uses replace.
 * Writes merge with the current query so unrelated deep links stay intact.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setUrlState = useCallback(
    (updates: Record<string, UrlStateValue>, history: UrlHistoryMode = "push") => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }

      const query = next.toString();
      const hash = typeof window === "undefined" ? "" : window.location.hash;
      const href = `${pathname}${query ? `?${query}` : ""}${hash}`;
      const currentQuery = searchParams.toString();
      const currentHref = `${pathname}${currentQuery ? `?${currentQuery}` : ""}${hash}`;
      if (href === currentHref) return;
      router[history](href, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { searchParams, setUrlState };
}
