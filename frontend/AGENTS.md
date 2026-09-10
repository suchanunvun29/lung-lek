<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UX Conventions — กติกาที่โค้ดปัจจุบันรองรับจริง

ทุกข้อในนี้อ้าง component/hook ที่มีอยู่จริงและใช้งานอยู่ **แก้เอกสารนี้พร้อมแก้โค้ดเสมอ** — ถ้าโค้ดเปลี่ยนแล้วเอกสารไม่ตาม เอกสารฉบับนี้ถือว่าใช้ไม่ได้

## 1. Error / Retry (ทุกหน้าโหลดข้อมูล)

- **ทำ:** ส่ง `loading` / `error` / `onRetry` ให้ `DataTable` — มัน render `SkeletonTable` (กำลังโหลด) และ `EmptyState variant="error"` + ปุ่ม retry ให้เอง ป้องกัน double-click ด้วย `isRetrying`
- **ทำ:** ข้อความ error มาจาก `getErrorMessage()` (`lib/api-client.ts`) เสมอ — ผู้ใช้ต้องเห็นไทย ห้ามส่ง error อังกฤษดิบขึ้นจอ
- **ทำ:** error ของ action รอง (save/unlink ที่ไม่ใช่การโหลดทั้งหน้า) แสดงผ่าน `InlineMessage` แยกจาก error ของการโหลด
- **ห้าม:** swallow error เงียบ ๆ, เขียน `loadError && <p>…</p>` เอง, ปล่อย retry กดรัว (ต้อง disable ขณะ retry)

## 2. Abort (การโหลดข้อมูลทุกจุด)

- **ทำ:** ทุก read API function รับ `signal?: AbortSignal` และส่งต่อให้ `request()` — หน้า fetch ผ่าน `useAbortableEffect` (`lib/useAbortableEffect.ts`) เสมอ เพื่อให้ response เก่าจาก filter/filter ที่เปลี่ยนรัว ๆ ไม่ render ทับ
- **ห้าม:** ต่อ signal ให้ mutation/save call (มีของค้างกลางทางไม่ได้)
- **ทำ:** request ที่โดน abort = เงียบ (`isAbortError` จาก `lib/api-client.ts` — ไม่ใช่ failure ไม่ต้อง toast)

## 3. Confirmation 3 ระดับ (ทุก write)

ตาม `_docs/planning/CONFIRMATION-POLICY.md` — ใช้ `ConfirmDialog` (`components/shared/feedback/ConfirmDialog.tsx`) เป็นตัวเดียว:

- **ระดับ 1** reversible → ทำได้เลย + toast (เช่น ผูกบัญชีใหม่, toggle)
- **ระดับ 2** เขียนทับ/กระทบหลายรายการ → `ConfirmDialog` + `consequence` บอกผลชัด (เช่น copy แบบ overwrite, รับข้อเสนอเขต)
- **ระดับ 3** ไม่มี undo/กระทบกว้าง → `ConfirmDialog` + `requireTypedConfirmation` (เช่น import REPLACE/PERIOD_DELETE)

## 4. Toast / success feedback (ช่องทางเดียวของระบบ)

- **ทำ:** `toast.success(msg)` / `toast.error(msg)` จาก `components/shared/feedback/toast/ToastProvider.tsx` — auto-dismiss ~4s, สูงสุด 3 ใบ, ข้อความซ้ำที่ยังแสดงอยู่ถูกดรอปเอง
- **ห้าม:** เรียก `announce()` ซ้ำสำหรับเหตุการณ์เดียวกัน — toast ประกาศ SR เองผ่าน role บนตัว toast (`status`/`alert`) แล้ว
- **ทำ:** export ใช้ `ExportButton` เป็นตัวเดียว (pending/success/failure ครบ, failure ผ่าน `InlineMessage` + `getErrorMessage`, AbortError ไม่ใช่ failure)

## 5. Never first in list (WACC-P1-004)

