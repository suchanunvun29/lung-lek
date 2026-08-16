import { z } from "zod";

const SHARE_PERCENT_TOTAL = 100;
const SHARE_PERCENT_EPSILON = 0.001;

export const salesmanNameRuleIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const patchSalesmanNameRuleSchema = z
  .object({
    members: z
      .array(
        z.object({
          salespersonId: z.string().min(1),
          sharePercent: z.number().positive().max(SHARE_PERCENT_TOTAL),
        })
      )
      .min(1),
  })
  .refine(
    (data) => Math.abs(data.members.reduce((sum, m) => sum + m.sharePercent, 0) - SHARE_PERCENT_TOTAL) <= SHARE_PERCENT_EPSILON,
    { message: "ผลรวม sharePercent ของสมาชิกต้องเท่ากับ 100 พอดี", path: ["members"] }
  )
  .refine((data) => new Set(data.members.map((m) => m.salespersonId)).size === data.members.length, {
    message: "salespersonId ในสมาชิกห้ามซ้ำกัน",
    path: ["members"],
  });

export type SalesmanNameRuleIdParams = z.infer<typeof salesmanNameRuleIdParamsSchema>;
export type PatchSalesmanNameRuleBody = z.infer<typeof patchSalesmanNameRuleSchema>;
