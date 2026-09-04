import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  /** Optional custom id for the control. If omitted, a unique id is generated. */
  id?: string;
  /** Visible label text */
  label: React.ReactNode;
  /** Optional hint/description text beneath label or control */
  hint?: React.ReactNode;
  /** Error message string or node. When present, sets aria-invalid and binds aria-describedby */
  error?: React.ReactNode;
  /** Optional extra className for the outer container */
  className?: string;
  /** Optional indicator whether the field is required */
  required?: boolean;
  /**
   * The form control element. Can be a React element (which will be cloned to attach id,
   * aria-invalid, and aria-describedby) or a render function:
   * (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode
   */
  children:
    | React.ReactElement<Record<string, unknown>>
    | ((props: {
        id: string;
        "aria-invalid"?: boolean;
        "aria-describedby"?: string;
      }) => React.ReactNode);
}

export function FormField({
  id: customId,
  label,
  hint,
  error,
  className,
  required,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = customId || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const isInvalid = Boolean(error);

  const controlProps = {
    id: fieldId,
    ...(isInvalid ? { "aria-invalid": true } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      </div>

      {typeof children === "function" ? (
        children(controlProps)
      ) : React.isValidElement(children) ? (
        React.cloneElement(children, {
          ...controlProps,
          ...children.props,
          id: (children.props as { id?: string }).id || fieldId,
          "aria-invalid":
            (children.props as { "aria-invalid"?: boolean })["aria-invalid"] ??
            controlProps["aria-invalid"],
          "aria-describedby":
            (children.props as { "aria-describedby"?: string })["aria-describedby"] ??
            controlProps["aria-describedby"],
        } as Record<string, unknown>)
      ) : (
        children
      )}

      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs text-[var(--danger)] mt-0.5 font-medium"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
