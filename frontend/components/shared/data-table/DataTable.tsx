"use client";

/**
 * DataTable — WACC-P0-017
 *
 * The one table component for the whole product: client-side sorting and search,
 * sticky header, optional frozen first column, density, column priority, and a
 * mobile card fallback — so screens stop each hand-rolling `<table>`.
 * It supersedes `components/ui/table.tsx` as the table surface (that file has no
 * consumers and remains untouched); `Pagination` is absorbed as an internal part
 * and stays exported from its own file for direct users.
 *
 * ── Data rules (behavior preservation) ────────────────────────────────────────
 * • Sorting and search operate ONLY on rows already fetched. No query parameter
 *   is invented — no endpoint accepts a sort or search parameter today.
 * • `serverPaginated`: the screen owns paging (e.g. /sales-lines). DataTable
 *   renders `Pagination` wired to `page`/`pageSize`/`total`/`onPageChange` and
 *   DISABLES its own sort and search UI — sorting one page of a server-paginated
 *   set is a lie. Pass `pageSize` WITHOUT `serverPaginated` for client-side paging.
 * • Money values are rendered, never recomputed: a money column's `render` calls
 *   `formatMoney(row.x)`; DataTable never arithmetically combines cell values.
 * • A restricted cell renders `RestrictedValue` (WACC-P0-020) inside its `render`
 *   and branches on the server row's `visibility` field only — never on a value
 *   being null/empty/zero.
 * • Loading/error states are driven by the screen (typically through
 *   `useAbortableEffect` + `request(path, { signal })` from WACC-P0-021, so a
 *   stale response never renders): pass `loading`, `error`, `onRetry` through.
 *
 * ── Responsive ────────────────────────────────────────────────────────────────
 * • ≥1280px (xl): all columns. 1024–1279px (lg): priority-3 hidden.
 * • 768–1023px (md): priority-2 also hidden — still a table.
 * • <768px: each row renders as a card built from `mobileRole` — identity line,
 *   one key metric, the `rowAction` if provided, everything else behind an
 *   expand toggle. No horizontal page scroll, no nested scroll containers.
 *
 * ── A11y ─────────────────────────────────────────────────────────────────────
 * sr-only `<caption>`, `scope="col"` headers, `aria-sort` on the sorted header
 * with a `<button>` inside the `<th>`, and `aria-live="polite"` on the results
 * container with a visually-hidden count announcement.
 */

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { SkeletonTable } from "@/components/shared/feedback/Skeleton";
import { Pagination } from "./Pagination";
import { cn } from "@/lib/utils";

export type DataTableMobileRole = "identity" | "metric" | "meta" | "hidden";

export interface DataTableColumn<Row> {
  /** Stable key — used for sorting state, defaults, and React keys. */
  key: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Client-side sort toggle. Ignored when `serverPaginated`. */
  sortable?: boolean;
  /** Value used for sorting; defaults to the row's `key` field. Nulls sort last. */
  sortValue?: (row: Row) => string | number | null;
  /** 1 = table column from 768px up; 2 = from 1024px; 3 = from 1280px. Default 2. */
  priority?: 1 | 2 | 3;
  /** Numeric columns are right-aligned and tabular (`font-numeric`). */
  numeric?: boolean;
  /** Role in the <768px card. Default "meta" (behind the expand toggle). */
  mobileRole?: DataTableMobileRole;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string | number;
  /** Read by screen readers via a sr-only <caption>; not displayed. */
  caption: string;
  /** Row height: "default" = 40px, "comfortable" = 48px (§15.6). */
  density?: "default" | "comfortable";
  loading?: boolean;
  /** Translated error message; renders EmptyState(error) with `onRetry`. */
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Renders the client-side search input. Ignored when `serverPaginated`. */
  searchable?: boolean;
  /** Row matches the (lower-cased) query; defaults to matching any column's raw `key` value. */
  searchPredicate?: (row: Row, query: string) => boolean;
  searchPlaceholder?: string;
  /** Server-paginated mode: disables sort/search UI and renders the wired Pagination. */
  serverPaginated?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  /** Freeze the first column (sticky left) for wide grids. */
  frozenFirstColumn?: boolean;
  /** The card's single primary action on <768px (e.g. a detail link). */
  rowAction?: (row: Row) => React.ReactNode;
  className?: string;
}

