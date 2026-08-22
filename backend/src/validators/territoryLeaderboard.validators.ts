import { z } from "zod"; import { basePeriodFields, normalizePeriodNumber, periodNumberIsValid } from "./kpi.validators";
export const territoryLeaderboardQuerySchema=z.object({criteria:z.enum(["COMPOSITE","PERCENT_TARGET","REVENUE","NEW_CUSTOMERS"]),...basePeriodFields}).refine(periodNumberIsValid,{path:["periodNumber"],message:"periodNumber ไม่ถูกต้อง"}).transform(normalizePeriodNumber);
export const territoryLeaderboardDrillParams=z.object({territoryId:z.string().min(1)}); export type TerritoryLeaderboardQuery=z.infer<typeof territoryLeaderboardQuerySchema>;
