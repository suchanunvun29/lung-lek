import * as React from "react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning" | "success" | "info";
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  const variantStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
    default: "bg-surface-subtle text-text-primary border-border",
    destructive: "bg-danger-subtle text-danger border-danger/20",
    warning: "bg-warning-subtle text-warning border-warning/20",
    success: "bg-success-subtle text-success border-success/20",
    info: "bg-info-subtle text-info border-info/20",
  };

  return (
    <div
      role="alert"
      className={cn("relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4", variantStyles[variant], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