type SortDirection = "asc" | "desc";

interface SortState {
  key: string;
  direction: SortDirection;
}

const PRIORITY_CLASS: Record<1 | 2 | 3, string> = {
  1: "",
  2: "hidden lg:table-cell",
  3: "hidden xl:table-cell",
};

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  density = "default",
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "ไม่มีข้อมูล",
  emptyDescription,
  searchable = false,
  searchPredicate,
  searchPlaceholder = "ค้นหา…",
  serverPaginated = false,
  page,
  pageSize,
  total,
  onPageChange,
  frozenFirstColumn = false,
  rowAction,
  className,
}: DataTableProps<Row>) {
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [query, setQuery] = React.useState("");
  const [clientPage, setClientPage] = React.useState(1);
  const [expandedCardIds, setExpandedCardIds] = React.useState<Set<string>>(new Set());

  const normalizedQuery = query.trim().toLowerCase();
  const searchEnabled = searchable && !serverPaginated;
  const clientPaginated = !serverPaginated && typeof pageSize === "number" && pageSize > 0;

  const sortedRows = React.useMemo(() => {
    if (serverPaginated || !sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortable) return rows;
    const getSortValue =
      column.sortValue ?? ((row: Row) => (row as Record<string, unknown>)[column.key] as string | number | null);
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls last regardless of direction
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "th") * factor;
    });
  }, [rows, sort, columns, serverPaginated]);

  const filteredRows = React.useMemo(() => {
    if (!searchEnabled || normalizedQuery === "") return sortedRows;
    const predicate =
      searchPredicate ??
      ((row: Row, q: string) =>
        columns.some((column) => {
          const value = (row as Record<string, unknown>)[column.key];
          return value != null && String(value).toLowerCase().includes(q);
        }));
    return sortedRows.filter((row) => predicate(row, normalizedQuery));
  }, [sortedRows, searchEnabled, normalizedQuery, searchPredicate, columns]);

  const totalAfterClientPaging = clientPaginated ? filteredRows.length : undefined;
  const clientTotalPages = totalAfterClientPaging !== undefined && pageSize
    ? Math.max(1, Math.ceil(totalAfterClientPaging / pageSize))
    : 1;
  const safeClientPage = Math.min(clientPage, clientTotalPages);

  const visibleRows = React.useMemo(() => {
    if (!clientPaginated || !pageSize) return filteredRows;
    return filteredRows.slice((safeClientPage - 1) * pageSize, safeClientPage * pageSize);
  }, [filteredRows, clientPaginated, pageSize, safeClientPage]);

  function toggleSort(columnKey: string) {
    setClientPage(1);
    setSort((current) => {
      if (current?.key !== columnKey) return { key: columnKey, direction: "asc" };
      return { key: columnKey, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function toggleCardExpanded(rowKey: string) {
    setExpandedCardIds((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  const rowHeightClass = density === "comfortable" ? "h-12" : "h-10";

  const isFilteredEmpty = !serverPaginated && normalizedQuery !== "" && filteredRows.length === 0;

  const showServerPagination =
    serverPaginated && page !== undefined && pageSize !== undefined && total !== undefined && !!onPageChange;
  const showClientPagination = clientPaginated && !loading && !error && filteredRows.length > 0;

  const identityColumns = columns.filter((c) => c.mobileRole === "identity");
  const metricColumn = columns.find((c) => c.mobileRole === "metric");
  const cardDetailColumns = columns.filter(
    (c) => c.mobileRole === "meta" || (c.mobileRole === "metric" && c !== metricColumn)
  );

  return (
    <div className={className}>
      {searchEnabled && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setClientPage(1);
              }}
              placeholder={searchPlaceholder}
              aria-label="ค้นหาในตาราง"
              className="pl-8"
            />
          </div>
          {normalizedQuery !== "" && (
            <p className="text-xs text-text-muted">
              พบ {filteredRows.length.toLocaleString("th-TH")} รายการ
            </p>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={6} columns={columns.length} />
      ) : error ? (
        <EmptyState
          variant="error"
          title="เกิดข้อผิดพลาดในการโหลดข้อมูล"
          description={error}
          onRetry={onRetry}
        />
      ) : visibleRows.length === 0 ? (
        isFilteredEmpty ? (
          <EmptyState
            variant="filtered"
            title="ไม่พบรายการที่ตรงกับการค้นหา"
            description={`ไม่มีรายการที่ตรงกับ "${query.trim()}"`}
            onResetFilters={() => setQuery("")}
          />
        ) : (
          <EmptyState variant="empty" title={emptyTitle} description={emptyDescription} />
        )
      ) : (
        <div aria-live="polite">
          <p className="sr-only">
            {serverPaginated
              ? `ทั้งหมด ${(total ?? 0).toLocaleString("th-TH")} รายการ หน้า ${page}`
              : `แสดง ${visibleRows.length.toLocaleString("th-TH")} จาก ${rows.length.toLocaleString("th-TH")} รายการ`}
          </p>

          {/* Table — 768px up. Sticky header + optional frozen first column live
              inside this scroll container, so both work wherever the grid scrolls. */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface md:block">
            <table className="min-w-full divide-y divide-border text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  {columns.map((column, index) => {
                    const isSorted = sort?.key === column.key;
                    const ariaSort = isSorted
                      ? sort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined;
                    const alignClass =
                      column.align === "right" || column.numeric
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left";
                    const frozen = frozenFirstColumn && index === 0;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={ariaSort}
                        className={cn(
                          "sticky top-0 z-10 bg-surface-subtle px-3 align-middle font-medium text-text-secondary",
                          rowHeightClass,
                          alignClass,
                          PRIORITY_CLASS[column.priority ?? 2],
                          frozen && "left-0 z-20 border-r border-border"
                        )}
                      >
                        {column.sortable && !serverPaginated ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key)}
                            className="inline-flex cursor-pointer items-center gap-1 hover:text-text-primary"
                          >
                            {column.header}
                            {isSorted ? (
                              sort?.direction === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => {
                  const rowKey = String(getRowId(row));
                  return (
                    <tr key={rowKey} className="group hover:bg-surface-subtle">
                      {columns.map((column, index) => {
                        const alignClass =
                          column.align === "right" || column.numeric
                            ? "text-right"
                            : column.align === "center"
                              ? "text-center"
                              : "text-left";
                        const frozen = frozenFirstColumn && index === 0;
                        return (
                          <td
                            key={column.key}
                            className={cn(
                              "px-3 align-middle text-text-primary",
                              rowHeightClass,
                              alignClass,
                              column.numeric && "font-numeric",
                              PRIORITY_CLASS[column.priority ?? 2],
                              frozen && "sticky left-0 z-[1] bg-surface border-r border-border group-hover:bg-surface-subtle"
                            )}
                          >
                            {column.render(row)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — below 768px. Identity line, one metric, one primary action,
              everything else behind an expand toggle. */}
          <div className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {visibleRows.map((row) => {
              const rowKey = String(getRowId(row));
              const detailsId = `card-details-${rowKey}`;
              const expanded = expandedCardIds.has(rowKey);
              const action = rowAction?.(row);
              return (
                <div key={rowKey} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {identityColumns.map((column) => (
                        <div key={column.key}>{column.render(row)}</div>
                      ))}
                    </div>
                    {metricColumn && (
                      <div
                        className={cn(
                          "shrink-0 text-right",
                          metricColumn.numeric && "font-numeric"
                        )}
                      >
                        {metricColumn.render(row)}
                      </div>
                    )}
                  </div>

                  {action && <div className="mt-3">{action}</div>}

                  {cardDetailColumns.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        onClick={() => toggleCardExpanded(rowKey)}
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary"
                      >
                        รายละเอียดเพิ่มเติม
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                      {expanded && (
                        <dl id={detailsId} className="mt-2 space-y-2">
                          {cardDetailColumns.map((column) => (
                            <div key={column.key} className="flex items-start justify-between gap-3">
                              <dt className="min-w-0 text-xs text-text-muted">{column.header}</dt>
                              <dd
                                className={cn(
                                  "min-w-0 text-right text-sm text-text-primary",
                                  column.numeric && "font-numeric"
                                )}
                              >
                                {column.render(row)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showServerPagination && (
        <div className="mt-4">
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
        </div>
      )}
      {showClientPagination && (
        <div className="mt-4">
          <Pagination
            page={safeClientPage}
            pageSize={pageSize}
            total={totalAfterClientPaging ?? 0}
            onPageChange={setClientPage}
          />
        </div>
      )}
    </div>
  );
}

export default DataTable;
