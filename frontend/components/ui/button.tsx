import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "success";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default: "bg-primary text-primary-fg hover:bg-primary-hover shadow-xs",
      secondary: "bg-surface-subtle text-text-primary hover:bg-border border border-border",
      destructive: "bg-danger text-white hover:bg-red-700 shadow-xs",
      outline: "border border-border bg-surface text-text-primary hover:bg-surface-subtle",
      ghost: "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
      link: "text-primary underline-offset-4 hover:underline",
      success: "bg-success text-white hover:bg-emerald-700 shadow-xs",
    };

    const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
      default: "h-9 min-h-11 lg:min-h-9 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs rounded-md min-h-11 lg:min-h-8",
      lg: "h-11 px-8 text-base rounded-md",
      icon: "h-9 w-9 p-0 min-h-11 min-w-11 lg:min-h-9 lg:min-w-9",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

