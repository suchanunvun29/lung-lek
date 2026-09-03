import { z } from "zod";
import { basePeriodFields, normalizePeriodNumber, periodNumberIsValid } from "./kpi.validators";
export const territoryViewParamsSchema = z.object({ salespersonId: z.string().min(1) });
export const territoryViewQuerySchema = z.object({ ...basePeriodFields, productTypeId: z.string().min(1).optional(), creditOnly: z.preprocess((value) => value === "true" || value === true, z.boolean().default(false)) }).refine(periodNumberIsValid, { path: ["periodNumber"], message: "periodNumber ไม่ถูกต้อง" }).transform(normalizePeriodNumber);
export type TerritoryViewQuery = z.infer<typeof territoryViewQuerySchema>;

export const neverSoldQuerySchema = z
  .object({
    ...basePeriodFields,
    topN: z.preprocess((v) => (v != null && v !== "" ? Number(v) : 20), z.number().int().positive().default(20)),
    provinceMappingId: z.string().min(1).optional(),
    potentialMetric: z.enum(["BEDS", "CMI", "SUM_ADJ_RW", "OCCUPANCY_RATE", "PATIENTS", "VISITS"]).default("BEDS"),
    productTypeId: z.string().min(1).optional(),
  })
  .refine(periodNumberIsValid, { path: ["periodNumber"], message: "periodNumber ไม่ถูกต้อง" })
  .transform(normalizePeriodNumber);
export type NeverSoldQuery = z.infer<typeof neverSoldQuerySchema>;

