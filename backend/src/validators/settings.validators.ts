import { z } from "zod";

const KPI_METRICS = ["REVENUE_VS_TARGET", "NEW_CUSTOMERS", "PRODUCT_GROUP", "RETENTION", "CONSISTENCY"] as const;

export const scoringWeightsUpdateSchema = z
  .object({
    weights: z
      .array(
        z.object({
          metric: z.enum(KPI_METRICS),
          weight: z.number().int().nonnegative(),
        })
      )
      .length(5),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (data) => new Set(data.weights.map((w) => w.metric)).size === 5,
    { message: "ต้องระบุน้ำหนักของทั้ง 5 เกณฑ์ ครบและไม่ซ้ำ", path: ["weights"] }
  )
  .refine((data) => data.weights.reduce((sum, w) => sum + w.weight, 0) === 100, {
    message: "น้ำหนักรวมทั้ง 5 เกณฑ์ต้องเท่ากับ 100",
    path: ["weights"],
  });

export const evaluationSettingUpdateSchema = z
  .object({
    churnMonths: z.number().int().positive().optional(),
    minMonthsForChurn: z.number().int().positive().optional(),
    minMonthsForConsistency: z.number().int().positive().optional(),
    aiEnabled: z.boolean().optional(),
    aiAnonymize: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "ไม่มีค่าที่ต้องการแก้ไข" });

export type ScoringWeightsUpdateBody = z.infer<typeof scoringWeightsUpdateSchema>;
export type EvaluationSettingUpdateBody = z.infer<typeof evaluationSettingUpdateSchema>;
