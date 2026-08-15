import { z } from "zod";
import {
  PERIOD_NUMBER_VALIDATION_MESSAGE,
  basePeriodFields,
  normalizePeriodNumber,
  periodNumberIsValid,
} from "./kpi.validators";

export const generateInsightBodySchema = z
  .object(basePeriodFields)
  .refine(periodNumberIsValid, { message: PERIOD_NUMBER_VALIDATION_MESSAGE, path: ["periodNumber"] })
  .transform(normalizePeriodNumber);

export type GenerateInsightBody = z.infer<typeof generateInsightBodySchema>;
