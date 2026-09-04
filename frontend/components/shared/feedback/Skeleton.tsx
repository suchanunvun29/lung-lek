import * as React from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      className={cn("animate-pulse rounded-md bg-surface-subtle", className)}
      {...props}
    />
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 5, className }: SkeletonTableProps) {
  return (
    <div
      aria-busy="true"
      className={cn("w-full overflow-hidden rounded-lg border border-border bg-surface", className)}
    >
      {/* Desktop table skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-subtle">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-3 py-3 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="h-10">
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c} className="px-3 py-2">
                    <Skeleton className={cn("h-4", c === 0 ? "w-32" : "w-16")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card skeleton (<768px) */}
      <div className="md:hidden divide-y divide-border p-3 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 space-y-2 bg-surface rounded-md border border-border">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-48" />
            <div className="pt-2 flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn("rounded-lg border border-border bg-surface p-4 space-y-3", className)}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

export function SkeletonKpiRow({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}
    >
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}