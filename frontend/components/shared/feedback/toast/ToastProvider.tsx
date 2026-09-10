"use client";

/**
 * Toast — T-UX-012 (UX-006, UX-021)
 *
 * ระบบ feedback ชั่วคราวทางเดียวของทั้งแอป: `toast.success(msg)` / `toast.error(msg)`
 * เรียกได้จากทุกที่ (module-level API + hook `useToast()`), provider เดียวที่ AppShell
 * (ข้าง LiveRegion).
 *
 * ช่องทาง screen reader: ทุก toast ประกาศ "ครั้งเดียว" ผ่าน role="status" (success)
 * หรือ role="alert" (error) บนตัว toast เอง — จึง **ห้าม** เรียก `announce()` ซ้ำ
 * สำหรับเหตุการณ์เดียวกัน (call site ที่เคย announce สำเร็จ/ล้มเหลว ให้แทนด้วย toast)
 *
 * กติกา:
 * - auto-dismiss ~4 วินาที, hover/focus ค้าง = หยุดเวลาชั่วคราว, ปิดเองได้ (ปุ่ม X)
 * - stack สูงสุด 3 ใบ (ใหม่ทับเก่า), ข้อความซ้ำที่ยังแสดงอยู่ไม่ถูกเพิ่มซ้ำ (กัน toast flood
 *   เวลากดบันทึกรัว ๆ)
 * - ตำแหน่ง: desktop ขวาล่าง / มือถือ (<sm) บนใต้ header — กันบัง dirty bar และปุ่มบันทึก
 *   ที่ sticky อยู่ล่าง (ทดสอบ 375px ตาม T-UX-012)
 * - z-(--z-toast) (60) สูงกว่า modal/drawer ตามลำดับ overlay ของระบบ (T-UX-019 z-scale)
 */

import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

const AUTO_DISMISS_MS = 4000;
const MAX_STACK = 3;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextToastId = 1;

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function scheduleDismiss(id: number, delay = AUTO_DISMISS_MS) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => dismissToast(id), delay)
  );
}

function pauseAll() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
}

function resumeAll() {
  toasts.forEach((toast) => scheduleDismiss(toast.id));
}

function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

function push(kind: ToastKind, message: string) {
  if (!message) return;
  // Flood guard: ข้อความเดิมที่ยังแสดงอยู่ไม่เพิ่มใบใหม่
  if (toasts.some((toast) => toast.kind === kind && toast.message === message)) return;
  const item: ToastItem = { id: nextToastId++, kind, message };
  // Stack cap: เกิน 3 ใบ = ทิ้งใบเก่าสุด
  toasts = [...toasts, item].slice(-MAX_STACK);
  // ถ้าใบเก่าสุดถูกทิ้ง เคลียร์ timer ค้างของมัน
  timers.forEach((_, id) => {
    if (!toasts.some((toast) => toast.id === id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }
  });
  scheduleDismiss(item.id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

/** Hook API — ค่า stable ทุกตัว เรียกใน useEffect dependency ได้ปลอดภัย */
export function useToast() {
  return React.useMemo(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    []
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>(toasts);

  React.useEffect(() => {
    const listener: ToastListener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Hover/focus ค้างบน toast = หยุด auto-dismiss ชั่วคราว (คืนเมื่อเลาก/blur)
  const handlePause = React.useCallback(() => pauseAll(), []);
  const handleResume = React.useCallback(() => resumeAll(), []);

  return (
    <>
      {children}
      <div
        aria-label="การแจ้งเตือน"
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        onFocus={handlePause}
        onBlur={handleResume}
        className="pointer-events-none fixed inset-x-3 top-16 z-(--z-toast) flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end"
      >
        <ul className="flex w-full flex-col gap-2 sm:w-80" aria-label="รายการแจ้งเตือน">
          {items.map((item) => (
            <li
              key={item.id}
              role={item.kind === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex items-start gap-2 rounded-[var(--radius-md)] border p-3 shadow-[var(--elevation-2)] ${
                item.kind === "error"
                  ? "border-danger/30 bg-danger-subtle text-danger-text"
                  : "border-success/30 bg-success-subtle text-success-text"
              }`}
            >
              {item.kind === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <p className="flex-1 text-sm font-medium">{item.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="ปิดการแจ้งเตือน"
                className="-m-1 rounded p-1 text-current/70 hover:text-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default ToastProvider;
