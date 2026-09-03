import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

export function Spinner({ className, size = "default", ...props }: SpinnerProps) {
  const sizeStyles: Record<NonNullable<SpinnerProps["size"]>, string> = {
    sm: "h-4 w-4 border-2",
    default: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-3",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-blue-600 border-t-transparent inline-block",
        sizeStyles[size],
        className
      )}
      role="status"
      aria-label="กำลังโหลด"
      {...props}
    />
  );
}
