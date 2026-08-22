import { z } from "zod";
import { basePeriodFields, normalizePeriodNumber, periodNumberIsValid } from "./kpi.validators";
export const territoryViewParamsSchema = z.object({ salespersonId: z.string().min(1) });
export const territoryViewQuerySchema = z.object({ ...basePeriodFields, productTypeId: z.string().min(1).optional(), creditOnly: z.preprocess((value) => value === "true" || value === true, z.boolean().default(false)) }).refine(periodNumberIsValid, { path: ["periodNumber"], message: "periodNumber ไม่ถูกต้อง" }).transform(normalizePeriodNumber);
export type TerritoryViewQuery = z.infer<typeof territoryViewQuerySchema>;
