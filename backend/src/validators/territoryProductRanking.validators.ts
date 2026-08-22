import { z } from "zod";
import { basePeriodFields, normalizePeriodNumber, periodNumberIsValid } from "./kpi.validators";
export const territoryProductParamsSchema = z.object({ territoryId: z.string().min(1) });
export const territoryProductQuerySchema = z.object(basePeriodFields).refine(periodNumberIsValid, { path: ["periodNumber"], message: "periodNumber ไม่ถูกต้อง" }).transform(normalizePeriodNumber);
export type TerritoryProductQuery = z.infer<typeof territoryProductQuerySchema>;