- **ห้าม:** default เงียบ ๆ เป็นรายการแรกของลิสต์ที่โหลดมา — ไม่มี subject เลือก → แสดง chooser / EmptyState "กรุณาเลือก"
- **ทำ:** auto-select ได้เฉพาะตัวที่ "เป็นของผู้ใช้เอง" เท่านั้น (แบบ ContextBar หา salesperson ของตัวเอง) — ตัวอย่างที่ทำถูก: `dashboard/page.tsx`, `performance/individual/page.tsx`

## 6. ห้าม raw palette — ใช้ token จาก `app/globals.css` เท่านั้น

- สีสถานะ: `text-success-text` / `text-warning-text` / `text-danger-text` / `text-info-text` บน `-subtle` ของคู่มัน (AA แล้ว — อย่าใช้ `text-emerald-700` แบบนั้น)
- hover ของปุ่มสีทึบ: `hover:bg-danger-hover` / `hover:bg-success-hover`
- scrim overlay ทุกชั้น: `bg-scrim` (ห้าม `bg-black/40` หรือ `bg-foreground/40` เอง)
- touch target: `min-h-(--touch-target) min-w-(--touch-target)` (44px มือถือ, desktop ย่อด้วย `lg:`/`sm:` ที่ระบุชัด) — ปุ่มเล็กที่ขยายไม่ได้ใช้ hit-area แบบ `after:-inset-2.5`
- z-index ใช้ ladder ตัวเดียว: `z-(--z-table-header)` < `z-(--z-nav)` < `z-(--z-drawer)` < `z-(--z-modal)` < `z-(--z-toast)` < `z-(--z-block)` — **ห้าม** เลข z ลอย ๆ (`z-50`, `z-[100]`)

## 7. Accessibility (lint บังคับ + ของที่ lint จับไม่ได้)

- `eslint-plugin-jsx-a11y` (ชุด recommended) เปิดอยู่และ fail build — **ห้าม** ปิด rule ทั้งระบบ; ถ้าจำเป็นต้อง disable รายจุด ต้องมี `TODO(a11y):` + เหตุผล
- dialog/overlay ทุกตัวผ่าน `useDialogA11y` (`lib/useDialogA11y.ts`) — trap + Escape + restore focus (อย่าเขียนเอง); primitive ที่ทำไว้แล้ว: `Modal`, `FilterDrawer`, Sidebar drawer
- ring ตอน focus ใช้ `focus-visible:` เท่านั้น (ไม่ใช่ `focus:`)
- reduced-motion: global CSS จัดการแล้ว — อย่าเพิ่ม animation ใหม่ที่ข้ามมันไม่ได้
- รัน `npm run a11y` (axe smoke เทียบ `scripts/a11y-baseline.json`) หลังแตะหน้าหลัก — violation ใหม่ = ต้องแก้ ไม่ใช่ update baseline

## 8. Page title (ต่อหน้า)

- **ทำ:** export `metadata` จาก `layout.tsx`/`page.tsx` ของแต่ละ route (root layout มี `title.template "%s · ระบบประเมินพนักงานขาย"`)
- **ห้าม:** hook ที่เขียน `document.title` เอง — Next 16 + React 19 ระบบ metadata จะเขียนทับหลัง hydration (พิสูจน์แล้วใน T-UX-007 ว่าแก้ด้วย timer ไม่ได้)

## 9. ทางเดียวของ design system (ห้าม hand-roll ซ้ำ)

ตาราง = `DataTable` (pagination อยู่ข้างใน — ไม่มี import ตรง) · badge สถานะ = `StatusBadge` · primitives = `components/ui/*` · overlay = `Modal`/`FilterDrawer` · ตัวเลือกงวด = `PeriodSelector` (`components/shared/layout/`) · คิวแจ้งเตือน = `useQueueCounts` — ก่อนเขียน UI ใหม่ หาของเดิมก่อนเสมอ
