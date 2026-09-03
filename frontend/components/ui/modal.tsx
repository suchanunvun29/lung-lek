import * as React from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the modal panel — defaults to a small form-sized modal. */
  widthClassName?: string;
}

export function Modal({ title, onClose, children, widthClassName = "max-w-md" }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={cn("w-full rounded-lg bg-white p-6 shadow-lg border border-slate-200", widthClassName)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-sm p-1 transition-colors cursor-pointer"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
