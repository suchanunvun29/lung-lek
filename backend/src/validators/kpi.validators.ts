import { z } from "zod";

export const basePeriodFields = {
  periodType: z.enum(["MONTH", "QUARTER", "YEAR"]),
  year: z.coerce.number().int(),
  periodNumber: z.coerce.number().int().optional(),
};

export function periodNumberIsValid(data: { periodType: string; periodNumber?: number }): boolean {
  if (data.periodType === "MONTH") {
    return data.periodNumber !== undefined && data.periodNumber >= 1 && data.periodNumber <= 12;
  }
  if (data.periodType === "QUARTER") {
    return data.periodNumber !== undefined && data.periodNumber >= 1 && data.periodNumber <= 4;
  }
  return true;
}

export function normalizePeriodNumber<T extends { periodType: string; periodNumber?: number }>(data: T) {
  return { ...data, periodNumber: data.periodType === "YEAR" ? 0 : data.periodNumber! };
}

export const PERIOD_NUMBER_VALIDATION_MESSAGE = "periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)";

export const periodQuerySchema = z
  .object(basePeriodFields)
  .refine(periodNumberIsValid, {
    message: "periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)",
    path: ["periodNumber"],
  })
  .transform(normalizePeriodNumber);

export const drillDownQuerySchema = z
  .object({ ...basePeriodFields, hospitalId: z.string().min(1).optional() })
  .refine(periodNumberIsValid, {
    message: "periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)",
    path: ["periodNumber"],
  })
  .transform(normalizePeriodNumber);

export const salespersonIdParamsSchema = z.object({
  salespersonId: z.string().min(1),
});

const SCORED_METRICS = ["REVENUE_VS_TARGET", "NEW_CUSTOMERS", "PRODUCT_GROUP", "RETENTION", "CONSISTENCY"] as const;
const SUPPLEMENTARY_METRICS = [
  "ACTIVE_CUSTOMERS",
  "CHURNED_CUSTOMERS",
  "PRODUCT_PENETRATION",
  "REVENUE_BY_HOSPITAL",
  "MONTHLY_TREND",
] as const;

export const drillDownMetricSchema = z.enum([...SCORED_METRICS, ...SUPPLEMENTARY_METRICS]);

export const drillDownParamsSchema = z.object({
  salespersonId: z.string().min(1),
  metric: drillDownMetricSchema,
});

export type PeriodQuery = z.infer<typeof periodQuerySchema>;
export type DrillDownQuery = z.infer<typeof drillDownQuerySchema>;
export type SalespersonIdParams = z.infer<typeof salespersonIdParamsSchema>;
export type DrillDownParams = z.infer<typeof drillDownParamsSchema>;
export type DrillDownMetric = z.infer<typeof drillDownMetricSchema>;

export const SCORED_METRIC_SET = new Set<string>(SCORED_METRICS);
