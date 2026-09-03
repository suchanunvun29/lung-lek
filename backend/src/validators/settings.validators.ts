import { z } from "zod";

const KPI_METRICS = ["REVENUE_VS_TARGET", "NEW_CUSTOMERS", "PRODUCT_GROUP", "RETENTION", "CONSISTENCY"] as const;

const POTENTIAL_METRIC_KEYS = ["BEDS", "CMI", "SUM_ADJ_RW", "OCCUPANCY_RATE", "PATIENTS", "VISITS"] as const;

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
    // Module L — Territory & Potential Rules (all bounds follow the column types in design.md)
    potentialMetric: z.enum(POTENTIAL_METRIC_KEYS).optional(),
    minRegionCoverage: z.number().min(0).max(1).optional(),
    targetSuggestionAlpha: z.number().min(0).max(1).optional(),
    targetLookbackMonths: z.number().int().min(1).optional(),
    targetOutlierThreshold: z.number().gt(0).lte(1).optional(),
    targetGrowthRate: z.number().min(0).max(999.999).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "ไม่มีค่าที่ต้องการแก้ไข" });

export const tierWeightsUpdateSchema = z
  .object({
    weights: z
      .array(
        z.object({
          tier: z.string().trim().min(1).max(50),
          weight: z.number().min(0).max(999.999),
        })
      )
      .min(1)
      .refine((weights) => new Set(weights.map((w) => w.tier)).size === weights.length, {
        message: "ระดับโรงพยาบาลซ้ำกัน",
        path: ["weights"],
      }),
  });

export type ScoringWeightsUpdateBody = z.infer<typeof scoringWeightsUpdateSchema>;
export type EvaluationSettingUpdateBody = z.infer<typeof evaluationSettingUpdateSchema>;
export type TierWeightsUpdateBody = z.infer<typeof tierWeightsUpdateSchema>;
