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
  // Role comes from Alert itself (T-UX-009): destructive/warning → "alert",
  // everything else → "status". A consumer-provided role still wins via props.
  return (
    <Alert variant={variant} className={className} {...props}>
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}