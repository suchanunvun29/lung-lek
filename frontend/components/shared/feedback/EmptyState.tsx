import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  variant?: "empty" | "filtered" | "error";
  action?: React.ReactNode;
  onResetFilters?: () => void;
  onRetry?: () => void;
}

export function EmptyState({
  title,
  description,
  variant = "empty",
  action,
  onResetFilters,
  onRetry,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted mb-3">
        {variant === "filtered" ? (
          <span className="text-xl">🔍</span>
        ) : variant === "error" ? (
          <span className="text-xl">⚠️</span>
        ) : (
          <span className="text-xl">📄</span>
        )}
      </div>

      <h3 className="text-base font-medium text-text-primary">{title}</h3>

      {description && (
        <p className="mt-1.5 text-sm text-text-muted max-w-sm">{description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {action}
        {variant === "filtered" && onResetFilters && (
          <Button type="button" variant="outline" size="sm" onClick={onResetFilters}>
            ล้างตัวกรอง
          </Button>
        )}
        {variant === "error" && onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            ลองใหม่อีกครั้ง
          </Button>
        )}
      </div>
    </div>
  );
}