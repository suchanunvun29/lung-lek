import { z } from "zod";
import { SCORED_METRICS } from "./kpi.validators";

export const territoryIdParamsSchema = z.object({
  territoryId: z.string().min(1),
});

export const territoryDrillDownParamsSchema = z.object({
  territoryId: z.string().min(1),
  metric: z.enum(SCORED_METRICS),
});

export type TerritoryIdParams = z.infer<typeof territoryIdParamsSchema>;
export type TerritoryDrillDownParams = z.infer<typeof territoryDrillDownParamsSchema>;
