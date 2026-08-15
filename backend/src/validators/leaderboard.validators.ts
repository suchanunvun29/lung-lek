import { z } from "zod";
import {
  PERIOD_NUMBER_VALIDATION_MESSAGE,
  basePeriodFields,
  normalizePeriodNumber,
  periodNumberIsValid,
} from "./kpi.validators";

// Matches design.md's Module F leaderboard criteria: composite score / % of target achieved /
// revenue / new customers.
export const LEADERBOARD_CRITERIA = ["COMPOSITE", "PERCENT_TARGET", "REVENUE", "NEW_CUSTOMERS"] as const;

export const leaderboardQuerySchema = z
  .object({
    criteria: z.enum(LEADERBOARD_CRITERIA),
    ...basePeriodFields,
  })
  .refine(periodNumberIsValid, {
    message: PERIOD_NUMBER_VALIDATION_MESSAGE,
    path: ["periodNumber"],
  })
  .transform(normalizePeriodNumber);

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LeaderboardCriteria = (typeof LEADERBOARD_CRITERIA)[number];
