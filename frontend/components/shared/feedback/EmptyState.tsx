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
  isRetrying?: boolean;
  headingLevel?: 2 | 3;
}

export function EmptyState({
  title,
  description,
  variant = "empty",
  action,
  onResetFilters,
  onRetry,
  isRetrying = false,
  headingLevel = 3,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted mb-3"
      >
        {variant === "filtered" ? (
          <span className="text-xl">🔍</span>
        ) : variant === "error" ? (
          <span className="text-xl">⚠️</span>
        ) : (
          <span className="text-xl">📄</span>
        )}
      </div>

      <Heading className="text-base font-medium text-text-primary">{title}</Heading>

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? "กำลังลองใหม่..." : "ลองใหม่อีกครั้ง"}
          </Button>
        )}
      </div>
    </div>
  );
}
