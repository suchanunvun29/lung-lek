import React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export interface InlineMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning" | "success" | "info";
  title?: string;
  children: React.ReactNode;
}

export function InlineMessage({
  variant = "default",
  title,
  children,
  className,
  ...props
}: InlineMessageProps) {
  const role = variant === "destructive" ? "alert" : "status";

  return (
    <Alert variant={variant} role={role} className={className} {...props}>
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}