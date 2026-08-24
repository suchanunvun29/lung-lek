import { z } from "zod";

export const salesmanNameReviewIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const patchSalesmanNameReviewSchema = z.discriminatedUnion("decision", [
  z.object({
    // "คนใหม่จริง" — ยืนยันว่าชื่อนี้ไม่ซ้ำกับใคร ปิดคิวโดยไม่เปลี่ยนข้อมูล
    decision: z.literal("KEPT_SEPARATE"),
    note: z.string().trim().min(1).optional(),
  }),
  z.object({
    // "ซ้ำ" — ย้ายดีล/เครดิต/reference ทั้งหมดไปยังพนักงานเป้าหมายแล้วลบแถวที่ถูกสร้างซ้ำ
    decision: z.literal("MERGED"),
    mergedIntoId: z.string().min(1),
    note: z.string().trim().min(1).optional(),
  }),
]);

export type SalesmanNameReviewIdParams = z.infer<typeof salesmanNameReviewIdParamsSchema>;
export type PatchSalesmanNameReviewBody = z.infer<typeof patchSalesmanNameReviewSchema>;
