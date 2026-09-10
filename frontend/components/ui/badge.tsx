import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "border-transparent bg-primary text-primary-fg",
    secondary: "border-transparent bg-surface-subtle text-text-primary",
    destructive: "border-transparent bg-danger-subtle text-danger-text border border-danger/20",
    outline: "text-text-primary border-border bg-surface",
    success: "border-transparent bg-success-subtle text-success-text border border-success/20 font-medium",
    warning: "border-transparent bg-warning-subtle text-warning-text border border-warning/20 font-medium",
    info: "border-transparent bg-info-subtle text-info-text border border-info/20 font-medium",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

